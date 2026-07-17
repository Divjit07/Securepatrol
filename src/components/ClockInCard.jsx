// Geofenced Face ID clock card (guard dashboard). Watches GPS, shows live
// distance to the site, and arms the clock-in button only inside the geofence.
// Clock-OUT works from anywhere — the punch is recorded with GPS for audit but
// never blocked by the fence (server trigger agrees since migration 031).
// The whole card is a traffic light: grey = off duty, yellow = 15-min early
// window, green = clocked in (on duty), red = late for clock-in / overdue out.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanFace, MapPin, LocateFixed, Nfc } from 'lucide-react'
import {
  passkeySupported,
  hasEnrolledPasskey,
  enrollPasskey,
  verifyWithPasskey,
} from '../lib/passkeys.js'
import { fetchSiteGeofence, geofenceStatus, clockPunch } from '../lib/clockPunch.js'
import { getOptionalPosition } from '../lib/gps.js'

const EARLY_WINDOW_MIN = 15 // clock-in opens this many minutes before the shift
const LATE_GRACE_MIN = 10 // matches the roster-alerts "late" threshold
const EARLY_OUT_GRACE_MIN = 5 // last N minutes of shift = normal clock-out, no note

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Today's shift window from the published roster only.
 *  Site operating hours are NOT used — guards only see times admin published.
 *  (Exported for the /dev/scale logic tests.) */
export function shiftWindow(publishedShift, _scheduled, _date) {
  if (publishedShift?.starts_at && publishedShift?.ends_at) {
    return { start: new Date(publishedShift.starts_at), end: new Date(publishedShift.ends_at) }
  }
  return null
}

/** Traffic-light state for the punch button vs. the schedule.
 *  (Exported for the /dev/scale logic tests.) */
export function punchState(type, window, now = new Date()) {
  if (!window) return { tone: type === 'out' ? 'green' : 'grey', allowed: true, note: null }
  const min = 60_000
  if (type === 'in') {
    // Shift already over → not "late", the day is done. Caller fills in the
    // next-shift details.
    if (now > new Date(window.end.getTime() + LATE_GRACE_MIN * min)) {
      return { tone: 'grey', allowed: false, shiftOver: true, note: null }
    }
    const opensAt = new Date(window.start.getTime() - EARLY_WINDOW_MIN * min)
    if (now < opensAt) {
      return { tone: 'grey', allowed: false, note: `Clock-in opens at ${fmtTime(opensAt)} (15 min before your ${fmtTime(window.start)} shift).` }
    }
    if (now < window.start) {
      return { tone: 'yellow', allowed: true, note: `You’re early — shift starts at ${fmtTime(window.start)}.` }
    }
    if (now <= new Date(window.start.getTime() + LATE_GRACE_MIN * min)) {
      return { tone: 'green', allowed: true, note: null }
    }
    return { tone: 'red', allowed: true, note: `You’re running late — shift started at ${fmtTime(window.start)}. Clock in now.` }
  }
  // clock-out — always allowed, from anywhere
  if (now < new Date(window.end.getTime() - EARLY_WINDOW_MIN * min)) {
    return { tone: 'green', allowed: true, note: `On duty — your shift runs until ${fmtTime(window.end)}.` }
  }
  if (now <= new Date(window.end.getTime() + LATE_GRACE_MIN * min)) {
    return { tone: 'green', allowed: true, note: null }
  }
  return { tone: 'red', allowed: true, note: `Shift ended at ${fmtTime(window.end)} — clock out now.` }
}

const TONE_BUTTON = {
  grey: 'bg-white/10 text-ink-3',
  yellow: 'bg-[#FACC15] text-[#422006] hover:brightness-105',
  green: 'bg-[#22C55E] text-[#052E16] hover:brightness-105',
  red: 'bg-[#EF4444] text-white hover:brightness-105',
}

