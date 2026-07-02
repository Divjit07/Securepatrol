import { CheckCircle2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import LiveFeed from '../components/LiveFeed.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'

export default function ClientDashboard() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const { date, setDate, shift, scheduled } = useClientShift()
  const { site, guards, scans, checkpoints, loading, rounds, patrolScanCount, patrolCheckpointCount, guardShifts } =
    useClientSiteData(siteId, date, shift)

  if (!siteId) {
    return (
      <Layout variant="client">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-amber-900">No site assigned</h1>
          <p className="mt-2 text-sm text-amber-800">
            Contact your administrator to link your account to a patrol site.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="client">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-600">Client Portal</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{site?.name || 'Patrol Overview'}</h1>
        <p className="text-slate-600">{site?.address || 'Live scan activity for your site'}</p>
      </div>

      <ClientShiftBar
        date={date}
        setDate={setDate}
        scheduled={scheduled}
        stats={{
          rounds,
          patrolScanCount,
          patrolCheckpointCount,
          scanCount: scans.length,
          guardShifts,
        }}
      />

      {guards.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-slate-500">On duty:</p>
          {guards.map((g) => (
            <span key={g.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {g.name}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-display text-lg font-semibold">Scan history</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Successful check-ins for {date} · {shift.start}–{shift.end}
                </p>
              </div>

              {scans.length === 0 ? (
                <p className="p-10 text-center text-sm text-slate-500">
                  No successful scans during this shift yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-5 py-3 font-medium">Time</th>
                        <th className="px-5 py-3 font-medium">Checkpoint</th>
                        <th className="px-5 py-3 font-medium">Guard</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scans.map((scan) => {
                        const cp = checkpoints.find((c) => c.id === scan.checkpoint_id)
                        return (
                          <tr key={scan.id} className="hover:bg-slate-50/80">
                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                              {new Date(scan.scanned_at).toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-slate-900">{cp?.name || 'Checkpoint'}</p>
                              {cp?.floor?.floor_name && (
                                <p className="text-xs text-slate-500">{cp.floor.floor_name}</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-slate-700">
                              {scan.profiles?.name || 'Guard'}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
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
