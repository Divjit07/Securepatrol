// Reference-cloned dashboard widgets (Dark Ops spec §3): segmented ratio bar,
// dotted-bar coverage chart w/ tooltip, cyan line chart on paper, feed timeline.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { CHART } from '../../lib/brandPalette.js'

/** Eased count-up for KPI values ("78", "02", "17%"); keeps padding/suffix. */
export function AnimatedNumber({ value, duration = 800 }) {
  const str = String(value)
  const match = str.match(/^(\d+)(.*)$/)
  const target = match ? parseInt(match[1], 10) : NaN
  const [n, setN] = useState(0)

  useEffect(() => {
    if (Number.isNaN(target)) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(target)
      return undefined
    }
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  if (Number.isNaN(target)) return str
  return `${String(n).padStart(match[1].length, '0')}${match[2]}`
}

export function ExpandChip({ to = '#', onPaper = false }) {
  return (
    <Link
      to={to}
      className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
        onPaper
          ? 'border-black/10 text-black/60 hover:bg-black/5'
          : 'border-white/10 bg-white/5 text-ink-2 hover:bg-white/10 hover:text-ink'
      }`}
    >
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  )
}

export function LegendDot({ color, label, dark = false }) {
  return (
    <span className={`flex items-center gap-1.5 text-[10px] ${dark ? 'text-black/60' : 'text-ink-2'}`}>
      <span className="h-2 w-2 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  )
}

/** Workforce Summary: big total + segmented ratio blocks. */
export function RatioBar({ total, segments }) {
  const denom = Math.max(1, total)

  if (total === 0) {
    return (
      <div className="flex h-14 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-ink-3">
        No guards on the roster
      </div>
    )
  }

  return (
    <div className="flex items-end gap-5">
      <div className="shrink-0">
        <p className="text-4xl font-semibold tracking-tight text-ink">{total}</p>
        <p className="mt-1 max-w-[90px] text-xs leading-tight text-ink-2">Total guards on the roster</p>
      </div>
      <div className="flex h-14 flex-1 items-stretch gap-1.5">
        {segments.map(
          (s) =>
            s.value > 0 && (
              <div
                key={s.label}
                title={`${s.label}: ${s.value}`}
                className="rounded-lg border border-white/15"
                style={{ background: s.color, flexGrow: s.value / denom, flexBasis: 0, minWidth: 14 }}
              />
            ),
        )}
      </div>
    </div>
  )
}

const STATUS_COLORS = {
  adequate: CHART.onPatrol,
  moderate: CHART.upNext,
  missed: CHART.missed,
}

/**
 * Patrol Coverage: per-hour columns of fine dotted vertical lines capped with a
 * solid line in the status color (reference "Shift Coverage" clone).
 */
export function CoverageChart({ hours, maxY = 8 }) {
  const [tip, setTip] = useState(null)
  const W = 720
  const H = 190
  const PAD_L = 26
  const PAD_B = 22
  const innerW = W - PAD_L - 8
  const colW = innerW / Math.max(1, hours.length)
  const yFor = (v) => H - PAD_B - (Math.min(v, maxY) / maxY) * (H - PAD_B - 10)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <pattern id="dotcol" width="4" height="5" patternUnits="userSpaceOnUse">
            <rect x="1.5" y="0" width="1" height="2.5" fill="rgba(255,255,255,0.28)" />
          </pattern>
        </defs>
        {[0, 2, 4, 6, 8].map((v) => (
          <g key={v}>
            <text x={PAD_L - 8} y={yFor(v) + 3} textAnchor="end" fontSize="8" fill={CHART.axis}>
              {v}
            </text>
            <line
              x1={PAD_L} x2={W - 4} y1={yFor(v)} y2={yFor(v)}
              stroke={CHART.grid} strokeDasharray="2 4"
            />
          </g>
        ))}
        {hours.map((h, i) => {
          const x = PAD_L + i * colW + colW * 0.18
          const w = colW * 0.64
          const v = Math.max(h.scanned, 0.15)
          const y = yFor(v)
          const color = STATUS_COLORS[h.status]
          const highlighted = tip?.i === i
          return (
            <g
              key={h.label}
              onMouseEnter={() => setTip({ i, x: x + w / 2, y, ...h })}
              onMouseLeave={() => setTip(null)}
              style={{ cursor: 'default' }}
            >
              <rect x={x} y={y} width={w} height={H - PAD_B - y} fill="url(#dotcol)" opacity={highlighted ? 1 : 0.8} />
              <line x1={x} x2={x + w} y1={y} y2={y} stroke={color} strokeWidth={highlighted ? 3 : 2} />
              {i % 2 === 0 && (
                <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="8" fill={CHART.axis}>
                  {h.label}
                </text>
              )}
              <rect x={PAD_L + i * colW} y={8} width={colW} height={H - PAD_B} fill="transparent" />
            </g>
          )
        })}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-40 rounded-xl bg-surface-2 p-3 shadow-xl shadow-black/40"
          style={{ left: `${(tip.x / W) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
        >
          <p className="text-xs font-semibold text-ink">
            {tip.status === 'adequate' ? 'Adequate Coverage' : tip.status === 'moderate' ? 'Moderate Coverage' : 'Missed Patrols'}
          </p>
          <div className="mt-1.5 space-y-0.5 text-[11px]">
            <p className="flex justify-between"><span className="text-ink-2">Required</span><span className="font-semibold text-accent-orange">{String(tip.required).padStart(2, '0')}</span></p>
            <p className="flex justify-between"><span className="text-ink-2">Variance</span><span className="font-semibold text-accent-orange">{String(Math.abs(tip.scanned - tip.required)).padStart(2, '0')}</span></p>
            <p className="flex justify-between"><span className="text-ink-2">Scanned</span><span className="font-semibold text-accent-orange">{String(tip.scanned).padStart(2, '0')}</span></p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Hourly activity: cyan line/area on the white paper card, peak dot + black tooltip. */
export function ActivityLine({ points, labels }) {
  const W = 340
  const H = 150
  const PAD = 14
  const PAD_B = 20
  const maxV = Math.max(1, ...points)
  const stepX = (W - PAD * 2) / Math.max(1, points.length - 1)
  const yFor = (v) => H - PAD_B - (v / maxV) * (H - PAD_B - 26)
  const coords = points.map((v, i) => [PAD + i * stepX, yFor(v)])
  const peakIdx = points.indexOf(Math.max(...points))
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  const area = `${line} L${PAD + (points.length - 1) * stepX},${H - PAD_B} L${PAD},${H - PAD_B} Z`

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <path d={area} fill="color-mix(in srgb, var(--color-accent-cyan-line) 15%, transparent)" />
        <path d={line} fill="none" stroke="var(--color-accent-cyan-line)" strokeWidth="1.6" />
        {points[peakIdx] > 0 && (
          <>
            <line
              x1={coords[peakIdx][0]} x2={coords[peakIdx][0]}
              y1={coords[peakIdx][1]} y2={H - PAD_B}
              stroke={CHART.peak} strokeDasharray="3 3" strokeWidth="1"
            />
            <circle cx={coords[peakIdx][0]} cy={coords[peakIdx][1]} r="3.5" fill={CHART.peak} />
          </>
        )}
        {labels.map((l, i) =>
          i % 2 === 0 ? (
            <text key={l} x={PAD + i * stepX} y={H - 5} textAnchor="middle" fontSize="7.5" fill={CHART.axis}>
              {l}
            </text>
          ) : null,
        )}
      </svg>
      {points[peakIdx] > 0 && (
        <div
          className="pointer-events-none absolute rounded-xl bg-inset px-3 py-2 text-white shadow-lg"
          style={{ left: `${(coords[peakIdx][0] / W) * 100}%`, top: `${Math.max(14, (coords[peakIdx][1] / H) * 100 - 4)}%`, transform: 'translate(-108%, -60%)' }}
        >
          <p className="text-lg font-bold leading-none">{points[peakIdx]}</p>
          <p className="mt-1 text-[9px] text-white/60">Peak scans / hour</p>
        </div>
      )}
    </div>
  )
}

const PILL_STYLES = [
  'bg-accent-cyan text-cyan-950',
  'border border-white/15 bg-white/5 text-ink',
  'border border-white/15 bg-white/5 text-ink',
]

/** Live feed: avatar + pill rows on a dotted time grid (reference Live Task Board). */
export function FeedTimeline({ items }) {
  return (
    <div
      className="space-y-3 rounded-xl py-2"
      style={{
        backgroundImage:
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 56px)',
      }}
    >
      {items.length === 0 && (
        <p className="px-2 py-8 text-center text-sm text-ink-3">No scans yet today.</p>
      )}
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center" style={{ paddingLeft: `${Math.min(i * 26, 130)}px` }}>
          <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-orange/20 text-[9px] font-bold text-accent-orange ring-2 ring-surface">
            {item.initials}
          </div>
          <span
            className={`-ml-1 flex items-center gap-1 truncate rounded-full py-1 pl-3 pr-3 text-[11px] ${PILL_STYLES[Math.min(i, 2)]}`}
          >
            <strong className="font-semibold">{item.name}</strong>
            <span className={i === 0 ? 'text-cyan-900/70' : 'text-ink-2'}>
              · {item.detail} | {item.time}
            </span>
          </span>
          <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
        </div>
      ))}
    </div>
  )
}
