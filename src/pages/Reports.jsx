import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Layout from '../components/Layout.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'

function localDayStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function localDayEnd(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

export default function Reports() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [filters, setFilters] = useState({
    siteId: '',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
  })
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin').then((s) => {
      setSites(s)
      if (s.length) setFilters((f) => ({ ...f, siteId: s[0].id }))
    })
  }, [user?.id])

  const loadScans = async () => {
    if (!filters.siteId) return
    setLoading(true)

    const { data: floors } = await supabase.from('floors').select('id').eq('site_id', filters.siteId)
    const floorIds = floors?.map((f) => f.id) || []

    if (!floorIds.length) {
      setScans([])
      setLoading(false)
      return
    }

    const { data: checkpoints } = await supabase
      .from('checkpoints')
      .select('id, name, floors(floor_name)')
      .in('floor_id', floorIds)

    const cpIds = checkpoints?.map((c) => c.id) || []
    const cpMap = Object.fromEntries((checkpoints || []).map((c) => [c.id, c]))

    if (!cpIds.length) {
      setScans([])
      setLoading(false)
      return
    }

    const from = localDayStart(filters.fromDate)
    const to = localDayEnd(filters.toDate)

    const { data, error } = await supabase
      .from('scans')
      .select('*, profiles:guard_id(name)')
      .in('checkpoint_id', cpIds)
      .gte('scanned_at', from.toISOString())
      .lte('scanned_at', to.toISOString())
      .order('scanned_at', { ascending: false })

    if (error) {
      console.error('Failed to load scans:', error)
      alert(`Could not load scans: ${error.message}`)
      setScans([])
      setLoading(false)
      return
    }

    setScans(
      (data || []).map((s) => ({
        ...s,
        checkpoint: cpMap[s.checkpoint_id],
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    if (filters.siteId) loadScans()
  }, [filters.siteId, filters.fromDate, filters.toDate])

  const exportCsv = () => {
    const headers = ['Date', 'Checkpoint', 'Floor', 'Guard', 'Distance (m)', 'Status', 'Sync']
    const rows = scans.map((s) => [
      new Date(s.scanned_at).toLocaleString(),
      s.checkpoint?.name || '',
      s.checkpoint?.floors?.floor_name || '',
      s.profiles?.name || s.guards?.name || '',
      s.distance_metres,
      s.status,
      s.sync_method,
    ])

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `securepatrol-report-${filters.fromDate}-${filters.toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const site = sites.find((s) => s.id === filters.siteId)
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('SecurePatrol Patrol Report', 14, 20)
    doc.setFontSize(9)
    doc.text('Productive Security Inc.', 14, 26)
    doc.setFontSize(11)
    doc.text(`Site: ${site?.name || ''}`, 14, 33)
    doc.text(`Period: ${filters.fromDate} to ${filters.toDate}`, 14, 40)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 47)

    autoTable(doc, {
      startY: 55,
      head: [['Date/Time', 'Checkpoint', 'Floor', 'Guard', 'Dist (m)', 'Status']],
      body: scans.map((s) => [
        new Date(s.scanned_at).toLocaleString(),
        s.checkpoint?.name || '',
        s.checkpoint?.floors?.floor_name || '',
        s.profiles?.name || s.guards?.name || '',
        s.distance_metres?.toFixed(0),
        s.status.toUpperCase(),
      ]),
    })

    doc.save(`securepatrol-report-${filters.fromDate}.pdf`)
  }

  const passed = scans.filter((s) => s.status === 'pass').length

  return (
    <Layout variant="admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Patrol Reports</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!scans.length}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={!scans.length}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <select
          value={filters.siteId}
          onChange={(e) => setFilters({ ...filters, siteId: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total Scans</p>
          <p className="text-2xl font-bold">{scans.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Passed</p>
          <p className="text-2xl font-bold text-green-600">{passed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Failed</p>
          <p className="text-2xl font-bold text-red-600">{scans.length - passed}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Date/Time</th>
                <th className="px-4 py-3 font-medium">Checkpoint</th>
                <th className="px-4 py-3 font-medium">Guard</th>
                <th className="px-4 py-3 font-medium">Distance</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td className="px-4 py-3">{new Date(scan.scanned_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{scan.checkpoint?.name}</td>
                  <td className="px-4 py-3">{scan.profiles?.name || scan.guards?.name}</td>
                  <td className="px-4 py-3">{scan.distance_metres?.toFixed(0)}m</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scan.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {scan.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scans.length === 0 && (
            <p className="p-8 text-center text-slate-500">No scans found for this period.</p>
          )}
        </div>
      )}
    </Layout>
  )
}
