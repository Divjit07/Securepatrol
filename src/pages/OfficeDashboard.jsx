// Office-staff clock screen. An office employee clocks IN (must be inside the
// office geofence) / OUT (from anywhere) to track hours. Clock-in is a geofenced
// GPS punch — same as guards, no biometric. The office geofence is validated
// server-side by the migration-040 trigger.
import { useEffect, useRef, useState } from 'react'
import { MapPin, LocateFixed, Clock } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  fetchOfficeLocation,
  officeGeofenceStatus,
  fetchOfficeClockStatus,
  officeClockPunch,
  listOfficeEvents,
  deriveHours,
  OFFICE_MAX_GPS_ACCURACY_M,
} from '../lib/officeStaff.js'
import { getOptionalPosition } from '../lib/gps.js'

function fmtDuration(ms) {
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default function OfficeDashboard() {
  const { profile, user } = useAuth()
  const employeeId = user?.id
  const officeLocationId = profile?.office_location_id

  const [office, setOffice] = useState(null)
  const [position, setPosition] = useState(null)
  const [gpsError, setGpsError] = useState(null)
  const [clockedIn, setClockedIn] = useState(false)
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(null) // 'punching'
  const [message, setMessage] = useState(null)
  const watchIdRef = useRef(null)

  const refreshStatus = async () => {
    if (!employeeId) return
    try {
      const [status, evs] = await Promise.all([
        fetchOfficeClockStatus(employeeId),
        listOfficeEvents(employeeId),
      ])
      setClockedIn(status.clockedIn)
      setEvents(evs)
    } catch { /* ignore transient */ }
  }

  useEffect(() => {
    if (!employeeId) return
    refreshStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId])

  useEffect(() => {
    if (!officeLocationId) return
    fetchOfficeLocation(officeLocationId).then(setOffice).catch(() => setOffice(null))
  }, [officeLocationId])

  useEffect(() => {
    if (!navigator.geolocation) return undefined
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null)
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      (err) => setGpsError(err.code === 1 ? 'Allow location access to clock in.' : 'Waiting for GPS signal…'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  const officeLocated = office && office.latitude != null && office.longitude != null
  const fence = position && office ? officeGeofenceStatus(position, office) : null

  const today = startOfToday()
  const todays = events.filter((e) => new Date(e.event_at) >= today)
  const { totalMs, openIn } = deriveHours(todays)

  const handlePunch = async (type) => {
    setBusy('punching')
    setMessage(null)
    try {
      let pos = position
      if (!pos) pos = await getOptionalPosition(8000, 2)
      if (!pos && type === 'in') {
        setMessage({ tone: 'error', text: 'Couldn’t read your location — turn Location Services on and try again.' })
        return
      }
      const punch = await officeClockPunch({ employeeId, officeLocationId, type, position: pos })
      if (punch.status === 'pass') {
        setMessage({
          tone: 'success',
          text: type === 'in' ? 'Clocked in. Have a great shift!' : 'Clocked out — hours recorded.',
        })
        await refreshStatus()
      } else {
        setMessage({
          tone: 'error',
          text: `Clock-in rejected — you’re ${Math.round(punch.distance_metres)}m from the office. Get closer and try again.`,
        })
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || 'Could not record the punch. Try again.' })
    } finally {
      setBusy(null)
    }
  }

  // --- Guard rails: not configured ----------------------------------------
  let banner = null
  if (!officeLocationId) {
    banner = 'You haven’t been assigned an office yet — ask your admin to set your office location.'
  } else if (office !== null && !officeLocated) {
    banner = 'Your office has no GPS location yet — ask your admin to set the office coordinates.'
  }

  return (
    <Layout variant="office">
      <div className="mx-auto max-w-md">
        <h1 className="text-lg font-semibold text-ink">Hi, {profile?.name?.split(' ')[0] || 'there'}</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          {office?.name ? `Clock in at ${office.name}` : 'Office time clock'}
        </p>

        {banner && (
          <div className="mt-4 rounded-xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-sm text-accent-orange">
            {banner}
          </div>
        )}

        {!banner && (
          <div
            className={`sp-card mt-4 border p-5 transition-colors ${
              clockedIn ? 'border-[#22C55E]/50' : 'border-white/10'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Clock className="h-4 w-4 text-accent-orange" /> Time clock
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                    clockedIn ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-white/10 text-ink-2'
                  }`}
                >
                  {clockedIn ? 'On the clock' : 'Off'}
                </span>
              </p>
              {!clockedIn && (
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
                        ? `At office · ${Math.round(fence.distance)}m`
                        : `${Math.round(fence.distance)}m away`
                    : gpsError || 'Locating…'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => handlePunch(clockedIn ? 'out' : 'in')}
              disabled={
                busy === 'punching' ||
                (!clockedIn && (!fence?.located || !fence?.inside || !fence?.accuracyOk))
              }
              className={`mt-4 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition active:scale-[0.99] disabled:opacity-50 ${
                clockedIn
                  ? 'bg-[#EF4444] text-white hover:brightness-105'
                  : 'bg-[#22C55E] text-[#052E16] hover:brightness-105'
              }`}
            >
              {busy === 'punching' ? (
                <>
                  <LocateFixed className="h-5 w-5 animate-pulse" /> Recording…
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5" />
                  {clockedIn ? 'Clock out' : 'Clock in'}
                </>
              )}
            </button>

            {clockedIn ? (
              <p className="mt-2 text-center text-xs text-ink-3">
                You can clock out from anywhere — no need to stay at the office.
              </p>
            ) : (
              fence?.located && !fence.inside && (
                <p className="mt-2 text-center text-xs text-ink-3">
                  The button unlocks when you’re within {office.geofence_radius_m ?? 120}m of the office.
                </p>
              )
            )}
            {!clockedIn && fence?.located && fence.inside && !fence.accuracyOk && (
              <p className="mt-2 text-center text-xs text-ink-3">
                GPS accuracy is ±{Math.round(fence.accuracy)}m — it must be under {OFFICE_MAX_GPS_ACCURACY_M}m. Step outside or near a window.
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
          </div>
        )}

        {/* Today's hours */}
        <div className="sp-card mt-4 p-5">
          <p className="text-sm font-semibold text-ink">Today</p>
          <p className="mt-1 text-3xl font-bold text-ink">
            {fmtDuration(totalMs)}
            {openIn && <span className="ml-2 align-middle text-xs font-medium text-accent-green">· on the clock</span>}
          </p>
          {todays.length === 0 && <p className="mt-1 text-xs text-ink-3">No punches yet today.</p>}
          {todays.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {todays
                .slice()
                .sort((a, b) => new Date(b.event_at) - new Date(a.event_at))
                .map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span className={e.event_type === 'in' ? 'text-accent-green' : 'text-ink-2'}>
                      {e.event_type === 'in' ? 'Clock in' : 'Clock out'}
                      {e.status === 'fail' && <span className="ml-1 text-accent-red">(rejected)</span>}
                    </span>
                    <span className="text-ink-3">
                      {new Date(e.event_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  )
}
