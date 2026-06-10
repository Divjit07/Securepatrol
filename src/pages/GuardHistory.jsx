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
      <p className="mb-4 text-sm text-slate-600">All scans from today&apos;s shift</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : scans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No scans recorded today.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Checkpoint</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Distance</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td className="px-4 py-3 font-medium">{scan.checkpoints?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(scan.scanned_at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{scan.distance_metres?.toFixed(0)}m</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        scan.status === 'pass'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {scan.status.toUpperCase()}
                    </span>
                    {scan.sync_method === 'offline_sync' && (
                      <span className="ml-1 text-xs text-amber-600">(synced)</span>
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
