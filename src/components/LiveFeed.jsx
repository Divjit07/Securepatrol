import { useEffect, useState, useCallback, useRef } from 'react'
import { Radio } from 'lucide-react'
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
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="font-semibold">Live Feed</h3>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-600' : 'text-slate-400'}`}>
          <Radio className={`h-3.5 w-3.5 ${connected ? 'animate-pulse' : ''}`} />
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
        {scans.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No scans yet. Waiting for guard check-ins…</p>
        ) : (
          scans.map((scan) => (
            <div key={scan.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-sm">{scan.checkpoints?.name || 'Checkpoint'}</p>
                <p className="text-xs text-slate-500">
                  {scan.profiles?.name || 'Guard'} · {new Date(scan.scanned_at).toLocaleString()}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  scan.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {scan.status === 'pass' ? 'PASS' : 'FAIL'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
