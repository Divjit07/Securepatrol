// iOS-widget-gallery style tiles for the Overview board, skinned with the
// Dark Ops brand palette (KPI tone gradients + theme tokens — no Apple colors).
// Each tile is a rounded square/2x1 card with its name + subtitle centered
// underneath, like the iPhone widget picker.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Gauge,
  ShieldCheck,
  ScanLine,
  BellRing,
  Plus,
  CalendarDays,
  Search,
  ArrowUpRight,
  Check,
  RotateCw,
} from 'lucide-react'
import { KPI_TONES } from '../../lib/brandPalette.js'
import { AnimatedNumber, RatioBar, LegendDot, ExpandChip } from './widgets.jsx'

/** Widget shell: tile + centered label/sub below (iOS widget-picker anatomy). */
export function Tile({ label, sub, span = 1, delay = 0, className = '', children }) {
  return (
    <div className={`ios-rise flex min-w-0 flex-col ${span === 2 ? 'col-span-2' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div className={`relative flex-1 overflow-hidden rounded-[28px] p-5 ${span === 2 ? 'aspect-[2.05/1]' : 'aspect-square'} ${className}`}>
        {children}
      </div>
      <div className="mt-2.5 text-center">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        {sub && <p className="text-xs text-ink-3">{sub}</p>}
      </div>
    </div>
  )
}

function TileHeading({ text, icon: Icon, tone }) {
  return (
    <div className="flex items-start justify-between">
      <p className={`text-[11px] font-bold uppercase tracking-wider ${tone.sub}`}>{text}</p>
      <Icon className={`h-4 w-4 ${tone.icon}`} />
    </div>
  )
}

/** Compliance ring — lime gradient tile (KPI lime tone). */
export function ComplianceTile({ value, siteLabel, delay = 0 }) {
  const tone = KPI_TONES.lime
  const R = 34
  const C = 2 * Math.PI * R
  return (
    <Tile label="Compliance" sub={`Today · ${siteLabel}`} delay={delay} className={tone.bg}>
      <TileHeading text="Compliance" icon={Gauge} tone={tone} />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 96 96" className="h-[66%] w-[66%] -rotate-90">
          <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(18,41,13,0.15)" strokeWidth="9" />
          <circle
            cx="48" cy="48" r={R} fill="none" stroke="#12290d" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, value) / 100)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <p className={`absolute text-3xl font-bold tracking-tight ${tone.ink}`}>
          <AnimatedNumber value={String(value)} />
        </p>
      </div>
      <p className={`absolute bottom-5 left-5 text-xs font-medium ${tone.sub}`}>of checkpoints scanned</p>
    </Tile>
  )
}

/** Guards on duty — sky tile with initial chips. */
export function OnDutyTile({ guards, delay = 0 }) {
  const tone = KPI_TONES.sky
  const names = guards.map((g) => (g.name || 'Guard').split(' ')[0])
  return (
    <Tile label="Guards on duty" sub="Live roster" delay={delay} className={tone.bg}>
      <TileHeading text="On duty" icon={ShieldCheck} tone={tone} />
      <p className={`mt-3 text-5xl font-bold tracking-tight ${tone.ink}`}>
        <AnimatedNumber value={String(guards.length).padStart(2, '0')} />
      </p>
      <div className="absolute bottom-5 left-5 right-5 flex items-center">
        {guards.slice(0, 4).map((g, i) => (
          <span
            key={g.id || i}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#12293b] text-[10px] font-bold text-white ${i ? '-ml-2' : ''}`}
          >
            {(g.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
          </span>
        ))}
        <span className={`ml-2 truncate text-xs font-medium ${tone.sub}`}>
          {names.length ? [...new Set(names)].join(' · ') : 'No one on patrol'}
        </span>
      </div>
    </Tile>
  )
}

/** Patrol rounds — sky tile: completed rounds + progress into the current one. */
export function RoundsTile({ rounds, scansIntoRound = 0, checkpointCount = 0, delay = 0 }) {
  const tone = KPI_TONES.sky
  const pct = checkpointCount ? Math.min(100, Math.round((scansIntoRound / checkpointCount) * 100)) : 0
  return (
    <Tile label="Patrol Rounds" sub="Completed today" delay={delay} className={tone.bg}>
      <TileHeading text="Rounds" icon={RotateCw} tone={tone} />
      <p className={`mt-3 text-5xl font-bold tracking-tight ${tone.ink}`}>
        <AnimatedNumber value={String(rounds).padStart(2, '0')} />
      </p>
      <div className="absolute bottom-5 left-5 right-5">
        {checkpointCount > 0 ? (
          <>
            <p className={`text-xs font-medium ${tone.sub}`}>
              {scansIntoRound} of {checkpointCount} checkpoints this round
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#12293b]/15">
              <div className="h-full rounded-full bg-[#12293b] transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <p className={`text-xs font-medium ${tone.sub}`}>No checkpoints set up yet</p>
        )}
      </div>
    </Tile>
  )
}