// Card-level traffic light: border tint + status pill.
const TONE_CARD = {
  grey: { ring: 'border-white/10', pill: 'bg-white/10 text-ink-2', label: 'Off duty' },
  yellow: { ring: 'border-[#FACC15]/50', pill: 'bg-[#FACC15]/15 text-[#FACC15]', label: 'Early window' },
  green: { ring: 'border-[#22C55E]/50', pill: 'bg-[#22C55E]/15 text-[#22C55E]', label: 'On duty' },
  red: { ring: 'border-[#EF4444]/50', pill: 'bg-[#EF4444]/15 text-[#EF4444]', label: 'Late' },
}

/** "Next shift: Tomorrow 9:00 PM at Site — clock-in opens 8:45 PM." */
function nextShiftLine(nextShift) {
  if (!nextShift?.starts_at) return null
  const start = new Date(nextShift.starts_at)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const same = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const day = same(start, today)
    ? 'today'
    : same(start, tomorrow)
      ? 'tomorrow'
      : start.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
  const opens = new Date(start.getTime() - EARLY_WINDOW_MIN * 60_000)
  const siteName = nextShift.sites?.name ? ` at ${nextShift.sites.name}` : ''
  return `Next shift: ${day} ${fmtTime(start)}${siteName} — clock-in opens ${fmtTime(opens)}.`
}

