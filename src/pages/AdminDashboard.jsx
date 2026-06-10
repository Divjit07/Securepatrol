import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, ChevronRight, Users } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites, formatSiteLabel } from '../lib/guards.js'
import { supabase } from '../lib/supabase.js'

export default function AdminDashboard() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [showNewSite, setShowNewSite] = useState(false)
  const [newSite, setNewSite] = useState({ name: '', address: '' })

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
    if (!error) {
      setNewSite({ name: '', address: '' })
      setShowNewSite(false)
      loadSites()
    }
  }

  const unassignedGuards = guards.filter((g) => g.unassigned)

  return (
    <Layout variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Overview</h1>
          <p className="text-slate-600">All sites and guard assignments at a glance</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewSite(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New Site
        </button>
      </div>

      {showNewSite && (
        <form onSubmit={createSite} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Create Site</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Site name"
              value={newSite.name}
              onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="Address"
              value={newSite.address}
              onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNewSite(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Guard roster — who is assigned where */}
      {!loading && guards.length > 0 && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
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
              <Link
                key={site.id}
                to={`/admin/site/${site.id}`}
                className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-brand-50 p-2">
                      <Building2 className="h-5 w-5 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-brand-600">{site.name}</h3>
                      <p className="text-sm text-slate-500">{site.address || 'No address'}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>

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
            )
          })}
        </div>
      )}
    </Layout>
  )
}
