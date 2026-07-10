import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Plus,
  ChevronRight,
  Trash2,
  Clock,
  ScanLine,
  Gauge,
  ShieldCheck,
  BellRing,
  Check,
} from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import KpiCard from '../components/KpiCard.jsx'
import SiteSearchInput from '../components/SiteSearchInput.jsx'
import SiteHoursModal from '../components/SiteHoursModal.jsx'
import { RatioBar, CoverageChart, ActivityLine, FeedTimeline, ExpandChip, LegendDot } from '../components/overview/widgets.jsx'
import { CHART } from '../lib/brandPalette.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { describeOperatingHours, getScheduledShiftForDate } from '../hooks/useClientShift.js'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import { fetchOpenAlertEvents, acknowledgeAlertEvent, ALERT_TYPE_LABELS } from '../lib/alertEvents.js'
import { supabase } from '../lib/supabase.js'
import { deleteSite } from '../lib/sites.js'

function initialsOf(name) {
  return (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function AlertCard({ alert, primary, onAcknowledge, busy }) {
  const typeLabel = ALERT_TYPE_LABELS[alert.event_type] || alert.event_type
  const when = new Date(alert.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (primary) {
    return (
      <div className="rounded-2xl bg-paper p-4 text-black">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent-orange">
            {typeLabel} · {alert.sites?.name} · {when}
          </p>
          <button
            type="button"
            onClick={() => onAcknowledge(alert.id)}
            disabled={busy}
            className="shrink-0 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? '…' : 'Acknowledge'}
          </button>
        </div>
        <p className="mt-2 text-sm font-semibold leading-snug">{alert.message}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="dk-label text-accent-orange/70">
          {typeLabel} · {alert.sites?.name} · {when}
        </p>
        <button
          type="button"
          onClick={() => onAcknowledge(alert.id)}
          disabled={busy}
          className="shrink-0 rounded-full border border-white/10 p-1.5 text-ink-3 transition hover:bg-white/10 hover:text-ink disabled:opacity-50"
          aria-label="Acknowledge"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-2 text-sm leading-snug text-ink-2">{alert.message}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [stats, setStats] = useState({})
  const [scansToday, setScansToday] = useState([])
  const [shiftsToday, setShiftsToday] = useState([])
  const [alerts, setAlerts] = useState([])
  const [cpMap, setCpMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showNewSite, setShowNewSite] = useState(false)
  const [newSite, setNewSite] = useState({ name: '', address: '' })
  const [removingId, setRemovingId] = useState(null)
  const [hoursSite, setHoursSite] = useState(null)
  const [ackBusy, setAckBusy] = useState(null)
  const [query, setQuery] = useState('')

  const loadSites = async () => {
    if (!user) return
    setLoading(true)
    try {
      const role = isSuperAdmin ? 'super_admin' : 'admin'
      const siteList = await fetchSitesForAdmin(user.id, role)
      setSites(siteList)

      fetchOpenAlertEvents().then(setAlerts).catch(() => setAlerts([]))

      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      supabase
        .from('shifts')
        .select('id, guard_id, site_id, starts_at, ends_at, profiles:guard_id(name)')
        .eq('status', 'published')
        .not('guard_id', 'is', null)
        .lt('starts_at', dayEnd.toISOString())
        .gt('ends_at', dayStart.toISOString())
        .then(({ data }) => setShiftsToday(data || []))

      const allGuards = await fetchGuardsWithSites()
      const siteIds = new Set(siteList.map((s) => s.id))
      setGuards(isSuperAdmin ? allGuards : allGuards.filter((g) => !g.site_id || siteIds.has(g.site_id)))

      const siteStats = {}
      const cpLookup = {}
      const allCpIds = []
      for (const site of siteList) {
        const { data: floors } = await supabase.from('floors').select('id').eq('site_id', site.id)
        const floorIds = floors?.map((f) => f.id) || []

        let checkpointCount = 0
        let scanCount = 0
        if (floorIds.length) {
          const { data: cps } = await supabase
            .from('checkpoints')
            .select('id, name')
            .in('floor_id', floorIds)
          checkpointCount = cps?.length || 0
          for (const cp of cps || []) {
            cpLookup[cp.id] = { name: cp.name, site: site.name, siteId: site.id }
            allCpIds.push(cp.id)
          }
          if (cps?.length) {
            const { count } = await supabase
              .from('scans')
              .select('*', { count: 'exact', head: true })
              .in('checkpoint_id', cps.map((c) => c.id))
              .eq('status', 'pass')
              .gte('scanned_at', dayStart.toISOString())
            scanCount = count || 0
          }
        }

        const siteGuards = allGuards.filter((g) => g.site_id === site.id)
        siteStats[site.id] = {
          checkpoints: checkpointCount,
          scannedToday: scanCount,
          compliance: checkpointCount ? Math.round((scanCount / checkpointCount) * 100) : 0,
          guards: siteGuards,
        }
      }
      setStats(siteStats)
      setCpMap(cpLookup)

      if (allCpIds.length) {
        const { data: scanRows } = await supabase
          .from('scans')
          .select('id, checkpoint_id, guard_id, scanned_at, profiles:guard_id(name)')
          .in('checkpoint_id', allCpIds)
          .eq('status', 'pass')
          .gte('scanned_at', dayStart.toISOString())
          .order('scanned_at', { ascending: false })
          .limit(300)
        setScansToday(scanRows || [])
      } else {
        setScansToday([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSites()
  }, [user?.id])

  useEffect(() => {
    const onFocus = () => loadSites()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user?.id, isSuperAdmin])

  const handleAcknowledge = async (id) => {
    setAckBusy(id)
    try {
      await acknowledgeAlertEvent(id)
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setAckBusy(null)
    }
  }

  const createSite = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('sites').insert({
      name: newSite.name,
      address: newSite.address,
      admin_id: user.id,
    })
    if (error) {
      alert(`Could not create site: ${error.message}`)
      return
    }
    setNewSite({ name: '', address: '' })
    setShowNewSite(false)
    loadSites()
  }

  const handleDeleteSite = async (site) => {
    const s = stats[site.id] || {}
    const guardCount = s.guards?.length || 0
    const checkpointCount = s.checkpoints || 0
    const message =
      `Remove "${site.name}"?\n\nThis permanently deletes:\n` +
      `• All floors and checkpoints (${checkpointCount})\n• All scan history for this site\n• Alerts for this site\n\n` +
      (guardCount > 0 ? `${guardCount} guard(s) and any client logins will be unassigned (accounts stay active).\n\n` : '') +
      `This cannot be undone.`
    if (!confirm(message)) return
    setRemovingId(site.id)
    try {
      await deleteSite(site.id)
      await loadSites()
    } catch (err) {
      alert(err.message || 'Could not remove site')
    } finally {
      setRemovingId(null)
    }
  }

  // ---- Derived widget data (scoped by site search) --------------------------
  const now = new Date()
  const q = query.trim().toLowerCase()

  const matchedSites = useMemo(() => {
    if (!q) return sites
    return sites.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q),
    )
  }, [sites, q])

  const scopedSiteIds = useMemo(() => new Set(matchedSites.map((s) => s.id)), [matchedSites])

  const scopedGuards = useMemo(() => {
    if (!q) return guards
    return guards.filter((g) => g.site_id && scopedSiteIds.has(g.site_id))
  }, [guards, q, scopedSiteIds])

  const scopedShifts = useMemo(() => {
    if (!q) return shiftsToday
    return shiftsToday.filter((s) => scopedSiteIds.has(s.site_id))
  }, [shiftsToday, q, scopedSiteIds])

  const scopedScans = useMemo(() => {
    if (!q) return scansToday
    return scansToday.filter((s) => scopedSiteIds.has(cpMap[s.checkpoint_id]?.siteId))
  }, [scansToday, q, scopedSiteIds, cpMap])

  const scopedAlerts = useMemo(() => {
    if (!q) return alerts
    return alerts.filter((a) => scopedSiteIds.has(a.site_id))
  }, [alerts, q, scopedSiteIds])

  const scopedStats = useMemo(() => {
    if (!q) return stats
    return Object.fromEntries(Object.entries(stats).filter(([id]) => scopedSiteIds.has(id)))
  }, [stats, q, scopedSiteIds])

  const unassignedGuards = guards.filter((g) => g.unassigned)
  const activeGuards = scopedGuards.filter((g) => g.active)
  const totalScansToday = Object.values(scopedStats).reduce((sum, s) => sum + (s.scannedToday || 0), 0)
  const complianceValues = Object.values(scopedStats).map((s) => s.compliance || 0)
  const avgCompliance = complianceValues.length
    ? Math.round(complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length)
    : 0

  const onDutyGuardIds = useMemo(
    () =>
      new Set(
        scopedShifts
          .filter((s) => new Date(s.starts_at) <= now && new Date(s.ends_at) > now)
          .map((s) => s.guard_id),
      ),
    [scopedShifts],
  )
  const upNextIds = useMemo(
    () => new Set(scopedShifts.filter((s) => new Date(s.starts_at) > now).map((s) => s.guard_id)),
    [scopedShifts],
  )
  const noShowIds = useMemo(
    () => new Set(scopedAlerts.filter((a) => a.event_type === 'no_show').map((a) => a.guard_id)),
    [scopedAlerts],
  )

  const unscheduledCount = Math.max(
    0,
    activeGuards.length - onDutyGuardIds.size - upNextIds.size - noShowIds.size,
  )

  const summarySegments = [
    { label: 'On patrol', value: onDutyGuardIds.size, color: CHART.onPatrol },
    { label: 'Up next', value: upNextIds.size, color: CHART.upNext },
    { label: 'No-show', value: noShowIds.size, color: CHART.noShow },
    { label: 'Unscheduled', value: unscheduledCount, color: CHART.unscheduledBar },
  ]

  // Hour window across sites' operating hours today (fallback 08–20)
  const todayStr = now.toISOString().slice(0, 10)
  const hourWindow = useMemo(() => {
    let min = 8
    let max = 20
    for (const site of matchedSites) {
      const sched = getScheduledShiftForDate(todayStr, site.operating_hours)
      if (!sched.isClosed) {
        min = Math.min(min, parseInt(sched.start, 10))
        max = Math.max(max, parseInt(sched.end, 10))
      }
    }
    return { min, max }
  }, [matchedSites, todayStr])

  const coverageHours = useMemo(() => {
    const out = []
    for (let h = hourWindow.min; h <= hourWindow.max; h += 1) {
      const hourStart = new Date(now)
      hourStart.setHours(h, 0, 0, 0)
      const hourEnd = new Date(hourStart)
      hourEnd.setHours(h + 1)
      const required = scopedShifts.filter(
        (s) => new Date(s.starts_at) < hourEnd && new Date(s.ends_at) > hourStart,
      ).length
      const scanned = scopedScans.filter((s) => {
        const t = new Date(s.scanned_at)
        return t >= hourStart && t < hourEnd
      }).length
      const future = hourStart > now
      const status = future || (required > 0 && scanned >= required)
        ? 'adequate'
        : scanned > 0
          ? 'moderate'
          : 'missed'
      out.push({ label: `${String(h).padStart(2, '0')}:00`, required, scanned, status })
    }
    return out
  }, [hourWindow, scopedShifts, scopedScans])

  const activity = useMemo(() => {
    const labels = []
    const points = []
    for (let h = hourWindow.min; h <= hourWindow.max; h += 1) {
      labels.push(`${String(h).padStart(2, '0')}:00`)
      points.push(
        scopedScans.filter((s) => new Date(s.scanned_at).getHours() === h).length,
      )
    }
    return { labels, points }
  }, [hourWindow, scopedScans])

  const feedItems = useMemo(
    () =>
      scopedScans.slice(0, 5).map((s) => ({
        id: s.id,
        initials: initialsOf(s.profiles?.name),
        name: (s.profiles?.name || 'Guard').split(' ')[0],
        detail: cpMap[s.checkpoint_id]?.name || 'Checkpoint',
        time: new Date(s.scanned_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      })),
    [scopedScans, cpMap],
  )

  const visibleSites = matchedSites

  return (
    <Layout variant="admin">
      <PageHeader
        title="Overview"
        description="Sites, coverage, and today's compliance at a glance."
        action={
          <>
            <SiteSearchInput sites={sites} value={query} onChange={setQuery} className="w-full sm:w-48" />
            <button type="button" onClick={() => setShowNewSite(true)} className="dk-cta">
              <Plus className="h-4 w-4" /> New Site
            </button>
          </>
        }
      />

      {showNewSite && (
        <form onSubmit={createSite} className="dk-card mb-6 p-6">
          <h3 className="font-display text-lg font-semibold text-ink">Create Site</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="sp-label">Site name</label>
              <input placeholder="e.g. 800 Bathurst St" value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} required className="sp-input" />
            </div>
            <div>
              <label className="sp-label">Address</label>
              <input placeholder="Full street address" value={newSite.address} onChange={(e) => setNewSite({ ...newSite, address: e.target.value })} className="sp-input" />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" className="dk-cta">Create site</button>
            <button type="button" onClick={() => setShowNewSite(false)} className="dk-btn-2">Cancel</button>
          </div>
        </form>
      )}

      {unassignedGuards.length > 0 && (
        <div className="mb-6 rounded-xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-sm text-accent-orange">
          <strong>{unassignedGuards.length} guard(s)</strong> have no site assigned. Go to{' '}
          <Link to="/admin/guards" className="font-semibold underline">Guards</Link> to assign them.
        </div>
      )}

      {q && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-accent-cyan-line/30 bg-accent-cyan/10 px-4 py-2.5 text-sm text-ink">
          <span>
            Showing data for{' '}
            <strong className="text-accent-cyan-line">
              {matchedSites.length === 1 ? matchedSites[0].name : `${matchedSites.length} sites`}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="ml-auto text-xs font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {q && matchedSites.length === 0 && (
        <div className="mb-6 rounded-xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-sm text-accent-orange">
          No sites match your search. KPIs and charts are empty until you pick a matching site.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-12">
        {/* ============ Main column ============ */}
        <div className="space-y-5 xl:col-span-8">
          {/* KPI 2×2 + Workforce Summary */}
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="grid grid-cols-2 gap-4 lg:col-span-3">
              <KpiCard icon={Gauge} label="Compliance Score" value={`${avgCompliance}`} tone="sky" />
              <KpiCard icon={ShieldCheck} label="Guards on duty" value={String(onDutyGuardIds.size).padStart(2, '0')} tone="lime" />
              <KpiCard icon={ScanLine} label="Scans Today" value={String(totalScansToday).padStart(2, '0')} tone="lavender" />
              <KpiCard icon={BellRing} label="Open Alerts" value={String(scopedAlerts.length).padStart(2, '0')} tone="blossom" />
            </div>

            <div className="dk-card p-5 lg:col-span-2">
              <div className="flex items-start justify-between">
                <h2 className="text-sm font-semibold text-ink">Workforce Summary</h2>
                <ExpandChip to="/admin/roster" />
              </div>
              <div className="mt-2 grid grid-cols-2 justify-end gap-x-3 gap-y-1 pl-16">
                <LegendDot color={CHART.onPatrol} label="On patrol" />
                <LegendDot color={CHART.upNext} label="Up next" />
                <LegendDot color={CHART.noShow} label="No-show" />
                <LegendDot color={CHART.unscheduledBar} label="Unscheduled" />
              </div>
              <div className="mt-4">
                <RatioBar total={activeGuards.length} segments={summarySegments} />
              </div>
            </div>
          </div>

          {/* Patrol Coverage — dark inset chart */}
          <div className="dk-inset p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Patrol Coverage</h2>
              <div className="flex items-center gap-4">
                <LegendDot color={CHART.onPatrol} label="Adequate" />
                <LegendDot color={CHART.upNext} label="Moderate" />
                <LegendDot color={CHART.missed} label="Missed" />
                <ExpandChip to="/admin/reports" />
              </div>
            </div>
            <CoverageChart hours={coverageHours} maxY={Math.max(8, ...coverageHours.map((h) => h.scanned))} />
          </div>

          {/* Bottom row: Hourly activity (paper) + Live feed */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-paper p-5">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-black">Hourly Patrol Activity</h2>
                <ExpandChip to="/admin/reports" onPaper />
              </div>
              <ActivityLine points={activity.points} labels={activity.labels} />
            </div>

            <div className="dk-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Live Feed</h2>
                <ExpandChip to={matchedSites[0] ? `/admin/site/${matchedSites[0].id}/live` : '#'} />
              </div>
              <FeedTimeline items={feedItems} />
            </div>
          </div>

          {/* Site cards */}
          {loading ? (
            <div className="dk-card flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
            </div>
          ) : visibleSites.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-ink-3">
              {sites.length ? 'No sites match your search.' : 'No sites yet. Create your first site to get started.'}
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {visibleSites.map((site) => {
                const s = scopedStats[site.id] || stats[site.id] || {}
                return (
                  <div key={site.id} className="group dk-card p-6 transition hover:border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/admin/site/${site.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="rounded-lg bg-white/5 p-2">
                          <Building2 className="h-5 w-5 text-accent-orange" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-ink group-hover:text-accent-cyan-line">{site.name}</h3>
                          <p className="text-sm text-ink-2">{site.address || 'No address'}</p>
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button" onClick={() => setHoursSite(site)} className="rounded-lg p-2 text-ink-3 hover:bg-white/10 hover:text-ink" title="Edit site hours">
                          <Clock className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDeleteSite(site)} disabled={removingId === site.id} className="rounded-lg p-2 text-ink-3 hover:bg-accent-red/10 hover:text-accent-red disabled:opacity-40" title="Remove site">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Link to={`/admin/site/${site.id}`} className="rounded-lg p-2 text-ink-3 hover:bg-white/10 hover:text-ink" title="Open site">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-3">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="truncate">{describeOperatingHours(site.operating_hours)}</span>
                    </p>

                    <Link to={`/admin/site/${site.id}`} className="block">
                      <p className="dk-label mt-4 mb-2">Assigned guards</p>
                      {s.guards?.length > 0 ? (
                        <ul className="space-y-1">
                          {s.guards.map((g) => (
                            <li key={g.id} className="text-sm leading-relaxed text-ink-2">
                              <span className="text-ink">{g.name}</span>
                              <span className="text-ink-3"> · </span>
                              {g.email}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-3">No guards assigned</p>
                      )}

                      <div className="mt-4 flex divide-x divide-white/5 rounded-xl bg-inset p-3">
                        {[
                          { value: s.checkpoints || 0, label: 'Checkpoints' },
                          { value: s.scannedToday || 0, label: 'Scanned today' },
                          { value: `${s.compliance || 0}%`, label: 'Compliance', className: (s.compliance || 0) === 0 ? 'text-accent-red' : 'text-ink' },
                        ].map((metric) => (
                          <div key={metric.label} className="flex-1 px-3 text-center first:pl-0 last:pr-0">
                            <p className={`text-base font-bold ${metric.className || 'text-ink'}`}>{metric.value}</p>
                            <p className="dk-label">{metric.label}</p>
                          </div>
                        ))}
                      </div>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ============ Right rail: alerts ============ */}
        <div className="xl:col-span-4">
          <div className="dk-inset flex h-full flex-col gap-3 p-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-ink">Alerts</h2>
              <span className="dk-label">{scopedAlerts.length ? `${scopedAlerts.length} open` : 'All clear'}</span>
            </div>
            {scopedAlerts.length === 0 ? (
              <div className="hatch-empty flex flex-1 items-center justify-center rounded-xl border border-white/5 py-16 text-center">
                <p className="text-sm text-ink-3">
                  No open alerts.
                  <br />
                  Late, no-show and stale-patrol events land here.
                </p>
              </div>
            ) : (
              scopedAlerts.map((alertItem, i) => (
                <AlertCard key={alertItem.id} alert={alertItem} primary={i === 0} onAcknowledge={handleAcknowledge} busy={ackBusy === alertItem.id} />
              ))
            )}
          </div>
        </div>
      </div>

      {hoursSite && <SiteHoursModal site={hoursSite} onSaved={() => loadSites()} onClose={() => setHoursSite(null)} />}
    </Layout>
  )
}
