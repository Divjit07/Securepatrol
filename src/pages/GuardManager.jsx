import { useEffect, useState } from 'react'
import { Plus, UserX, UserCheck, Trash2, MapPin } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../lib/supabase.js'
import { useReveal } from '../lib/motion.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { readFnError } from '../lib/fnError.js'
import { fetchGuardsWithSites, assignGuardToSite, removeGuard } from '../lib/guards.js'

const initials = (name) =>
  (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

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

  const gridRef = useReveal({ deps: [guards.length] })
  const unassignedCount = guards.filter((g) => g.unassigned).length

  return (
    <Layout variant="admin">
      <PageHeader
        title="Guards"
        description="Your guard roster — assign each to a site, activate or remove access."
        action={
          <button type="button" onClick={() => setShowForm(true)} className="dk-cta">
            <Plus className="h-4 w-4" /> Add Guard
          </button>
        }
      />

      {unassignedCount > 0 && (
        <div className="mb-5 rounded-2xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-sm text-accent-orange">
          <strong>{unassignedCount}</strong> guard{unassignedCount === 1 ? '' : 's'} without a site — assign one below so they can clock in.
        </div>
      )}

      {showForm && (
        <form onSubmit={createGuard} className="dk-card mb-6 p-6">
          <h3 className="font-display text-lg font-semibold text-ink">Create guard account</h3>
          {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="sp-label">Full name</label>
              <input placeholder="e.g. Divjit Singh" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="sp-input" />
            </div>
            <div>
              <label className="sp-label">Email</label>
              <input type="email" placeholder="guard@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="sp-input" />
            </div>
            <div>
              <label className="sp-label">Temporary password</label>
              <input type="password" placeholder="At least 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} className="sp-input" />
            </div>
            <div>
              <label className="sp-label">Assign to site</label>
              <select value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })} required className="sp-input">
                <option value="">Choose a site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.address ? ` — ${s.address}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={loading} className="dk-cta">{loading ? 'Creating…' : 'Create guard'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="dk-btn-2">Cancel</button>
          </div>
        </form>
      )}

      {/* Bento guard cards — actions (incl. Remove) always visible on mobile. */}
      <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {guards.map((guard) => (
          <div
            key={guard.id}
            data-reveal
            className={`bento bento-interactive ${guard.unassigned ? 'ring-1 ring-accent-orange/40' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${guard.active ? 'bg-accent-orange/20 text-accent-orange' : 'bg-white/[0.06] text-ink-3'}`}>
                  {initials(guard.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">{guard.name}</p>
                  <p className="truncate text-xs text-ink-3">{guard.email}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${guard.active ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'}`}>
                {guard.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <label className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              <MapPin className="h-3 w-3" /> Assigned site
            </label>
            <select
              className={`sp-input mt-1.5 ${guard.unassigned ? 'border-accent-orange/40' : ''}`}
              value={guard.site_id || ''}
              disabled={assigningId === guard.id}
              onChange={(e) => handleAssignSite(guard.id, e.target.value, guard.name, guard.email)}
            >
              <option value="">— Not assigned —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.address ? ` — ${s.address}` : ''}</option>
              ))}
            </select>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => toggleActive(guard)}
                disabled={removingId === guard.id}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-ink-2 transition hover:bg-white/[0.08] hover:text-ink disabled:opacity-40"
              >
                {guard.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                {guard.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => handleRemoveGuard(guard)}
                disabled={removingId === guard.id}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-accent-red/30 px-3 py-2 text-xs font-semibold text-accent-red transition hover:bg-accent-red/10 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </div>
        ))}
        {guards.length === 0 && (
          <div className="hatch-empty flex items-center justify-center rounded-[28px] border border-white/5 p-12 text-center text-sm text-ink-3 sm:col-span-2 xl:col-span-3">
            No guards yet. Add your first guard to get started.
          </div>
        )}
      </div>
    </Layout>
  )
}
