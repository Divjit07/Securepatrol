import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import {
  computeGuardHoursReport,
  dateRangeDays,
  defaultPayPeriodEnd,
  defaultPayPeriodStart,
  formatShiftTime,
} from '../lib/clientStats.js'
import { fetchShiftAdjustmentsForSite, mapShiftAdjustments } from '../lib/shiftAdjustments.js'

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
  const [tab, setTab] = useState('scans')
  const [scanFilters, setScanFilters] = useState({
    siteId: '',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
  })
  const [hoursFilters, setHoursFilters] = useState({
    siteId: '',
    fromDate: defaultPayPeriodStart(),
    toDate: defaultPayPeriodEnd(),
  })
  const [scans, setScans] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [guards, setGuards] = useState([])
  const [hoursScans, setHoursScans] = useState([])
  const [hoursAdjustments, setHoursAdjustments] = useState({})
  const [loading, setLoading] = useState(false)

  const activeSiteId = tab === 'scans' ? scanFilters.siteId : hoursFilters.siteId
  const selectedSite = sites.find((s) => s.id === activeSiteId)

  useEffect(() => {
    if (!user) return
    fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin').then((siteList) => {
      setSites(siteList)
      if (siteList.length) {
        setScanFilters((f) => ({ ...f, siteId: f.siteId || siteList[0].id }))
        setHoursFilters((f) => ({ ...f, siteId: f.siteId || siteList[0].id }))
      }
    })
  }, [user?.id, isSuperAdmin])

  const loadSiteMeta = async (siteId) => {
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
    if (!scanFilters.siteId) return
    setLoading(true)

    const cps = await loadSiteMeta(scanFilters.siteId)
    const cpIds = cps.map((c) => c.id)
    if (!cpIds.length) {
      setScans([])
      setLoading(false)
      return
    }

    const from = localDayStart(scanFilters.fromDate)
    const to = localDayEnd(scanFilters.toDate)
    const cpMap = Object.fromEntries(cps.map((c) => [c.id, c]))

    const { data, error } = await supabase
      .from('scans')
      .select('*, profiles:guard_id(name)')
      .in('checkpoint_id', cpIds)
      .gte('scanned_at', from.toISOString())
      .lte('scanned_at', to.toISOString())
      .order('scanned_at', { ascending: false })

    if (error) {
      alert(error.message)
      setScans([])
    } else {
      setScans((data || []).map((s) => ({ ...s, checkpoint: cpMap[s.checkpoint_id] })))
    }

    setLoading(false)
  }

  const loadHoursData = async () => {
    if (!hoursFilters.siteId) return
    setLoading(true)

    const cps = await loadSiteMeta(hoursFilters.siteId)
    const cpIds = cps.map((c) => c.id)
    if (!cpIds.length) {
      setHoursScans([])
      setHoursAdjustments({})
      setLoading(false)
      return
    }

    const from = localDayStart(hoursFilters.fromDate)
    const to = localDayEnd(hoursFilters.toDate)

    const [{ data, error }, adjRows] = await Promise.all([
      supabase
        .from('scans')
        .select('id, guard_id, checkpoint_id, scanned_at, status')
        .in('checkpoint_id', cpIds)
        .eq('status', 'pass')
        .gte('scanned_at', from.toISOString())
        .lte('scanned_at', to.toISOString())
        .order('scanned_at', { ascending: true }),
      fetchShiftAdjustmentsForSite(hoursFilters.siteId, hoursFilters.fromDate, hoursFilters.toDate),
    ])

    if (error) {
      alert(error.message)
      setHoursScans([])
      setHoursAdjustments({})
    } else {
      setHoursScans(data || [])
      setHoursAdjustments(mapShiftAdjustments(adjRows))
    }

    setLoading(false)
  }

  useEffect(() => {
    if (scanFilters.siteId && tab === 'scans') loadScans()
  }, [scanFilters.siteId, scanFilters.fromDate, scanFilters.toDate, tab])

  useEffect(() => {
    if (hoursFilters.siteId && tab === 'hours') loadHoursData()
  }, [hoursFilters.siteId, hoursFilters.fromDate, hoursFilters.toDate, tab])

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
    doc.text('SecurePatrol Patrol Report', 14, 20)
    doc.setFontSize(9)
    doc.text('Productive Security Inc.', 14, 26)
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

  const hoursReport = computeGuardHoursReport({
    scans: hoursScans,
    checkpoints,
    guards,
    dates: dateRangeDays(hoursFilters.fromDate, hoursFilters.toDate),
    adjustmentsByKey: hoursAdjustments,
  })

  const exportHoursCsv = () => {
    const headers = ['Date', 'Guard', 'Clock In', 'Clock Out', 'Hours', 'Day type']
    const rows = hoursReport.rows.map((row) => [
      row.date,
      row.guardName,
      formatShiftTime(row.clockIn),
      formatShiftTime(row.clockOut),
      row.hoursLabel,
      row.statutoryHolidayLabel || 'Regular shift',
    ])
    const summaryRows = [
      [],
      ['Guard', 'Days worked', 'Total hours'],
      ...Object.values(hoursReport.totalByGuard).map((g) => [g.name, g.days, g.hoursLabel]),
    ]
    const csv = [headers, ...rows, ...summaryRows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `securepatrol-hours-${hoursFilters.fromDate}-${hoursFilters.toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportHoursPdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('SecurePatrol Guard Hours Report', 14, 20)
    doc.setFontSize(9)
    doc.text('Productive Security Inc.', 14, 26)
    doc.setFontSize(11)
    doc.text(`Site: ${selectedSite?.name || ''}`, 14, 33)
    doc.text(`Pay period: ${hoursFilters.fromDate} to ${hoursFilters.toDate}`, 14, 40)
    doc.text('Schedule: Mon–Fri 11:00 AM–8:00 PM (9 hrs) · Sat 10:00 AM–5:00 PM (7 hrs) · Sun closed', 14, 47)
    doc.text('Payroll report · Includes statutory holidays and manual adjustments', 14, 54)

    autoTable(doc, {
      startY: 62,
      head: [['Date', 'Guard', 'Clock In', 'Clock Out', 'Hours', 'Day type']],
      body: hoursReport.rows.map((row) => [
        row.date,
        row.guardName,
        row.clockIn.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        row.clockOut.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        String(row.hoursLabel),
        row.statutoryHolidayLabel || 'Regular shift',
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
        g.hoursLabel,
      ]),
    })

    doc.save(`securepatrol-hours-${hoursFilters.fromDate}-${hoursFilters.toDate}.pdf`)
  }

  const passed = scans.filter((s) => s.status === 'pass').length

  const syncSiteSelection = (siteId) => {
    setScanFilters((f) => ({ ...f, siteId }))
    setHoursFilters((f) => ({ ...f, siteId }))
  }

  return (
    <Layout variant="admin">
      <PageHeader
        title="Reports"
        description="Patrol scan history and guard hours for payroll. Export PDF or CSV for any site."
      />

      <div className="mb-6 flex gap-2 rounded-lg border border-slate-200 bg-white p-1">
        {[
          { id: 'scans', label: 'Patrol scans' },
          { id: 'hours', label: 'Guard hours (payroll)' },
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

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <select
          value={activeSiteId}
          onChange={(e) => syncSiteSelection(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {tab === 'scans' ? (
          <>
            <input
              type="date"
              value={scanFilters.fromDate}
              onChange={(e) => setScanFilters({ ...scanFilters, fromDate: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="date"
              value={scanFilters.toDate}
              onChange={(e) => setScanFilters({ ...scanFilters, toDate: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </>
        ) : (
          <>
            <input
              type="date"
              value={hoursFilters.fromDate}
              onChange={(e) => setHoursFilters({ ...hoursFilters, fromDate: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="date"
              value={hoursFilters.toDate}
              onChange={(e) => setHoursFilters({ ...hoursFilters, toDate: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </>
        )}
      </div>

      {tab === 'scans' ? (
        <>
          <div className="mb-4 flex justify-end gap-2">
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

          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Total scans</p>
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
                      <td className="px-4 py-3">{scan.profiles?.name}</td>
                      <td className="px-4 py-3">{scan.distance_metres?.toFixed(0)}m</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            scan.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
                <p className="p-8 text-center text-slate-500">No scans found for this period.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
            Payroll hours for <strong>{selectedSite?.name || 'selected site'}</strong>. Mon–Fri{' '}
            <strong>9 hours</strong> (11:00 AM–8:00 PM), Saturday <strong>7 hours</strong> (10:00 AM–5:00 PM).
            Includes statutory holidays and shift clock edits.
          </div>

          <div className="mb-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={exportHoursCsv}
              disabled={!hoursReport.rows.length}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              type="button"
              onClick={exportHoursPdf}
              disabled={!hoursReport.rows.length}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.values(hoursReport.totalByGuard).map((g) => (
                  <div key={g.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">{g.name}</p>
                    <p className="text-2xl font-bold">{g.hoursLabel}</p>
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
                      <th className="px-4 py-3 font-medium">Day type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hoursReport.rows.map((row) => (
                      <tr key={`${row.date}-${row.guardId}`}>
                        <td className="px-4 py-3">{row.date}</td>
                        <td className="px-4 py-3 font-medium">{row.guardName}</td>
                        <td className="px-4 py-3">{formatShiftTime(row.clockIn)}</td>
                        <td className="px-4 py-3">{formatShiftTime(row.clockOut)}</td>
                        <td className="px-4 py-3 font-semibold">{row.hoursLabel}</td>
                        <td className="px-4 py-3 text-brand-700">
                          {row.statutoryHolidayLabel || 'Regular shift'}
                        </td>
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
