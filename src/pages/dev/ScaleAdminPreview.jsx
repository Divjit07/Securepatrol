// DEV-ONLY (/dev/admin-scale): the admin Overview rendered with the 40-guard ×
// 15-site scale dataset — same widget tiles as the real dashboard, numbers
// computed by the real pipeline from generated punches. Companion to /dev/scale
// (which shows the raw checks); this shows how the UI carries that volume.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, FlaskConical, MapPin } from 'lucide-react'
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
} from '../../components/overview/HomeWidgets.jsx'
import { CHART } from '../../lib/brandPalette.js'
import { generateScaleData } from './scaleData.js'
import { getScheduledShiftForDate } from '../../hooks/useClientShift.js'
import { countPatrolRounds } from '../../lib/clientStats.js'

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function buildOverview(seed) {
  const data = generateScaleData(seed)
  const day = data.dates[data.dates.length - 1]
  const cpAll = Object.values(data.checkpointsBySite).flat()
  const cpName = Object.fromEntries(cpAll.map((cp) => [cp.id, cp.name]))
  const patrolIds = new Set(cpAll.filter((cp) => cp.checkpoint_role === 'patrol').map((cp) => cp.id))
  const clockInIds = new Set(cpAll.filter((cp) => cp.checkpoint_role === 'shift_clock_in').map((cp) => cp.id))
  const guardName = Object.fromEntries(data.guards.map((g) => [g.id, g.name]))

  const dayScans = Object.values(data.scansBySite)
    .flat()
    .filter((s) => s.scanned_at.startsWith(day) || s.scanned_at.startsWith(`${day}T`) || s.scanned_at.slice(0, 10) === day)
    .sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))

  // Hourly coverage 08:00–20:00: required = sites open that hour, scanned = patrol scans.
  const hours = Array.from({ length: 13 }, (_, i) => {
    const h = 8 + i
    const scanned = dayScans.filter((s) => patrolIds.has(s.checkpoint_id) && new Date(s.scanned_at).getHours() === h).length
    const required = data.sites.filter((site) => {
      const sched = getScheduledShiftForDate(day, site.operating_hours)
      if (sched.isClosed) return false
      const start = Number(sched.start.slice(0, 2))
      const end = Number(sched.end.slice(0, 2))
      return end > start ? h >= start && h < end : h >= start || h < end
    }).length
    return {
      label: `${String(h).padStart(2, '0')}:00`,
      required,
      scanned,
      status: scanned >= required ? 'adequate' : scanned > 0 ? 'moderate' : 'missed',
    }
  })

  // Rounds completed today across sites (real counter, per site).
  let rounds = 0
  for (const site of data.sites) {
    const sched = getScheduledShiftForDate(day, site.operating_hours)
    if (sched.isClosed) continue
    rounds += countPatrolRounds(
      data.scansBySite[site.id].filter((s) => s.scanned_at.slice(0, 10) === day),
      data.checkpointsBySite[site.id],
      { date: day, shiftStart: sched.start, shiftEnd: sched.end },
    ).rounds
  }

  const scannedPatrolIds = new Set(dayScans.filter((s) => patrolIds.has(s.checkpoint_id)).map((s) => s.checkpoint_id))
  const compliance = Math.round((scannedPatrolIds.size / Math.max(1, patrolIds.size)) * 100)

  const workedToday = new Set(dayScans.filter((s) => clockInIds.has(s.checkpoint_id)).map((s) => s.guard_id))
  const dayAlerts = data.alerts.filter((a) => a.date === day)
  const noShows = dayAlerts.filter((a) => a.type === 'no_show').length
  const late = dayAlerts.filter((a) => a.type === 'late').length

  const feed = dayScans.slice(0, 6).map((s, i) => ({
    id: i,
    initials: initialsOf(guardName[s.guard_id] || 'G'),
    name: guardName[s.guard_id] || 'Guard',
    detail: cpName[s.checkpoint_id] || 'Checkpoint',
    time: fmtTime(s.scanned_at),
  }))

  const siteCards = data.sites.map((site) => {
    const siteDayScans = data.scansBySite[site.id].filter((s) => s.scanned_at.slice(0, 10) === day)
    const sitePatrol = data.checkpointsBySite[site.id].filter((cp) => cp.checkpoint_role === 'patrol')
    const scannedHere = new Set(siteDayScans.filter((s) => patrolIds.has(s.checkpoint_id)).map((s) => s.checkpoint_id))
    return {
      ...site,
      guards: data.guards.filter((g) => g.site_id === site.id),
      checkpointCount: data.checkpointsBySite[site.id].length,
      scannedToday: siteDayScans.length,
      compliance: sitePatrol.length ? Math.round((scannedHere.size / sitePatrol.length) * 100) : 0,
    }
  })

  return { data, day, hours, rounds, compliance, workedToday, dayScans, dayAlerts, noShows, late, feed, siteCards }
}