export default function ClockInCard({ guardId, siteId, clockedIn, onPunched, publishedShift, scheduled, date, nextShift }) {
  const [enrolled, setEnrolled] = useState(null) // null = checking
  const [site, setSite] = useState(null)
  const [position, setPosition] = useState(null)
  const [gpsError, setGpsError] = useState(null)
  const [busy, setBusy] = useState(null) // 'enrolling' | 'punching'
  const [message, setMessage] = useState(null) // { tone: 'success'|'error', text }
  const [confirmingOut, setConfirmingOut] = useState(false) // early clock-out gate
  const [outNote, setOutNote] = useState('')
  const watchIdRef = useRef(null)

  const supported = passkeySupported()

  useEffect(() => {
    if (!guardId || !supported) return
    hasEnrolledPasskey(guardId).then(setEnrolled)
  }, [guardId, supported])

  useEffect(() => {
    if (!siteId) return
    fetchSiteGeofence(siteId).then(setSite).catch(() => setSite(null))
  }, [siteId])

  // Live location while the card is on screen.
  useEffect(() => {
    if (!navigator.geolocation || !supported) return undefined
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null)
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
        })
      },
      (err) => setGpsError(err.code === 1 ? 'Allow location access to clock in.' : 'Waiting for GPS signal…'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [supported])

  const fence = position && site ? geofenceStatus(position, site) : null
  const siteLocated = site && site.latitude != null && site.longitude != null

  // Re-evaluate the traffic light every 30s so it flips at the right moment.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  const window_ = shiftWindow(publishedShift, scheduled, date)
  const punch = punchState(clockedIn ? 'out' : 'in', window_)
  // Card color: green whenever clocked in (red only when overdue to leave);
  // when clocked out it follows the clock-in traffic light.
  const cardTone = clockedIn ? (punch.tone === 'red' ? 'red' : 'green') : punch.tone
  const card = TONE_CARD[cardTone]

  // Early clock-out: anytime before the published shift end needs a reason.
  // Last few minutes of the shift (and after end) = normal clock-out, no note.
  const earlyOut =
    clockedIn &&
    Boolean(window_) &&
    Date.now() < window_.end.getTime() - EARLY_OUT_GRACE_MIN * 60_000

  // Off-duty note: once today's shift is over (or there's none), point at the
  // next scheduled shift instead of yelling "you're late".
  let statusNote = punch.note
  if (!clockedIn && (punch.shiftOver || !window_)) {
    const next = nextShiftLine(nextShift)
    if (punch.shiftOver) {
      statusNote =
        next || `Today's shift ended at ${fmtTime(window_.end)} — check Schedule for what's next.`
    } else if (next) {
      statusNote = next
    }
  }
  if (clockedIn && earlyOut && !confirmingOut) {
    statusNote = `Leaving before ${fmtTime(window_.end)}? You’ll need to add a short note for the office.`
  }

  const handleEnroll = async () => {
    setBusy('enrolling')
    setMessage(null)
    try {
      const ok = await enrollPasskey()
      if (ok) {
        setEnrolled(true)
        setMessage({ tone: 'success', text: 'Face ID is set up — you can clock in with it now.' })
      } else {
        setMessage({ tone: 'error', text: 'Could not verify this device. Try again.' })
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || 'Face ID setup was cancelled.' })
    } finally {
      setBusy(null)
    }
  }

  const handlePunch = async (type) => {
    // Early clock-out needs an explicit confirmation + a reason first.
    if (type === 'out' && earlyOut && !confirmingOut) {
      setConfirmingOut(true)
      setMessage(null)
      return
    }
    if (type === 'out' && earlyOut && outNote.trim().length < 3) {
      setMessage({ tone: 'error', text: 'Add a short reason before clocking out early.' })
      setConfirmingOut(true)
      return
    }
    await doPunch(type, type === 'out' ? outNote : null)
  }

  const doPunch = async (type, note) => {
    if (type === 'out' && earlyOut && (!note || note.trim().length < 3)) {
      setConfirmingOut(true)
      setMessage({ tone: 'error', text: 'Add a short reason before clocking out early.' })
      return
    }
    setBusy('punching')
    setMessage(null)
    try {
      // Clock-out works from anywhere — grab a one-shot fix if the watch
      // hasn't produced one yet.
      let pos = position
      if (!pos && type === 'out') pos = await getOptionalPosition(8000, 2)
      if (!pos) {
        setMessage({ tone: 'error', text: 'Couldn’t read your location — turn Location Services on and try again.' })
        return
      }
      await verifyWithPasskey()
      const scan = await clockPunch({
        guardId,
        siteId,
        type,
        position: pos,
        note: type === 'out' ? note : null,
      })
      const wasEarly = type === 'out' && earlyOut
      if (scan.status === 'pass') {
        setConfirmingOut(false)
        setOutNote('')
        setMessage({
          tone: 'success',
          text:
            type === 'out'
              ? wasEarly
                ? 'Clocked out early — your note was sent to the office.'
                : 'Clocked out. Have a safe one!'
              : 'Clocked in — shift started. Stay safe out there.',
        })
        onPunched?.()
      } else {
        setMessage({
          tone: 'error',
          text: `Punch rejected — GPS puts you ${Math.round(scan.distance_metres)}m from the site. Get closer and try again.`,
        })
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || 'Face ID check failed.' })
    } finally {
      setBusy(null)
    }
  }

  if (!supported) {
    return (
      <div className="sp-card mb-4 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ScanFace className="h-4 w-4 text-accent-orange" /> Face ID clock-in
        </p>
        <p className="mt-2 text-sm text-ink-2">
          This browser can’t do Face ID.{' '}
          <Link to="/guard/scan" className="font-semibold text-accent-cyan-line underline underline-offset-2">
            Tap the clock-in NFC tag instead
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div id="face-clock" className={`sp-card mb-4 scroll-mt-24 border p-5 transition-colors ${card.ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ScanFace className="h-4 w-4 text-accent-orange" /> Shift clock
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${card.pill}`}>
            {card.label}
          </span>
        </p>

        {siteLocated && !clockedIn && (
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              fence?.located
                ? fence.inside
                  ? 'bg-accent-green/15 text-accent-green'
                  : 'bg-accent-orange/15 text-accent-orange'
                : 'bg-white/5 text-ink-3'
            }`}
          >
            <MapPin className="h-3 w-3" />
            {fence?.located
              ? fence.inside
                ? `On site · ${Math.round(fence.distance)}m`
                : `${Math.round(fence.distance)}m away`
              : gpsError || 'Locating…'}
          </span>
        )}
      </div>

      {!siteLocated && site !== null && !clockedIn && (
        <p className="mt-3 rounded-xl border border-accent-orange/30 bg-accent-orange/10 px-3 py-2 text-xs text-accent-orange">
          This site has no GPS location yet — ask your admin to set it (Overview → site card → clock icon).
        </p>
      )}

      {enrolled === false && (
        <>
          <p className="mt-3 text-sm text-ink-2">
            One-time setup: register this phone’s Face ID so you can clock in without scanning a tag.
          </p>
          <button
            type="button"
            onClick={handleEnroll}
            disabled={busy === 'enrolling'}
            className="sp-btn-primary mt-3 min-h-[3rem] w-full text-base"
          >
            <ScanFace className="h-5 w-5" />
            {busy === 'enrolling' ? 'Waiting for Face ID…' : 'Set up Face ID clock-in'}
          </button>
        </>
      )}

      {enrolled && confirmingOut && (
        <div className="mt-4 rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/10 p-4">
          <p className="text-sm font-semibold text-ink">
            Early clock-out — your shift is scheduled until {fmtTime(window_.end)}.
          </p>
          <p className="mt-1 text-xs text-ink-2">
            Add a short note for the office, then confirm. Without a note you can’t leave early.
          </p>
          <textarea
            value={outNote}
            onChange={(e) => setOutNote(e.target.value)}
            rows={3}
            maxLength={500}
            required
            autoFocus
            placeholder="Why are you leaving early? (required)"
            className="sp-input mt-3 w-full text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => doPunch('out', outNote)}
              disabled={busy === 'punching' || outNote.trim().length < 3}
              className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl bg-[#EF4444] text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
            >
              {busy === 'punching' ? 'Verifying…' : 'Confirm early clock out'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingOut(false)
                setOutNote('')
                setMessage(null)
              }}
              disabled={busy === 'punching'}
              className="flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-ink transition hover:bg-white/15"
            >
              Stay on shift
            </button>
          </div>
        </div>
      )}

      {enrolled && !confirmingOut && (
        <button
          type="button"
          onClick={() => handlePunch(clockedIn ? 'out' : 'in')}
          disabled={
            busy === 'punching' ||
            !punch.allowed ||
            // Clock-IN needs to be inside the geofence; clock-OUT works anywhere.
            (!clockedIn && (!siteLocated || !fence?.located || !fence?.inside))
          }
          className={`mt-4 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition active:scale-[0.99] disabled:opacity-50 ${TONE_BUTTON[clockedIn ? (punch.tone === 'red' ? 'red' : 'green') : punch.tone]}`}
        >
          {busy === 'punching' ? (
            <>
              <LocateFixed className="h-5 w-5 animate-pulse" /> Verifying…
            </>
          ) : (
            <>
              <ScanFace className="h-5 w-5" />
              {clockedIn
                ? punch.tone === 'red'
                  ? 'Clock out now — you’re over'
                  : earlyOut
                    ? 'Leave early (note required)'
                    : 'Clock out with Face ID'
                : punch.tone === 'red'
                  ? 'Clock in now — you’re late'
                  : punch.tone === 'yellow'
                    ? 'Clock in early'
                    : 'Clock in with Face ID'}
            </>
          )}
        </button>
      )}

      {enrolled && !confirmingOut && statusNote && (
        <p className={`mt-2 text-center text-xs ${punch.tone === 'red' ? 'font-semibold text-accent-red' : 'text-ink-3'}`}>
          {statusNote}
        </p>
      )}

      {enrolled && clockedIn && (
        <p className="mt-2 text-center text-xs text-ink-3">
          You can clock out from anywhere — no need to be at the site.
        </p>
      )}

      {enrolled && !clockedIn && punch.allowed && siteLocated && fence?.located && !fence.inside && (
        <p className="mt-2 text-center text-xs text-ink-3">
          The button unlocks when you’re within {site.geofence_radius_m ?? 120}m of the site.
        </p>
      )}

      {message && (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm ${
            message.tone === 'success'
              ? 'bg-accent-green/10 text-accent-green'
              : 'bg-accent-red/10 text-accent-red'
          }`}
        >
          {message.text}
        </p>
      )}

      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-3">
        <Nfc className="h-3.5 w-3.5" />
        Backup:{' '}
        <Link to="/guard/scan" className="font-semibold text-ink-2 underline underline-offset-2 hover:text-ink">
          tap the clock NFC tag
        </Link>{' '}
        (QR is never accepted for the clock)
      </p>
    </div>
  )
}
