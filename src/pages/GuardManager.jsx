import { useEffect, useState } from 'react'
import { Plus, UserX, UserCheck, Trash2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites, assignGuardToSite, formatSiteLabel, removeGuard } from '../lib/guards.js'

export default function GuardManager() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', site_id: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [assigningId, setAssigningId] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  const loadGuards = async () => {
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
  }

  useEffect(() => {
    if (user) loadGuards()
  }, [user?.id])

  const handleAssignSite = async (guardId, siteId, name, email) => {
    if (!siteId) return
    setAssigningId(guardId)
    try {
      await assignGuardToSite(guardId, siteId, name, email)
      await loadGuards()
    } catch (err) {
      alert(err.message || 'Failed to assign site')
    } finally {
      setAssigningId(null)
    }
  }

  const createGuard = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-guard', {
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          site_id: form.site_id,
        },
      })

      if (fnError) {
        throw new Error(
          fnError.message?.includes('FunctionsFetchError')
            ? 'Guard service not deployed. Create user in Supabase, then assign site in the table below.'
            : fnError.message,
        )
      }

      if (data?.error) throw new Error(data.error)

      setForm({ name: '', email: '', password: '', site_id: '' })
      setShowForm(false)
      loadGuards()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (guard) => {
    const newActive = !guard.active
    await supabase.from('guards').update({ active: newActive }).eq('id', guard.id)
    await supabase.from('profiles').update({ active: newActive }).eq('id', guard.id)
    loadGuards()
  }

  const handleRemoveGuard = async (guard) => {
    const label = guard.email !== '—' ? `${guard.name} (${guard.email})` : guard.name
    const confirmed = window.confirm(
      `Remove guard "${label}"?\n\nThis deletes their account and they will no longer be able to log in.`,
    )
    if (!confirmed) return

    setRemovingId(guard.id)
    try {
      const result = await removeGuard(guard.id)
      if (result.warning) {
        alert(result.warning)
      }
      await loadGuards()
    } catch (err) {
      alert(err.message || 'Failed to remove guard')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Layout variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guard Manager</h1>
          <p className="text-slate-600">Assign each guard to exactly one site</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Add Guard
        </button>
      </div>

      {showForm && (
        <form onSubmit={createGuard} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Create Guard Account</h3>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="password"
              placeholder="Temporary password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <select
              value={form.site_id}
              onChange={(e) => setForm({ ...form, site_id: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Assign to site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.address ? ` — ${s.address}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={loading} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Guard'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Guard</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Assigned Site</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {guards.map((guard) => (
              <tr key={guard.id} className={guard.unassigned ? 'bg-amber-50/60' : ''}>
                <td className="px-4 py-3 font-medium">{guard.name}</td>
                <td className="px-4 py-3 text-slate-600">{guard.email}</td>
                <td className="px-4 py-3">
                  <select
                    className={`max-w-xs rounded border px-2 py-1.5 text-sm ${
                      guard.unassigned ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                    }`}
                    value={guard.site_id || ''}
                    disabled={assigningId === guard.id}
                    onChange={(e) => handleAssignSite(guard.id, e.target.value, guard.name, guard.email)}
                  >
                    <option value="">— Not assigned —</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.address ? ` — ${s.address}` : ''}
                      </option>
                    ))}
                  </select>
                  {!guard.unassigned && (
                    <p className="mt-1 text-xs text-slate-500">{formatSiteLabel(guard)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${guard.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {guard.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(guard)}
                      className="text-slate-500 hover:text-slate-700"
                      title={guard.active ? 'Deactivate' : 'Activate'}
                      disabled={removingId === guard.id}
                    >
                      {guard.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveGuard(guard)}
                      className="text-red-500 hover:text-red-700 disabled:opacity-40"
                      title="Remove guard permanently"
                      disabled={removingId === guard.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {guards.length === 0 && (
          <p className="p-8 text-center text-slate-500">No guards yet.</p>
        )}
      </div>
    </Layout>
  )
}