export default function ScaleAdminPreview() {
  const [seed, setSeed] = useState(42)
  const ov = useMemo(() => buildOverview(seed), [seed])
  const activity = { labels: ov.hours.map((h) => h.label), points: ov.hours.map((h) => h.scanned) }
  const guardsTotal = ov.data.guards.length
  const onPatrol = ov.workedToday.size
  const unscheduled = Math.max(0, guardsTotal - onPatrol - ov.noShows - ov.late)

  return (
    <Layout variant="admin">
      <PageHeader
        title="Overview"
        description={`Scale dataset · ${ov.data.sites.length} sites · ${guardsTotal} guards · ${ov.day} (last generated day)`}
        action={
          <>
            <Link to="/dev/scale" className="dk-btn-2">
              <FlaskConical className="h-3.5 w-3.5" /> Logic checks
            </Link>
            <button type="button" onClick={() => setSeed((s) => s + 1)} className="dk-cta">
              Re-roll (seed {seed + 1})
            </button>
          </>
        }
      />

      {/* Widget board — same tiles as the real Overview, scale numbers */}
      <div className="mb-8 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
        <ComplianceTile value={ov.compliance} siteLabel="all 15 sites" delay={0} />
        <RoundsTile rounds={ov.rounds} scansIntoRound={ov.dayScans.length} checkpointCount={Object.values(ov.data.checkpointsBySite).flat().length} delay={60} />
        <ScansTile count={ov.dayScans.length} points={activity.points} delay={120} />
        <ClockTile code="ALL" sub={`${ov.data.sites.length} sites`} delay={180} />
        <FeedTile count={ov.dayScans.length} items={ov.feed.slice(0, 3)} to="#feed" delay={240} />
        <CoverageTile hours={ov.hours} delay={300} />
        <WorkforceTile
          total={guardsTotal}
          segments={[
            { label: 'On patrol', value: onPatrol, color: CHART.onPatrol },
            { label: 'Late', value: ov.late, color: CHART.upNext },
            { label: 'No-show', value: ov.noShows, color: CHART.noShow },
            { label: 'Unscheduled', value: unscheduled, color: CHART.unscheduledBar },
          ]}
          to="/dev/roster"
          delay={360}
        />
        <AlertsCountTile
          count={ov.dayAlerts.length}
          summary={ov.dayAlerts.slice(0, 3).map((a) => a.type.replace('_', ' ')).join(' · ') || 'Quiet day'}
          delay={420}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <div className="dk-inset p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Patrol Coverage — {ov.day}</h2>
              <div className="flex items-center gap-4">
                <LegendDot color={CHART.onPatrol} label="Adequate" />
                <LegendDot color={CHART.upNext} label="Moderate" />
                <LegendDot color={CHART.missed} label="Missed" />
                <ExpandChip to="#" />
              </div>
            </div>
            <CoverageChart hours={ov.hours} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-paper p-5">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-black">Hourly Patrol Activity</h2>
                <ExpandChip to="#" onPaper />
              </div>
              <ActivityLine points={activity.points} labels={activity.labels} />
            </div>

            <div className="dk-card p-5" id="feed">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Live Feed</h2>
                <ExpandChip to="#" />
              </div>
              <FeedTimeline items={ov.feed} />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {ov.siteCards.map((site) => (
              <div key={site.id} className="dk-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="rounded-lg bg-white/5 p-2">
                      <Building2 className="h-5 w-5 text-accent-orange" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{site.name}</p>
                      <p className="truncate text-xs text-ink-2">{site.address}</p>
                    </div>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      site.latitude != null ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
                    }`}
                  >
                    <MapPin className="h-3 w-3" />
                    {site.latitude != null ? `${site.geofence_radius_m}m` : 'No GPS'}
                  </span>
                </div>
                <p className="mt-3 truncate text-xs text-ink-3">
                  {site.guards.map((g) => g.name).join(' · ') || 'No guards assigned'}
                </p>
                <div className="mt-3 grid grid-cols-3 divide-x divide-white/10 rounded-lg bg-white/5 p-2 text-center">
                  <div>
                    <p className="text-sm font-bold text-ink">{site.checkpointCount}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-3">Checkpoints</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">{site.scannedToday}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-3">Scans today</p>
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${site.compliance === 0 ? 'text-accent-red' : 'text-ink'}`}>
                      {site.compliance}%
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-3">Compliance</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <div className="dk-card p-5">
            <h2 className="text-sm font-semibold text-ink">Alerts — {ov.day}</h2>
            <div className="mt-3 space-y-3">
              {ov.dayAlerts.length === 0 && <p className="text-sm text-ink-3">No alerts on the last generated day.</p>}
              {ov.dayAlerts.map((a, i) => (
                <div key={i} className="rounded-xl bg-white/5 p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      a.type === 'no_show'
                        ? 'bg-accent-red/15 text-accent-red'
                        : a.type === 'late'
                          ? 'bg-[#FACC15]/15 text-[#FACC15]'
                          : 'bg-accent-cyan/15 text-accent-cyan-line'
                    }`}
                  >
                    {a.type.replace('_', ' ')}
                  </span>
                  <p className="mt-1.5 text-xs text-ink-2">{a.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
