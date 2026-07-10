// Geofenced Face ID clock-in card (guard dashboard). Watches GPS, shows live
// distance to the site, and arms the clock-in/out button only inside the
// geofence. Punching = Face ID (passkey, verified server-side) + a face_gps
// scan that the DB trigger re-validates against the site coordinates.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanFace, MapPin, LocateFixed, QrCode } from 'lucide-react'
import {
  passkeySupported,
  hasEnrolledPasskey,
  enrollPasskey,
  verifyWithPasskey,
} from '../lib/passkeys.js'
import { fetchSiteGeofence, geofenceStatus, clockPunch } from '../lib/clockPunch.js'

export default function ClockInCard({ guardId, siteId, clockedIn, onPunched }) {
  const [enrolled, setEnrolled] = useState(null) // null = checking
  const [site, setSite] = useState(null)
  const [position, setPosition] = useState(null)
  const [gpsError, setGpsError] = useState(null)
  const [busy, setBusy] = useState(null) // 'enrolling' | 'punching'
  const [message, setMessage] = useState(null) // { tone: 'success'|'error', text }
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
    if (!position) return
    setBusy('punching')
    setMessage(null)
    try {
      await verifyWithPasskey()
      const scan = await clockPunch({ guardId, siteId, type, position })
      if (scan.status === 'pass') {
        setMessage({
          tone: 'success',
          text: type === 'out' ? 'Clocked out. Have a safe one!' : 'Clocked in — shift started. Stay safe out there.',
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
            Scan the clock-in tag instead
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="sp-card mb-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ScanFace className="h-4 w-4 text-accent-orange" /> Face ID clock-in
        </p>

        {siteLocated && (
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

      {!siteLocated && site !== null && (
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

      {enrolled && (
        <button
          type="button"
          onClick={() => handlePunch(clockedIn ? 'out' : 'in')}
          disabled={busy === 'punching' || !siteLocated || !fence?.located || (!fence?.inside && !clockedIn)}
          className="sp-btn-primary mt-4 min-h-[3.25rem] w-full text-base disabled:opacity-50"
        >
          {busy === 'punching' ? (
            <>
              <LocateFixed className="h-5 w-5 animate-pulse" /> Verifying…
            </>
          ) : (
            <>
              <ScanFace className="h-5 w-5" />
              {clockedIn ? 'Clock out with Face ID' : 'Clock in with Face ID'}
            </>
          )}
        </button>
      )}

      {enrolled && !clockedIn && siteLocated && fence?.located && !fence.inside && (
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
        <QrCode className="h-3.5 w-3.5" />
        Backup:{' '}
        <Link to="/guard/scan" className="font-semibold text-ink-2 underline underline-offset-2 hover:text-ink">
          scan the clock-in NFC/QR tag
        </Link>
      </p>
    </div>
  )
}
