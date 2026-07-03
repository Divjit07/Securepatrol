import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Radio } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import LiveFeed from '../components/LiveFeed.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'

export default function SiteDashboard() {
  const { id } = useParams()
  const { date, setDate, shift, scheduled } = useClientShift()
  const { site, guards, scans, checkpoints, loading, rounds, patrolScanCount, patrolCheckpointCount, scannedCount } =
    useClientSiteData(id, date, shift)

  return (
    <Layout variant="admin">
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to overview
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand-600">Site Dashboard</p>
          <h1 className="mt-1 font-display text-2xl font-bold">{site?.name || 'Patrol Overview'}</h1>
          <p className="text-slate-600">{site?.address || 'Live scan activity for this site'}</p>
        </div>
        <Link
          to={`/admin/site/${id}/live`}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          <Radio className="h-4 w-4" /> Live Feed
        </Link>
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
            <LiveFeed siteId={id} limit={20} passesOnly />
          </div>
        </div>
      )}
    </Layout>
  )
}
