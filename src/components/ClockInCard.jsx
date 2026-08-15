// Geofenced GPS clock card (guard dashboard). Watches GPS, shows live distance
// to the site, and arms the clock-in button only inside the geofence. Clock-OUT
// works from anywhere — the punch is recorded with GPS for audit but never
// blocked by the fence (server trigger agrees since migration 031).
// The whole card is a traffic light: grey = off duty, yellow = 15-min early
// window, green = clocked in (on duty), red = late for clock-in / overdue out.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin, LocateFixed, Nfc } from 'lucide-react'
import { fetchSiteGeofence, geofenceStatus, clockPunch, CLOCK_MAX_GPS_ACCURACY_M } from '../lib/clockPunch.js'
import { getOptionalPosition } from '../lib/gps.js'
import { shiftBounds } from '../hooks/useClientShift.js'

const EARLY_WINDOW_MIN = 15 // clock-in opens this many minutes before the shift
const LATE_GRACE_MIN = 10 // how long after shift end before clock-IN is treated as "day over"
const EARLY_OUT_GRACE_MIN = 5 // last N minutes of shift = normal clock-out, no note

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Today's shift window. The published roster wins when it exists; otherwise
 *  the site's operating hours gate the clock (a "Closed" day blocks clock-in),
 *  so the Site Hours modal's "drives the shift clock" promise actually holds.
 *  (Exported for the /dev/scale logic tests.) */
export function shiftWindow(publishedShift, scheduled, date) {
  if (publishedShift?.starts_at && publishedShift?.ends_at) {
    return {
      start: new Date(publishedShift.starts_at),
      end: new Date(publishedShift.ends_at),
      source: 'roster',
    }
  }
  if (scheduled && date) {
    if (scheduled.isClosed) return { closed: true }
    const { start, end } = shiftBounds(date, scheduled.start, scheduled.end)
    // `source: 'hours'` matters downstream: the building's opening hours can
    // gate clock-IN, but they are NOT a shift the guard was rostered for, so
    // nothing may treat leaving before them as "leaving early".
    return { start, end, source: 'hours' }
  }
  return null
}

/** Traffic-light state for the punch button vs. the schedule.
 *  (Exported for the /dev/scale logic tests.) */
export function punchState(type, window, now = new Date()) {
  // Roster-only: no published shift → no window. Clock-IN is blocked (the admin
  // must post a shift first); clock-OUT stays allowed so anyone already on the
  // clock can still end their shift.
  if (!window) {
    if (type === 'in') {
      return { tone: 'grey', allowed: false, note: 'No shift scheduled today — ask your admin to post one in the roster.' }
    }
    return { tone: 'green', allowed: true, note: null }
  }
  // Site closed today (operating hours, no published shift): clock-in is
  // blocked; clock-out stays allowed for overnight shifts running past midnight.
  if (window.closed) {
    if (type === 'in') {
      return { tone: 'grey', allowed: false, note: 'Site is closed today — no shift scheduled.' }
    }
    return { tone: 'green', allowed: true, note: null }
  }
  const min = 60_000
  if (type === 'in') {
    // Shift already over → not "late", the day is done. Caller fills in the
    // next-shift details. Keep a short post-end buffer so a late punch near
    // end-of-day still shows as late rather than vanishing instantly.
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
    // At/after scheduled start and still not punched → red urgency.
    return {
      tone: 'red',
      allowed: true,
      urgent: true,
      note: `Your shift started at ${fmtTime(window.start)} — CLOCK IN NOW!`,
    }
  }
  // clock-out — always allowed, from anywhere
  if (now < window.end) {
    // Last 15 minutes: gentle nudge, still green.
    if (now >= new Date(window.end.getTime() - EARLY_WINDOW_MIN * min)) {
      return {
        tone: 'green',
        allowed: true,
        note: `Shift ends at ${fmtTime(window.end)} — wrap up and clock out soon.`,
      }
    }
    return { tone: 'green', allowed: true, note: `On duty — your shift runs until ${fmtTime(window.end)}.` }
  }
  // At or past scheduled end → red urgency to clock out.
  return {
    tone: 'red',
    allowed: true,
    urgent: true,
    note: `Your shift ended at ${fmtTime(window.end)} — CLOCK OUT NOW!`,
  }
}

