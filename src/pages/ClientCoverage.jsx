import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ShieldCheck, CalendarDays } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useReveal } from '../lib/motion.js'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  fetchShiftsInRange,
  startOfWeek,
  addDays,
  sameDay,
  formatTimeRange,
  formatDayLabel,
} from '../lib/schedule.js'

/** Read-only weekly coverage view for clients: who protects the site, when. */
export default function ClientCoverage() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    fetchShiftsInRange(siteId, weekStart, addDays(weekStart, 7))
      .then(setShifts)
      .catch(() => setShifts([]))
      .finally(() => setLoading(false))
  }, [siteId, weekStart])

  const now = new Date()
  const onDutyNow = useMemo(
    () => shifts.filter((s) => new Date(s.starts_at) <= now && new Date(s.ends_at) > now),
    [shifts],
  )
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const weekLabel = `${weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${addDays(weekStart, 6).toLocaleDateString([], { month: 'short', day: 'numeric' })}`

  const gridRef = useReveal({ deps: [loading, shifts.length, weekStart] })

  return (
    <Layout variant="client">
      <PageHeader
        title="Coverage"
        description="Scheduled guard coverage at your site, straight from the published roster."
        action={
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-surface p-1 shadow-sm">
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-lg p-2 text-ink-2 hover:bg-white/10" aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-semibold text-ink-2">{weekLabel}</span>
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-lg p-2 text-ink-2 hover:bg-white/10" aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {onDutyNow.length > 0 && (
        <div className="sp-card-elevated mb-6 flex items-center gap-4 border-accent-green/30 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-green/15 text-accent-green">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent-green"><span className="live-dot" /> On duty now</p>
            <p className="font-display text-lg font-semibold text-ink">
              {onDutyNow.map((s) => s.profiles?.name || 'Guard').join(', ')}
            </p>
            <p className="text-sm text-ink-2">{onDutyNow.map((s) => formatTimeRange(s)).join(' · ')}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="sp-card px-6 py-16 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-ink-3" />
          <p className="mt-3 font-medium text-ink-2">No coverage published for this week yet</p>
          <p className="mt-1 text-sm text-ink-3">Published guard schedules appear here automatically.</p>
        </div>
      ) : (
        <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {days.map((day) => {
            const dayShifts = shifts.filter((s) => sameDay(new Date(s.starts_at), day))
            const isToday = sameDay(day, now)
            return (
              <div key={day.toISOString()} data-reveal className={`sp-card overflow-hidden ${isToday ? 'ring-2 ring-accent-cyan-line/30' : ''}`}>
                <div className={`border-b border-white/5 px-5 py-2.5 ${isToday ? 'bg-accent-cyan/10' : 'bg-white/5'}`}>
                  <h2 className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-accent-cyan-line' : 'text-ink-2'}`}>
                    {formatDayLabel(day)} {isToday && '· Today'}
                  </h2>
                </div>
                {dayShifts.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-ink-3">No scheduled coverage</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {dayShifts.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-accent-cyan/100" />
                        <span className="font-medium text-ink">{s.profiles?.name || 'Unassigned'}</span>
                        <span className="ml-auto text-sm text-ink-2">{formatTimeRange(s)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
