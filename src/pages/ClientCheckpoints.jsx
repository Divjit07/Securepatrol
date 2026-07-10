import Layout from '../components/Layout.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import ClientShiftClock from '../components/ClientShiftClock.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useSiteHours } from '../hooks/useSiteHours.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'

export default function ClientCheckpoints() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const operatingHours = useSiteHours(siteId)
  const { date, setDate, shift, scheduled } = useClientShift(operatingHours)
  const { site, guards, loading, scans, checkpoints, rounds, patrolScanCount, patrolCheckpointCount, scannedCount, guardShifts } =
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
        <h1 className="mt-1 font-display text-2xl font-bold">Shift Clock</h1>
        <p className="text-ink-2">
          {site?.name || 'Your site'} — when guards signed in for the selected date
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
          scannedCount,
          totalCheckpoints: checkpoints.length,
        }}
      />

      <ClientShiftClock guardShifts={guardShifts} scheduled={scheduled} loading={loading} />

      {guards.length > 0 && (
        <div className="mt-8 rounded-xl border border-white/10 bg-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-ink-2">Guards at this site</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {guards.map((g) => (
              <span key={g.id} className="rounded-lg bg-white/5 px-3 py-1.5 text-sm">
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
