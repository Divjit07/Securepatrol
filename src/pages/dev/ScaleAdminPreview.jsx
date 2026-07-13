// DEV-ONLY (/dev/admin-scale): the operations-first admin Overview rendered
// with the 40-guard × 15-site scale dataset, so you can see the real new design
// populated at volume. Same OverviewBoard the live dashboard renders.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import Layout from '../../components/Layout.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import OverviewBoard from '../../components/overview/OverviewBoard.jsx'
import { generateScaleData } from './scaleData.js'
import { getScheduledShiftForDate } from '../../hooks/useClientShift.js'

const TYPE_LABEL = { late: 'Late', no_show: 'No-show', stale_patrol: 'Stale patrol' }

function buildBoard(seed) {
  const data = generateScaleData(seed)
  const day = data.dates[data.dates.length - 1]
  const cpAll = Object.values(data.checkpointsBySite).flat()
  const patrolIds = new Set(cpAll.filter((cp) => cp.checkpoint_role === 'patrol').map((cp) => cp.id))
  const clockInIds = new Set(cpAll.filter((cp) => cp.checkpoint_role === 'shift_clock_in').map((cp) => cp.id))
  const guardName = Object.fromEntries(data.guards.map((g) => [g.id, g.name]))

  const dayScans = Object.values(data.scansBySite).flat().filter((s) => s.scanned_at.slice(0, 10) === day)
  const dayAlerts = data.alerts.filter((a) => a.date === day)

  const workedToday = new Set(dayScans.filter((s) => clockInIds.has(s.checkpoint_id)).map((s) => s.guard_id))
  const noShow = dayAlerts.filter((a) => a.type === 'no_show').length
  const late = dayAlerts.filter((a) => a.type === 'late').length

  // Per-site stats
  const siteRows = data.sites.map((site) => {
    const siteDayScans = data.scansBySite[site.id].filter((s) => s.scanned_at.slice(0, 10) === day)
    const sitePatrol = data.checkpointsBySite[site.id].filter((cp) => cp.checkpoint_role === 'patrol')
    const scannedHere = new Set(siteDayScans.filter((s) => patrolIds.has(s.checkpoint_id)).map((s) => s.checkpoint_id))
    const siteGuards = data.guards.filter((g) => g.site_id === site.id)
    return {
      id: site.id,
      name: site.name,
      address: site.address,
      guardNames: siteGuards.map((g) => g.name).join(', '),
      checkpoints: data.checkpointsBySite[site.id].length,
      scannedToday: siteDayScans.length,
      compliance: sitePatrol.length ? Math.round((scannedHere.size / sitePatrol.length) * 100) : 0,
      geofenced: site.latitude != null,
      radius: site.geofence_radius_m,
    }
  })

  const avgCompliance = Math.round(siteRows.reduce((s, r) => s + r.compliance, 0) / siteRows.length)
  const totalScans = dayScans.length
  const openSites = data.sites.filter((s) => !getScheduledShiftForDate(day, s.operating_hours).isClosed).length

  const statusSegments = [
    { label: 'On duty now', pill: 'On duty', value: workedToday.size, tone: 'green' },
    { label: 'Running late', pill: 'Late', value: late, tone: late ? 'amber' : 'muted' },
    { label: 'No-show', pill: 'No-show', value: noShow, tone: noShow ? 'red' : 'muted' },
    { label: 'Off / not scheduled', pill: 'Off', value: Math.max(0, data.guards.length - workedToday.size - late - noShow), tone: 'muted' },
  ]
  const kpis = [
    { label: 'Sites', value: data.sites.length, hint: `${openSites} open today` },
    { label: 'Active guards', value: data.guards.length },
    { label: 'Scans today', value: totalScans },
    { label: 'Avg compliance', value: `${avgCompliance}%` },
  ]
  const alerts = dayAlerts.map((a, i) => ({
    id: i,
    type: a.type,
    typeLabel: TYPE_LABEL[a.type] || a.type,
    siteName: a.site,
    when: 'today',
    message: a.message,
  }))

  // Clock in/out events for the day (from clock-checkpoint scans), newest first.
  const clockInIdSet = new Set(cpAll.filter((cp) => cp.checkpoint_role === 'shift_clock_in').map((cp) => cp.id))
  const clockOutIdSet = new Set(cpAll.filter((cp) => cp.checkpoint_role === 'shift_clock_out').map((cp) => cp.id))
  const siteOfCp = {}
  for (const site of data.sites) for (const cp of data.checkpointsBySite[site.id]) siteOfCp[cp.id] = site.name
  const clockActivity = dayScans
    .filter((s) => clockInIdSet.has(s.checkpoint_id) || clockOutIdSet.has(s.checkpoint_id))
    .sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))
    .slice(0, 25)
    .map((s) => ({
      id: s.id,
      guardName: guardName[s.guard_id] || 'Guard',
      siteName: siteOfCp[s.checkpoint_id] || 'Site',
      type: clockInIdSet.has(s.checkpoint_id) ? 'in' : 'out',
      at: s.scanned_at,
    }))

  return { day, sitesCount: data.sites.length, guardsCount: data.guards.length, statusSegments, kpis, alerts, siteRows, clockActivity }
}

export default function ScaleAdminPreview() {
  const [seed, setSeed] = useState(42)
  const b = useMemo(() => buildBoard(seed), [seed])

  return (
    <Layout variant="admin">
      <PageHeader
        title="Overview"
        description={`Scale preview · ${b.sitesCount} sites · ${b.guardsCount} guards · ${b.day}`}
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
      <OverviewBoard
        statusSegments={b.statusSegments}
        kpis={b.kpis}
        alerts={b.alerts}
        sites={b.siteRows}
        clockActivity={b.clockActivity}
        loading={false}
      />
    </Layout>
  )
}