/** Scans today — lavender tile with sparkline. */
export function ScansTile({ count, points, delay = 0 }) {
  const tone = KPI_TONES.lavender
  const pts = points.length > 1 ? points : [0, 0]
  const max = Math.max(1, ...pts)
  const W = 100
  const H = 34
  const step = W / (pts.length - 1)
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`).join(' ')
  return (
    <Tile label="Scans Today" sub="Checkpoint activity" delay={delay} className={tone.bg}>
      <TileHeading text="Scans" icon={ScanLine} tone={tone} />
      <p className={`mt-3 text-5xl font-bold tracking-tight ${tone.ink}`}>
        <AnimatedNumber value={String(count)} />
      </p>
      <svg viewBox={`0 0 ${W} ${H + 2}`} preserveAspectRatio="none" className="absolute bottom-5 left-5 h-10 w-[calc(100%-2.5rem)]">
        <path d={`${line} L${W},${H + 2} L0,${H + 2} Z`} fill="rgba(32,36,77,0.12)" />
        <path d={line} fill="none" stroke="#20244d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </Tile>
  )
}

/** Analog site clock on paper — ticks along with the real time. */
export function ClockTile({ code, sub, delay = 0 }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const hourDeg = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5
  const minDeg = now.getMinutes() * 6
  return (
    <Tile label="Site Clock" sub={sub} delay={delay} className="bg-paper">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="h-[84%] w-[84%]">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180
            return (
              <line
                key={i}
                x1={50 + 42 * Math.sin(a)} y1={50 - 42 * Math.cos(a)}
                x2={50 + 46 * Math.sin(a)} y2={50 - 46 * Math.cos(a)}
                stroke="#141414" strokeWidth={i % 3 === 0 ? 2.5 : 1.2} strokeLinecap="round"
              />
            )
          })}
          <text x="50" y="34" textAnchor="middle" fontSize="9" fontWeight="700" fill="#141414" opacity="0.4">
            {code}
          </text>
          <line x1="50" y1="50" x2={50 + 22 * Math.sin((hourDeg * Math.PI) / 180)} y2={50 - 22 * Math.cos((hourDeg * Math.PI) / 180)} stroke="#141414" strokeWidth="4" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + 34 * Math.sin((minDeg * Math.PI) / 180)} y2={50 - 34 * Math.cos((minDeg * Math.PI) / 180)} stroke="#141414" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3" fill="var(--color-accent-orange)" />
        </svg>
      </div>
    </Tile>
  )
}

/** Live feed — dark inset tile with avatar rows. */
export function FeedTile({ count, items, to = '#', delay = 0 }) {
  return (
    <Tile label="Live Feed" sub="Latest checkpoint scans" span={2} delay={delay} className="border border-white/5 bg-inset">
      <div className="flex items-center justify-between">
        <p className="font-display text-[17px] font-bold text-ink">
          <span className="text-accent-orange">{count}</span> Scans Today
        </p>
        <Link to={to} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-ink transition hover:bg-white/15">
          Feed <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 && <p className="py-6 text-center text-sm text-ink-3">No scans yet today.</p>}
        {items.slice(0, 6).map((f) => (
          <div key={f.id} className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-orange/20 text-[9px] font-bold text-accent-orange">
              {f.initials}
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] text-ink">
              <span className="font-semibold">{f.name}</span>
              <span className="text-ink-2"> {f.detail}</span>
            </p>
            <span className="text-xs text-ink-3">{f.time}</span>
          </div>
        ))}
      </div>
    </Tile>
  )
}

/** Patrol coverage — paper tile with hourly bars, peak highlighted. */
export function CoverageTile({ hours, delay = 0 }) {
  const max = Math.max(1, ...hours.map((h) => h.scanned))
  const first = hours[0]?.label || '08:00'
  const last = hours[hours.length - 1]?.label || '20:00'
  const mid = hours[Math.floor(hours.length / 2)]?.label
  return (
    <Tile label="Patrol Coverage" sub={`Scans per hour, ${first} – ${last}`} span={2} delay={delay} className="bg-paper">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-black/45">Coverage</p>
        <p className="text-xs font-bold text-black/70">Peak {max} / hr</p>
      </div>
      <div className="absolute bottom-9 left-5 right-5 flex h-[52%] items-end gap-[5px]">
        {hours.map((h, i) => (
          <div
            key={i}
            title={`${h.label}: ${h.scanned} scans`}
            className="flex-1 rounded-[5px]"
            style={{
              height: `${Math.max(8, (h.scanned / max) * 100)}%`,
              background:
                h.status === 'missed'
                  ? 'rgba(20,20,20,0.12)'
                  : 'var(--color-accent-orange)',
              opacity: h.status === 'missed' ? 1 : h.scanned === max ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-4 left-5 right-5 flex justify-between text-[10px] font-medium text-black/40">
        <span>{first}</span>
        {mid && <span>{mid}</span>}
        <span>{last}</span>
      </div>
    </Tile>
  )
}

/** Open alerts — blossom tile: count + red badge, matching the KPI tone. */
export function AlertsCountTile({ count, summary = '', delay = 0 }) {
  const tone = KPI_TONES.blossom
  return (
    <Tile label="Alerts" sub={count ? `${count} need attention` : 'All clear'} delay={delay} className={tone.bg}>
      <div className="flex items-start justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-wider ${tone.sub}`}>Open alerts</p>
        <span className="relative">
          <BellRing className={`h-4 w-4 ${tone.icon}`} />
          {count > 0 && <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-accent-red" />}
        </span>
      </div>
      <p className={`mt-3 text-5xl font-bold tracking-tight ${tone.ink}`}>
        <AnimatedNumber value={String(count).padStart(2, '0')} />
      </p>
      <p className={`absolute bottom-5 left-5 right-5 truncate text-xs font-medium ${tone.sub}`}>
        {count ? summary : 'Late, no-show and stale patrols land here.'}
      </p>
    </Tile>
  )
}

