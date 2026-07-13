// Operations-first Overview. Answers the only question an admin opens the app
// for — "is everyone where they should be, and who needs attention?" — before
// any detail. No rings, donuts, sparklines or load animations: a status band,
// KPI tiles, an alert list, and clean site rows. Pure presentational;
// both the live dashboard and the /dev preview render it.
import { Link } from 'react-router-dom'
import { Building2, Clock, Trash2, ChevronRight, Check, MapPin } from 'lucide-react'
import ClockActivity from './ClockActivity.jsx'

// Colored pills — the only place colour lives on the black/white canvas.
const PILL_TONE = {
  green: 'bg-accent-green/15 text-accent-green',
  amber: 'bg-[#E8A33D]/15 text-[#E8A33D]',
  red: 'bg-accent-red/15 text-accent-red',
  muted: 'bg-white/10 text-ink-2',
}
const NUM_TONE = {
  green: 'text-accent-green',
  amber: 'text-[#E8A33D]',
  red: 'text-accent-red',
  muted: 'text-ink',
}

// iOS-style widget tile: big radius, soft surface, quiet border.
function WidgetTile({ children, className = '' }) {
  return (
    <div className={`rounded-[26px] border border-white/8 bg-surface p-5 shadow-[var(--card-shine)] ${className}`}>
      {children}
    </div>
  )
}

function StatusBand({ segments }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
      {segments.map((s) => (
        <WidgetTile key={s.label}>
          <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${PILL_TONE[s.tone] || PILL_TONE.muted}`}>
            {s.pill || s.label}
          </span>
          <p className={`mt-4 text-4xl font-bold tabular-nums ${NUM_TONE[s.tone] || 'text-ink'}`}>{s.value}</p>
          <p className="mt-1 text-xs text-ink-3">{s.label}</p>
        </WidgetTile>
      ))}
    </div>
  )
}

function KpiRow({ kpis }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3">
      {kpis.map((k) => (
        <WidgetTile key={k.label}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{k.label}</p>
          <p className={`mt-2 text-3xl font-bold tabular-nums ${k.danger ? 'text-accent-red' : 'text-ink'}`}>{k.value}</p>
          {k.hint ? <p className="mt-0.5 text-xs text-ink-3">{k.hint}</p> : null}
        </WidgetTile>
      ))}
    </div>
  )
}

function AlertRow({ alert, onAcknowledge, busy }) {
  const tone =
    alert.type === 'no_show' ? 'bg-accent-red/15 text-accent-red'
    : alert.type === 'late' ? 'bg-[#E8A33D]/15 text-[#E8A33D]'
    : 'bg-accent-cyan/15 text-accent-cyan-line'
  return (
    <div className="flex items-start gap-3 border-t border-white/5 px-4 py-3 first:border-t-0">
      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
        {alert.typeLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-ink">{alert.message}</p>
        <p className="mt-0.5 text-[11px] text-ink-3">{alert.siteName} · {alert.when}</p>
      </div>
      {onAcknowledge && (
        <button
          type="button"
          onClick={() => onAcknowledge(alert.id)}
          disabled={busy}
          className="shrink-0 rounded-lg border border-white/10 p-1.5 text-ink-3 transition hover:bg-white/10 hover:text-ink disabled:opacity-50"
          aria-label="Acknowledge alert"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function SiteRow({ site, onEditHours, onDeleteSite, removing }) {
  return (
    <div className="flex items-center gap-3 border-t border-white/5 px-4 py-3 first:border-t-0">
      <Link to={`/admin/site/${site.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
          <Building2 className="h-4 w-4 text-ink-2" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{site.name}</p>
          <p className="truncate text-xs text-ink-3">
            {site.guardNames || 'No guards'} · {site.checkpoints} checkpoints
          </p>
        </div>
      </Link>

      <div className="hidden shrink-0 items-center gap-4 text-right sm:flex">
        <div>
          <p className="text-sm font-bold tabular-nums text-ink">{site.scannedToday}</p>
          <p className="text-[10px] uppercase tracking-wide text-ink-3">Scans</p>
        </div>
        <div>
          <p className={`text-sm font-bold tabular-nums ${site.compliance === 0 ? 'text-accent-red' : 'text-ink'}`}>
            {site.compliance}%
          </p>
          <p className="text-[10px] uppercase tracking-wide text-ink-3">Compliance</p>
        </div>
      </div>

      <span
        className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold md:flex ${
          site.geofenced ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
        }`}
        title={site.geofenced ? `Geofenced · ${site.radius}m` : 'No GPS set'}
      >
        <MapPin className="h-3 w-3" />
        {site.geofenced ? `${site.radius}m` : 'No GPS'}
      </span>

      {(onEditHours || onDeleteSite) && (
        <div className="flex shrink-0 items-center">
          {onEditHours && (
            <button type="button" onClick={() => onEditHours(site)} className="rounded-lg p-1.5 text-ink-3 hover:bg-white/10 hover:text-ink" title="Edit hours">
              <Clock className="h-4 w-4" />
            </button>
          )}
          {onDeleteSite && (
            <button type="button" onClick={() => onDeleteSite(site)} disabled={removing} className="rounded-lg p-1.5 text-ink-3 hover:bg-accent-red/10 hover:text-accent-red disabled:opacity-40" title="Remove site">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <Link to={`/admin/site/${site.id}`} className="rounded-lg p-1.5 text-ink-3 hover:bg-white/10 hover:text-ink" title="Open site">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

export default function OverviewBoard({
  statusSegments,
  kpis,
  alerts,
  onAcknowledge,
  ackBusy,
  sites,
  onEditHours,
  onDeleteSite,
  removingId,
  loading,
  clockActivity = [],
  emptyLabel = 'No sites yet. Create your first site to get started.',
}) {
  return (
    <>
      <StatusBand segments={statusSegments} />
      <KpiRow kpis={kpis} />

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Sites */}
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-ink">Sites</h2>
            <Link to="/admin/sites" className="text-xs font-medium text-ink-3 hover:text-ink">View all →</Link>
          </div>
          <div className="overflow-hidden rounded-[26px] border border-white/8 bg-surface">
            {loading ? (
              <div className="flex justify-center py-14">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
              </div>
            ) : sites.length === 0 ? (
              <p className="p-10 text-center text-sm text-ink-3">{emptyLabel}</p>
            ) : (
              sites.map((site) => (
                <SiteRow
                  key={site.id}
                  site={site}
                  onEditHours={onEditHours}
                  onDeleteSite={onDeleteSite}
                  removing={removingId === site.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Alerts + clock activity */}
        <div className="space-y-5 lg:col-span-5 xl:col-span-4">
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-ink">Needs attention</h2>
              <Link
                to="/admin/alerts"
                className="text-xs font-medium text-ink-3 transition hover:text-ink"
              >
                {alerts.length ? `${alerts.length} open →` : 'View all →'}
              </Link>
            </div>
            <div className="overflow-hidden rounded-[26px] border border-white/8 bg-surface">
              {alerts.length === 0 ? (
                <p className="p-10 text-center text-sm text-ink-3">
                  No open alerts. Late, no-show and stale-patrol events show up here.
                </p>
              ) : (
                alerts.map((a) => (
                  <AlertRow key={a.id} alert={a} onAcknowledge={onAcknowledge} busy={ackBusy === a.id} />
                ))
              )}
            </div>
          </div>

          <ClockActivity events={clockActivity} />
        </div>
      </div>
    </>
  )
}
