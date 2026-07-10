import { Calendar, Clock } from 'lucide-react'

function GuardStatCard({ label, value, hint, accent = false }) {
  const cardClass = accent ? 'stat-card-accent' : 'dk-card guard-stat-neutral'
  return (
    <div className={`rounded-2xl p-4 ${cardClass}`}>
      <p className="text-sm text-ink-2">{label}</p>
      <p className="stat-card-value text-2xl font-bold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  )
}

export default function ClientShiftBar({ date, setDate, scheduled, stats }) {
  return (
    <>
      <div className="dk-card guard-shift-date-bar mb-6 flex flex-wrap gap-4 p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-ink-2" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sp-input rounded-lg px-3 py-2"
          />
        </div>
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${scheduled?.isClosed ? 'bg-accent-orange/10 text-accent-orange' : 'bg-white/5 text-ink-2'}`}>
          <Clock className="h-4 w-4 shrink-0 opacity-70" />
          <span>{scheduled?.scheduleLabel || '11:00 AM – 8:00 PM'}</span>
        </div>
      </div>

      {scheduled?.isClosed && (
        <div className="mb-6 rounded-xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-sm text-accent-orange">
          The building is closed on Sundays. No patrol shift or hours are recorded for this date.
        </div>
      )}

      {stats && !scheduled?.isClosed && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <GuardStatCard
            label="Patrol rounds"
            value={stats.rounds}
            hint={`${stats.patrolCheckpointCount} checkpoints per round`}
          />
          <GuardStatCard
            label="Total scans"
            value={stats.patrolScanCount}
            hint={`${stats.scannedCount} of ${stats.totalCheckpoints} unique checkpoints · ${stats.rounds} ${stats.rounds === 1 ? 'round' : 'rounds'}`}
            accent
          />
        </div>
      )}
    </>
  )
}
