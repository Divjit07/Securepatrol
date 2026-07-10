import { useMemo, useState } from 'react'
import { X, Trash2, Repeat, Clock } from 'lucide-react'
import { SHIFT_COLORS } from '../../lib/schedule.js'
import { SHIFT_SHEET_SWATCHES } from '../../lib/brandPalette.js'

const COLOR_DOTS = SHIFT_SHEET_SWATCHES

function toDateInput(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toTimeInput(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function minutesToTime(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

/**
 * Create/edit bottom sheet. `initial` is either an existing shift (edit mode,
 * has id) or `{ guard_id, starts_at }` seed from a grid cell (create mode).
 */
export default function ShiftSheet({ initial, guards, templates = [], onSave, onDelete, onClose }) {
  const isEdit = Boolean(initial?.id)
  const [guardId, setGuardId] = useState(initial?.guard_id || '')
  const [date, setDate] = useState(toDateInput(initial?.starts_at || new Date().toISOString()))
  const [startTime, setStartTime] = useState(initial?.id ? toTimeInput(initial.starts_at) : '09:00')
  const [endTime, setEndTime] = useState(initial?.id ? toTimeInput(initial.ends_at) : '17:00')
  const [breakMinutes, setBreakMinutes] = useState(initial?.break_minutes ?? 30)
  const [color, setColor] = useState(initial?.color || 'blue')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [repeat, setRepeat] = useState('none')
  const [repeatCount, setRepeatCount] = useState(4)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const overnight = useMemo(() => endTime <= startTime, [startTime, endTime])

  const applyTemplate = (t) => {
    setStartTime(minutesToTime(t.start_minutes))
    setEndTime(minutesToTime((t.start_minutes + t.duration_minutes) % 1440))
    setBreakMinutes(t.break_minutes)
    setColor(t.color)
  }

  const handleSave = async () => {
    setError('')
    const starts = new Date(`${date}T${startTime}`)
    const ends = new Date(`${date}T${endTime}`)
    if (overnight) ends.setDate(ends.getDate() + 1)
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      setError('Enter a valid date and times.')
      return
    }

    setSaving(true)
    try {
      await onSave(
        {
          guard_id: guardId || null,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          break_minutes: Number(breakMinutes) || 0,
          color,
          notes: notes.trim() || null,
        },
        repeat !== 'none' ? { frequency: repeat, count: Number(repeatCount) } : null,
      )
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save shift.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (series) => {
    setSaving(true)
    try {
      await onDelete(initial, series)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not delete shift.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{isEdit ? 'Edit shift' : 'New shift'}</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              {isEdit && initial.status === 'published'
                ? 'Published — the guard will be notified of changes on republish.'
                : 'Saved as draft. Guards see it after you publish.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="sp-btn-ghost -mr-2 px-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {templates.length > 0 && !isEdit && (
          <div className="mb-4 flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:border-accent-cyan-line/40 hover:bg-accent-cyan/10 hover:text-accent-cyan-line"
              >
                <Clock className="h-3 w-3" /> {t.name}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="sp-label">Assign to</label>
            <select value={guardId} onChange={(e) => setGuardId(e.target.value)} className="sp-input">
              <option value="">Open shift — any eligible guard can claim</option>
              {guards.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="sp-label">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sp-input" />
            </div>
            <div>
              <label className="sp-label">Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="sp-input" />
            </div>
            <div>
              <label className="sp-label">End {overnight && <span className="normal-case text-accent-orange">(+1 day)</span>}</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="sp-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="sp-label">Unpaid break (min)</label>
              <input
                type="number"
                min="0"
                step="15"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Color</label>
              <div className="flex items-center gap-2 py-2.5">
                {SHIFT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    className={`h-7 w-7 rounded-full transition ${COLOR_DOTS[c]} ${
                      color === c ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-surface' : 'opacity-40 hover:opacity-80'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="sp-label">
                  <span className="inline-flex items-center gap-1">
                    <Repeat className="h-3 w-3" /> Repeat
                  </span>
                </label>
                <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className="sp-input">
                  <option value="none">Does not repeat</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {repeat !== 'none' && (
                <div>
                  <label className="sp-label">Occurrences</label>
                  <input
                    type="number"
                    min="2"
                    max="26"
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(e.target.value)}
                    className="sp-input"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="sp-label">Notes (visible to the guard)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Gate code, patrol focus, handover details…"
              className="sp-input resize-none"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-accent-red/10 px-4 py-3 text-sm font-medium text-accent-red">{error}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {isEdit && (
              <>
                <button
                  type="button"
                  onClick={() => handleDelete(false)}
                  disabled={saving}
                  className="sp-btn-ghost px-3 text-accent-red hover:bg-accent-red/10 hover:text-accent-red"
                  aria-label="Delete shift"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                {initial.recurrence_id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(true)}
                    disabled={saving}
                    className="sp-btn-ghost px-3 text-xs text-accent-red hover:bg-accent-red/10 hover:text-accent-red"
                  >
                    Delete series
                  </button>
                )}
              </>
            )}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={onClose} className="sp-btn-secondary" disabled={saving}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="sp-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add shift'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
