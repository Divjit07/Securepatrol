import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { fetchNextShift, formatTimeRange, acknowledgeShift } from '../lib/schedule.js'

function relativeDayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const same = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (same(d, today)) return 'Today'
  if (same(d, tomorrow)) return 'Tomorrow'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

/** Guard dashboard hero card: next published shift + one-tap confirm. */
export default function NextShiftCard({ guardId }) {
  const [shift, setShift] = useState(null)
  const [checked, setChecked] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const reload = useCallback(async () => {
    if (!guardId) return
    try {
      const next = await fetchNextShift(guardId)
      setShift(next)
    } catch {
      setShift(null)
    } finally {
      setChecked(true)
    }
  }, [guardId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!guardId) return undefined
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    const channel = supabase
      .channel(`guard-next-shift-${guardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts', filter: `guard_id=eq.${guardId}` },
        () => reload(),
      )
      .subscribe()
    return () => {
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [guardId, reload])

  if (!checked || !shift) return null

  const inProgress = new Date(shift.starts_at) <= new Date()

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const updated = await acknowledgeShift(shift.id)
      if (updated) setShift(updated)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="sp-card-elevated mb-6 overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${inProgress ? 'bg-accent-orange/15 text-accent-orange' : 'bg-accent-cyan/10 text-accent-cyan-line'}`}>
          <CalendarClock className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            {inProgress ? 'Current shift' : 'Next shift'}
          </p>
          <p className="truncate font-display text-lg font-semibold text-ink">
            {relativeDayLabel(shift.starts_at)} · {formatTimeRange(shift)}
          </p>
          {shift.sites?.name && <p className="truncate text-sm text-ink-2">{shift.sites.name}</p>}
        </div>
        {!shift.acknowledged_at && !inProgress ? (
          <button type="button" onClick={handleConfirm} disabled={confirming} className="sp-btn-primary shrink-0 px-4 py-2 text-xs">
            {confirming ? 'Confirming…' : 'Confirm'}
          </button>
        ) : (
          shift.acknowledged_at && (
            <span className="dk-pill-ok shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
            </span>
          )
        )}
        <Link to="/guard/schedule" className="shrink-0 rounded-lg p-2 text-ink-3 transition hover:bg-white/10 hover:text-ink-2" aria-label="My schedule">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  )
}
