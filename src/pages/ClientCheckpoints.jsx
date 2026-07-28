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
        <p className="deck-eyebrow text-accent-cyan-line">Client Portal</p>
        <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">Shift Clock</h1>
        <p className="mt-1 text-ink-2">
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
        <div className="dk-card mt-8 p-5">
          <p className="deck-eyebrow">Guards at this site</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {guards.map((g) => (
              <span key={g.id} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-sm text-ink">
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