const TONE_BUTTON = {
  grey: 'bg-white/10 text-ink-3',
  yellow: 'bg-[#FACC15] text-[#422006] hover:brightness-105',
  green: 'bg-[#22C55E] text-[#052E16] hover:brightness-105',
  red: 'bg-[#EF4444] text-white hover:brightness-105 animate-pulse',
}

// Card-level traffic light: border tint + status pill.
const TONE_CARD = {
  grey: { ring: 'border-white/10', bg: '', pill: 'bg-white/10 text-ink-2', label: 'Off duty' },
  yellow: { ring: 'border-[#FACC15]/50', bg: 'bg-[#FACC15]/5', pill: 'bg-[#FACC15]/15 text-[#FACC15]', label: 'Early window' },
  green: { ring: 'border-[#22C55E]/50', bg: 'bg-[#22C55E]/5', pill: 'bg-[#22C55E]/15 text-[#22C55E]', label: 'On duty' },
  red: {
    ring: 'border-[#EF4444]',
    bg: 'bg-[#EF4444]/15',
    pill: 'bg-[#EF4444] text-white',
    label: 'Action needed',
  },
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
  const [site, setSite] = useState(null)
  const [position, setPosition] = useState(null)
  const [gpsError, setGpsError] = useState(null)
  const [busy, setBusy] = useState(null) // 'punching'
  const [message, setMessage] = useState(null) // { tone: 'success'|'error', text }
  const [confirmingOut, setConfirmingOut] = useState(false) // early clock-out gate
  const [outNote, setOutNote] = useState('')
  const watchIdRef = useRef(null)

  // Roster-only: a shift window exists only when a shift is published. GPS is
  // watched and shown ONLY while there's a shift to clock into (or the guard is
  // on the clock) — never idle. No shift = no location tracking, no "on site".
  const window_ = shiftWindow(publishedShift, scheduled, date)
  const shiftActive = Boolean(window_ && !window_.closed)
  const needsLocation = shiftActive || clockedIn

  useEffect(() => {
    if (!siteId) return
    fetchSiteGeofence(siteId).then(setSite).catch(() => setSite(null))
  }, [siteId])

  // Live location — only while a shift is active or the guard is on the clock.
  useEffect(() => {
    if (!navigator.geolocation || !needsLocation) {
      setPosition(null)
      return undefined
    }
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
  }, [needsLocation])

  const fence = position && site ? geofenceStatus(position, site) : null
  const siteLocated = site && site.latitude != null && site.longitude != null

  // Re-evaluate the traffic light every 10s so late / overdue flips feel instant.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])
  const punch = punchState(clockedIn ? 'out' : 'in', window_)
  // Card color: green whenever clocked in (red only when overdue to leave);
  // when clocked out it follows the clock-in traffic light.
  const cardTone = clockedIn ? (punch.tone === 'red' ? 'red' : 'green') : punch.tone
  const card = {
    ...TONE_CARD[cardTone],
    label:
      cardTone === 'red'
        ? clockedIn
          ? 'CLOCK OUT NOW'
          : 'CLOCK IN NOW'
        : TONE_CARD[cardTone].label,
  }

  // Early clock-out: before the end of a shift the guard was actually ROSTERED
  // for. Last few minutes (and after the end) = normal clock-out, no note.
  //
  // Gated on source === 'roster' deliberately. With no published shift the
  // window falls back to the site's operating hours, which routinely run later
  // than the guard's actual shift — that made the app demand a "why are you
  // leaving early?" note from someone whose shift had already finished.
  const earlyOut =
    clockedIn &&
    window_?.source === 'roster' &&
    window_?.end &&
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
        // Mirror the server's two rejection reasons (migration 031): weak GPS
        // accuracy is a hard fail independent of distance — don't tell the
        // guard to "get closer" when distance wasn't the problem.
        const weakAccuracy = scan.gps_accuracy != null && scan.gps_accuracy > CLOCK_MAX_GPS_ACCURACY_M
        setMessage({
          tone: 'error',
          text: weakAccuracy
            ? `Punch rejected — GPS signal too weak (±${Math.round(scan.gps_accuracy)}m accuracy). Step outside or near a window and try again.`
            : `Punch rejected — GPS puts you ${Math.round(scan.distance_metres)}m from the site. Get closer and try again.`,
        })
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || 'Could not record the punch. Try again.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div id="face-clock" className={`sp-card mb-4 scroll-mt-24 border p-5 transition-colors ${card.ring} ${card.bg}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock className={`h-4 w-4 ${cardTone === 'red' ? 'text-[#EF4444]' : 'text-accent-orange'}`} /> Shift clock
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${card.pill}`}>
            {card.label}
          </span>
        </p>

        {siteLocated && !clockedIn && shiftActive && (
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              fence?.located
                ? fence.inside && fence.accuracyOk
                  ? 'bg-accent-green/15 text-accent-green'
                  : 'bg-accent-orange/15 text-accent-orange'
                : 'bg-white/5 text-ink-3'
            }`}
          >
            <MapPin className="h-3 w-3" />
            {fence?.located
              ? !fence.accuracyOk
                ? `GPS too weak · ±${Math.round(fence.accuracy)}m`
                : fence.inside
                  ? `On site · ${Math.round(fence.distance)}m`
                  : `${Math.round(fence.distance)}m away`
              : gpsError || 'Locating…'}
          </span>
        )}
      </div>

      {!siteLocated && site !== null && !clockedIn && shiftActive && (
        <p className="mt-3 rounded-xl border border-accent-orange/30 bg-accent-orange/10 px-3 py-2 text-xs text-accent-orange">
          This site has no GPS location yet — ask your admin to set it (Overview → site card → clock icon).
        </p>
      )}

      {confirmingOut && (
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
              {busy === 'punching' ? 'Recording…' : 'Confirm early clock out'}
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

      {!confirmingOut && (
        <button
          type="button"
          onClick={() => handlePunch(clockedIn ? 'out' : 'in')}
          disabled={
            busy === 'punching' ||
            !punch.allowed ||
            // Clock-IN needs to be inside the geofence with usable GPS accuracy
            // (server hard-fails accuracy > 100m); clock-OUT works anywhere.
            (!clockedIn && (!siteLocated || !fence?.located || !fence?.inside || !fence?.accuracyOk))
          }
          className={`mt-4 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition active:scale-[0.99] disabled:opacity-50 ${TONE_BUTTON[clockedIn ? (punch.tone === 'red' ? 'red' : 'green') : punch.tone]}`}
        >
          {busy === 'punching' ? (
            <>
              <LocateFixed className="h-5 w-5 animate-pulse" /> Recording…
            </>
          ) : (
            <>
              <Clock className="h-5 w-5" />
              {clockedIn
                ? punch.tone === 'red'
                  ? 'CLOCK OUT NOW!'
                  : earlyOut
                    ? 'Leave early (note required)'
                    : 'Clock out'
                : punch.tone === 'red'
                  ? 'CLOCK IN NOW!'
                  : punch.tone === 'yellow'
                    ? 'Clock in early'
                    : 'Clock in'}
            </>
          )}
        </button>
      )}

      {!confirmingOut && statusNote && (
        <p
          className={`mt-2 text-center text-xs ${
            punch.tone === 'red' ? 'text-sm font-bold uppercase tracking-wide text-[#EF4444]' : 'text-ink-3'
          }`}
        >
          {statusNote}
        </p>
      )}

      {clockedIn && (
        <p className="mt-2 text-center text-xs text-ink-3">
          You can clock out from anywhere — no need to be at the site.
        </p>
      )}

      {!clockedIn && punch.allowed && siteLocated && fence?.located && !fence.inside && (
        <p className="mt-2 text-center text-xs text-ink-3">
          The button unlocks when you’re within {site.geofence_radius_m ?? 120}m of the site.
        </p>
      )}

      {!clockedIn && punch.allowed && siteLocated && fence?.located && fence.inside && !fence.accuracyOk && (
        <p className="mt-2 text-center text-xs text-ink-3">
          GPS accuracy is ±{Math.round(fence.accuracy)}m — it must be under {CLOCK_MAX_GPS_ACCURACY_M}m to clock in. Step outside or near a window.
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
        </Link>
      </p>
    </div>
  )
}
