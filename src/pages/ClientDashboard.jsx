import { CheckCircle2, Clock } from 'lucide-react'
import { formatShiftTime } from '../lib/clientStats.js'
import Layout from '../components/Layout.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import LiveFeed from '../components/LiveFeed.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useSiteHours } from '../hooks/useSiteHours.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'

export default function ClientDashboard() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const operatingHours = useSiteHours(siteId)
  const { date, setDate, shift, scheduled } = useClientShift(operatingHours)
  const { site, guards, scans, checkpoints, loading, rounds, patrolScanCount, patrolCheckpointCount, scannedCount, guardShifts } =
    useClientSiteData(siteId, date, shift)

  if (!siteId) {
    return (
      <Layout variant="client">
        <div className="rounded-xl border border-accent-orange/30 bg-accent-orange/10 p-8 text-center">
          <h1 className="text-lg font-semibold text-accent-orange">No site assigned</h1>
          <p className="mt-2 text-sm text-accent-orange">
            Contact your administrator to link your account to a patrol site.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="client">
      <div className="mb-6">
        <p className="deck-eyebrow text-accent-cyan-line">Client Portal</p>
        <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">{site?.name || 'Patrol Overview'}</h1>
        <p className="mt-1 text-ink-2">{site?.address || 'Live scan activity for your site'}</p>
      </div>

      <ClientShiftBar
        date={date}
        setDate={setDate}
        scheduled={scheduled}
        stats={{
          rounds,
          patrolScanCount,
          patrolCheckpointCount,
          scannedCount,
          totalCheckpoints: checkpoints.length,
        }}
      />

      {/* When each guard clocked in on the selected date */}
      <div className="dk-card mb-6 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock className="h-4 w-4 text-accent-orange" /> Guard clock-ins
        </h2>
        {guardShifts?.length ? (
          <div className="mt-3 space-y-2">
            {guardShifts.map((gs) => (
              <div key={gs.guardId} className="flex items-center gap-3 rounded-xl bg-ink/5 px-3 py-2.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${gs.onShift ? 'bg-accent-green' : 'bg-zinc-500'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{gs.guardName}</span>
                  <span className="block text-xs text-ink-2">
                    {/* Admin shift-clock edits (guard_shift_adjustments) win over the
                        raw punch time — the raw scan stays immutable underneath.
                        Clients see the official time only; the Adjusted badge stays
                        on Admin → Shift Clock. */}
                    Clocked in {formatShiftTime(new Date(gs.isAdjusted ? gs.clockInAt : gs.signedInAt || gs.clockInAt))}
                    {gs.onShift ? ' · on shift now' : gs.clockOutAt ? ` · until ${formatShiftTime(new Date(gs.clockOutAt))}` : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-3">No guard has clocked in for this date yet.</p>
        )}
      </div>

      {guards.length > 0 && (
        <div className="dk-card mb-6 flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink-2"><span className="live-dot" /> On duty:</span>
          {guards.map((g) => (
            <span key={g.id} className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-ink">
              {g.name}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="dk-card overflow-hidden p-0">
              <div className="flex items-center justify-between px-5 pb-3 pt-5">
                <div>
                  <h2 className="font-display text-base font-bold text-ink">Scan history</h2>
                  <p className="mt-0.5 text-xs text-ink-3">
                    Successful check-ins for {date} · {shift.start}–{shift.end}
                  </p>
                </div>
                {scans.length > 0 && (
                  <span className="rounded-full bg-accent-green/15 px-2.5 py-1 text-[11px] font-bold tabular-nums text-accent-green">
                    {scans.length} pass{scans.length === 1 ? '' : 'es'}
                  </span>
                )}
              </div>

              {scans.length === 0 ? (
                <div className="hatch-empty m-3 flex items-center justify-center rounded-2xl border border-white/5 py-14 text-center">
                  <p className="px-6 text-sm text-ink-3">No successful scans during this shift yet.</p>
                </div>
              ) : (
                <div className="max-h-[32rem] space-y-1 overflow-y-auto px-2 pb-2">
                  {scans.map((scan) => {
                    const cp = checkpoints.find((c) => c.id === scan.checkpoint_id)
                    return (
                      <div
                        key={scan.id}
                        className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 hover:bg-white/[0.05]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green transition group-hover:scale-105">
                          <CheckCircle2 className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{cp?.name || 'Checkpoint'}</p>
                          <p className="truncate text-xs text-ink-3">
                            {cp?.floor?.floor_name ? `${cp.floor.floor_name} · ` : ''}{scan.profiles?.name || 'Guard'}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-xs tabular-nums text-ink-3">
                          {new Date(scan.scanned_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className="shrink-0 rounded-full bg-accent-green/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-accent-green">PASS</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <LiveFeed siteId={siteId} limit={20} passesOnly />
          </div>
        </div>
      )}
    </Layout>
  )
}
