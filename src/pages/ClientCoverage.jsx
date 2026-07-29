import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ShieldCheck, CalendarDays, ArrowRight } from 'lucide-react'
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

// Rotating pastel per weekday so the coverage list isn't a wall of white.
const DAY_TONES = [
  { bg: '#D9F0FF', ink: '#12293b', sub: 'rgba(23,51,71,0.72)', dot: '#12293b' }, // sky
  { bg: '#ECEEFE', ink: '#20244d', sub: 'rgba(44,48,87,0.72)', dot: '#20244d' }, // lavender
  { bg: '#FBE4E3', ink: '#42201c', sub: 'rgba(74,39,35,0.72)', dot: '#42201c' }, // blossom
  { bg: '#DFF4E8', ink: '#0e2c1b', sub: 'rgba(18,53,36,0.75)', dot: '#0e2c1b' }, // mint
  { bg: '#ECFAB5', ink: '#34400f', sub: 'rgba(52,64,15,0.72)', dot: '#34400f' }, // meadow
  { bg: '#FDECC8', ink: '#4a3510', sub: 'rgba(74,53,16,0.72)', dot: '#4a3510' }, // amber
  { bg: '#E7E9EC', ink: '#25292e', sub: 'rgba(37,41,46,0.7)', dot: '#25292e' },  // graphite
]

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
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const gridRef = useReveal({ deps: [loading, shifts.length, weekStart] })

  return (
    <Layout variant="client">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#EDF8FF] to-[#D9F0FF] text-[#12293b] shadow-[0_10px_24px_-8px_rgba(150,200,240,0.8)]">
            <CalendarDays className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="deck-eyebrow text-accent-cyan-line">Client Portal · Coverage</p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight sm:text-[2rem]">Coverage</h1>
            <p className="mt-1 text-sm text-ink-2">
              <span className="font-semibold text-ink">{shifts.length}</span> shift{shifts.length === 1 ? '' : 's'} scheduled this week, straight from the published roster.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          {onDutyNow.length > 0 && (
            <span className="hidden items-center gap-2 rounded-full bg-accent-green/15 px-3 py-2 text-sm font-bold text-accent-green md:flex">
              <span className="live-dot" /> {onDutyNow[0].profiles?.name || 'On duty'}
            </span>
          )}
          <div className="flex items-center gap-1 rounded-full border border-[color:var(--hairline)] bg-[var(--fill-subtle)] p-1">
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-full p-2 text-ink-2 transition hover:bg-white/10 hover:text-ink" aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-semibold text-ink-2">{weekLabel}</span>
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-full p-2 text-ink-2 transition hover:bg-white/10 hover:text-ink" aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

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
          {days.map((day, i) => {
            const dayShifts = shifts.filter((s) => sameDay(new Date(s.starts_at), day))
            const isToday = sameDay(day, now)
            const tone = isToday
              ? { ink: '#12290d', sub: 'rgba(18,41,13,0.7)', dot: '#12290d' }
              : DAY_TONES[i % DAY_TONES.length]
            return (
              <Link
                key={day.toISOString()}
                to={`/client?date=${ymd(day)}`}
                data-reveal
                className={`group relative block overflow-hidden rounded-[22px] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:brightness-[0.98] ${isToday ? 'bg-gradient-to-br from-[#ECFAB5] to-[#96EE60] ring-2 ring-[#12290d]/15' : ''}`}
                style={isToday ? undefined : { background: tone.bg }}
                title={`Open ${formatDayLabel(day)} overview`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: tone.ink }}>
                    {formatDayLabel(day)}{isToday && ' · Today'}
                  </h2>
                  <span className="flex items-center gap-2">
                    {isToday && (
                      <span className="flex items-center gap-1.5 rounded-full bg-[#12290d]/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: tone.ink }}>
                        <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ background: tone.ink }} /> Live
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" style={{ color: tone.ink }} />
                  </span>
                </div>
                {dayShifts.length === 0 ? (
                  <p className="text-sm font-medium" style={{ color: tone.sub }}>No scheduled coverage</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayShifts.map((s) => (
                      <div key={s.id} className="flex items-center gap-2.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone.dot }} />
                        <span className="font-semibold" style={{ color: tone.ink }}>{s.profiles?.name || 'Unassigned'}</span>
                        <span className="ml-auto text-sm font-semibold tabular-nums" style={{ color: tone.sub }}>{formatTimeRange(s)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
