import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Hand, Clock, Inbox, FileSignature } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import {
  fetchGuardSchedule,
  claimOpenShift,
  acknowledgeShift,
  formatTimeRange,
  formatDayLabel,
  shiftHours,
  addDays,
  startOfWeek,
} from '../lib/schedule.js'
import { fetchMyApproval, approveTimesheet } from '../lib/payroll.js'

/** Last week's sign-off: guard confirms their hours before payroll runs. */
function TimesheetCard({ guardId, siteId }) {
  const [state, setState] = useState({ status: 'loading', hours: 0, approval: null })
  const [busy, setBusy] = useState(false)

  const lastWeekStart = useMemo(() => addDays(startOfWeek(new Date()), -7), [])
  const weekStartStr = useMemo(() => {
    const d = lastWeekStart
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [lastWeekStart])

  useEffect(() => {
    if (!guardId) return
    Promise.all([
      fetchGuardSchedule(guardId, lastWeekStart, addDays(lastWeekStart, 7)),
      fetchMyApproval(guardId, weekStartStr),
    ])
      .then(([schedule, approval]) => {
        const hours = schedule.mine.reduce((sum, s) => sum + shiftHours(s), 0)
        setState({ status: hours || approval ? 'ready' : 'empty', hours, approval })
      })
      .catch(() => setState({ status: 'empty', hours: 0, approval: null }))
  }, [guardId, lastWeekStart, weekStartStr])

  if (state.status !== 'ready') return null

  const handleApprove = async () => {
    setBusy(true)
    try {
      const approval = await approveTimesheet({
        guardId,
        siteId,
        weekStart: weekStartStr,
        hours: Number(state.hours.toFixed(2)),
      })
      setState((s) => ({ ...s, approval }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sp-card mb-6 flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-cyan/10 text-accent-cyan-line">
        <FileSignature className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Last week's timesheet</p>
        <p className="text-sm text-ink-2">
          Week of {lastWeekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} ·{' '}
          {state.hours.toFixed(1).replace(/\.0$/, '')}h scheduled
        </p>
      </div>
      {state.approval ? (
        <span className="dk-pill-ok shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5" /> Signed off
        </span>
      ) : (
        <button type="button" onClick={handleApprove} disabled={busy} className="sp-btn-primary shrink-0 px-4 py-2 text-xs">
          {busy ? 'Signing…' : 'Approve hours'}
        </button>
      )}
    </div>
  )
}

const RANGES = [
  { label: '2 weeks', days: 14 },
  { label: 'Month', days: 31 },
]

function groupByDay(shifts) {
  const groups = new Map()
  for (const s of shifts) {
    const key = new Date(s.starts_at).toDateString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }
  return [...groups.entries()].map(([key, list]) => ({ date: new Date(key), list }))
}

function ShiftRow({ shift, action }) {
  const past = new Date(shift.ends_at) < new Date()
  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${past ? 'opacity-60' : ''}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-cyan/10 text-accent-cyan-line">
        <Clock className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{formatTimeRange(shift)}</p>
        <p className="truncate text-sm text-ink-2">
          {shift.sites?.name || 'Site'} · {shiftHours(shift).toFixed(1).replace(/\.0$/, '')}h
          {shift.notes ? ` · ${shift.notes}` : ''}
        </p>
      </div>
      {action}
    </div>
  )
}

export default function GuardSchedule() {
  const { user, profile } = useAuth()
  const [rangeDays, setRangeDays] = useState(14)
  const [mine, setMine] = useState([])
  const [open, setOpen] = useState([])
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const reload = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const data = await fetchGuardSchedule(user.id, start, addDays(start, rangeDays))
      setMine(data.mine)
      setOpen(data.open)
    } catch {
      // Schedule tables not migrated yet — show empty state instead of an error.
      setMine([])
      setOpen([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, rangeDays])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!user?.id) return undefined
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    const channel = supabase
      .channel(`guard-schedule-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts', filter: `guard_id=eq.${user.id}` },
        () => reload(),
      )
      .subscribe()
    return () => {
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [user?.id, reload])

  const days = useMemo(() => groupByDay(mine), [mine])
  const totalHours = useMemo(() => mine.reduce((sum, s) => sum + shiftHours(s), 0), [mine])
  const unconfirmed = useMemo(() => mine.filter((s) => !s.acknowledged_at).length, [mine])

  const flash = (tone, text) => {
    setBanner({ tone, text })
    setTimeout(() => setBanner(null), 5000)
  }

  const handleConfirm = async (shift) => {
    setBusyId(shift.id)
    try {
      await acknowledgeShift(shift.id)
      setMine((prev) =>
        prev.map((s) => (s.id === shift.id ? { ...s, acknowledged_at: new Date().toISOString() } : s)),
      )
    } catch (err) {
      flash('error', err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleClaim = async (shift) => {
    setBusyId(shift.id)
    try {
      await claimOpenShift(shift.id)
      flash('success', `Shift claimed — ${formatDayLabel(new Date(shift.starts_at))}, ${formatTimeRange(shift)} is yours.`)
      reload()
    } catch (err) {
      flash('error', err.message)
      reload() // someone else may have won the race; refresh the list
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Layout variant="guard">
      <PageHeader
        title="My Schedule"
        description={
          mine.length
            ? `${mine.length} shifts · ${totalHours.toFixed(1).replace(/\.0$/, '')}h over the next ${rangeDays === 14 ? '2 weeks' : 'month'}${unconfirmed ? ` · ${unconfirmed} to confirm` : ''}`
            : 'Your published shifts appear here.'
        }
        action={
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setRangeDays(r.days)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  rangeDays === r.days ? 'bg-white text-black' : 'text-ink-2 hover:bg-white/10'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {banner && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            banner.tone === 'success' ? 'border border-accent-green/20 bg-accent-green/15 text-accent-green' : 'border border-accent-red/20 bg-accent-red/15 text-accent-red'
          }`}
        >
          {banner.text}
        </div>
      )}

      <TimesheetCard guardId={user?.id} siteId={profile?.site_id} />

      {open.length > 0 && (
        <div className="sp-card-elevated mb-6 overflow-hidden border-accent-orange/30/70">
          <div className="flex items-center gap-2 border-b border-accent-orange/20 bg-accent-orange/10 px-5 py-3">
            <Inbox className="h-4 w-4 text-accent-orange" />
            <h2 className="font-display text-sm font-semibold text-accent-orange">
              Available shifts — first come, first served
            </h2>
          </div>
          <div className="divide-y divide-white/5">
            {open.map((shift) => (
              <ShiftRow
                key={shift.id}
                shift={shift}
                action={
                  <button
                    type="button"
                    onClick={() => handleClaim(shift)}
                    disabled={busyId === shift.id}
                    className="sp-btn-primary shrink-0 px-4 py-2 text-xs"
                  >
                    <Hand className="h-3.5 w-3.5" />
                    {busyId === shift.id ? 'Claiming…' : 'Claim'}
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : days.length === 0 ? (
        <div className="sp-card px-6 py-16 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-ink-3" />
          <p className="mt-3 font-medium text-ink-2">No shifts scheduled yet</p>
          <p className="mt-1 text-sm text-ink-3">
            When your admin publishes the roster, your shifts show up here and land in your email.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map(({ date, list }) => (
            <div key={date.toISOString()} className="sp-card overflow-hidden">
              <div className="border-b border-white/5 bg-white/5 px-5 py-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                  {formatDayLabel(date)}
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {list.map((shift) => (
                  <ShiftRow
                    key={shift.id}
                    shift={shift}
                    action={
                      shift.acknowledged_at ? (
                        <span className="dk-pill-ok shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConfirm(shift)}
                          disabled={busyId === shift.id}
                          className="sp-btn-secondary shrink-0 px-4 py-2 text-xs"
                        >
                          {busyId === shift.id ? '…' : 'Confirm'}
                        </button>
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
