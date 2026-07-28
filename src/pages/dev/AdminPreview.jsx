// Dev-only visual harness for the 2026 remaster Overview (/dev/admin) — renders
// the real OverviewBoard against mock data matching its production props, so the
// "Apple Bento × Command Deck" board can be previewed/screenshotted without auth.
import { Plus, Search, Download } from 'lucide-react'
import Layout from '../../components/Layout.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import OverviewBoard from '../../components/overview/OverviewBoard.jsx'

const STATUS = [
  { label: 'On duty now', pill: 'On duty', value: 5, tone: 'green' },
  { label: 'Running late', pill: 'Late', value: 1, tone: 'amber' },
  { label: 'No-show', pill: 'No-show', value: 1, tone: 'red' },
]

const KPIS = [
  { label: 'Sites', value: 6 },
  { label: 'Active guards', value: 12, hint: '2 unassigned' },
]

const SITES = [
  { id: '1', name: '800 Bathurst-DJ', address: '800 Bathurst St.', guardNames: 'Divjit Singh, Sukhi', checkpoints: 15, scannedToday: 12, compliance: 80, geofenced: true, radius: 120 },
  { id: '2', name: 'King West Tower', address: '620 King St W.', guardNames: 'Aman Deep', checkpoints: 9, scannedToday: 9, compliance: 100, geofenced: true, radius: 90 },
  { id: '3', name: 'Union Station Concourse', address: '65 Front St W.', guardNames: 'Priya, Marcus', checkpoints: 22, scannedToday: 14, compliance: 64, geofenced: true, radius: 150 },
  { id: '4', name: 'Liberty Village Lofts', address: '80 Western Battery Rd.', guardNames: 'No guards', checkpoints: 6, scannedToday: 0, compliance: 0, geofenced: false, radius: 120 },
  { id: '5', name: 'Distillery District', address: '55 Mill St.', guardNames: 'Chen', checkpoints: 11, scannedToday: 8, compliance: 73, geofenced: true, radius: 110 },
]

const ALERTS = [
  { id: 'a1', type: 'no_show', typeLabel: 'No-show', siteName: 'Liberty Village Lofts', when: '9:40 PM', message: 'Test Guard has NOT clocked in — shift started 9:00 PM (40 min ago).' },
  { id: 'a2', type: 'stale_patrol', typeLabel: 'Stale patrol', siteName: '800 Bathurst-DJ', when: '8:10 PM', message: 'Sukhi: no checkpoint scan for 130 minutes (site limit 120).' },
  { id: 'a3', type: 'late', typeLabel: 'Late', siteName: 'Union Station Concourse', when: '11:12 AM', message: 'Divjit Singh is running late — shift started 11:00 AM, no clock-in yet.' },
]

export default function AdminPreview() {
  return (
    <Layout variant="admin">
      <PageHeader
        title="Overview"
        description="Who's on duty, who needs attention, and today's coverage."
        action={
          <>
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 md:flex">
              <Search className="h-3.5 w-3.5 text-ink-3" />
              <input placeholder="Search site…" className="w-32 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3" />
            </div>
            <button type="button" className="dk-btn-2">Export <Download className="h-3.5 w-3.5" /></button>
            <button type="button" className="dk-cta"><Plus className="h-4 w-4" /> New Site</button>
          </>
        }
      />

      <OverviewBoard
        statusSegments={STATUS}
        kpis={KPIS}
        alerts={ALERTS}
        onAcknowledge={() => {}}
        ackBusy={null}
        sites={SITES}
        onEditHours={() => {}}
        onDeleteSite={() => {}}
        removingId={null}
        loading={false}
      />
    </Layout>
  )
}
