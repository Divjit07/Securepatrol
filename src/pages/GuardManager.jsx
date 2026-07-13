import { useEffect, useState } from 'react'
import { Plus, UserX, UserCheck, Trash2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { readFnError } from '../lib/fnError.js'
import { fetchGuardsWithSites, assignGuardToSite, removeGuard } from '../lib/guards.js'

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

      if (fnError) throw new Error(await readFnError(fnError, 'Could not create the guard account'))

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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guard Manager</h1>
          <p className="text-ink-2">Assign each guard to exactly one site</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" /> Add Guard
        </button>
      </div>

      {showForm && (
        <form onSubmit={createGuard} className="mb-6 rounded-xl border border-white/10 bg-surface p-4">
          <h3 className="font-semibold">Create Guard Account</h3>
          {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="rounded-lg border border-white/10 px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="rounded-lg border border-white/10 px-3 py-2"
            />
            <input
              type="password"
              placeholder="Temporary password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className="rounded-lg border border-white/10 px-3 py-2"
            />
            <select
              value={form.site_id}
              onChange={(e) => setForm({ ...form, site_id: e.target.value })}
              required
              className="rounded-lg border border-white/10 px-3 py-2"
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

      {/* Responsive card list — actions (incl. Remove) always visible on mobile. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {guards.map((guard) => (
          <div
            key={guard.id}
            className={`rounded-xl border bg-surface p-4 ${
              guard.unassigned ? 'border-accent-orange/40' : 'border-white/10'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{guard.name}</p>
                <p className="truncate text-xs text-ink-2">{guard.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  guard.active ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
                }`}
              >
                {guard.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Assigned site
            </label>
            <select
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                guard.unassigned ? 'border-accent-orange/40 bg-accent-orange/10' : 'border-white/10 bg-inset'
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

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => toggleActive(guard)}
                disabled={removingId === guard.id}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-white/5 disabled:opacity-40"
              >
                {guard.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                {guard.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => handleRemoveGuard(guard)}
                disabled={removingId === guard.id}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent-red/30 px-3 py-2 text-xs font-semibold text-accent-red hover:bg-accent-red/10 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </div>
        ))}
        {guards.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-surface p-8 text-center text-ink-2 sm:col-span-2 xl:col-span-3">
            No guards yet.
          </p>
        )}
      </div>
    </Layout>
  )
}
