import { Clock } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import ClientShiftClock from '../components/ClientShiftClock.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

const initials = (name) =>
  (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
import { useClientShift } from '../hooks/useClientShift.js'
import { useSiteHours } from '../hooks/useSiteHours.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'

export default function ClientCheckpoints() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const operatingHours = useSiteHours(siteId)
  const { date, setDate, shift, scheduled } = useClientShift(operatingHours)
  const { site, guards, loading, scans, checkpoints, rounds, patrolScanCount, patrolCheckpointCount, scannedCount, guardShifts, rosterHoursLabel } =
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#ECFAB5] to-[#96EE60] text-[#12290d] shadow-[0_10px_24px_-8px_rgba(150,238,96,0.7)]">
            <Clock className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="deck-eyebrow text-accent-green">Client Portal</p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight sm:text-[2rem]">Shift Clock</h1>
            <p className="mt-1 text-sm text-ink-2">
              {site?.name || 'Your site'} — when guards signed in for the selected date
            </p>
          </div>
        </div>
        {(() => {
          const onShift = guardShifts.filter((g) => g.onShift).length
          const clockedIn = guardShifts.length
          if (onShift > 0) {
            return (
              <span className="hidden shrink-0 items-center gap-2 rounded-full bg-accent-green/15 px-3.5 py-2 text-sm font-bold text-accent-green sm:flex">
                <span className="live-dot" /> {onShift} on shift
              </span>
            )
          }
          if (clockedIn > 0) {
            return (
              <span className="hidden shrink-0 items-center gap-2 rounded-full bg-accent-cyan/15 px-3.5 py-2 text-sm font-bold text-accent-cyan-line sm:flex">
                {clockedIn} clocked in
              </span>
            )
          }
          return null
        })()}
      </div>

      <ClientShiftBar date={date} setDate={setDate} scheduled={scheduled} hoursLabel={rosterHoursLabel} showStats={false} />

      <ClientShiftClock guardShifts={guardShifts} scheduled={scheduled} loading={loading} />

      {guards.length > 0 && (
        <div className="dk-card mt-6 p-5">
          <p className="deck-eyebrow">Guards at this site</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {guards.map((g) => (
              <span
                key={g.id}
                className="flex items-center gap-2 rounded-full bg-accent-green/10 py-1 pl-1 pr-3.5 text-sm font-semibold text-ink ring-1 ring-accent-green/20 transition hover:bg-accent-green/15"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#ECFAB5] to-[#96EE60] text-[10px] font-bold text-[#12290d]">
                  {initials(g.name)}
                </span>
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
