import { useState } from 'react'
import { X, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import {
  normalizeOperatingHours,
  describeOperatingHours,
} from '../hooks/useClientShift.js'

const WEEK = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

/** Edit a site's per-day operating hours (drives dashboards + payroll). */
export default function SiteHoursModal({ site, onSaved, onClose }) {
  const [hours, setHours] = useState(() => normalizeOperatingHours(site.operating_hours))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setDay = (key, patch) => {
    setHours((prev) => ({
      ...prev,
      [key]: patch === null ? null : { ...(prev[key] || { start: '09:00', end: '17:00' }), ...patch },
    }))
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
    setSaving(true)
    const { error: err } = await supabase
      .from('sites')
      .update({ operating_hours: hours })
      .eq('id', site.id)
    setSaving(false)
    if (err) {
      setError(
        err.message.includes('operating_hours')
          ? 'Run migration 027_site_hours_and_realtime.sql in Supabase first.'
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
              <Clock className="h-5 w-5 text-accent-orange" /> Site hours
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
