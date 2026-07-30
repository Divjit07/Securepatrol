// Dev-only visual harness for the guard portal (/dev/guard) — the phone
// surfaces rendered from the real components against mock data, so the Night
// theme can be previewed and screenshotted without a session or a GPS fix.
//
//   /dev/guard                  on duty, mid-shift
//   /dev/guard?state=ended      shift over, clock-out overdue (red)
//   /dev/guard?view=incident    the real incident report form
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, ScanLine, AlertTriangle } from 'lucide-react'
import Layout from '../../components/Layout.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import ClockInCard from '../../components/ClockInCard.jsx'
import ClientShiftBar from '../../components/ClientShiftBar.jsx'
import GuardClockedInPanel from '../../components/GuardClockedInPanel.jsx'
import CheckpointCard from '../../components/CheckpointCard.jsx'
import GuardIncidentReport from '../GuardIncidentReport.jsx'

const GUARD = 'Divjit Singh'
const SITE = '800 Bathurst-DJ'

const at = (h, m) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

const CHECKPOINTS = [
  { id: 'c1', name: 'Main Entrance', floor: { floor_name: 'Ground Floor' } },
  { id: 'c2', name: 'Lobby Desk', floor: { floor_name: 'Ground Floor' } },
  { id: 'c3', name: 'Parking Level B', floor: { floor_name: 'Basement' } },
  { id: 'c4', name: 'East Stairwell', floor: { floor_name: '4th Floor' } },
  { id: 'c5', name: 'Loading Dock', floor: { floor_name: 'Ground Floor' } },
  { id: 'c6', name: 'Rooftop Access', floor: { floor_name: '12th Floor' } },
]

const SCANS = [
  { id: 's1', checkpoint_id: 'c1', at: at(17, 26), distance: 11 },
  { id: 's2', checkpoint_id: 'c3', at: at(17, 12), distance: 8 },
  { id: 's3', checkpoint_id: 'c6', at: at(16, 55), distance: 14 },
  { id: 's4', checkpoint_id: 'c2', at: at(16, 40), distance: 6 },
  { id: 's5', checkpoint_id: 'c4', at: at(16, 18), distance: 19 },
  { id: 's6', checkpoint_id: 'c5', at: at(15, 51), distance: 9 },
].map((s) => ({ ...s, scanned_at: s.at.toISOString(), distance_metres: s.distance }))

const LATEST = Object.fromEntries(
  CHECKPOINTS.map((cp) => [cp.id, SCANS.find((s) => s.checkpoint_id === cp.id) || null]),
)

/** Two checkpoints are deliberately still pending — a full board says nothing. */
const STATUS = { c1: 'pass', c2: 'pass', c3: 'pass', c4: 'late', c5: 'pass', c6: 'pending' }

export default function GuardPreview() {
  const [params] = useSearchParams()

  if (params.get('view') === 'incident') return <GuardIncidentReport />

  // "ended" backdates the shift so the clock card is past its end and turns red.
  const ended = params.get('state') === 'ended'
  const now = new Date()
  const start = ended ? new Date(now.getTime() - 9 * 3_600_000) : at(11, 0)
  const end = ended ? new Date(now.getTime() - 40 * 60_000) : at(20, 0)
  const publishedShift = {
    id: 'demo-shift',
    site_id: null,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    sites: { name: SITE },
  }

  return (
    <Layout variant="guard">
      <PageHeader
        title="Patrol Dashboard"
        description={`Good shift, ${GUARD}. ${SITE}`}
      />

      <GuardClockedInPanel
        profile={{ name: GUARD }}
        siteName={SITE}
        guardShift={{
          guardId: 'demo',
          onShift: true,
          signedInAt: at(11, 4),
          clockInAt: at(11, 4),
          clockOutAt: end,
        }}
        publishedShift={publishedShift}
        clockedIn
        loading={false}
      />

      <ClockInCard
        guardId="demo-guard"
        siteId={null}
        clockedIn
        onPunched={() => {}}
        publishedShift={publishedShift}
        scheduled={null}
        date={now.toISOString().slice(0, 10)}
        nextShift={null}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <span className="sp-btn-primary min-h-[3.5rem] text-base">
          <ScanLine className="h-5 w-5" />
          Scan checkpoint
        </span>
        <span className="sp-btn-secondary flex min-h-[3.5rem] items-center justify-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5" />
          Report incident
        </span>
      </div>

      <ClientShiftBar
        date={now.toISOString().slice(0, 10)}
        setDate={() => {}}
        scheduled={{ scheduleLabel: 'Tuesday · 11:00 AM – 8:00 PM' }}
        hoursLabel="11:00 AM – 8:00 PM"
        stats={{
          rounds: 3,
          patrolScanCount: 30,
          patrolCheckpointCount: 6,
          scannedCount: 5,
          totalCheckpoints: 6,
        }}
      />

      <div className="dk-card guard-history-card mb-8 overflow-hidden">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Scan history</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            Your successful check-ins for today · 11:00 AM – 8:00 PM
          </p>
        </div>
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
              {SCANS.map((scan) => {
                const cp = CHECKPOINTS.find((c) => c.id === scan.checkpoint_id)
                return (
                  <tr key={scan.id}>
                    <td className="whitespace-nowrap px-5 py-3.5 text-ink-2">
                      {scan.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{cp.name}</p>
                      <p className="text-xs text-ink-2">{cp.floor.floor_name}</p>
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
      </div>

      <h2 className="mb-4 font-display text-lg font-semibold">Checkpoints</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHECKPOINTS.map((cp) => (
          <CheckpointCard
            key={cp.id}
            checkpoint={cp}
            status={STATUS[cp.id]}
            lastScan={LATEST[cp.id]}
          />
        ))}
      </div>
    </Layout>
  )
}
