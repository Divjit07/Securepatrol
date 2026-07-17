import { useEffect, useState, useCallback, useRef } from 'react'
import { Radio, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

async function fetchScanDetails(scanId) {
  const { data } = await supabase
    .from('scans')
    .select('*, checkpoints(name), profiles:guard_id(name)')
    .eq('id', scanId)
    .single()
  return data
}

async function checkpointBelongsToSite(checkpointId, siteId) {
  const { data } = await supabase
    .from('checkpoints')
    .select('id, floors!inner(site_id)')
    .eq('id', checkpointId)
    .eq('floors.site_id', siteId)
    .maybeSingle()
  return Boolean(data)
}

export default function LiveFeed({ siteId, limit = 20, passesOnly = false }) {
  const [scans, setScans] = useState([])
  const [connected, setConnected] = useState(false)
  const [selected, setSelected] = useState(null)
  const checkpointIdsRef = useRef(new Set())

  const loadRecent = useCallback(async () => {
    const { data: floors } = await supabase.from('floors').select('id').eq('site_id', siteId)
    if (!floors?.length) {
      setScans([])
      checkpointIdsRef.current = new Set()
      return
    }

    const { data: checkpoints } = await supabase
      .from('checkpoints')
      .select('id')
      .in('floor_id', floors.map((f) => f.id))
      .eq('active', true)

    if (!checkpoints?.length) {
      setScans([])
      checkpointIdsRef.current = new Set()
      return
    }

    const cpIds = checkpoints.map((c) => c.id)
    checkpointIdsRef.current = new Set(cpIds)

    let query = supabase
      .from('scans')
      .select('*, checkpoints(name), profiles:guard_id(name)')
      .in('checkpoint_id', cpIds)
      .order('scanned_at', { ascending: false })
      .limit(limit)

    if (passesOnly) {
      query = query.eq('status', 'pass')
    }

    const { data } = await query

    setScans(data || [])
  }, [siteId, limit, passesOnly])

  useEffect(() => {
    if (!siteId) return undefined
    loadRecent()

    const channel = supabase
      .channel(`live-feed_${siteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans' }, async (payload) => {
        if (passesOnly && payload.new.status !== 'pass') return

        const checkpointId = payload.new.checkpoint_id
        if (!checkpointIdsRef.current.has(checkpointId)) {
          const belongs = await checkpointBelongsToSite(checkpointId, siteId)
          if (!belongs) return
          checkpointIdsRef.current.add(checkpointId)
        }

        const data = await fetchScanDetails(payload.new.id)
        if (data) {
          setScans((prev) => [data, ...prev.filter((s) => s.id !== data.id)].slice(0, limit))
        }
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    return () => {
      supabase.removeChannel(channel)
    }
  }, [siteId, limit, passesOnly, loadRecent])

  return (
    <div className="rounded-xl border border-white/10 bg-surface">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h3 className="font-semibold">Live Feed</h3>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-accent-green' : 'text-ink-3'}`}>
          <Radio className={`h-3.5 w-3.5 ${connected ? 'animate-pulse' : ''}`} />
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
        {scans.length === 0 ? (
          <p className="p-4 text-sm text-ink-2">No scans yet. Waiting for guard check-ins…</p>
        ) : (
          scans.map((scan) => {
            const label = scan.checkpoints?.name || 'Checkpoint'
            const statusLabel = scan.status === 'pass' ? 'PASS' : 'FAIL'
            return (
              <button
                key={scan.id}
                type="button"
                onClick={() => setSelected(scan)}
                aria-label={`${statusLabel} — ${label} details`}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
              >
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-ink-2">
                    {scan.profiles?.name || 'Guard'} · {new Date(scan.scanned_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    scan.status === 'pass' ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
                  }`}
                >
                  {statusLabel}
                </span>
              </button>
            )
          })
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Scan details"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-2">Checkpoint scan</p>
                <h4 className="text-lg font-semibold text-ink">
                  {selected.checkpoints?.name || 'Checkpoint'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-ink-2 hover:bg-white/5 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Status</dt>
                <dd>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      selected.status === 'pass'
                        ? 'bg-accent-green/15 text-accent-green'
                        : 'bg-accent-red/15 text-accent-red'
                    }`}
                  >
                    {selected.status === 'pass' ? 'PASS' : 'FAIL'}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Guard</dt>
                <dd className="font-medium text-ink">{selected.profiles?.name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Time</dt>
                <dd className="font-medium text-ink">
                  {new Date(selected.scanned_at).toLocaleString()}
                </dd>
              </div>
              {selected.distance_metres != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Distance</dt>
                  <dd className="font-medium text-ink">{Number(selected.distance_metres).toFixed(0)} m</dd>
                </div>
              )}
            </dl>
            <button type="button" onClick={() => setSelected(null)} className="dk-cta mt-5 w-full justify-center">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
