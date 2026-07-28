import { useEffect, useState } from 'react'
import { Plus, UserX, UserCheck, Trash2, MapPin } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../lib/supabase.js'
import { useReveal } from '../lib/motion.js'
import { useAuth } from '../hooks/useAuth.jsx'

const initials = (name) =>
  (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
import { fetchSitesForAdmin } from '../lib/scans.js'
import { readFnError } from '../lib/fnError.js'
import {
  assignClientToSite,
  fetchClientsWithSites,
  removeClient,
} from '../lib/clients.js'

export default function ClientManager() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [clients, setClients] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', site_id: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [assigningId, setAssigningId] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  const loadClients = async () => {
    const role = isSuperAdmin ? 'super_admin' : 'admin'
    const siteList = await fetchSitesForAdmin(user.id, role)
    setSites(siteList)

    const allClients = await fetchClientsWithSites()
    const siteIds = new Set(siteList.map((s) => s.id))
    setClients(
      isSuperAdmin
        ? allClients
        : allClients.filter((c) => !c.site_id || siteIds.has(c.site_id)),
    )
  }

  useEffect(() => {
    if (user) loadClients()
  }, [user?.id])

  const handleAssignSite = async (clientId, siteId) => {
    if (!siteId) return
    setAssigningId(clientId)
    try {
      await assignClientToSite(clientId, siteId)
      await loadClients()
    } catch (err) {
      alert(err.message || 'Failed to assign site')
    } finally {
      setAssigningId(null)
    }
  }

  const createClient = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-client', {
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          site_id: form.site_id,
        },
      })

      if (fnError) throw new Error(await readFnError(fnError, 'Could not create the client account'))

      if (data?.error) throw new Error(data.error)

      setForm({ name: '', email: '', password: '', site_id: '' })
      setShowForm(false)
      loadClients()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (client) => {
    const newActive = !client.active
    await supabase.from('profiles').update({ active: newActive }).eq('id', client.id)
    loadClients()
  }

  const handleRemoveClient = async (client) => {
    const label = client.email !== '—' ? `${client.name} (${client.email})` : client.name
    const confirmed = window.confirm(
      `Remove client "${label}"?\n\nThey will no longer be able to log in to the patrol portal.`,
    )
    if (!confirmed) return

    setRemovingId(client.id)
    try {
      const result = await removeClient(client.id)
      if (result.warning) {
        alert(result.warning)
      }
      await loadClients()
    } catch (err) {
      alert(err.message || 'Failed to remove client')
    } finally {
      setRemovingId(null)
    }
  }

  const gridRef = useReveal({ deps: [clients.length] })

  return (
    <Layout variant="admin">
      <PageHeader
        title="Client Manager"
        description="Create read-only client logins. Each client sees patrol compliance for one site only — same as Amjad's portal."
        action={
          <button type="button" onClick={() => setShowForm(true)} className="sp-btn-primary">
            <Plus className="h-4 w-4" /> Add Client
          </button>
        }
      />

      {showForm && (
        <form onSubmit={createClient} className="sp-card mb-6 p-6">
          <h3 className="font-display text-lg font-semibold">Create Client Account</h3>
          <p className="mt-1 text-sm text-ink-2">
            Clients get a read-only patrol overview: green/red checkpoints, live feed, and shift history.
          </p>
          {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="sp-label">Full name</label>
              <input
                placeholder="e.g. Ali"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Email</label>
              <input
                type="email"
                placeholder="ali@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Temporary password</label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Site access</label>
              <select
                value={form.site_id}
                onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                required
                className="sp-input"
              >
                <option value="">Select site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.address ? ` — ${s.address}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={loading} className="sp-btn-primary disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Client'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="sp-btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Bento client cards — read-only site logins. */}
      <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clients.map((client) => (
          <div
            key={client.id}
            data-reveal
            className={`bento bento-interactive ${client.unassigned ? 'ring-1 ring-accent-orange/40' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${client.active ? 'bg-accent-cyan/20 text-accent-cyan-line' : 'bg-white/[0.06] text-ink-3'}`}>
                  {initials(client.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">{client.name}</p>
                  <p className="truncate text-xs text-ink-3">{client.email}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${client.active ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'}`}>
                {client.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <label className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              <MapPin className="h-3 w-3" /> Site access
            </label>
            <select
              className={`sp-input mt-1.5 ${client.unassigned ? 'border-accent-orange/40' : ''}`}
              value={client.site_id || ''}
              disabled={assigningId === client.id}
              onChange={(e) => handleAssignSite(client.id, e.target.value)}
            >
              <option value="">— Not assigned —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.address ? ` — ${s.address}` : ''}</option>
              ))}
            </select>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => toggleActive(client)}
                disabled={removingId === client.id}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-ink-2 transition hover:bg-white/[0.08] hover:text-ink disabled:opacity-40"
              >
                {client.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                {client.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => handleRemoveClient(client)}
                disabled={removingId === client.id}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-accent-red/30 px-3 py-2 text-xs font-semibold text-accent-red transition hover:bg-accent-red/10 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <div className="hatch-empty flex items-center justify-center rounded-[28px] border border-white/5 p-12 text-center text-sm text-ink-3 sm:col-span-2 xl:col-span-3">
            No client accounts yet. Click Add Client to create one.
          </div>
        )}
      </div>
    </Layout>
  )
}
