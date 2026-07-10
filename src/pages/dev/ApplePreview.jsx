// Dev-only harness (/dev/apple) — the search-first Overview (greeting hero +
// widget board) rendered inside the real admin shell with mock data, so the
// integrated design can be previewed and screenshotted without auth.
// Query params: ?board=1 (skip landing), ?t=morning|afternoon|evening|night.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Layout from '../../components/Layout.jsx'
import HomeHero from '../../components/overview/HomeHero.jsx'
import {
  ComplianceTile,
  OnDutyTile,
  ScansTile,
  ClockTile,
  FeedTile,
  CoverageTile,
  AlertsTile,
  ActionsTile,
} from '../../components/overview/HomeWidgets.jsx'

const SITES = [
  { id: 'bathurst', name: '800 Bathurst-DJ', address: '800 Bathurst St, Toronto' },
  { id: 'home', name: 'Home', address: 'Mississauga' },
]

const FEED = [
  { id: 1, initials: 'DS', name: 'Divjit', detail: '2nd Floor', time: '12:23 PM' },
  { id: 2, initials: 'SK', name: 'Sukhi', detail: 'Main Entrance', time: '12:05 PM' },
  { id: 3, initials: 'DS', name: 'Divjit', detail: 'Parking B', time: '11:40 AM' },
  { id: 4, initials: 'SK', name: 'Sukhi', detail: 'Lobby Desk', time: '11:15 AM' },
]

const COVERAGE = [3, 6, 4, 5, 2, 3, 6, 7, 3, 4, 1, 5, 5].map((scanned, i) => ({
  label: `${String(8 + i).padStart(2, '0')}:00`,
  scanned,
  required: 4,
  status: scanned >= 4 ? 'adequate' : scanned > 0 ? 'moderate' : 'missed',
}))

const ALERTS = [
  { id: 1, event_type: 'late', sites: { name: '800 Bathurst-DJ' }, message: 'Divjit Singh is running late — shift started 11:00 AM, no clock-in yet.' },
  { id: 2, event_type: 'stale_patrol', sites: { name: '800 Bathurst-DJ' }, message: 'Sukhi: no checkpoint scan for 130 minutes (site limit 120).' },
  { id: 3, event_type: 'no_show', sites: { name: 'Home' }, message: 'Test Guard has NOT clocked in — shift started 9:00 PM.' },
]

const TYPE_LABELS = { late: 'Late', stale_patrol: 'Stale patrol', no_show: 'No-show' }

export default function ApplePreview() {
  const [params, setParams] = useSearchParams()
  const daypart = ['morning', 'afternoon', 'evening', 'night'].includes(params.get('t'))
    ? params.get('t')
    : undefined
  const [selected, setSelected] = useState(params.get('board') ? SITES[0] : null)
  const [ackd, setAckd] = useState([])
  const alerts = ALERTS.filter((a) => !ackd.includes(a.id))

  const toolbar = (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-white/10 bg-inset/90 px-1.5 py-1.5 text-[11px] font-semibold backdrop-blur-xl">
      {['morning', 'afternoon', 'evening', 'night'].map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setParams((p) => { p.set('t', t); return p })}
          className={`rounded-full px-2.5 py-1.5 capitalize transition ${daypart === t ? 'bg-white/15 text-ink' : 'text-ink-3 hover:text-ink-2'}`}
        >
          {t}
        </button>
      ))}
    </div>
  )

  if (!selected) {
    return (
      <Layout variant="admin">
        <HomeHero
          name="Div"
          role="admin"
          sites={SITES}
          onPick={setSelected}
          onNewSite={() => {}}
          daypart={daypart}
        />
        {toolbar}
      </Layout>
    )
  }

  const isAll = selected === 'all'
  return (
    <Layout variant="admin">
      <HomeHero
        compact
        name="Div"
        daypart={daypart}
        activeLabel={isAll ? `All sites · ${SITES.length} sites` : `${selected.name} · ${selected.address}`}
        onClear={() => setSelected(null)}
        action={
          <button type="button" className="dk-cta">
            <Plus className="h-4 w-4" /> New Site
          </button>
        }
      />
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
        <ComplianceTile value={78} siteLabel={isAll ? 'all sites' : selected.name} delay={0} />
        <OnDutyTile guards={[{ id: 1, name: 'Divjit Singh' }, { id: 2, name: 'Sukhi' }]} delay={60} />
        <ScansTile count={45} points={COVERAGE.map((c) => c.scanned)} delay={120} />
        <ClockTile code={isAll ? 'ALL' : 'BTH'} sub={isAll ? 'All sites' : selected.name} delay={180} />
        <FeedTile count={45} items={FEED} delay={240} />
        <CoverageTile hours={COVERAGE} delay={300} />
        <AlertsTile
          alerts={alerts}
          typeLabels={TYPE_LABELS}
          onAcknowledge={(id) => setAckd((prev) => [...prev, id])}
          delay={360}
        />
        <ActionsTile initial="D" onNewSite={() => {}} delay={420} />
      </div>
      {toolbar}
    </Layout>
  )
}
