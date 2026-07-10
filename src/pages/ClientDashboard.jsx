import { CheckCircle2 } from 'lucide-react'
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
  const { site, guards, scans, checkpoints, loading, rounds, patrolScanCount, patrolCheckpointCount, scannedCount } =
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
        <p className="text-sm font-medium uppercase tracking-wide text-accent-cyan-line">Client Portal</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{site?.name || 'Patrol Overview'}</h1>
        <p className="text-ink-2">{site?.address || 'Live scan activity for your site'}</p>
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

      {guards.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-surface px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-ink-2">On duty:</p>
          {guards.map((g) => (
            <span key={g.id} className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-ink-2">
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
            <div className="overflow-hidden rounded-xl border border-white/10 bg-surface shadow-sm">
              <div className="border-b border-white/5 px-5 py-4">
                <h2 className="font-display text-lg font-semibold">Scan history</h2>
                <p className="mt-0.5 text-sm text-ink-2">
                  Successful check-ins for {date} · {shift.start}–{shift.end}
                </p>
              </div>

              {scans.length === 0 ? (
                <p className="p-10 text-center text-sm text-ink-2">
                  No successful scans during this shift yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead className="bg-white/5 text-left text-ink-2">
                      <tr>
                        <th className="px-5 py-3 font-medium">Time</th>
                        <th className="px-5 py-3 font-medium">Checkpoint</th>
                        <th className="px-5 py-3 font-medium">Guard</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {scans.map((scan) => {
                        const cp = checkpoints.find((c) => c.id === scan.checkpoint_id)
                        return (
                          <tr key={scan.id} className="hover:bg-white/5">
                            <td className="whitespace-nowrap px-5 py-3.5 text-ink-2">
                              {new Date(scan.scanned_at).toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-ink">{cp?.name || 'Checkpoint'}</p>
                              {cp?.floor?.floor_name && (
                                <p className="text-xs text-ink-2">{cp.floor.floor_name}</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-ink-2">
                              {scan.profiles?.name || 'Guard'}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-green/15 px-2.5 py-1 text-xs font-semibold text-accent-green ring-1 ring-accent-green/30">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Pass
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
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
