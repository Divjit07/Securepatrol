import { CheckCircle2, XCircle } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'
import { getClientCheckpointStatus } from '../lib/scans.js'

export default function ClientCheckpoints() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const { date, setDate, shift, scheduled } = useClientShift()
  const { site, guards, loading, scansByCheckpoint, groupedByFloor, scans, rounds, patrolScanCount, patrolCheckpointCount } =
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
        <h1 className="mt-1 font-display text-2xl font-bold">Checkpoints</h1>
        <p className="text-slate-600">
          {site?.name || 'Your site'} — scan status for each patrol point this shift
        </p>
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
        }}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByFloor.map(({ floor, checkpoints: cps }) => (
            <section key={floor.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <h2 className="font-display font-semibold">{floor.floor_name}</h2>
                <p className="text-sm text-slate-500">
                  {cps.filter((cp) => scansByCheckpoint[cp.id]).length} / {cps.length} scanned
                </p>
              </div>
              {cps.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No checkpoints on this floor.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Checkpoint</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium">Last scan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cps.map((cp) => {
                      const latestScan = scansByCheckpoint[cp.id]
                      const status = getClientCheckpointStatus(latestScan)
                      const passed = status === 'on_time'
                      return (
                        <tr key={cp.id}>
                          <td className="px-5 py-3 font-medium text-slate-900">{cp.name}</td>
                          <td className="px-5 py-3">
                            {passed ? (
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <CheckCircle2 className="h-4 w-4" /> Scanned
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-600">
                                <XCircle className="h-4 w-4" /> Not scanned
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {latestScan
                              ? new Date(latestScan.scanned_at).toLocaleString()
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>
          ))}
        </div>
      )}

      {guards.length > 0 && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Guards at this site</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {guards.map((g) => (
              <span key={g.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
