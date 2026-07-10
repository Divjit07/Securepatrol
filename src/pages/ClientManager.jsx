import { useEffect, useState } from 'react'
import { Plus, UserX, UserCheck, Trash2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import {
  assignClientToSite,
  fetchClientsWithSites,
  formatClientSiteLabel,
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

      if (fnError) {
        throw new Error(
          fnError.message?.includes('FunctionsFetchError')
            ? 'Client service not deployed. Create user in Supabase, then link profile with role client.'
            : fnError.message,
        )
      }

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

      <div className="sp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-ink-2">
            <tr>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Site</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {clients.map((client) => (
              <tr key={client.id} className={client.unassigned ? 'bg-accent-orange/10' : ''}>
                <td className="px-4 py-3 font-medium">{client.name}</td>
                <td className="px-4 py-3 text-ink-2">{client.email}</td>
                <td className="px-4 py-3">
                  <select
                    className={`max-w-xs rounded border px-2 py-1.5 text-sm ${
                      client.unassigned ? 'border-amber-300 bg-accent-orange/10' : 'border-white/10 bg-surface'
                    }`}
                    value={client.site_id || ''}
                    disabled={assigningId === client.id}
                    onChange={(e) => handleAssignSite(client.id, e.target.value)}
                  >
                    <option value="">— Not assigned —</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.address ? ` — ${s.address}` : ''}
                      </option>
                    ))}
                  </select>
                  {!client.unassigned && (
                    <p className="mt-1 text-xs text-ink-2">{formatClientSiteLabel(client)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      client.active ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
                    }`}
                  >
                    {client.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(client)}
                      className="text-ink-2 hover:text-ink-2"
                      title={client.active ? 'Deactivate' : 'Activate'}
                      disabled={removingId === client.id}
                    >
                      {client.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveClient(client)}
                      className="text-accent-red hover:text-accent-red disabled:opacity-40"
                      title="Remove client permanently"
                      disabled={removingId === client.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && (
          <p className="p-8 text-center text-ink-2">No client accounts yet. Click Add Client to create one for Ali.</p>
        )}
      </div>
    </Layout>
  )
}
