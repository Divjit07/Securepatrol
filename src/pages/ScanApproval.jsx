import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CheckCircle2, Waves } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import RosterSitePicker from '../components/roster/RosterSitePicker.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import {
  approveCheckpointScan,
  approveScanWave,
  fetchRecentAdminApprovals,
} from '../lib/scanApproval.js'

export default function ScanApproval() {
  const { user, isSuperAdmin, canApproveScans, privilegesLoading } = useAuth()
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
  const [waveGuard, setWaveGuard] = useState('')
  const [waveMinutes, setWaveMinutes] = useState(15)
  const [waveNote, setWaveNote] = useState('')
  const [waveSelection, setWaveSelection] = useState([])
  const [waveLoading, setWaveLoading] = useState(false)

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
    setWaveGuard('')
    setWaveSelection([])
    loadCheckpoints(selectedSite)
  }, [selectedSite])

  if (!canApproveScans) {
    // Access flags resolve async (DB checks) — don't bounce until they land.
    if (privilegesLoading) {
      return (
        <Layout>
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
          </div>
        </Layout>
      )
    }
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

  const toggleWaveCheckpoint = (id) =>
    setWaveSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const handleWave = async (e) => {
    e.preventDefault()
    if (!waveGuard || waveSelection.length === 0) return

    setWaveLoading(true)
    setMessage(null)

    try {
      // Ordered as the admin picked them — that is the walking order, and the
      // spacing follows it. Window ends now and runs back `waveMinutes`.
      const endedAt = new Date()
      const startedAt = new Date(endedAt.getTime() - waveMinutes * 60000)
      const ids = await approveScanWave(waveSelection, waveGuard, {
        startedAt,
        endedAt,
        note: waveNote,
      })
      setMessage({
        type: 'success',
        text: `Wave recorded — ${ids.length} checkpoint${ids.length === 1 ? '' : 's'} across ${waveMinutes} minutes.`,
      })
      setWaveSelection([])
      setWaveNote('')
      await loadRecent()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to record wave' })
    } finally {
      setWaveLoading(false)
    }
  }

  const waveSpacing =
    waveSelection.length > 1
      ? Math.round(((waveMinutes * 60) / (waveSelection.length - 1)) * 10) / 10
      : null

  return (
    <Layout variant="admin">
      <PageHeader
        title="Approve Scan"
        description="Remotely record a passing checkpoint scan for a guard when GPS fails on site. Only available to the designated approver."
      />

      <form onSubmit={handleApprove} className="sp-card max-w-xl space-y-5 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Site</label>
          {sites.length > 0 && (
            <RosterSitePicker
              sites={sites}
              value={selectedSite}
              onChange={setSelectedSite}
              allowAll={false}
            />
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Checkpoint</label>
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
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Guard</label>
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
            <p className="mt-1 text-sm text-accent-orange">No active guards assigned to this site.</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Note (optional)</label>
          <textarea
            className="sp-input w-full"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. GPS failed on 12th floor — guard confirmed on site"
          />
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-accent-green' : 'text-accent-red'}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !selectedCheckpoint || !selectedGuard}
          className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {loading ? 'Approving…' : 'Approve scan'}
        </button>
      </form>


      <form onSubmit={handleWave} className="sp-card mt-8 max-w-3xl space-y-5 p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-orange/15 text-accent-orange">
            <Waves className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Wave — record a whole round</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              One scan per checkpoint, spread evenly across the round instead of landing on the
              same second. Pick the checkpoints in walking order.
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Guard</label>
          <select
            className="sp-input w-full"
            value={waveGuard}
            onChange={(e) => setWaveGuard(e.target.value)}
          >
            <option value="">Select guard…</option>
            {siteGuards.map((guard) => (
              <option key={guard.id} value={guard.id}>{guard.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-ink-2">
              Checkpoints{waveSelection.length > 0 && ` · ${waveSelection.length} selected`}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWaveSelection(checkpoints.map((c) => c.id))}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-2 ring-1 ring-[color:var(--hairline-strong)] transition hover:text-ink"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setWaveSelection([])}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-2 ring-1 ring-[color:var(--hairline-strong)] transition hover:text-ink"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {checkpoints.map((cp) => {
              const order = waveSelection.indexOf(cp.id)
              const picked = order !== -1
              return (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => toggleWaveCheckpoint(cp.id)}
                  className={`flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                    picked
                      ? 'bg-accent-orange/15 font-semibold text-ink ring-1 ring-accent-orange/40'
                      : 'text-ink-2 ring-1 ring-[color:var(--hairline)] hover:text-ink'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums ${
                      picked ? 'bg-accent-orange text-[#12290d]' : 'text-ink-3 ring-1 ring-[color:var(--hairline)]'
                    }`}
                  >
                    {picked ? order + 1 : ''}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {cp.name}
                    {cp.floors?.floor_name ? ` (${cp.floors.floor_name})` : ''}
                  </span>
                </button>
              )
            })}
          </div>
          {checkpoints.length === 0 && (
            <p className="text-sm text-ink-3">No active checkpoints at this site.</p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-2">Round length</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={480}
                value={waveMinutes}
                onChange={(e) => setWaveMinutes(Math.max(1, Number(e.target.value) || 1))}
                className="sp-input w-24 tabular-nums"
              />
              <span className="text-sm text-ink-2">minutes</span>
            </div>
          </div>
          {waveSpacing && (
            <p className="pb-2.5 text-sm text-ink-2">
              ≈ <span className="tabular-nums font-semibold text-ink">{waveSpacing}s</span> between
              checkpoints, ending now.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Note (optional)</label>
          <input
            className="sp-input w-full"
            value={waveNote}
            onChange={(e) => setWaveNote(e.target.value)}
            placeholder="e.g. parkade round — no GPS below P2"
          />
        </div>

        <button
          type="submit"
          disabled={waveLoading || !waveGuard || waveSelection.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          <Waves className="h-4 w-4" />
          {waveLoading
            ? 'Recording…'
            : `Record wave${waveSelection.length ? ` · ${waveSelection.length} checkpoints` : ''}`}
        </button>
      </form>

      {recent.length > 0 && (
        <div className="sp-card mt-8 overflow-hidden">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="text-lg font-semibold">Recent approvals</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-ink-2">
                <tr>
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Site</th>
                  <th className="px-6 py-3 font-medium">Checkpoint</th>
                  <th className="px-6 py-3 font-medium">Guard</th>
                  <th className="px-6 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recent.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-6 py-3 text-ink-2">
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
                    <td className="px-6 py-3 text-ink-2">{row.approval_note || '—'}</td>
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
