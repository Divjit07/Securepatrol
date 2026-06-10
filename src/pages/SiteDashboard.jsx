import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Radio, Users } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import CheckpointCard from '../components/CheckpointCard.jsx'
import LiveFeed from '../components/LiveFeed.jsx'
import { supabase } from '../lib/supabase.js'
import { getCheckpointStatus } from '../lib/scans.js'

export default function SiteDashboard() {
  const { id } = useParams()
  const [site, setSite] = useState(null)
  const [floors, setFloors] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('floors')
  const [siteGuards, setSiteGuards] = useState([])

  useEffect(() => {
    if (!id) return

    const load = async () => {
      setLoading(true)
      const [{ data: siteData }, { data: floorData }] = await Promise.all([
        supabase.from('sites').select('*').eq('id', id).single(),
        supabase.from('floors').select('*').eq('site_id', id).order('floor_number'),
      ])

      setSite(siteData)
      setFloors(floorData || [])

      const { data: guards } = await supabase
        .from('guards')
        .select('id, name, email, active')
        .eq('site_id', id)
        .order('name')
      setSiteGuards(guards || [])

      if (floorData?.length) {
        const { data: cps } = await supabase
          .from('checkpoints')
          .select('*')
          .in('floor_id', floorData.map((f) => f.id))
          .eq('active', true)

        const floorMap = Object.fromEntries(floorData.map((f) => [f.id, f]))
        setCheckpoints(
          (cps || []).map((cp) => ({ ...cp, floor: floorMap[cp.floor_id] })),
        )

        if (cps?.length) {
          const startOfDay = new Date()
          startOfDay.setHours(0, 0, 0, 0)
          const { data: scanData } = await supabase
            .from('scans')
            .select('*, guards:guard_id(name)')
            .in('checkpoint_id', cps.map((c) => c.id))
            .gte('scanned_at', startOfDay.toISOString())
            .order('scanned_at', { ascending: false })

          setScans(scanData || [])
        }
      }
      setLoading(false)
    }

    load()
  }, [id])

  const scansByCheckpoint = scans.reduce((acc, scan) => {
    if (!acc[scan.checkpoint_id]) acc[scan.checkpoint_id] = scan
    return acc
  }, {})

  const groupedByFloor = floors.map((floor) => ({
    floor,
    checkpoints: checkpoints.filter((cp) => cp.floor_id === floor.id),
  }))

  return (
    <Layout variant="admin">
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to overview
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{site?.name || 'Site Dashboard'}</h1>
          <p className="text-slate-600">{site?.address}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('floors')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'floors' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`}
          >
            Floor View
          </button>
          <Link
            to={`/admin/site/${id}/live`}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            <Radio className="h-4 w-4" /> Live Feed
          </Link>
        </div>
      </div>

      {!loading && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold">Assigned Guards</h2>
          </div>
          {siteGuards.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {siteGuards.map((g) => (
                <div
                  key={g.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{g.name}</span>
                  {g.email && (
                    <span className="text-slate-500"> · {g.email}</span>
                  )}
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                      g.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {g.active ? 'Active' : 'Off'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              No guards assigned to this site.{' '}
              <Link to="/admin/guards" className="text-brand-600 hover:underline">
                Assign in Guards →
              </Link>
            </p>
          )}
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
                      const status = getCheckpointStatus(cp, latestScan)
                      return (
                        <CheckpointCard
                          key={cp.id}
                          checkpoint={cp}
                          status={status}
                          lastScan={latestScan}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div>
            <LiveFeed siteId={id} />
          </div>
        </div>
      )}
    </Layout>
  )
}
