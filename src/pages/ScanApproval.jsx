import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import {
  approveCheckpointScan,
  fetchRecentAdminApprovals,
} from '../lib/scanApproval.js'

export default function ScanApproval() {
  const { user, isSuperAdmin, canApproveScans } = useAuth()
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState('')
  const [checkpoints, setCheckpoints] = useState([])
  const [guards, setGuards] = useState([])
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('')
  const [selectedGuard, setSelectedGuard] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [recent, setRecent] = useState([])

  const siteGuards = useMemo(
    () => guards.filter((g) => g.site_id === selectedSite && g.active),
    [guards, selectedSite],
  )

  const loadRecent = async () => {
    try {
      const rows = await fetchRecentAdminApprovals()
      setRecent(rows)
    } catch (err) {
      console.error(err)
    }
  }

  const loadCheckpoints = async (siteId) => {
    const { data: floors } = await supabase
      .from('floors')
      .select('id')
      .eq('site_id', siteId)

    if (!floors?.length) {
      setCheckpoints([])
      return
    }

    const { data } = await supabase
      .from('checkpoints')
      .select('id, name, floors(floor_name)')
      .in('floor_id', floors.map((f) => f.id))
      .eq('active', true)
      .order('name')

    setCheckpoints(data || [])
  }

  useEffect(() => {
    if (!user || !canApproveScans) return

    const role = isSuperAdmin ? 'super_admin' : 'admin'
    fetchSitesForAdmin(user.id, role).then((siteList) => {
      setSites(siteList)
      if (siteList.length) setSelectedSite(siteList[0].id)
    })

    fetchGuardsWithSites().then(setGuards)
    loadRecent()
  }, [user?.id, canApproveScans])

  useEffect(() => {
    if (!selectedSite) return
    setSelectedCheckpoint('')
    setSelectedGuard('')
    loadCheckpoints(selectedSite)
  }, [selectedSite])

  if (!canApproveScans) {
    return <Navigate to="/admin" replace />
  }

  const handleApprove = async (e) => {
    e.preventDefault()
    if (!selectedCheckpoint || !selectedGuard) return

    setLoading(true)
    setMessage(null)

    try {
      await approveCheckpointScan(selectedCheckpoint, selectedGuard, note)
      setMessage({ type: 'success', text: 'Checkpoint scan approved successfully.' })
      setNote('')
      setSelectedCheckpoint('')
      setSelectedGuard('')
      await loadRecent()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to approve scan' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout variant="admin">
      <PageHeader
        title="Approve Scan"
        description="Remotely record a passing checkpoint scan for a guard when GPS fails on site. Only available to the designated approver."
      />

      <form onSubmit={handleApprove} className="sp-card max-w-xl space-y-5 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Site</label>
          <select
            className="sp-input w-full"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            required
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Checkpoint</label>
          <select
            className="sp-input w-full"
            value={selectedCheckpoint}
            onChange={(e) => setSelectedCheckpoint(e.target.value)}
            required
          >
            <option value="">Select checkpoint…</option>
            {checkpoints.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.name}
                {cp.floors?.floor_name ? ` (${cp.floors.floor_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Guard</label>
          <select
            className="sp-input w-full"
            value={selectedGuard}
            onChange={(e) => setSelectedGuard(e.target.value)}
            required
          >
            <option value="">Select guard…</option>
            {siteGuards.map((guard) => (
              <option key={guard.id} value={guard.id}>
                {guard.name}
                {guard.email && guard.email !== '—' ? ` — ${guard.email}` : ''}
              </option>
            ))}
          </select>
          {selectedSite && siteGuards.length === 0 && (
            <p className="mt-1 text-sm text-amber-600">No active guards assigned to this site.</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Note (optional)</label>
          <textarea
            className="sp-input w-full"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. GPS failed on 12th floor — guard confirmed on site"
          />
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !selectedCheckpoint || !selectedGuard}
          className="sp-btn-primary inline-flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          {loading ? 'Approving…' : 'Approve scan'}
        </button>
      </form>

      {recent.length > 0 && (
        <div className="sp-card mt-8 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold">Recent approvals</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Site</th>
                  <th className="px-6 py-3 font-medium">Checkpoint</th>
                  <th className="px-6 py-3 font-medium">Guard</th>
                  <th className="px-6 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-6 py-3 text-slate-600">
                      {new Date(row.scanned_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">{row.checkpoints?.floors?.sites?.name || '—'}</td>
                    <td className="px-6 py-3">
                      {row.checkpoints?.name || '—'}
                      {row.checkpoints?.floors?.floor_name
                        ? ` (${row.checkpoints.floors.floor_name})`
                        : ''}
                    </td>
                    <td className="px-6 py-3">{row.guard?.name || '—'}</td>
                    <td className="px-6 py-3 text-slate-500">{row.approval_note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}
