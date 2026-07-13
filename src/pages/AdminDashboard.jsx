import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SiteSearchInput from '../components/SiteSearchInput.jsx'
import SiteHoursModal from '../components/SiteHoursModal.jsx'
import OverviewBoard from '../components/overview/OverviewBoard.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { getScheduledShiftForDate } from '../hooks/useClientShift.js'
import { fetchSitesForAdmin, fetchRecentClockEvents } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import { fetchOpenAlertEvents, acknowledgeAlertEvent, ALERT_TYPE_LABELS } from '../lib/alertEvents.js'
import { supabase } from '../lib/supabase.js'
import { deleteSite } from '../lib/sites.js'

export default function AdminDashboard() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [stats, setStats] = useState({})
  const [shiftsToday, setShiftsToday] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewSite, setShowNewSite] = useState(false)
  const [newSite, setNewSite] = useState({ name: '', address: '' })
  const [removingId, setRemovingId] = useState(null)
  const [hoursSite, setHoursSite] = useState(null)
  const [ackBusy, setAckBusy] = useState(null)
  const [query, setQuery] = useState('')
  const [clockEvents, setClockEvents] = useState([])

  const loadSites = async () => {
    if (!user) return
    setLoading(true)
    try {
      const role = isSuperAdmin ? 'super_admin' : 'admin'
      const siteList = await fetchSitesForAdmin(user.id, role)
      setSites(siteList)

      fetchOpenAlertEvents().then(setAlerts).catch(() => setAlerts([]))
      fetchRecentClockEvents(siteList.map((s) => s.id))
        .then(setClockEvents)
        .catch(() => setClockEvents([]))

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

      // Batched: one floors query, one checkpoints query, per-site counts in parallel.
      const siteStats = {}
      const cpIdsBySite = {}

      let floorRows = []
      if (siteList.length) {
        const { data } = await supabase
          .from('floors')
          .select('id, site_id')
          .in('site_id', siteList.map((s) => s.id))
        floorRows = data || []
      }
      const floorSite = Object.fromEntries(floorRows.map((f) => [f.id, f.site_id]))

      let cpRows = []
      if (floorRows.length) {
        const { data } = await supabase
          .from('checkpoints')
          .select('id, floor_id')
          .in('floor_id', floorRows.map((f) => f.id))
        cpRows = data || []
      }
      for (const cp of cpRows) {
        const siteId = floorSite[cp.floor_id]
        ;(cpIdsBySite[siteId] ||= []).push(cp.id)
      }

      const scanCounts = await Promise.all(
        siteList.map(async (site) => {
          const cpIds = cpIdsBySite[site.id] || []
          if (!cpIds.length) return 0
          const { count } = await supabase
            .from('scans')
            .select('*', { count: 'exact', head: true })
            .in('checkpoint_id', cpIds)
            .eq('status', 'pass')
            .gte('scanned_at', dayStart.toISOString())
          return count || 0
        }),
      )

      siteList.forEach((site, i) => {
        const checkpointCount = (cpIdsBySite[site.id] || []).length
        const scanCount = scanCounts[i]
        siteStats[site.id] = {
          checkpoints: checkpointCount,
          scannedToday: scanCount,
          compliance: checkpointCount ? Math.round((scanCount / checkpointCount) * 100) : 0,
          guards: allGuards.filter((g) => g.site_id === site.id),
        }
      })
      setStats(siteStats)
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

  // ---- Derived (scoped by site search) --------------------------------------
  const now = new Date()
  const q = query.trim().toLowerCase()

  const matchedSites = useMemo(() => {
    if (!q) return sites
    return sites.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q),
    )
  }, [sites, q])

  const scopedSiteIds = useMemo(() => new Set(matchedSites.map((s) => s.id)), [matchedSites])
  const scopedGuards = q ? guards.filter((g) => g.site_id && scopedSiteIds.has(g.site_id)) : guards
  const scopedShifts = q ? shiftsToday.filter((s) => scopedSiteIds.has(s.site_id)) : shiftsToday
  const scopedAlerts = q ? alerts.filter((a) => scopedSiteIds.has(a.site_id)) : alerts
  const scopedStats = q
    ? Object.fromEntries(Object.entries(stats).filter(([id]) => scopedSiteIds.has(id)))
    : stats

  const unassignedGuards = guards.filter((g) => g.unassigned)
  const activeGuards = scopedGuards.filter((g) => g.active)

  const onDutyIds = new Set(
    scopedShifts.filter((s) => new Date(s.starts_at) <= now && new Date(s.ends_at) > now).map((s) => s.guard_id),
  )
  const lateIds = new Set(scopedAlerts.filter((a) => a.event_type === 'late').map((a) => a.guard_id))
  const noShowIds = new Set(scopedAlerts.filter((a) => a.event_type === 'no_show').map((a) => a.guard_id))

  const statusSegments = [
    { label: 'On duty now', pill: 'On duty', value: onDutyIds.size, tone: 'green' },
    { label: 'Running late', pill: 'Late', value: lateIds.size, tone: lateIds.size ? 'amber' : 'muted' },
    { label: 'No-show', pill: 'No-show', value: noShowIds.size, tone: noShowIds.size ? 'red' : 'muted' },
  ]

  const kpis = [
    { label: 'Sites', value: matchedSites.length },
    { label: 'Active guards', value: activeGuards.length, hint: unassignedGuards.length ? `${unassignedGuards.length} unassigned` : '' },
  ]

  const alertItems = scopedAlerts.map((a) => ({
    id: a.id,
    type: a.event_type,
    typeLabel: ALERT_TYPE_LABELS[a.event_type] || a.event_type,
    siteName: a.sites?.name || 'Site',
    when: new Date(a.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    message: a.message,
  }))

  const siteNameById = Object.fromEntries(sites.map((s) => [s.id, s.name]))
  const clockActivity = clockEvents
    .filter((e) => !q || scopedSiteIds.has(e.siteId))
    .map((e) => ({ ...e, siteName: siteNameById[e.siteId] || 'Site' }))

  const siteRows = matchedSites.map((site) => {
    const s = scopedStats[site.id] || stats[site.id] || {}
    return {
      id: site.id,
      name: site.name,
      address: site.address,
      guardNames: (s.guards || []).map((g) => g.name).join(', '),
      checkpoints: s.checkpoints || 0,
      scannedToday: s.scannedToday || 0,
      compliance: s.compliance || 0,
      geofenced: site.latitude != null && site.longitude != null,
      radius: site.geofence_radius_m ?? 120,
    }
  })

  return (
    <Layout variant="admin">
      <PageHeader
        title="Overview"
        description="Who's on duty, who needs attention, and today's coverage."
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
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-accent-cyan-line/30 bg-accent-cyan/10 px-4 py-2.5 text-sm text-ink">
          <span>
            Showing{' '}
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

      <OverviewBoard
        statusSegments={statusSegments}
        kpis={kpis}
        alerts={alertItems}
        onAcknowledge={handleAcknowledge}
        ackBusy={ackBusy}
        sites={siteRows}
        onEditHours={setHoursSite}
        onDeleteSite={handleDeleteSite}
        removingId={removingId}
        loading={loading}
        clockActivity={clockActivity}
        emptyLabel={sites.length ? 'No sites match your search.' : 'No sites yet. Create your first site to get started.'}
      />

      {hoursSite && <SiteHoursModal site={hoursSite} onSaved={() => loadSites()} onClose={() => setHoursSite(null)} />}
    </Layout>
  )
}
