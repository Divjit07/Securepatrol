import { KPI_TONES } from '../lib/brandPalette.js'
import { AnimatedNumber } from './overview/widgets.jsx'

/** KPI card — reference anatomy: big value + icon top-right, label under. */
export default function KpiCard({ icon: Icon, label, value, tone }) {
  const t = KPI_TONES[tone]
  if (t) {
    return (
      <div className={`bento-face bento-interactive kpi-tone-card ${t.bg}`}>
        <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-white/40 blur-xl" />
        <div className="relative flex items-start justify-between">
          <p className={`kpi-tone-value font-display text-[40px] font-bold leading-none tracking-tight tabular-nums ${t.ink}`}>
            <AnimatedNumber value={value} />
          </p>
          <Icon className={`kpi-tone-icon h-4 w-4 ${t.icon}`} />
        </div>
        <p className={`kpi-tone-label relative mt-3 text-xs font-medium ${t.sub}`}>{label}</p>
      </div>
    )
  }
  return (
    <div className="dk-card p-5">
      <div className="flex items-start justify-between">
        <p className="text-4xl font-semibold tracking-tight text-ink tabular-nums">
          <AnimatedNumber value={value} />
        </p>
        <Icon className="h-4 w-4 text-ink-3" />
      </div>
      <p className="mt-2 text-xs text-ink-2">{label}</p>
    </div>
  )
}
