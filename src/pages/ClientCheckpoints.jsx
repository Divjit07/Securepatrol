import Layout from '../components/Layout.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import ClientShiftClock from '../components/ClientShiftClock.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'

export default function ClientCheckpoints() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const { date, setDate, shift, scheduled } = useClientShift()
  const { site, guards, loading, scans, rounds, patrolScanCount, patrolCheckpointCount, guardShifts } =
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
        <h1 className="mt-1 font-display text-2xl font-bold">Shift Clock</h1>
        <p className="text-slate-600">
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
          scanCount: scans.length,
        }}
      />

      <ClientShiftClock guardShifts={guardShifts} scheduled={scheduled} loading={loading} />

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
