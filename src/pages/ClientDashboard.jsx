import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar, CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import CheckpointCard from '../components/CheckpointCard.jsx'
import LiveFeed from '../components/LiveFeed.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import { getCheckpointStatus } from '../lib/scans.js'

const DEFAULT_SHIFT = { start: '11:00', end: '20:00' }

function shiftBounds(dateStr, startTime, endTime) {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d, startH, startM, 0, 0)
  const end = new Date(y, m - 1, d, endH, endM, 59, 999)
  return { start, end }
}

export default function ClientDashboard() {
  const { profile } = useAuth()
  const siteId = profile?.site_id

  const [site, setSite] = useState(null)
  const [floors, setFloors] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [guards, setGuards] = useState([])
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState(DEFAULT_SHIFT)
  const checkpointIdsRef = useRef(new Set())

  const loadData = useCallback(async () => {
    if (!siteId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const [{ data: siteData }, { data: floorData }, { data: guardData }] = await Promise.all([
      supabase.from('sites').select('*').eq('id', siteId).single(),
      supabase.from('floors').select('*').eq('site_id', siteId).order('floor_number'),
      supabase.from('guards').select('id, name, email, active').eq('site_id', siteId).order('name'),
    ])

    setSite(siteData)
    setFloors(floorData || [])
    setGuards(guardData || [])

    if (!floorData?.length) {
      setCheckpoints([])
      setScans([])
      checkpointIdsRef.current = new Set()
      setLoading(false)
      return
    }

    const { data: cps } = await supabase
      .from('checkpoints')
      .select('*')
      .in('floor_id', floorData.map((f) => f.id))
      .eq('active', true)

    const floorMap = Object.fromEntries(floorData.map((f) => [f.id, f]))
    const checkpointList = (cps || []).map((cp) => ({ ...cp, floor: floorMap[cp.floor_id] }))
    setCheckpoints(checkpointList)
    checkpointIdsRef.current = new Set(checkpointList.map((cp) => cp.id))

    if (cps?.length) {
      const { start, end } = shiftBounds(date, shift.start, shift.end)
      const { data: scanData } = await supabase
        .from('scans')
        .select('*, profiles:guard_id(name)')
        .in('checkpoint_id', cps.map((c) => c.id))
        .gte('scanned_at', start.toISOString())
        .lte('scanned_at', end.toISOString())
        .order('scanned_at', { ascending: false })

      setScans(scanData || [])
    } else {
      setScans([])
    }

    setLoading(false)
  }, [siteId, date, shift.start, shift.end])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!siteId) return undefined

    const channel = supabase
      .channel(`client-dashboard_${siteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans' }, async (payload) => {
        const checkpointId = payload.new.checkpoint_id
        if (!checkpointIdsRef.current.has(checkpointId)) return

        const { start, end } = shiftBounds(date, shift.start, shift.end)
        const scannedAt = new Date(payload.new.scanned_at)
        if (scannedAt < start || scannedAt > end) return

        const { data } = await supabase
          .from('scans')
          .select('*, profiles:guard_id(name)')
          .eq('id', payload.new.id)
          .single()

        if (!data) return

        setScans((prev) => [data, ...prev.filter((s) => s.id !== data.id)])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [siteId, date, shift.start, shift.end])

  const scansByCheckpoint = scans.reduce((acc, scan) => {
    if (!acc[scan.checkpoint_id] || new Date(scan.scanned_at) > new Date(acc[scan.checkpoint_id].scanned_at)) {
      acc[scan.checkpoint_id] = scan
    }
    return acc
  }, {})

  const scannedCount = checkpoints.filter((cp) => scansByCheckpoint[cp.id]).length
  const compliance = checkpoints.length
    ? Math.round((scannedCount / checkpoints.length) * 100)
    : 0

  const groupedByFloor = floors.map((floor) => ({
    floor,
    checkpoints: checkpoints.filter((cp) => cp.floor_id === floor.id),
  }))

  if (!siteId) {
    return (
      <Layout variant="client">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-amber-900">No site assigned</h1>
          <p className="mt-2 text-sm text-amber-800">
            Contact your administrator to link your account to a patrol site.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="client">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-600">Client Portal</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{site?.name || 'Patrol Overview'}</h1>
        <p className="text-slate-600">{site?.address || 'View guard scan compliance for your site'}</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500" />
          <label className="text-sm text-slate-600">Shift</label>
          <input
            type="time"
            value={shift.start}
            onChange={(e) => setShift((s) => ({ ...s, start: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-slate-400">to</span>
          <input
            type="time"
            value={shift.end}
            onChange={(e) => setShift((s) => ({ ...s, end: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Checkpoints scanned</p>
          <p className="text-2xl font-bold">
            {scannedCount} <span className="text-base font-normal text-slate-400">/ {checkpoints.length}</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Shift compliance</p>
          <p className={`text-2xl font-bold ${compliance >= 80 ? 'text-green-600' : compliance >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {compliance}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total scans this shift</p>
          <p className="text-2xl font-bold">{scans.length}</p>
        </div>
      </div>

      {guards.length > 0 && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">On-duty guards at this site</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {guards.map((g) => (
              <span key={g.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {groupedByFloor.map(({ floor, checkpoints: cps }) => (
              <div key={floor.id}>
                <h2 className="mb-3 text-lg font-semibold">{floor.floor_name}</h2>
                {cps.length === 0 ? (
                  <p className="text-sm text-slate-500">No checkpoints on this floor.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {cps.map((cp) => {
                      const latestScan = scansByCheckpoint[cp.id]
                      const status = latestScan ? getCheckpointStatus(cp, latestScan) : 'missed'
                      return (
                        <CheckpointCard
                          key={cp.id}
                          checkpoint={cp}
                          status={latestScan ? status : 'missed'}
                          lastScan={latestScan}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            ))}

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold">Scan history (this shift)</h2>
              </div>
              {scans.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  No scans recorded during this shift window yet.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Checkpoint</th>
                      <th className="px-4 py-3 font-medium">Guard</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scans.map((scan) => {
                      const cp = checkpoints.find((c) => c.id === scan.checkpoint_id)
                      return (
                        <tr key={scan.id}>
                          <td className="px-4 py-3">{new Date(scan.scanned_at).toLocaleString()}</td>
                          <td className="px-4 py-3 font-medium">{cp?.name || 'Checkpoint'}</td>
                          <td className="px-4 py-3">{scan.profiles?.name || 'Guard'}</td>
                          <td className="px-4 py-3">
                            {scan.status === 'pass' ? (
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <CheckCircle2 className="h-4 w-4" /> Pass
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700">
                                <XCircle className="h-4 w-4" /> Fail
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Green checkpoints were scanned during your selected shift ({shift.start}–{shift.end}).
                  Red means not yet scanned.
                </p>
              </div>
            </div>
            <LiveFeed siteId={siteId} limit={15} />
          </div>
        </div>
      )}
    </Layout>
  )
}
