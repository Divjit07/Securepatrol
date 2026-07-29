// Client/site stat header — 2026 Apple-Bento. A clean date pill row over a
// colourful KPI bento (coverage ring + rounds / scans / checkpoints tiles), so
// the client view reads like the admin Overview. Shared by ClientDashboard,
// ClientCheckpoints and SiteDashboard — upgrading here lifts all three.
import { Calendar, Clock, UserCheck, Footprints, ScanLine, MapPin } from 'lucide-react'
import { KPI_TONES } from '../lib/brandPalette.js'
import { AnimatedNumber } from './overview/widgets.jsx'
import { useReveal } from '../lib/motion.js'

const gInitials = (name) =>
  (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

/** On-duty guard hero tile (lime) — the clocked-in guard's name in bold. */
function OnDutyTile({ guard }) {
  const t = KPI_TONES.lime
  const first = guard ? guard.name.split(/\s+/)[0] || guard.name : null
  return (
    <div data-reveal className={`bento-face bento-interactive ${t.bg} flex min-h-[168px] flex-col justify-between`}>
      <div className="flex items-start justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${t.sub}`}>On duty</p>
        <UserCheck className={`h-4 w-4 ${t.icon}`} />
      </div>
      {guard ? (
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#12290d] text-[11px] font-bold text-[#d6f5b8]">
              {gInitials(guard.name)}
            </span>
            <p className={`min-w-0 flex-1 truncate font-display text-[24px] font-bold uppercase leading-none tracking-tight ${t.ink}`}>
              {first} <span className="text-base font-semibold normal-case opacity-60">({gInitials(guard.name)})</span>
            </p>
          </div>
          <p className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${t.sub}`}>
            <span className="live-dot" style={{ background: '#12290d' }} /> Clocked in {guard.time}
          </p>
        </div>
      ) : (
        <div>
          <p className={`font-display text-xl font-bold ${t.ink}`}>No one on duty</p>
          <p className={`mt-1 text-xs font-medium ${t.sub}`}>Waiting for clock-in</p>
        </div>
      )}
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

export default function ClientShiftBar({ date, setDate, scheduled, stats, hoursLabel, showStats = true, onDutyGuard = null }) {
  const label =
    hoursLabel ??
    scheduled?.scheduleLabel ??
    (scheduled?.isClosed ? 'Closed' : null)

  const coverage =
    stats && stats.totalCheckpoints
      ? Math.round((stats.scannedCount / stats.totalCheckpoints) * 100)
      : 0

  const renderStats = showStats && stats && (!scheduled?.isClosed || hoursLabel)
  const gridRef = useReveal({ deps: [date, coverage, showStats] })

  return (
    <>
      {/* Date + hours pill row */}
      <div className="dk-card mb-4 flex flex-wrap items-center gap-2 p-2.5">
        <label className="flex items-center gap-2 rounded-2xl bg-[#D9F0FF] px-3 py-2 ring-1 ring-[#12293b]/10 transition hover:brightness-[0.98] [color-scheme:light]">
          <Calendar className="h-4 w-4 text-[#12293b]" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-sm font-semibold text-[#12293b] outline-none"
          />
        </label>
        {label && (
          <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ring-1 ${scheduled?.isClosed && !hoursLabel ? 'bg-accent-orange/10 text-accent-orange ring-accent-orange/20' : 'bg-[#ECEEFE] text-[#33375c] ring-[#33375c]/10'}`}>
            <Clock className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </div>
        )}
      </div>

      {scheduled?.isClosed && !hoursLabel && (
        <div className="mb-6 rounded-2xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-sm text-accent-orange">
          The building is closed on Sundays. No patrol shift or hours are recorded for this date.
        </div>
      )}

      {renderStats && (
        <div ref={gridRef} className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <OnDutyTile guard={onDutyGuard} />
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
