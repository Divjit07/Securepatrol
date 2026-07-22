import { useState } from 'react'
import { X, Clock, MapPin, LocateFixed, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import {
  normalizeOperatingHours,
  describeOperatingHours,
} from '../hooks/useClientShift.js'
import { getBestPosition, parseCoordinatePaste } from '../lib/gps.js'

const WEEK = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

/** Edit a site's per-day operating hours + GPS geofence (drives dashboards,
 *  payroll windows, and GPS clock-in). */
export default function SiteHoursModal({ site, onSaved, onClose }) {
  const [hours, setHours] = useState(() => normalizeOperatingHours(site.operating_hours))
  const [lat, setLat] = useState(site.latitude != null ? String(site.latitude) : '')
  const [lng, setLng] = useState(site.longitude != null ? String(site.longitude) : '')
  const [radius, setRadius] = useState(String(site.geofence_radius_m ?? 120))
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const useMyLocation = async () => {
    setLocating(true)
    setError('')
    try {
      const pos = await getBestPosition(2)
      setLat(pos.latitude.toFixed(6))
      setLng(pos.longitude.toFixed(6))
    } catch (err) {
      setError(err.message || 'Could not get your location.')
    } finally {
      setLocating(false)
    }
  }

  const handleCoordPaste = (text) => {
    const parsed = parseCoordinatePaste(text)
    if (parsed) {
      setLat(String(parsed.lat))
      setLng(String(parsed.lng))
      return true
    }
    return false
  }

  const setDay = (key, patch) => {
    setHours((prev) => ({
      ...prev,
      [key]: patch === null ? null : { ...(prev[key] || { start: '09:00', end: '17:00' }), ...patch },
    }))
  }

  const handleClearGps = async () => {
    if (lat.trim() === '' && lng.trim() === '' && site.latitude == null && site.longitude == null) {
      return
    }
    if (
      !window.confirm(
        'Remove GPS from this site? GPS clock-in will stop until you set a new location.',
      )
    ) {
      return
    }
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('sites')
      .update({ latitude: null, longitude: null })
      .eq('id', site.id)
    setSaving(false)
    if (err) {
      setError(err.message || 'Could not remove GPS.')
      return
    }
    setLat('')
    setLng('')
    onSaved?.(hours)
  }

  const handleSave = async () => {
    setError('')
    for (const { key, label } of WEEK) {
      const day = hours[key]
      if (day && day.start >= day.end) {
        setError(`${label}: end time must be after start time.`)
        return
      }
    }

    const hasLat = lat.trim() !== ''
    const hasLng = lng.trim() !== ''
    if (hasLat !== hasLng) {
      setError('Enter both latitude and longitude (or leave both empty).')
      return
    }
    const latNum = hasLat ? parseFloat(lat) : null
    const lngNum = hasLng ? parseFloat(lng) : null
    if (hasLat && (Number.isNaN(latNum) || Number.isNaN(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180)) {
      setError('Those coordinates don’t look valid.')
      return
    }
    const radiusNum = Math.min(1000, Math.max(30, parseInt(radius, 10) || 120))

    setSaving(true)
    const { error: err } = await supabase
      .from('sites')
      .update({
        operating_hours: hours,
        latitude: latNum,
        longitude: lngNum,
        geofence_radius_m: radiusNum,
      })
      .eq('id', site.id)
    setSaving(false)
    if (err) {
      setError(
        err.message.includes('operating_hours')
          ? 'Run migration 027_site_hours_and_realtime.sql in Supabase first.'
          : err.message.includes('latitude') || err.message.includes('geofence')
            ? 'Run migration 029_geofence_faceid_clockin.sql in Supabase first.'
            : err.message,
      )
      return
    }
    onSaved?.(hours)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Clock className="h-5 w-5 text-accent-orange" /> Site hours &amp; location
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">{site.name}</p>
          </div>
          <button type="button" onClick={onClose} className="sp-btn-ghost -mr-2 px-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {WEEK.map(({ key, label }) => {
            const day = hours[key]
            return (
              <div key={key} className="flex items-center gap-3 rounded-xl border border-white/5 bg-inset px-3 py-2">
                <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(day)}
                    onChange={(e) => setDay(key, e.target.checked ? {} : null)}
                    className="h-4 w-4 accent-accent-orange"
                  />
                  <span className="text-sm font-medium text-ink-2">{label}</span>
                </label>
                {day ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="time"
                      value={day.start || '09:00'}
                      onChange={(e) => setDay(key, { start: e.target.value })}
                      className="sp-input px-2 py-1.5 text-sm"
                    />
                    <span className="text-ink-3">–</span>
                    <input
                      type="time"
                      value={day.end || '17:00'}
                      onChange={(e) => setDay(key, { end: e.target.value })}
                      className="sp-input px-2 py-1.5 text-sm"
                    />
                  </div>
                ) : (
                  <span className="flex-1 text-sm text-ink-3">Closed</span>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-4 rounded-xl bg-accent-cyan/10 px-4 py-3 text-xs text-accent-cyan">
          {describeOperatingHours(hours)}
        </p>
        <p className="mt-2 text-xs text-ink-3">
          These hours drive the shift clock, guard and client dashboards, and payroll windows for this site.
        </p>

        {/* ---- Location & clock-in geofence ---- */}
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <MapPin className="h-4 w-4 text-accent-orange" /> Location &amp; clock-in geofence
          </h3>
          <p className="mt-1 text-xs text-ink-2">
            Guards can clock in once they’re within this distance of the site.
            Paste coordinates from Google Maps or use your location while standing on site.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="sp-label">Latitude</label>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                onPaste={(e) => {
                  if (handleCoordPaste(e.clipboardData.getData('text'))) e.preventDefault()
                }}
                placeholder="43.664486"
                inputMode="decimal"
                className="sp-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="sp-label">Longitude</label>
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                onPaste={(e) => {
                  if (handleCoordPaste(e.clipboardData.getData('text'))) e.preventDefault()
                }}
                placeholder="-79.411079"
                inputMode="decimal"
                className="sp-input px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-2 flex items-end gap-2">
            <div className="w-32">
              <label className="sp-label">Radius (m)</label>
              <input
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                inputMode="numeric"
                className="sp-input px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="sp-btn-secondary flex-1 gap-2 py-2 text-sm"
            >
              <LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse' : ''}`} />
              {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>

          {(lat.trim() !== '' || lng.trim() !== '' || site.latitude != null) && (
            <button
              type="button"
              onClick={handleClearGps}
              disabled={saving}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm font-semibold text-accent-red transition hover:bg-accent-red/15 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Remove GPS from site
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-accent-red/10 px-4 py-3 text-sm font-medium text-accent-red">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="sp-btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="sp-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save hours'}
          </button>
        </div>
      </div>
    </div>
  )
}
