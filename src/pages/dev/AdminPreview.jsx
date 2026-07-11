// Dev-only visual harness for the Dark Ops Overview (/dev/admin) — mirrors the
// reference dashboard geometry with mock data.
import { Building2, Clock, Trash2, ChevronRight, Plus, Check, Search, Download } from 'lucide-react'
import Layout from '../../components/Layout.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { CoverageChart, ActivityLine, FeedTimeline, ExpandChip, LegendDot } from '../../components/overview/widgets.jsx'
import {
  ComplianceTile,
  RoundsTile,
  ScansTile,
  ClockTile,
  FeedTile,
  CoverageTile,
  WorkforceTile,
  AlertsCountTile,
  ActionsTile,
} from '../../components/overview/HomeWidgets.jsx'
import { CHART } from '../../lib/brandPalette.js'

const COVERAGE = Array.from({ length: 13 }, (_, i) => {
  const h = 8 + i
  const required = [3, 4, 6, 5, 4, 3, 4, 7, 5, 4, 3, 5, 4][i]
  const scanned = [3, 6, 4, 5, 2, 3, 6, 7, 3, 4, 1, 5, 5][i]
  return {
    label: `${String(h).padStart(2, '0')}:00`,
    required,
    scanned,
    status: scanned >= required ? 'adequate' : scanned > 0 ? 'moderate' : 'missed',
  }
})

const ACTIVITY = { labels: COVERAGE.map((c) => c.label), points: COVERAGE.map((c) => c.scanned) }

const FEED = [
  { id: 1, initials: 'SK', name: 'Sukhi', detail: 'Main Entrance', time: '4:05 PM' },
  { id: 2, initials: 'DS', name: 'Divjit', detail: 'Parking Level B', time: '3:40 PM' },
  { id: 3, initials: 'TG', name: 'Test', detail: 'Lobby Desk', time: '2:15 PM' },
]

const ALERTS = [
  { id: 1, type: 'NO-SHOW', site: 'Home', time: '9:40 PM', msg: 'Test Guard has NOT clocked in — shift at Home started Wed 9:00 PM (40 min ago).' },
  { id: 2, type: 'STALE PATROL', site: '800 Bathurst-DJ', time: '8:10 PM', msg: 'Sukhi at 800 Bathurst-DJ: no checkpoint scan for 130 minutes (site limit 120).' },
  { id: 3, type: 'LATE', site: '800 Bathurst-DJ', time: '11:12 AM', msg: 'Divjit Singh is running late — shift started Wed 11:00 AM, no clock-in yet.' },
]

const PREVIEW_SITES = [
  { id: 'p1', name: '800 Bathurst-DJ', address: '800 Bathurst St, Toronto', latitude: 43.66, longitude: -79.41, geofence_radius_m: 120 },
  { id: 'p2', name: 'Home', address: '12 Example Ave', latitude: 43.7, longitude: -79.4, geofence_radius_m: 150 },
  { id: 'p3', name: 'Yorkdale North Tower', address: '1 Yorkdale Rd', latitude: 43.72, longitude: -79.45, geofence_radius_m: 120 },
  { id: 'p4', name: 'Harbourfront Plaza', address: '235 Queens Quay W' },
]

