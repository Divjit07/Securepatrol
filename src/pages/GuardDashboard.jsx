import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, Building2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import CheckpointCard from '../components/CheckpointCard.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchCheckpointsForSite, fetchTodayScansForGuard, getCheckpointStatus } from '../lib/scans.js'
import { flushOfflineQueue } from '../lib/offlineQueue.js'

export default function GuardDashboard() {
  const { profile, user } = useAuth()
  const [checkpoints, setCheckpoints] = useState([])
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)

  const siteId = profile?.site_id

  const loadData = async () => {
    if (!siteId || !user) return
    setLoading(true)
    try {
      await flushOfflineQueue()
      const [cps, todayScans] = await Promise.all([
        fetchCheckpointsForSite(siteId),
        fetchTodayScansForGuard(user.id),
      ])
      setCheckpoints(cps)
      setScans(todayScans)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [siteId, user?.id])

  const scansByCheckpoint = scans.reduce((acc, scan) => {
    if (!acc[scan.checkpoint_id]) acc[scan.checkpoint_id] = scan
    return acc
  }, {})

  const passed = scans.filter((s) => s.status === 'pass').length
  const total = checkpoints.length

  return (
    <Layout variant="guard">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Guard Dashboard</h1>
        <p className="mt-1 text-slate-600">Welcome, {profile?.name}</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">Assigned Site</span>
          </div>
          <p className="mt-1 font-semibold">{profile?.sites?.name || 'Not assigned'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Today&apos;s Progress</p>
          <p className="mt-1 text-2xl font-bold text-brand-600">
            {passed}/{total}
          </p>
        </div>
        <Link
          to="/guard/scan"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 p-4 font-semibold text-white hover:bg-brand-700"
        >
          <ScanLine className="h-5 w-5" />
          Scan Checkpoint
        </Link>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Checkpoints</h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : checkpoints.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No checkpoints assigned to your site yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {checkpoints.map((cp) => {
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
    </Layout>
  )
}
