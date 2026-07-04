import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, Building2, AlertTriangle } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
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
      <PageHeader
        title="Patrol Dashboard"
        description={`Good shift, ${profile?.name || 'Guard'}. Track today's checkpoint progress below.`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sp-stat-card">
          <div className="flex items-center gap-2 text-slate-500">
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Assigned site</span>
          </div>
          <p className="mt-2 font-display text-lg font-semibold">{profile?.sites?.name || 'Not assigned'}</p>
        </div>
        <div className="sp-stat-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today&apos;s progress</p>
          <p className="mt-2 font-display text-3xl font-bold text-brand-600">
            {passed}<span className="text-lg font-medium text-slate-400">/{total}</span>
          </p>
        </div>
        <Link to="/guard/scan" className="sp-btn-primary h-full min-h-[5.5rem] text-base">
          <ScanLine className="h-5 w-5" />
          Scan checkpoint
        </Link>
        <Link
          to="/guard/incident"
          className="sp-btn-secondary flex h-full min-h-[5.5rem] items-center justify-center gap-2 text-base"
        >
          <AlertTriangle className="h-5 w-5" />
          Report incident
        </Link>
      </div>

      <h2 className="mb-4 font-display text-lg font-semibold">Checkpoints</h2>

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
