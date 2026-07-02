import { ShieldCheck } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import CheckpointCard from '../components/CheckpointCard.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'
import { getClientCheckpointStatus } from '../lib/scans.js'

export default function ClientCheckpoints() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const { date, setDate, shift, scheduled } = useClientShift()
  const { site, guards, loading, scansByCheckpoint, groupedByFloor, checkpoints, scans, rounds, patrolScanCount, patrolCheckpointCount, guardShifts } =
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
          guardShifts,
        }}
      />

      <div className="mb-6 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong className="text-green-800">Green</strong> = scanned and passed during your shift ({shift.start}–{shift.end}).
            <strong className="text-red-800"> Red</strong> = not yet scanned or failed.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByFloor.map(({ floor, checkpoints: cps }) => (
            <section key={floor.id}>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">{floor.floor_name}</h2>
                <p className="text-sm text-slate-500">
                  {cps.filter((cp) => scansByCheckpoint[cp.id]).length} / {cps.length} scanned
                </p>
              </div>
              {cps.length === 0 ? (
                <p className="text-sm text-slate-500">No checkpoints on this floor.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {cps.map((cp) => {
                    const latestScan = scansByCheckpoint[cp.id]
                    const status = getClientCheckpointStatus(latestScan)
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
