import { useEffect, useState } from 'react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchTodayScansForGuard } from '../lib/scans.js'

export default function GuardHistory() {
  const { user } = useAuth()
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchTodayScansForGuard(user.id)
      .then(setScans)
      .finally(() => setLoading(false))
  }, [user])

  return (
    <Layout variant="guard">
      <h1 className="mb-6 text-2xl font-bold">Shift History</h1>
      <p className="mb-4 text-sm text-ink-2">All scans from today&apos;s shift</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : scans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-ink-2">
          No scans recorded today.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-white/5 text-left text-ink-2">
              <tr>
                <th className="px-4 py-3 font-medium">Checkpoint</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Distance</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td className="px-4 py-3 font-medium">{scan.checkpoints?.name || '—'}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {new Date(scan.scanned_at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{scan.distance_metres?.toFixed(0)}m</td>
                  <td className="px-4 py-3">
                    <span
                      className={scan.status === 'pass' ? 'dk-pill-ok' : 'dk-pill-bad'}
                    >
                      {scan.status.toUpperCase()}
                    </span>
                    {scan.sync_method === 'offline_sync' && (
                      <span className="ml-1 text-xs text-accent-orange">(synced)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
