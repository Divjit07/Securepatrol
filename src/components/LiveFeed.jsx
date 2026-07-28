import { useEffect, useState, useCallback, useRef } from 'react'
import { Radio, X, CheckCircle2, XCircle, ChevronRight, MapPin, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

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
    <div className="dk-card overflow-hidden p-0">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h3 className="font-display text-base font-bold text-ink">Live Feed</h3>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${connected ? 'bg-accent-green/15 text-accent-green' : 'bg-white/5 text-ink-3'}`}>
          {connected ? <span className="live-dot" /> : <Radio className="h-3 w-3" />}
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </div>

      <div className="max-h-[26rem] space-y-1 overflow-y-auto px-2 pb-2">
        {scans.length === 0 ? (
          <div className="hatch-empty m-2 flex items-center justify-center rounded-2xl border border-white/5 py-12 text-center">
            <p className="px-6 text-sm text-ink-3">No scans yet. Waiting for guard check-ins…</p>
          </div>
        ) : (
          scans.map((scan, i) => {
            const label = scan.checkpoints?.name || 'Checkpoint'
            const pass = scan.status === 'pass'
            const isNewest = i === 0
            return (
              <button
                key={scan.id}
                type="button"
                onClick={() => setSelected(scan)}
                aria-label={`${pass ? 'PASS' : 'FAIL'} — ${label} details`}
                className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-200 hover:bg-white/[0.06] ${isNewest ? 'bg-accent-green/[0.06] ring-1 ring-accent-green/20' : ''}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pass ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'}`}>
                  {pass ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{label}</p>
                  <p className="truncate text-xs text-ink-3">
                    {scan.profiles?.name || 'Guard'} · {timeAgo(scan.scanned_at)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${pass ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'}`}>
                  {pass ? 'PASS' : 'FAIL'}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 -translate-x-1 text-ink-3 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
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
            className="animate-rise w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-surface shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero status band */}
            <div className={`relative px-6 pb-5 pt-6 ${selected.status === 'pass' ? 'bg-accent-green/10' : 'bg-accent-red/10'}`}>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-2 transition hover:bg-white/10 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selected.status === 'pass' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}`}>
                  {selected.status === 'pass' ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                </span>
                <div>
                  <p className="deck-eyebrow">Checkpoint scan</p>
                  <h4 className="font-display text-xl font-bold text-ink">{selected.checkpoints?.name || 'Checkpoint'}</h4>
                </div>
              </div>
            </div>

            <div className="space-y-2 p-4">
              {[
                { icon: MapPin, label: 'Guard', value: selected.profiles?.name || '—' },
                { icon: Clock, label: 'Time', value: new Date(selected.scanned_at).toLocaleString() },
                ...(selected.distance_metres != null
                  ? [{ icon: MapPin, label: 'Distance', value: `${Number(selected.distance_metres).toFixed(0)} m` }]
                  : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
                  <row.icon className="h-4 w-4 shrink-0 text-ink-3" />
                  <span className="text-sm text-ink-3">{row.label}</span>
                  <span className="ml-auto text-sm font-semibold text-ink">{row.value}</span>
                </div>
              ))}
              <button type="button" onClick={() => setSelected(null)} className="dk-cta mt-2 w-full justify-center">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
