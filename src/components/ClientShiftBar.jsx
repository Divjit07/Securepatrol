// Client/site stat header — 2026 Apple-Bento. A clean date pill row over a
// colourful KPI bento (coverage ring + rounds / scans / checkpoints tiles), so
// the client view reads like the admin Overview. Shared by ClientDashboard,
// ClientCheckpoints and SiteDashboard — upgrading here lifts all three.
import { Calendar, Clock, Gauge, Footprints, ScanLine, MapPin } from 'lucide-react'
import { KPI_TONES } from '../lib/brandPalette.js'
import { AnimatedNumber } from './overview/widgets.jsx'
import { useReveal } from '../lib/motion.js'

/** Lime coverage ring tile. */
function RingTile({ pct }) {
  const t = KPI_TONES.lime
  const R = 30
  const C = 2 * Math.PI * R
  const v = Math.max(0, Math.min(100, pct))
  return (
    <div data-reveal className={`bento-face bento-interactive ${t.bg} min-h-[150px]`}>
      <div className="flex items-start justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${t.sub}`}>Coverage</p>
        <Gauge className={`h-4 w-4 ${t.icon}`} />
      </div>
      <div className="absolute inset-x-0 top-[47%] flex -translate-y-1/2 items-center justify-center">
        <svg viewBox="0 0 96 96" className="h-[94px] w-[94px] -rotate-90">
          <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(18,41,13,0.14)" strokeWidth="9" />
          <circle
            cx="48" cy="48" r={R} fill="none" stroke="#12290d" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)}
            className="transition-[stroke-dashoffset] duration-[900ms] ease-out"
          />
        </svg>
        <p className={`absolute font-display text-2xl font-bold tabular-nums ${t.ink}`}>
          <AnimatedNumber value={String(v)} />%
        </p>
      </div>
      <p className={`absolute inset-x-4 bottom-4 text-[11px] font-medium ${t.sub}`}>checkpoints scanned</p>
    </div>
  )
}

/** Colourful KPI tile. */
function StatTile({ tone, icon: Icon, label, value, hint }) {
  const t = KPI_TONES[tone]
  return (
    <div data-reveal className={`bento-face bento-interactive ${t.bg} min-h-[150px]`}>
      <div className="flex items-start justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${t.sub}`}>{label}</p>
        <Icon className={`h-4 w-4 ${t.icon}`} />
      </div>
      <p className={`mt-2 font-display text-5xl font-bold leading-none tabular-nums ${t.ink}`}>
        <AnimatedNumber value={String(value)} />
      </p>
      {hint && <p className={`absolute inset-x-4 bottom-4 text-[11px] font-medium ${t.sub}`}>{hint}</p>}
    </div>
  )
}

export default function ClientShiftBar({ date, setDate, scheduled, stats, hoursLabel }) {
  const label =
    hoursLabel ??
    scheduled?.scheduleLabel ??
    (scheduled?.isClosed ? 'Closed' : null)

  const coverage =
    stats && stats.totalCheckpoints
      ? Math.round((stats.scannedCount / stats.totalCheckpoints) * 100)
      : 0

  const showStats = stats && (!scheduled?.isClosed || hoursLabel)
  const gridRef = useReveal({ deps: [date, coverage, showStats] })

  return (
    <>
      {/* Date + hours pill row */}
      <div className="dk-card mb-4 flex flex-wrap items-center gap-2 p-2.5">
        <label className="flex items-center gap-2 rounded-2xl bg-white/[0.05] px-3 py-2 transition hover:bg-white/[0.08]">
          <Calendar className="h-4 w-4 text-ink-3" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-sm font-medium text-ink outline-none [color-scheme:dark]"
          />
        </label>
        {label && (
          <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium ${scheduled?.isClosed && !hoursLabel ? 'bg-accent-orange/10 text-accent-orange' : 'bg-white/[0.05] text-ink-2'}`}>
            <Clock className="h-4 w-4 shrink-0 opacity-70" />
            <span>{label}</span>
          </div>
        )}
      </div>

      {scheduled?.isClosed && !hoursLabel && (
        <div className="mb-6 rounded-2xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-sm text-accent-orange">
          The building is closed on Sundays. No patrol shift or hours are recorded for this date.
        </div>
      )}

      {showStats && (
        <div ref={gridRef} className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <RingTile pct={coverage} />
          <StatTile
            tone="sky"
            icon={Footprints}
            label="Patrol rounds"
            value={stats.rounds}
            hint={`${stats.patrolCheckpointCount} checkpoints per round`}
          />
          <StatTile
            tone="lavender"
            icon={ScanLine}
            label="Total scans"
            value={stats.patrolScanCount}
            hint={`${stats.rounds} ${stats.rounds === 1 ? 'round' : 'rounds'} today`}
          />
          <StatTile
            tone="moss"
            icon={MapPin}
            label="Checkpoints"
            value={`${stats.scannedCount}/${stats.totalCheckpoints}`}
            hint="unique hit today"
          />
        </div>
      )}
    </>
  )
}
