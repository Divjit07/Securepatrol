import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  computeGuardHoursReport,
  dateRangeDays,
  defaultPayPeriodEnd,
  defaultPayPeriodStart,
} from '../lib/clientStats.js'

function localDayStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function localDayEnd(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

export default function ClientReports() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const [site, setSite] = useState(null)
  const [tab, setTab] = useState('scans')
  const [scanFilters, setScanFilters] = useState({
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
  })
  const [hoursFilters, setHoursFilters] = useState({
    fromDate: defaultPayPeriodStart(),
    toDate: defaultPayPeriodEnd(),
  })
  const [scans, setScans] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [guards, setGuards] = useState([])
  const [hoursScans, setHoursScans] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!siteId) return
    supabase.from('sites').select('*').eq('id', siteId).single().then(({ data }) => setSite(data))
  }, [siteId])

  const loadSiteMeta = async () => {
    const [{ data: floors }, { data: guardData }] = await Promise.all([
      supabase.from('floors').select('id').eq('site_id', siteId),
      supabase.from('guards').select('id, name').eq('site_id', siteId).eq('active', true).order('name'),
    ])

    setGuards(guardData || [])

    if (!floors?.length) {
      setCheckpoints([])
      return []
    }

    const { data: cps } = await supabase
      .from('checkpoints')
      .select('id, name, checkpoint_role, floors(floor_name)')
      .in('floor_id', floors.map((f) => f.id))
      .eq('active', true)

    setCheckpoints(cps || [])
    return cps || []
  }

  const loadScans = async () => {
    if (!siteId) return
    setLoading(true)

    const cps = await loadSiteMeta()
    const cpIds = cps.map((c) => c.id)
    if (!cpIds.length) {
      setScans([])
      setLoading(false)
      return
    }

    const from = localDayStart(scanFilters.fromDate)
    const to = localDayEnd(scanFilters.toDate)

    const { data, error } = await supabase
      .from('scans')
      .select('*, profiles:guard_id(name)')
      .in('checkpoint_id', cpIds)
      .eq('status', 'pass')
      .gte('scanned_at', from.toISOString())
      .lte('scanned_at', to.toISOString())
      .order('scanned_at', { ascending: false })

    if (error) {
      alert(error.message)
      setScans([])
    } else {
      const cpMap = Object.fromEntries(cps.map((c) => [c.id, c]))
      setScans((data || []).map((s) => ({ ...s, checkpoint: cpMap[s.checkpoint_id] })))
    }

    setLoading(false)
  }

  const loadHoursData = async () => {
    if (!siteId) return
    setLoading(true)

    const cps = await loadSiteMeta()
    const cpIds = cps.map((c) => c.id)
    if (!cpIds.length) {
      setHoursScans([])
      setLoading(false)
      return
    }

    const from = localDayStart(hoursFilters.fromDate)
    const to = localDayEnd(hoursFilters.toDate)

    const { data, error } = await supabase
      .from('scans')
      .select('id, guard_id, checkpoint_id, scanned_at, status')
      .in('checkpoint_id', cpIds)
      .eq('status', 'pass')
      .gte('scanned_at', from.toISOString())
      .lte('scanned_at', to.toISOString())
      .order('scanned_at', { ascending: true })

    if (error) {
      alert(error.message)
      setHoursScans([])
    } else {
      setHoursScans(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (siteId && tab === 'scans') loadScans()
  }, [siteId, tab, scanFilters.fromDate, scanFilters.toDate])

  useEffect(() => {
    if (siteId && tab === 'hours') loadHoursData()
  }, [siteId, tab, hoursFilters.fromDate, hoursFilters.toDate])

  const exportScanCsv = () => {
    const headers = ['Date', 'Checkpoint', 'Floor', 'Guard', 'Distance (m)']
    const rows = scans.map((s) => [
      new Date(s.scanned_at).toLocaleString(),
      s.checkpoint?.name || '',
      s.checkpoint?.floors?.floor_name || '',
      s.profiles?.name || '',
      s.distance_metres,
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
    doc.text('SecurePatrol Scan Report', 14, 20)
    doc.setFontSize(9)
    doc.text('Productive Security Inc.', 14, 26)
    doc.setFontSize(11)
    doc.text(`Site: ${site?.name || ''}`, 14, 33)
    doc.text(`Period: ${scanFilters.fromDate} to ${scanFilters.toDate}`, 14, 40)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 47)

    autoTable(doc, {
      startY: 55,
      head: [['Date/Time', 'Checkpoint', 'Floor', 'Guard', 'Dist (m)']],
      body: scans.map((s) => [
        new Date(s.scanned_at).toLocaleString(),
        s.checkpoint?.name || '',
        s.checkpoint?.floors?.floor_name || '',
        s.profiles?.name || '',
        s.distance_metres?.toFixed?.(0) ?? '',
      ]),
    })

    doc.save(`securepatrol-scans-${scanFilters.fromDate}.pdf`)
  }

  const hoursReport = computeGuardHoursReport({
    scans: hoursScans,
    checkpoints,
    guards,
    dates: dateRangeDays(hoursFilters.fromDate, hoursFilters.toDate),
  })

  const exportHoursPdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('SecurePatrol Guard Hours Report', 14, 20)
    doc.setFontSize(9)
    doc.text('Productive Security Inc.', 14, 26)
    doc.setFontSize(11)
    doc.text(`Site: ${site?.name || ''}`, 14, 33)
    doc.text(`Pay period: ${hoursFilters.fromDate} to ${hoursFilters.toDate}`, 14, 40)
    doc.text('Schedule: Mon–Fri 11am–8pm · Sat 11am–5pm · Sun closed', 14, 47)
    doc.text('Clock-in: Main Entrance scan · Clock-out: fixed end time (no scan needed)', 14, 54)

    autoTable(doc, {
      startY: 62,
      head: [['Date', 'Guard', 'Clock In', 'Clock Out', 'Hours']],
      body: hoursReport.rows.map((row) => [
        row.date,
        row.guardName,
        row.clockIn.toLocaleTimeString(),
        row.clockOut.toLocaleTimeString(),
        row.hoursWorked.toFixed(2),
      ]),
    })

    const summaryY = doc.lastAutoTable.finalY + 12
    doc.setFontSize(12)
    doc.text('Total hours by guard', 14, summaryY)
    autoTable(doc, {
      startY: summaryY + 4,
      head: [['Guard', 'Days worked', 'Total hours']],
      body: Object.values(hoursReport.totalByGuard).map((g) => [
        g.name,
        g.days,
        g.hours.toFixed(2),
      ]),
    })

    doc.save(`securepatrol-hours-${hoursFilters.fromDate}-${hoursFilters.toDate}.pdf`)
  }

  if (!siteId) {
    return (
      <Layout variant="client">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-amber-900">No site assigned</h1>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="client">
      <PageHeader
        title="Reports"
        description={`Download scan history and guard hours for ${site?.name || 'your site'}.`}
      />

      <div className="mb-6 flex gap-2 rounded-lg border border-slate-200 bg-white p-1">
        {[
          { id: 'scans', label: 'Scan report' },
          { id: 'hours', label: 'Guard hours (2 weeks)' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${
              tab === id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'scans' ? (
        <>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              <input
                type="date"
                value={scanFilters.fromDate}
                onChange={(e) => setScanFilters({ ...scanFilters, fromDate: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={scanFilters.toDate}
                onChange={(e) => setScanFilters({ ...scanFilters, toDate: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportScanCsv}
                disabled={!scans.length}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
              <button
                type="button"
                onClick={exportScanPdf}
                disabled={!scans.length}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <FileText className="h-4 w-4" /> PDF
              </button>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scans.map((scan) => (
                    <tr key={scan.id}>
                      <td className="px-4 py-3">{new Date(scan.scanned_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">{scan.checkpoint?.name}</td>
                      <td className="px-4 py-3">{scan.profiles?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scans.length === 0 && (
                <p className="p-8 text-center text-slate-500">No scans for this period.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
            Scan <strong>Main Entrance</strong> when you arrive — auto clock-out at <strong>8:00 PM</strong> (Mon–Fri) or <strong>5:00 PM</strong> (Saturday). <strong>Sundays are closed</strong> — no shift hours.
          </div>

          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              <input
                type="date"
                value={hoursFilters.fromDate}
                onChange={(e) => setHoursFilters({ ...hoursFilters, fromDate: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={hoursFilters.toDate}
                onChange={(e) => setHoursFilters({ ...hoursFilters, toDate: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={exportHoursPdf}
              disabled={!hoursReport.rows.length}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> Download hours PDF
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                {Object.values(hoursReport.totalByGuard).map((g) => (
                  <div key={g.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">{g.name}</p>
                    <p className="text-2xl font-bold">{g.hours.toFixed(1)} hrs</p>
                    <p className="text-xs text-slate-400">{g.days} days worked</p>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Guard</th>
                      <th className="px-4 py-3 font-medium">Clock in</th>
                      <th className="px-4 py-3 font-medium">Clock out</th>
                      <th className="px-4 py-3 font-medium">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hoursReport.rows.map((row) => (
                      <tr key={`${row.date}-${row.guardId}`}>
                        <td className="px-4 py-3">{row.date}</td>
                        <td className="px-4 py-3 font-medium">{row.guardName}</td>
                        <td className="px-4 py-3">{row.clockIn.toLocaleTimeString()}</td>
                        <td className="px-4 py-3">{row.clockOut.toLocaleTimeString()}</td>
                        <td className="px-4 py-3 font-semibold">{row.hoursWorked.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hoursReport.rows.length === 0 && (
                  <p className="p-8 text-center text-slate-500">No shift hours recorded for this period.</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  )
}
