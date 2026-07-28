// Operations-first Overview — 2026 remaster, "Apple Bento" (heavy).
// An iPhone-widget-gallery board: every surface is a warm rounded tile, colour
// lives on the KPI faces, data sits in soft pill-rows (no hairline tables).
// Answers "is everyone where they should be, and who needs attention?" at a
// glance. Balanced GSAP motion (one stagger reveal) via useReveal. Pure
// presentational — the live dashboard and /dev preview share these props.
import { Link } from 'react-router-dom'
import {
  Building2, Trash2, Clock, ChevronRight, Check, MapPin, ShieldCheck, Gauge,
  ScanLine, BellRing, ArrowUpRight,
} from 'lucide-react'
import { AnimatedNumber } from './widgets.jsx'
import { KPI_TONES } from '../../lib/brandPalette.js'
import { useReveal } from '../../lib/motion.js'

// Warm amber tone for "late" (not in KPI_TONES — cautionary, still colourful).
const AMBER = { bg: 'bg-gradient-to-br from-[#FCE9C0] to-[#F4C877]', ink: 'text-[#4a3510]', sub: 'text-[#5a4212]/75', icon: 'text-[#5a4212]/55' }

function initials(name) {
  return (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// ---- Colourful KPI bento tiles ---------------------------------------------

/** Coverage — hero lime ring gauge (aggregate compliance across scoped sites). */
function CoverageTile({ value }) {
  const t = KPI_TONES.lime
  const R = 33
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div data-reveal className={`bento-face bento-interactive ${t.bg} min-h-[176px]`}>
      <div className="flex items-start justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${t.sub}`}>Coverage</p>
        <Gauge className={`h-4 w-4 ${t.icon}`} />
      </div>
      <div className="absolute inset-x-0 top-[48%] flex -translate-y-1/2 items-center justify-center">
        <svg viewBox="0 0 96 96" className="h-[108px] w-[108px] -rotate-90">
          <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(18,41,13,0.13)" strokeWidth="10" />
          <circle
            cx="48" cy="48" r={R} fill="none" stroke="#12290d" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
            className="transition-[stroke-dashoffset] duration-[900ms] ease-out"
          />
        </svg>
        <p className={`absolute font-display text-[30px] font-bold tabular-nums ${t.ink}`}>
          <AnimatedNumber value={String(pct)} />%
        </p>
      </div>
      <p className={`absolute inset-x-5 bottom-5 text-xs font-medium ${t.sub}`}>of checkpoints scanned today</p>
    </div>
  )
}

/** On duty — sky tile: big count, live pulse, avatar stack. */
function OnDutyTile({ count, guards, live }) {
  const t = KPI_TONES.sky
  const isLive = count > 0 && live
  return (
    <div data-reveal className={`bento-face bento-interactive ${t.bg} min-h-[176px]`}>
      <div className="flex items-start justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${t.sub}`}>On duty now</p>
        <ShieldCheck className={`h-4 w-4 ${t.icon}`} />
      </div>
      <p className={`mt-2 font-display text-6xl font-bold leading-none tabular-nums ${t.ink}`}>
        <AnimatedNumber value={String(count).padStart(2, '0')} />
      </p>
      <div className="absolute inset-x-5 bottom-5 flex items-center gap-2">
        {isLive ? (
          <>
            <div className="flex">
              {guards.slice(0, 4).map((g, i) => (
                <span key={g.id || i} className={`flex h-7 w-7 items-center justify-center rounded-full bg-[#12293b] text-[9px] font-bold text-white ring-2 ring-[#eaf6ff] ${i ? '-ml-2' : ''}`}>
                  {initials(g.name)}
                </span>
              ))}
            </div>
            <span className="live-dot ml-0.5" style={{ background: '#12293b' }} />
            <span className={`text-xs font-semibold ${t.sub}`}>live</span>
          </>
        ) : (
          <span className={`text-xs font-medium ${t.sub}`}>no one on patrol</span>
        )}
      </div>
    </div>
  )
}

/** Running late — warm amber tile. */
function LateTile({ count }) {
  const t = AMBER
  const active = count > 0
  return (
    <div data-reveal className={`bento-face bento-interactive ${active ? t.bg : 'bg-surface'} min-h-[176px] ${active ? '' : 'border border-[color:var(--hairline)]'}`}>
      <div className="flex items-start justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${active ? t.sub : 'text-ink-3'}`}>Running late</p>
        <Clock className={`h-4 w-4 ${active ? t.icon : 'text-ink-3'}`} />
      </div>
      <p className={`mt-2 font-display text-6xl font-bold leading-none tabular-nums ${active ? t.ink : 'text-ink-3'}`}>
        <AnimatedNumber value={String(count).padStart(2, '0')} />
      </p>
      <p className={`absolute inset-x-5 bottom-5 text-xs font-medium ${active ? t.sub : 'text-ink-3'}`}>
        {active ? 'past grace period' : 'all on time'}
      </p>
    </div>
  )
}

/** No-show — blossom tile. */
function NoShowTile({ count }) {
  const t = KPI_TONES.blossom
  const active = count > 0
  return (
    <div data-reveal className={`bento-face bento-interactive ${active ? t.bg : 'bg-surface'} min-h-[176px] ${active ? '' : 'border border-[color:var(--hairline)]'}`}>
      <div className="flex items-start justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${active ? t.sub : 'text-ink-3'}`}>No-show</p>
        <span className="relative">
          <BellRing className={`h-4 w-4 ${active ? t.icon : 'text-ink-3'}`} />
          {active && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent-red" />}
        </span>
      </div>
      <p className={`mt-2 font-display text-6xl font-bold leading-none tabular-nums ${active ? 'text-accent-red' : 'text-ink-3'}`}>
        <AnimatedNumber value={String(count).padStart(2, '0')} />
      </p>
      <p className={`absolute inset-x-5 bottom-5 text-xs font-medium ${active ? t.sub : 'text-ink-3'}`}>
        {active ? 'not clocked in — chase now' : 'everyone checked in'}
      </p>
    </div>
  )
}

// ---- Sites — soft pill-rows inside a bento (no hairline table) --------------

function SiteCard({ site, onEditHours, onDeleteSite, removing }) {
  const pct = Math.max(0, Math.min(100, site.compliance || 0))
  const barColor = pct === 0 ? 'var(--color-accent-red)' : pct >= 80 ? 'var(--color-accent-green)' : '#E8A33D'
  return (
    <div className="group flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
      <Link to={`/admin/site/${site.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
          <Building2 className="h-4.5 w-4.5 text-ink-2" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink">{site.name}</p>
            {site.geofenced ? (
              <span className="hidden shrink-0 items-center gap-0.5 rounded-full bg-accent-green/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent-green sm:inline-flex">
                <MapPin className="h-2.5 w-2.5" />{site.radius}m
              </span>
            ) : (
              <span className="hidden shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-ink-3 sm:inline-flex">No GPS</span>
            )}
          </div>
          <p className="truncate text-xs text-ink-3">{site.guardNames || 'No guards'} · {site.checkpoints} checkpoints</p>
          {/* inline compliance bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(3, pct)}%`, background: barColor }} />
            </div>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: barColor }}>{pct}%</span>
          </div>
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums text-ink">{site.scannedToday}</p>
          <p className="text-[9px] uppercase tracking-wide text-ink-3">scans</p>
        </div>
      </div>

      {(onEditHours || onDeleteSite) && (
        <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
          {onEditHours && (
            <button type="button" onClick={() => onEditHours(site)} className="rounded-lg p-1.5 text-ink-3 transition hover:bg-white/10 hover:text-ink" title="Edit hours">
              <Clock className="h-4 w-4" />
            </button>
          )}
          {onDeleteSite && (
            <button type="button" onClick={() => onDeleteSite(site)} disabled={removing} className="rounded-lg p-1.5 text-ink-3 transition hover:bg-accent-red/10 hover:text-accent-red disabled:opacity-40" title="Remove site">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <Link to={`/admin/site/${site.id}`} className="rounded-lg p-1.5 text-ink-3 transition hover:bg-white/10 hover:text-ink" title="Open site">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

// ---- Alerts — soft cards inside a bento -------------------------------------

const ALERT_TONE = {
  no_show: 'bg-accent-red/15 text-accent-red',
  late: 'bg-[#E8A33D]/15 text-[#E8A33D]',
}
function AlertCard({ alert, onAcknowledge, busy }) {
  const tone = ALERT_TONE[alert.type] || 'bg-accent-cyan/15 text-accent-cyan-line'
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>{alert.typeLabel}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-ink">{alert.message}</p>
        <p className="mt-0.5 text-[11px] text-ink-3">{alert.siteName} · {alert.when}</p>
      </div>
      {onAcknowledge && (
        <button type="button" onClick={() => onAcknowledge(alert.id)} disabled={busy} className="shrink-0 rounded-lg border border-white/10 p-1.5 text-ink-3 transition hover:bg-white/10 hover:text-ink disabled:opacity-50" aria-label="Acknowledge alert">
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ---- Board ------------------------------------------------------------------

export default function OverviewBoard({
  statusSegments = [],
  kpis = [],
  alerts = [],
  onAcknowledge,
  ackBusy,
  sites = [],
  onEditHours,
  onDeleteSite,
  removingId,
  loading,
  emptyLabel = 'No sites yet. Create your first site to get started.',
}) {
  const seg = (i) => statusSegments[i] || { value: 0, tone: 'muted' }
  const onDuty = seg(0)
  const late = seg(1)
  const noShow = seg(2)

  const coverage = sites.length
    ? Math.round(sites.reduce((s, x) => s + (x.compliance || 0), 0) / sites.length)
    : 0
  const totalScans = sites.reduce((s, x) => s + (x.scannedToday || 0), 0)

  const siteCount = kpis[0]?.value ?? sites.length
  const activeGuards = kpis[1]

  // Fabricate a small guard avatar set from site guard names for the On-duty tile.
  const onDutyGuards = sites
    .flatMap((s) => (s.guardNames ? s.guardNames.split(',').map((n) => ({ name: n.trim() })) : []))
    .filter((g) => g.name && g.name !== 'No guards')
    .slice(0, 4)

  const revealRef = useReveal({ deps: [loading, sites.length] })

  return (
    <div ref={revealRef}>
      {/* Colourful KPI bento */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <CoverageTile value={coverage} />
        <OnDutyTile count={onDuty.value} guards={onDutyGuards} live={onDuty.tone !== 'muted'} />
        <LateTile count={late.value} />
        <NoShowTile count={noShow.value} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sites — soft pill-row bento */}
        <div data-reveal className="min-w-0 lg:col-span-2">
          <div className="bento">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-base font-bold text-ink">Sites</h2>
                <span className="text-xs text-ink-3">
                  {siteCount}{activeGuards ? <> · {activeGuards.value} guards{activeGuards.hint ? <span className="text-accent-orange"> · {activeGuards.hint}</span> : null}</> : null}
                </span>
              </div>
              <Link to="/admin/sites" className="flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-ink-2 transition hover:bg-white/10 hover:text-ink">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
              </div>
            ) : sites.length === 0 ? (
              <div className="hatch-empty flex items-center justify-center rounded-2xl border border-white/5 py-16">
                <p className="text-sm text-ink-3">{emptyLabel}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sites.map((site) => (
                  <SiteCard key={site.id} site={site} onEditHours={onEditHours} onDeleteSite={onDeleteSite} removing={removingId === site.id} />
                ))}
              </div>
            )}

            {/* mini footer stat — scans today */}
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-orange/20">
                <ScanLine className="h-4 w-4 text-accent-orange" />
              </div>
              <p className="text-sm text-ink-2"><span className="font-bold text-ink">{totalScans}</span> checkpoint scans today</p>
            </div>
          </div>
        </div>

        {/* Needs attention — soft-card bento */}
        <div data-reveal className="min-w-0">
          <div className="bento h-full">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">Needs attention</h2>
              <Link to="/admin/alerts" className="text-xs font-semibold text-ink-3 transition hover:text-ink">
                {alerts.length ? `${alerts.length} open →` : 'View all →'}
              </Link>
            </div>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.03] px-5 py-12 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-green/15">
                  <Check className="h-5 w-5 text-accent-green" />
                </div>
                <p className="text-sm font-medium text-ink">All clear</p>
                <p className="mt-1 text-xs text-ink-3">Late, no-show and stale-patrol events show up here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a) => (
                  <AlertCard key={a.id} alert={a} onAcknowledge={onAcknowledge} busy={ackBusy === a.id} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