/** Workforce summary — dark tile wrapping the segmented roster ratio bar. */
export function WorkforceTile({ total, segments, to = '/admin/roster', delay = 0 }) {
  return (
    <Tile label="Workforce Summary" sub="Roster status right now" span={2} delay={delay} className="border border-white/5 bg-surface">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Workforce</p>
          <ExpandChip to={to} />
        </div>
        <div className="mt-1 flex justify-end">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {segments.map((s) => (
              <LegendDot key={s.label} color={s.color} label={s.label} />
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center">
          <div className="w-full">
            <RatioBar total={total} segments={segments} />
          </div>
        </div>
      </div>
    </Tile>
  )
}

/** Open alerts — dark tile with red badge + acknowledge actions. */
export function AlertsTile({ alerts, typeLabels = {}, onAcknowledge, busyId, delay = 0 }) {
  const n = alerts.length
  return (
    <Tile label="Alerts" sub={n ? `${n} need attention` : 'All clear'} span={2} delay={delay} className="border border-white/5 bg-surface">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Open alerts</p>
        <span className="relative">
          <BellRing className="h-4 w-4 text-ink-2" />
          {n > 0 && <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-accent-red" />}
        </span>
      </div>
      {n === 0 ? (
        <div className="hatch-empty absolute inset-x-5 bottom-5 top-12 flex items-center justify-center rounded-2xl border border-white/5">
          <p className="text-sm text-ink-3">Late, no-show and stale patrols land here.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {alerts.slice(0, 4).map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent-orange/80">
                  {(typeLabels[a.event_type] || a.event_type)} · {a.sites?.name}
                </p>
                <p className="truncate text-[13px] text-ink-2">{a.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onAcknowledge(a.id)}
                disabled={busyId === a.id}
                className="shrink-0 rounded-full border border-white/10 p-1.5 text-ink-3 transition hover:bg-white/10 hover:text-ink disabled:opacity-50"
                aria-label="Acknowledge"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Tile>
  )
}

/** Quick actions — dark tile, app-widget style (search pill + two buttons). */
export function ActionsTile({ initial = 'A', onNewSite, delay = 0 }) {
  return (
    <Tile label="Kronus" sub="Quick admin actions" span={2} delay={delay} className="border border-white/5 bg-surface">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
          <Search className="h-4 w-4 text-ink-3" />
          <span className="flex-1 text-sm text-ink-3">Search site data…</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-orange text-[11px] font-bold text-black">
            {initial}
          </span>
        </div>
        <div className="mt-3 grid flex-1 grid-cols-2 gap-3">
          <button type="button" onClick={onNewSite} className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 transition hover:bg-white/10">
            <Plus className="h-6 w-6 text-accent-orange" />
            <span className="text-[13px] font-medium text-ink-2">New Site</span>
          </button>
          <Link to="/admin/roster" className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 transition hover:bg-white/10">
            <CalendarDays className="h-6 w-6 text-accent-orange" />
            <span className="text-[13px] font-medium text-ink-2">Roster</span>
          </Link>
        </div>
      </div>
    </Tile>
  )
}
