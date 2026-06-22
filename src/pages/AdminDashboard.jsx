import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, ChevronRight, Users, Trash2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites, formatSiteLabel } from '../lib/guards.js'
import { supabase } from '../lib/supabase.js'
import { deleteSite } from '../lib/sites.js'

export default function AdminDashboard() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [showNewSite, setShowNewSite] = useState(false)
  const [newSite, setNewSite] = useState({ name: '', address: '' })
  const [removingId, setRemovingId] = useState(null)

  const loadSites = async () => {
    if (!user) return
    setLoading(true)
    try {
      const role = isSuperAdmin ? 'super_admin' : 'admin'
      const siteList = await fetchSitesForAdmin(user.id, role)
      setSites(siteList)

      const allGuards = await fetchGuardsWithSites()
      const siteIds = new Set(siteList.map((s) => s.id))
      setGuards(
        isSuperAdmin
          ? allGuards
          : allGuards.filter((g) => !g.site_id || siteIds.has(g.site_id)),
      )

      const siteStats = {}
      for (const site of siteList) {
        const { data: floors } = await supabase.from('floors').select('id').eq('site_id', site.id)
        const floorIds = floors?.map((f) => f.id) || []

        let checkpointCount = 0
        let scanCount = 0
        if (floorIds.length) {
          const { count: cpCount } = await supabase
            .from('checkpoints')
            .select('*', { count: 'exact', head: true })
            .in('floor_id', floorIds)
          checkpointCount = cpCount || 0

          const { data: cps } = await supabase.from('checkpoints').select('id').in('floor_id', floorIds)
          if (cps?.length) {
            const startOfDay = new Date()
            startOfDay.setHours(0, 0, 0, 0)
            const { count } = await supabase
              .from('scans')
              .select('*', { count: 'exact', head: true })
              .in('checkpoint_id', cps.map((c) => c.id))
              .eq('status', 'pass')
              .gte('scanned_at', startOfDay.toISOString())
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
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSites()
  }, [user?.id])

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
      `Remove "${site.name}"?\n\n` +
      `This permanently deletes:\n` +
      `• All floors and checkpoints (${checkpointCount})\n` +
      `• All scan history for this site\n` +
      `• Alerts for this site\n\n` +
      (guardCount > 0
        ? `${guardCount} guard(s) and any client logins will be unassigned from this site (accounts stay active).\n\n`
        : '') +
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

  const unassignedGuards = guards.filter((g) => g.unassigned)

  return (
    <Layout variant="admin">
      <PageHeader
        title="Admin Overview"
        description="Sites, guard assignments, and today's compliance at a glance."
        action={
          <button type="button" onClick={() => setShowNewSite(true)} className="sp-btn-primary">
            <Plus className="h-4 w-4" /> New Site
          </button>
        }
      />

      {showNewSite && (
        <form onSubmit={createSite} className="sp-card mb-8 p-6">
          <h3 className="font-display text-lg font-semibold">Create Site</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="sp-label">Site name</label>
              <input
                placeholder="e.g. 800 Bathurst St"
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                required
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Address</label>
              <input
                placeholder="Full street address"
                value={newSite.address}
                onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                className="sp-input"
              />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" className="sp-btn-primary">Create site</button>
            <button type="button" onClick={() => setShowNewSite(false)} className="sp-btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Guard roster — who is assigned where */}
      {!loading && guards.length > 0 && (
        <div className="sp-card mb-8 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-600" />
              <h2 className="font-semibold">Guard Assignments</h2>
            </div>
            <Link to="/admin/guards" className="text-sm text-brand-600 hover:underline">
              Manage guards →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Guard</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Assigned Site</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guards.map((guard) => (
                <tr key={guard.id} className={guard.unassigned ? 'bg-amber-50' : ''}>
                  <td className="px-4 py-2.5 font-medium">{guard.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{guard.email}</td>
                  <td className="px-4 py-2.5">
                    {guard.unassigned ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        Not assigned — fix in Guards
                      </span>
                    ) : (
                      <span className="text-slate-800">{formatSiteLabel(guard)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${guard.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {guard.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unassignedGuards.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{unassignedGuards.length} guard(s)</strong> have no site assigned.
          Go to <Link to="/admin/guards" className="font-medium underline">Guards</Link> to assign them.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : sites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No sites yet. Create your first site to get started.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sites.map((site) => {
            const s = stats[site.id] || {}
            return (
              <div
                key={site.id}
                className="group sp-card p-6 transition hover:border-brand-200 hover:shadow-lg hover:shadow-brand-500/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/admin/site/${site.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="rounded-lg bg-brand-50 p-2">
                      <Building2 className="h-5 w-5 text-brand-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold group-hover:text-brand-600">{site.name}</h3>
                      <p className="text-sm text-slate-500">{site.address || 'No address'}</p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteSite(site)}
                      disabled={removingId === site.id}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      title="Remove site"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <Link
                      to={`/admin/site/${site.id}`}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-brand-600"
                      title="Open site"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </div>
                </div>

                <Link to={`/admin/site/${site.id}`} className="block">

                {/* Guards assigned to this site */}
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-500">Assigned guards</p>
                  {s.guards?.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {s.guards.map((g) => (
                        <li key={g.id} className="text-sm text-slate-800">
                          {g.name}
                          <span className="text-slate-400"> · </span>
                          <span className="text-slate-500">{g.email}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">No guards assigned</p>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-lg font-bold">{s.checkpoints || 0}</p>
                    <p className="text-xs text-slate-500">Checkpoints</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-lg font-bold">{s.scannedToday || 0}</p>
                    <p className="text-xs text-slate-500">Scanned Today</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className={`text-lg font-bold ${s.compliance >= 80 ? 'text-green-600' : s.compliance >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {s.compliance || 0}%
                    </p>
                    <p className="text-xs text-slate-500">Compliance</p>
                  </div>
                </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
