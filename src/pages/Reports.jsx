import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { BRAND } from '../lib/brand.js'

function localDayStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function localDayEnd(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

// Guard hours + paystubs moved to /admin/payroll — this page is patrol proof only.
export default function Reports() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [scanFilters, setScanFilters] = useState({
    siteId: '',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
  })
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const selectedSite = sites.find((s) => s.id === scanFilters.siteId)

  useEffect(() => {
    if (!user) return
    fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin').then((siteList) => {
      setSites(siteList)
      if (siteList.length) setScanFilters((f) => ({ ...f, siteId: f.siteId || siteList[0].id }))
    })
  }, [user?.id, isSuperAdmin])

  const loadScans = async () => {
    if (!scanFilters.siteId) return
    setLoading(true)
    setLoadError(null)

    const { data: floors } = await supabase.from('floors').select('id').eq('site_id', scanFilters.siteId)
    if (!floors?.length) {
      setScans([])
      setLoading(false)
      return
    }

    const { data: cps } = await supabase
      .from('checkpoints')
      .select('id, name, checkpoint_role, floors(floor_name)')
      .in('floor_id', floors.map((f) => f.id))
      .eq('active', true)

    const cpIds = (cps || []).map((c) => c.id)
    if (!cpIds.length) {
      setScans([])
      setLoading(false)
      return
    }

    const from = localDayStart(scanFilters.fromDate)
    const to = localDayEnd(scanFilters.toDate)
    const cpMap = Object.fromEntries((cps || []).map((c) => [c.id, c]))

    const { data, error } = await supabase
      .from('scans')
      .select('*, profiles:guard_id(name)')
      .in('checkpoint_id', cpIds)
      .gte('scanned_at', from.toISOString())
      .lte('scanned_at', to.toISOString())
      .order('scanned_at', { ascending: false })

    if (error) {
      setLoadError(error.message)
      setScans([])
    } else {
      setScans((data || []).map((s) => ({ ...s, checkpoint: cpMap[s.checkpoint_id] })))
    }

    setLoading(false)
  }

  useEffect(() => {
    if (scanFilters.siteId) loadScans()
  }, [scanFilters.siteId, scanFilters.fromDate, scanFilters.toDate])

  const exportScanCsv = () => {
    const headers = ['Date', 'Checkpoint', 'Floor', 'Guard', 'Distance (m)', 'Status', 'Sync']
    const rows = scans.map((s) => [
      new Date(s.scanned_at).toLocaleString(),
      s.checkpoint?.name || '',
      s.checkpoint?.floors?.floor_name || '',
      s.profiles?.name || '',
      s.distance_metres,
      s.status,
      s.sync_method,
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `securepatrol-scans-${scanFilters.fromDate}-${scanFilters.toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportScanPdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(`${BRAND.name} Patrol Report`, 14, 20)
    doc.setFontSize(9)
    doc.text(BRAND.tagline, 14, 26)
    doc.setFontSize(11)
    doc.text(`Site: ${selectedSite?.name || ''}`, 14, 33)
    doc.text(`Period: ${scanFilters.fromDate} to ${scanFilters.toDate}`, 14, 40)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 47)

    autoTable(doc, {
      startY: 55,
      head: [['Date/Time', 'Checkpoint', 'Floor', 'Guard', 'Dist (m)', 'Status']],
      body: scans.map((s) => [
        new Date(s.scanned_at).toLocaleString(),
        s.checkpoint?.name || '',
        s.checkpoint?.floors?.floor_name || '',
        s.profiles?.name || '',
        s.distance_metres?.toFixed?.(0) ?? '',
        s.status.toUpperCase(),
      ]),
    })

    doc.save(`securepatrol-scans-${scanFilters.fromDate}.pdf`)
  }

  const passed = scans.filter((s) => s.status === 'pass').length

  return (
    <Layout variant="admin">
      <PageHeader
        title="Reports"
        description="Patrol scan history with CSV/PDF export. Guard hours and paystubs live in Payroll."
      />

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-white/10 bg-surface p-4">
        <select
          value={scanFilters.siteId}
          onChange={(e) => setScanFilters({ ...scanFilters, siteId: e.target.value })}
          className="rounded-full border-0 bg-black px-4 py-2.5 text-sm font-semibold text-white"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id} className="bg-white text-black">
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={scanFilters.fromDate}
          onChange={(e) => setScanFilters({ ...scanFilters, fromDate: e.target.value })}
          className="rounded-full border border-black/10 bg-[#FFFFFF] px-3 py-2 text-sm font-semibold text-black [color-scheme:light]"
        />
        <input
          type="date"
          value={scanFilters.toDate}
          onChange={(e) => setScanFilters({ ...scanFilters, toDate: e.target.value })}
          className="rounded-full border border-black/10 bg-[#FFFFFF] px-3 py-2 text-sm font-semibold text-black [color-scheme:light]"
        />
        <Link
          to="/admin/payroll"
          className="ml-auto flex items-center gap-2 rounded-full border border-black/10 bg-[#FFFFFF] px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-100"
        >
          Guard hours → Payroll
        </Link>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg bg-accent-red/15 p-4 text-sm text-accent-red">{loadError}</div>
      )}

      <div className="mb-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={exportScanCsv}
          disabled={!scans.length}
          className="flex items-center gap-2 rounded-full border border-black/10 bg-[#FFFFFF] px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-100 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
        <button
          type="button"
          onClick={exportScanPdf}
          disabled={!scans.length}
          className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" /> PDF
        </button>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <p className="text-sm text-ink-2">Total scans</p>
          <p className="text-2xl font-bold">{scans.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <p className="text-sm text-ink-2">Passed</p>
          <p className="text-2xl font-bold text-accent-green">{passed}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <p className="text-sm text-ink-2">Failed</p>
          <p className="text-2xl font-bold text-accent-red">{scans.length - passed}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-white/5 text-left text-ink-2">
              <tr>
                <th className="px-4 py-3 font-medium">Date/Time</th>
                <th className="px-4 py-3 font-medium">Checkpoint</th>
                <th className="px-4 py-3 font-medium">Guard</th>
                <th className="px-4 py-3 font-medium">Distance</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td className="px-4 py-3">{new Date(scan.scanned_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{scan.checkpoint?.name}</td>
                  <td className="px-4 py-3">{scan.profiles?.name}</td>
                  <td className="px-4 py-3">{scan.distance_metres?.toFixed(0)}m</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        scan.status === 'pass'
                          ? 'bg-black text-white'
                          : 'bg-accent-red text-white'
                      }`}
                    >
                      {scan.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scans.length === 0 && (
            <p className="p-8 text-center text-ink-2">No scans found for this period.</p>
          )}
        </div>
      )}
    </Layout>
  )
}