export default function AdminPreview() {
  return (
    <Layout variant="admin" previewSites={PREVIEW_SITES}>
      <PageHeader
        title="Overview"
        description="Sites, coverage, and today's compliance at a glance."
        action={
          <>
            <div className="hidden items-center gap-2 border-b border-white/10 px-1 pb-1 md:flex">
              <Search className="h-3.5 w-3.5 text-ink-3" />
              <input placeholder="Search site…" className="w-36 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3" />
            </div>
            <button type="button" className="dk-btn-2">Export <Download className="h-3.5 w-3.5" /></button>
            <button type="button" className="dk-cta"><Plus className="h-4 w-4" /> New Site</button>
          </>
        }
      />

      {/* Widget board — iOS-style tiles (mirrors AdminDashboard additions) */}
      <div className="mb-8 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
        <ComplianceTile value={78} siteLabel="all sites" delay={0} />
        <RoundsTile rounds={2} scansIntoRound={9} checkpointCount={18} delay={60} />
        <ScansTile count={45} points={ACTIVITY.points} delay={120} />
        <ClockTile code="ALL" sub="All sites" delay={180} />
        <FeedTile count={45} items={FEED.map((f) => ({ ...f, detail: f.detail }))} delay={240} />
        <CoverageTile hours={COVERAGE} delay={300} />
        <WorkforceTile
          total={12}
          segments={[
            { label: 'On patrol', value: 5, color: CHART.onPatrol },
            { label: 'Up next', value: 3, color: CHART.upNext },
            { label: 'No-show', value: 1, color: CHART.noShow },
            { label: 'Unscheduled', value: 3, color: CHART.unscheduledBar },
          ]}
          to="/dev/roster"
          delay={360}
        />
        <ActionsTile initial="D" onNewSite={() => {}} delay={420} />
        <AlertsCountTile count={3} summary="No-show · Stale patrol · Late" delay={480} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <div className="dk-inset p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Patrol Coverage</h2>
              <div className="flex items-center gap-4">
                <LegendDot color={CHART.onPatrol} label="Adequate" />
                <LegendDot color={CHART.upNext} label="Moderate" />
                <LegendDot color={CHART.missed} label="Missed" />
                <ExpandChip to="#" />
              </div>
            </div>
            <CoverageChart hours={COVERAGE} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-paper p-5">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-black">Hourly Patrol Activity</h2>
                <ExpandChip to="#" onPaper />
              </div>
              <ActivityLine points={ACTIVITY.points} labels={ACTIVITY.labels} />
            </div>

            <div className="dk-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Live Feed</h2>
                <ExpandChip to="#" />
              </div>
              <FeedTimeline items={FEED} />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {[
              { name: '800 Bathurst-DJ', address: '800 Bathurst St.', guards: [['Divjit Singh', 'dj@gmail.com'], ['Sukhi', 'sukhi@prodsec.ca']], cp: 15, scanned: 0, compliance: 0 },
              { name: 'Home', address: 'Mississauga', guards: [['Test Guard', 'testguard@gmail.com']], cp: 3, scanned: 3, compliance: 100 },
            ].map((site) => (
              <div key={site.name} className="group dk-card p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="rounded-lg bg-white/5 p-2">
                      <Building2 className="h-5 w-5 text-accent-orange" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-ink">{site.name}</h3>
                      <p className="text-sm text-ink-2">{site.address}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" className="rounded-lg p-2 text-ink-3 hover:bg-white/10"><Clock className="h-4 w-4" /></button>
                    <button type="button" className="rounded-lg p-2 text-ink-3 hover:bg-accent-red/10"><Trash2 className="h-4 w-4" /></button>
                    <button type="button" className="rounded-lg p-2 text-ink-3 hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-3">
                  <Clock className="h-3 w-3 shrink-0" /> Mon–Fri 11:00 AM–8:00 PM · Sat 10:00 AM–5:00 PM · Sun closed
                </p>
                <p className="dk-label mt-4 mb-2">Assigned guards</p>
                <ul className="space-y-1">
                  {site.guards.map(([name, email]) => (
                    <li key={email} className="text-sm leading-relaxed text-ink-2">
                      <span className="text-ink">{name}</span>
                      <span className="text-ink-3"> · </span>
                      {email}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex divide-x divide-white/5 rounded-xl bg-inset p-3">
                  {[
                    { value: site.cp, label: 'Checkpoints' },
                    { value: site.scanned, label: 'Scanned today' },
                    { value: `${site.compliance}%`, label: 'Compliance', className: site.compliance === 0 ? 'text-accent-red' : 'text-ink' },
                  ].map((m) => (
                    <div key={m.label} className="flex-1 px-3 text-center first:pl-0 last:pr-0">
                      <p className={`text-base font-bold ${m.className || 'text-ink'}`}>{m.value}</p>
                      <p className="dk-label">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="dk-inset flex h-full flex-col gap-3 p-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-ink">Alerts</h2>
              <span className="dk-label">3 open</span>
            </div>
            {ALERTS.map((a, i) =>
              i === 0 ? (
                <div key={a.id} className="rounded-2xl bg-paper p-4 text-black">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-accent-orange">{a.type} · {a.site} · {a.time}</p>
                    <button type="button" className="shrink-0 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white">Acknowledge</button>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-snug">{a.msg}</p>
                </div>
              ) : (
                <div key={a.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="dk-label text-accent-orange/70">{a.type} · {a.site} · {a.time}</p>
                    <button type="button" className="shrink-0 rounded-full border border-white/10 p-1.5 text-ink-3" aria-label="Acknowledge">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm leading-snug text-ink-2">{a.msg}</p>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
