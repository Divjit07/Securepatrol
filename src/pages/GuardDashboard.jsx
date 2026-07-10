import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ScanLine, AlertTriangle } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import GuardClockedInPanel from '../components/GuardClockedInPanel.jsx'
import NextShiftCard from '../components/NextShiftCard.jsx'
import CheckpointCard from '../components/CheckpointCard.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useSiteHours } from '../hooks/useSiteHours.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'
import { getCheckpointStatus } from '../lib/scans.js'
import { useGuardPublishedShift } from '../hooks/useGuardPublishedShift.js'

export default function GuardDashboard() {
  const { profile, user } = useAuth()
  const siteId = profile?.site_id
  const operatingHours = useSiteHours(siteId)
  const { date, setDate, shift, scheduled } = useClientShift(operatingHours)
  const { shift: publishedShift } = useGuardPublishedShift(user?.id, date)
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
    guardShifts,
    reload,
  } = useClientSiteData(siteId, date, shift, user?.id)

  const myShift = guardShifts.find((row) => row.guardId === user?.id) || guardShifts[0] || null
  const myShiftWithDate = myShift ? { ...myShift, date } : null

  useEffect(() => {
    flushOfflineQueue().then(() => reload())
  }, [siteId, user?.id, reload])

  if (!siteId) {
    return (
      <Layout variant="guard">
        <div className="rounded-xl border border-accent-orange/30 bg-accent-orange/10 p-8 text-center">
          <h1 className="text-lg font-semibold text-accent-orange">No site assigned</h1>
          <p className="mt-2 text-sm text-accent-orange">
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

      <GuardClockedInPanel
        profile={profile}
        siteName={site?.name || profile?.sites?.name}
        scheduled={scheduled}
        guardShift={myShiftWithDate}
        publishedShift={publishedShift}
        loading={loading}
      />

      <NextShiftCard guardId={user?.id} />

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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="dk-card guard-history-card mb-8 overflow-hidden">
            <div className="border-b border-white/5 px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Scan history</h2>
              <p className="mt-0.5 text-sm text-ink-2">
                Your successful check-ins for {date}
                {!scheduled?.isClosed ? ` · ${shift.start}–${shift.end}` : ''}
              </p>
            </div>

            {scans.length === 0 ? (
              <p className="p-10 text-center text-sm text-ink-2">
                {scheduled?.isClosed
                  ? 'No shift on this date.'
                  : 'No successful scans during this shift yet. Tap Scan checkpoint to start.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead className="bg-white/5 text-left text-ink-2">
                    <tr>
                      <th className="px-5 py-3 font-medium">Time</th>
                      <th className="px-5 py-3 font-medium">Checkpoint</th>
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
                          <td className="px-5 py-3.5">
                            <span className="dk-pill-ok">
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
