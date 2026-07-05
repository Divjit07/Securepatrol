import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ScanLine, AlertTriangle } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import CheckpointCard from '../components/CheckpointCard.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'
import { getCheckpointStatus } from '../lib/scans.js'
import { flushOfflineQueue } from '../lib/offlineQueue.js'

export default function GuardDashboard() {
  const { profile, user } = useAuth()
  const siteId = profile?.site_id
  const { date, setDate, shift, scheduled } = useClientShift()
  const {
    site,
    checkpoints,
    scans,
    loading,
    rounds,
    patrolScanCount,
    patrolCheckpointCount,
    scannedCount,
    scansByCheckpoint,
    reload,
  } = useClientSiteData(siteId, date, shift, user?.id)

  useEffect(() => {
    flushOfflineQueue().then(() => reload())
  }, [siteId, user?.id, reload])

  if (!siteId) {
    return (
      <Layout variant="guard">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-amber-900">No site assigned</h1>
          <p className="mt-2 text-sm text-amber-800">
            Contact your administrator to assign you to a patrol site.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="guard">
      <PageHeader
        title="Patrol Dashboard"
        description={`Good shift, ${profile?.name || 'Guard'}. ${site?.name || profile?.sites?.name || 'Your site'}`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link to="/guard/scan" className="sp-btn-primary min-h-[3.5rem] text-base">
          <ScanLine className="h-5 w-5" />
          Scan checkpoint
        </Link>
        <Link
          to="/guard/incident"
          className="sp-btn-secondary flex min-h-[3.5rem] items-center justify-center gap-2 text-base"
        >
          <AlertTriangle className="h-5 w-5" />
          Report incident
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Scan history</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Your successful check-ins for {date}
                {!scheduled?.isClosed ? ` · ${shift.start}–${shift.end}` : ''}
              </p>
            </div>

            {scans.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">
                {scheduled?.isClosed
                  ? 'No shift on this date.'
                  : 'No successful scans during this shift yet. Tap Scan checkpoint to start.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-5 py-3 font-medium">Time</th>
                      <th className="px-5 py-3 font-medium">Checkpoint</th>
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

          {!scheduled?.isClosed && checkpoints.length > 0 && (
            <>
              <h2 className="mb-4 font-display text-lg font-semibold">Checkpoints</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {checkpoints.map((cp) => {
                  const latestScan = scansByCheckpoint[cp.id]
                  const status = getCheckpointStatus(cp, latestScan)
                  return (
                    <CheckpointCard
                      key={cp.id}
                      checkpoint={cp}
                      status={status}
                      lastScan={latestScan}
                    />
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  )
}
