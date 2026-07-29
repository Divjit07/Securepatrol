import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Save, Wallet, Plus, Trash2, Receipt, Pencil, Ban, RotateCcw, X } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { BRAND } from '../lib/brand.js'
import {
  computeGuardHoursReport,
  dateRangeDays,
  defaultPayPeriodEnd,
  defaultPayPeriodStart,
  formatShiftTime,
} from '../lib/clientStats.js'
import {
  fetchShiftAdjustmentsForSite,
  mapShiftAdjustments,
  saveShiftAdjustment,
  removeShiftAdjustment,
  excludedNote,
  combineDateAndTime,
  toTimeInputValue,
} from '../lib/shiftAdjustments.js'
import {
  ROUNDING_MODES,
  applyRounding,
  computeWeeklyPayroll,
  overtimeByGuard,
  buildAccountingCsv,
  downloadCsv,
  formatMinutes,
  fetchApprovalsForSite,
  fetchGuardRates,
  saveGuardRate,
} from '../lib/payroll.js'
import {
  DEFAULT_DEDUCTION_RATES,
  DEFAULT_PERIOD_OT_THRESHOLD_HOURS,
  OVERTIME_MULTIPLIER,
  applyPeriodOtThreshold,
  computePaystub,
  periodTotalsForGuard,
  downloadPaystubPdf,
  downloadAllPaystubsPdf,
} from '../lib/paystub.js'
import { emptyInvoiceItem, computeInvoice, downloadInvoicePdf } from '../lib/invoice.js'

function localDayStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function localDayEnd(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

/** The payroll department's home: guard hours + the paystub generator. */
export default function AdminPayroll() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [tab, setTab] = useState('hours')
  const [filters, setFilters] = useState({
    siteId: '',
    fromDate: defaultPayPeriodStart(),
    toDate: defaultPayPeriodEnd(),
  })
  const [checkpoints, setCheckpoints] = useState([])
  const [guards, setGuards] = useState([])
  const [hoursScans, setHoursScans] = useState([])
  const [hoursAdjustments, setHoursAdjustments] = useState({})
  const [publishedShifts, setPublishedShifts] = useState([])
  const [loading, setLoading] = useState(false)
  const [rounding, setRounding] = useState('quarter')
  const [rates, setRates] = useState({})
  const [ratesPersisted, setRatesPersisted] = useState(true)
  const [savingRate, setSavingRate] = useState(null)
  const [rateError, setRateError] = useState(null)
  // Statutory deductions are % of gross (Net = Gross − Gross×EI% − (Gross−exemption)×CPP%);
  // only "other fees" is a typed dollar amount, per guard.
  const [deductionRates, setDeductionRates] = useState(DEFAULT_DEDUCTION_RATES)
  const [otherFees, setOtherFees] = useState({}) // guardId -> $ amount
  // Period OT: first N hours are regular, the rest is OT (default 88h biweekly);
  // each guard can get a typed OT $/h rate — blank = 1.5× their base rate.
  const [otThresholdHours, setOtThresholdHours] = useState(DEFAULT_PERIOD_OT_THRESHOLD_HOURS)
  const [otRates, setOtRates] = useState({}) // guardId -> $/h for OT
  const [stubBusy, setStubBusy] = useState(null) // guardId | 'all' while YTD loads
  // YTD (Jan 1 → period end) weekly rows, cached per site/period/rounding.
  const ytdCacheRef = useRef({ key: null, weekly: null })
  // Inline day cleanup: edit collapses the day to one corrected in/out;
  // exclude drops the day from payroll. Both are adjustments — raw punches
  // stay immutable, and Reset restores punch-derived hours.
  const [editingDay, setEditingDay] = useState(null) // {guardId, date, clockIn, clockOut}
  const [dayBusy, setDayBusy] = useState(null) // `${guardId}-${date}` while saving
  const [dayError, setDayError] = useState(null)
  const [invoice, setInvoice] = useState(() => ({
    number: `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-1`,
    date: new Date().toISOString().slice(0, 10),
    dueDate: '',
    billTo: '',
    billToAddress: '',
    taxPct: 13,
    notes: '',
    items: [emptyInvoiceItem()],
  }))

  const selectedSite = sites.find((s) => s.id === filters.siteId)

  useEffect(() => {
    if (!user) return
    fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin').then((siteList) => {
      setSites(siteList)
      if (siteList.length) setFilters((f) => ({ ...f, siteId: f.siteId || siteList[0].id }))
    })
  }, [user?.id, isSuperAdmin])

  const loadHoursData = async () => {
    if (!filters.siteId) return
    setLoading(true)

    const [{ data: floors }, { data: guardData }, rateResult] = await Promise.all([
      supabase.from('floors').select('id').eq('site_id', filters.siteId),
      supabase.from('guards').select('id, name').eq('site_id', filters.siteId).eq('active', true).order('name'),
      fetchGuardRates(filters.siteId),
    ])

    setGuards(guardData || [])
    setRates(rateResult.rates)
    setRatesPersisted(rateResult.persisted)

    if (!floors?.length) {
      setCheckpoints([])
      setHoursScans([])
      setHoursAdjustments({})
      setPublishedShifts([])
      setLoading(false)
      return
    }

    const { data: cps } = await supabase
      .from('checkpoints')
      .select('id, name, checkpoint_role, floors(floor_name)')
      .in('floor_id', floors.map((f) => f.id))
      .eq('active', true)

    setCheckpoints(cps || [])
    const cpIds = (cps || []).map((c) => c.id)
    if (!cpIds.length) {
      setHoursScans([])
      setHoursAdjustments({})
      setPublishedShifts([])
      setLoading(false)
      return
    }

    const from = localDayStart(filters.fromDate)
    const to = localDayEnd(filters.toDate)

    const [{ data, error }, adjRows, { data: shiftRows }] = await Promise.all([
      supabase
        .from('scans')
        .select('id, guard_id, checkpoint_id, scanned_at, status')
        .in('checkpoint_id', cpIds)
        .eq('status', 'pass')
        .gte('scanned_at', from.toISOString())
        .lte('scanned_at', to.toISOString())
        .order('scanned_at', { ascending: true }),
      fetchShiftAdjustmentsForSite(filters.siteId, filters.fromDate, filters.toDate),
      supabase
        .from('shifts')
        .select('id, guard_id, starts_at, ends_at')
        .eq('site_id', filters.siteId)
        .eq('status', 'published')
        .not('guard_id', 'is', null)
        .gte('starts_at', from.toISOString())
        .lte('starts_at', to.toISOString()),
    ])

    if (error) {
      setHoursScans([])
      setHoursAdjustments({})
      setPublishedShifts([])
    } else {
      setHoursScans(data || [])
      setHoursAdjustments(mapShiftAdjustments(adjRows))
      setPublishedShifts(shiftRows || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (filters.siteId) loadHoursData()
  }, [filters.siteId, filters.fromDate, filters.toDate])

  const hoursReport = computeGuardHoursReport({
    scans: hoursScans,
    checkpoints,
    guards,
    dates: dateRangeDays(filters.fromDate, filters.toDate),
    adjustmentsByKey: hoursAdjustments,
    operatingHours: selectedSite?.operating_hours,
    publishedShifts,
    bySessions: true,
  })

  const payRows = applyRounding(hoursReport.rows, rounding)
  const weeklyPayroll = computeWeeklyPayroll(payRows)
  const otByGuard = overtimeByGuard(weeklyPayroll)

  const guardsWithHours = guards.filter((g) => hoursReport.totalByGuard[g.id])

  const dayKey = (row) => `${row.guardId}-${row.date}`

  const startDayEdit = (row) => {
    setDayError(null)
    setEditingDay({
      guardId: row.guardId,
      date: row.date,
      guardName: row.guardName,
      clockIn: toTimeInputValue(new Date(row.clockIn)),
      clockOut: toTimeInputValue(new Date(row.clockOut)),
    })
  }

  const saveDayEdit = async () => {
    if (!editingDay) return
    const clockInAt = combineDateAndTime(editingDay.date, editingDay.clockIn)
    const clockOutAt = combineDateAndTime(editingDay.date, editingDay.clockOut)
    if (clockOutAt <= clockInAt) {
      setDayError('Clock-out must be after clock-in')
      return
    }
    setDayBusy(`${editingDay.guardId}-${editingDay.date}`)
    setDayError(null)
    try {
      await saveShiftAdjustment({
        siteId: filters.siteId,
        guardId: editingDay.guardId,
        shiftDate: editingDay.date,
        clockInAt: clockInAt.toISOString(),
        clockOutAt: clockOutAt.toISOString(),
        note: 'Corrected on Payroll',
      })
      setEditingDay(null)
      await loadHoursData()
    } catch (err) {
      setDayError(err.message || 'Failed to save times')
    } finally {
      setDayBusy(null)
    }
  }

  const excludeDay = async (row) => {
    if (
      !window.confirm(
        `Remove ${row.guardName}'s ${row.date} from payroll?\n\nRaw punches are kept — Reset (here or on Shift Clock) brings the day back.`,
      )
    )
      return
    setDayBusy(dayKey(row))
    setDayError(null)
    try {
      await saveShiftAdjustment({
        siteId: filters.siteId,
        guardId: row.guardId,
        shiftDate: row.date,
        clockInAt: new Date(row.clockIn).toISOString(),
        clockOutAt: new Date(row.clockOut).toISOString(),
        note: excludedNote(),
      })
      await loadHoursData()
    } catch (err) {
      setDayError(err.message || 'Failed to exclude day')
    } finally {
      setDayBusy(null)
    }
  }

  const resetDay = async (row) => {
    if (!window.confirm('Remove the manual override and revert to punch-derived times?')) return
    setDayBusy(dayKey(row))
    setDayError(null)
    try {
      await removeShiftAdjustment(row.guardId, row.date)
      await loadHoursData()
    } catch (err) {
      setDayError(err.message || 'Failed to reset')
    } finally {
      setDayBusy(null)
    }
  }

  const handleSaveRate = async (guardId) => {
    setSavingRate(guardId)
    setRateError(null)
    try {
      await saveGuardRate(guardId, rates[guardId])
      setRatesPersisted(true)
    } catch (err) {
      setRatesPersisted(false)
      setRateError(err.message)
    } finally {
      setSavingRate(null)
    }
  }

  // Inclusive day count of the selected pay period — drives CPP exemption proration.
  const periodDays = dateRangeDays(filters.fromDate, filters.toDate).length

  const paystubParamsFor = (guard) => {
    // Re-split worked time against the period threshold (e.g. 88h biweekly):
    // hours past it are OT regardless of which week they landed in.
    const totals = applyPeriodOtThreshold(periodTotalsForGuard(weeklyPayroll, guard.id), otThresholdHours)
    const rate = rates[guard.id]
    const stub = computePaystub({
      totals,
      rate,
      rates: deductionRates,
      otherFees: otherFees[guard.id],
      periodDays,
      otRate: otRates[guard.id],
    })
    return {
      guardName: guard.name,
      employeeNo: guard.id.slice(0, 8).toUpperCase(),
      siteName: selectedSite?.name,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      stub,
      rate,
      totals,
    }
  }

  /** YTD weekly payroll rows (Jan 1 of the period's year → period end). */
  const ensureYtdWeekly = async () => {
    const from = `${filters.toDate.slice(0, 4)}-01-01`
    const key = [filters.siteId, from, filters.toDate, rounding].join('|')
    if (ytdCacheRef.current.key === key) return ytdCacheRef.current.weekly

    const cpIds = checkpoints.map((c) => c.id)
    if (!cpIds.length) return null

    const [{ data, error }, adjRows, { data: shiftRows }] = await Promise.all([
      supabase
        .from('scans')
        .select('id, guard_id, checkpoint_id, scanned_at, status')
        .in('checkpoint_id', cpIds)
        .eq('status', 'pass')
        .gte('scanned_at', localDayStart(from).toISOString())
        .lte('scanned_at', localDayEnd(filters.toDate).toISOString())
        .order('scanned_at', { ascending: true }),
      fetchShiftAdjustmentsForSite(filters.siteId, from, filters.toDate),
      supabase
        .from('shifts')
        .select('id, guard_id, starts_at, ends_at')
        .eq('site_id', filters.siteId)
        .eq('status', 'published')
        .not('guard_id', 'is', null)
        .gte('starts_at', localDayStart(from).toISOString())
        .lte('starts_at', localDayEnd(filters.toDate).toISOString()),
    ])
    if (error) return null

    const report = computeGuardHoursReport({
      scans: data || [],
      checkpoints,
      guards,
      dates: dateRangeDays(from, filters.toDate),
      adjustmentsByKey: mapShiftAdjustments(adjRows),
      operatingHours: selectedSite?.operating_hours,
      publishedShifts: shiftRows || [],
      bySessions: true,
    })
    const weekly = computeWeeklyPayroll(applyRounding(report.rows, rounding))
    ytdCacheRef.current = { key, weekly }
    return weekly
  }

  const paramsWithYtd = (guard, ytdWeekly) => {
    const params = paystubParamsFor(guard)
    if (ytdWeekly) {
      // YTD keeps the weekly OT split (a period threshold doesn't scale to a
      // year) but pays OT at the same typed rate for consistency.
      const totals = periodTotalsForGuard(ytdWeekly, guard.id)
      const stub = computePaystub({
        totals,
        rate: rates[guard.id],
        rates: deductionRates,
        otherFees: otherFees[guard.id],
        // YTD column spans Jan 1 → period end; proration caps at the annual exemption.
        periodDays: dateRangeDays(`${filters.toDate.slice(0, 4)}-01-01`, filters.toDate).length,
        otRate: otRates[guard.id],
      })
      params.ytd = { totals, stub }
    }
    return params
  }

  const handlePaystubPdf = async (guard) => {
    setStubBusy(guard.id)
    try {
      const ytdWeekly = await ensureYtdWeekly()
      await downloadPaystubPdf(paramsWithYtd(guard, ytdWeekly))
    } finally {
      setStubBusy(null)
    }
  }

  const handleAllPaystubsPdf = async () => {
    setStubBusy('all')
    try {
      const ytdWeekly = await ensureYtdWeekly()
      await downloadAllPaystubsPdf(
        guardsWithHours.map((g) => paramsWithYtd(g, ytdWeekly)),
        filters.fromDate,
      )
    } finally {
      setStubBusy(null)
    }
  }

  const exportAccountingCsv = async () => {
    let approvals = {}
    try {
      approvals = await fetchApprovalsForSite(filters.siteId, filters.fromDate, filters.toDate)
    } catch {
      // approvals table not migrated yet — export without the column data
    }
    downloadCsv(
      `securepatrol-payroll-${filters.fromDate}-${filters.toDate}.csv`,
      buildAccountingCsv(weeklyPayroll, approvals),
    )
  }

  const exportHoursCsv = () => {
    const headers = ['Date', 'Guard', 'Clock In', 'Clock Out', 'Hours', 'Day type']
    const rows = payRows.map((row) => [
      row.date,
      row.guardName,
      formatShiftTime(row.payClockIn),
      formatShiftTime(row.payClockOut),
      formatMinutes(row.payMinutes),
      row.statutoryHolidayLabel || 'Regular shift',
    ])
    const summaryRows = [
      [],
      ['Guard', 'Days worked', 'Total hours'],
      ...Object.values(hoursReport.totalByGuard).map((g) => [g.name, g.days, g.hoursLabel]),
    ]
    downloadCsv(`securepatrol-hours-${filters.fromDate}-${filters.toDate}.csv`, [headers, ...rows, ...summaryRows])
  }

  const exportHoursPdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(`${BRAND.name} Guard Hours Report`, 14, 20)
    doc.setFontSize(9)
    doc.text(BRAND.tagline, 14, 26)
    doc.setFontSize(11)
    doc.text(`Site: ${selectedSite?.name || ''}`, 14, 33)
    doc.text(`Pay period: ${filters.fromDate} to ${filters.toDate}`, 14, 40)
    doc.text('Hours from GPS / clock punches (and shift-clock edits)', 14, 47)

    autoTable(doc, {
      startY: 54,
      head: [['Date', 'Guard', 'Clock In', 'Clock Out', 'Hours', 'Day type']],
      body: payRows.map((row) => [
        row.date,
        row.guardName,
        row.payClockIn.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        row.payClockOut.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        formatMinutes(row.payMinutes),
        row.statutoryHolidayLabel || 'Regular shift',
      ]),
    })

    const summaryY = doc.lastAutoTable.finalY + 12
    doc.setFontSize(12)
    doc.text('Total hours by guard', 14, summaryY)
    autoTable(doc, {
      startY: summaryY + 4,
      head: [['Guard', 'Days worked', 'Total hours']],
      body: Object.values(hoursReport.totalByGuard).map((g) => [g.name, g.days, g.hoursLabel]),
    })

    doc.save(`securepatrol-hours-${filters.fromDate}-${filters.toDate}.pdf`)
  }

  return (
    <Layout variant="admin">
      <PageHeader
        title="Payroll"
        description="The payroll department's home — guard hours from verified clock punches, and the paystub generator."
      />

      <div className="dk-seg mb-6" role="tablist" aria-label="Payroll view">
        {[
          { id: 'hours', label: 'Guard hours' },
          { id: 'paystubs', label: 'Paystub generator' },
          { id: 'invoices', label: 'Invoice generator' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="dk-seg-item"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-ink/10 bg-surface p-4">
        <select
          value={filters.siteId}
          onChange={(e) => setFilters({ ...filters, siteId: e.target.value })}
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
          value={filters.fromDate}
          onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
          className="rounded-full border border-black/10 bg-[#FFFFFF] px-3 py-2 text-sm font-semibold text-black [color-scheme:light]"
        />
        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
          className="rounded-full border border-black/10 bg-[#FFFFFF] px-3 py-2 text-sm font-semibold text-black [color-scheme:light]"
        />
        <div className="flex rounded-full border border-ink/10 bg-ink/5 p-1">
          {ROUNDING_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setRounding(m.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                rounding === m.id ? 'bg-black text-white' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {tab !== 'invoices' && (
        <div className="mb-4 rounded-xl border border-ink/10 bg-ink/5 p-4 text-sm text-ink">
          Payroll hours for <strong>{selectedSite?.name || 'selected site'}</strong> come from GPS /
          clock punches (and shift-clock edits) — not a fixed site schedule.
        </div>
      )}

      {loading && tab !== 'invoices' ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : tab === 'hours' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={exportAccountingCsv}
              disabled={!weeklyPayroll.length}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Payroll CSV
            </button>
            <button
              type="button"
              onClick={exportHoursCsv}
              disabled={!hoursReport.rows.length}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              type="button"
              onClick={exportHoursPdf}
              disabled={!hoursReport.rows.length}
              className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(hoursReport.totalByGuard).map(([guardId, g]) => (
              <div key={guardId} className="dk-card p-4">
                <p className="text-sm text-ink-2">{g.name}</p>
                <p className="text-2xl font-bold">{g.hoursLabel}</p>
                <p className="text-xs text-ink-3">
                  {g.days} days worked
                  {otByGuard[guardId] ? (
                    <span className="ml-2 font-semibold text-accent-orange">
                      OT {formatMinutes(otByGuard[guardId])}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>

          {dayError && <p className="mb-3 text-sm text-accent-red">{dayError}</p>}

          <div className="overflow-x-auto dk-card">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-white/5 text-left text-ink-2">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Guard</th>
                  <th className="px-4 py-3 font-medium">Clock in</th>
                  <th className="px-4 py-3 font-medium">Clock out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Day type</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payRows.map((row) => {
                  const isEditing =
                    editingDay &&
                    editingDay.guardId === row.guardId &&
                    editingDay.date === row.date &&
                    (row.sessionIndex ?? 0) === 0
                  const busy = dayBusy === dayKey(row)

                  return (
                    <tr key={`${row.date}-${row.guardId}-${row.sessionIndex ?? 0}`}>
                      <td className="px-4 py-3">
                        {row.date}
                        {row.sessionCount > 1 && (
                          <span className="ml-1 text-ink-3">· #{row.sessionIndex + 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{row.guardName}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="time"
                            className="sp-input"
                            value={editingDay.clockIn}
                            onChange={(e) => setEditingDay((p) => ({ ...p, clockIn: e.target.value }))}
                          />
                        ) : (
                          formatShiftTime(row.payClockIn)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="time"
                            className="sp-input"
                            value={editingDay.clockOut}
                            onChange={(e) => setEditingDay((p) => ({ ...p, clockOut: e.target.value }))}
                          />
                        ) : (
                          formatShiftTime(row.payClockOut)
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatMinutes(row.payMinutes)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            row.missingClockOut
                              ? 'bg-[#EF4444] text-white'
                              : row.statutoryHolidayLabel
                                ? 'bg-black text-white'
                                : row.isAdjusted
                                  ? 'bg-black text-white'
                                  : 'bg-[#FFFFFF] text-black ring-1 ring-black/10'
                          }`}
                          title={
                            row.missingClockOut
                              ? 'No clock-out punch — clock-out defaulted to the scheduled end. Verify before paying.'
                              : undefined
                          }
                        >
                          {row.missingClockOut
                            ? 'No clock-out'
                            : row.statutoryHolidayLabel || (row.isAdjusted ? 'Adjusted' : 'Regular shift')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={saveDayEdit}
                              className="inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                            >
                              <Save className="h-3 w-3" />
                              {busy ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setEditingDay(null)}
                              className="inline-flex items-center rounded-full bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold text-black ring-1 ring-black/10 transition hover:bg-zinc-100"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (row.sessionIndex ?? 0) === 0 ? (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => startDayEdit(row)}
                              title={
                                row.sessionCount > 1
                                  ? 'Edit collapses this day to one corrected clock in/out'
                                  : 'Correct this day’s clock in/out'
                              }
                              className="inline-flex items-center gap-1 rounded-full bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold text-black ring-1 ring-black/10 transition hover:bg-zinc-100 disabled:opacity-50"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => excludeDay(row)}
                              title="Exclude the whole day from payroll (punches are kept)"
                              className="inline-flex items-center gap-1 rounded-full bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold text-[#EF4444] ring-1 ring-black/10 transition hover:bg-zinc-100 disabled:opacity-50"
                            >
                              <Ban className="h-3 w-3" />
                              Exclude
                            </button>
                            {row.isAdjusted && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => resetDay(row)}
                                title="Remove the manual override — revert to punch-derived times"
                                className="inline-flex items-center gap-1 rounded-full bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold text-black ring-1 ring-black/10 transition hover:bg-zinc-100 disabled:opacity-50"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Reset
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-ink-3">see #1</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {hoursReport.rows.length === 0 && (
              <p className="p-8 text-center text-ink-2">No shift hours recorded for this period.</p>
            )}
          </div>
        </>
      ) : tab === 'invoices' ? (
        <div className="max-w-3xl dk-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Receipt className="h-4 w-4 text-accent-orange" /> Invoice for extra services
          </p>
          <p className="mt-1 text-xs text-ink-2">
            Bill a client for work outside the contract — event coverage, call-outs, extra patrols.
            Line items × rate, tax on top, PDF with the company letterhead.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { id: 'number', label: 'Invoice #', type: 'text' },
              { id: 'date', label: 'Date', type: 'date' },
              { id: 'dueDate', label: 'Due date', type: 'date' },
            ].map((f) => (
              <label key={f.id} className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                {f.label}
                <input
                  type={f.type}
                  value={invoice[f.id]}
                  onChange={(e) => setInvoice((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-inset px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"
                />
              </label>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Bill to (client / company)
              <input
                type="text"
                value={invoice.billTo}
                onChange={(e) => setInvoice((prev) => ({ ...prev, billTo: e.target.value }))}
                placeholder="Client name"
                className="mt-1 w-full rounded-lg border border-white/10 bg-inset px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"
              />
            </label>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Bill-to address (optional)
              <input
                type="text"
                value={invoice.billToAddress}
                onChange={(e) => setInvoice((prev) => ({ ...prev, billToAddress: e.target.value }))}
                placeholder="Street, city"
                className="mt-1 w-full rounded-lg border border-white/10 bg-inset px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"
              />
            </label>
          </div>

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">Line items</p>
          <div className="mt-1 space-y-2">
            {invoice.items.map((item, index) => {
              const amount = (Number(item.qty) || 0) * (Number(item.price) || 0)
              return (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      setInvoice((prev) => ({
                        ...prev,
                        items: prev.items.map((it, i) => (i === index ? { ...it, description: e.target.value } : it)),
                      }))
                    }
                    placeholder="Service description (e.g. Event coverage — 2 guards, Sat night)"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-inset px-3 py-2 text-sm text-ink"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={item.qty}
                    onChange={(e) =>
                      setInvoice((prev) => ({
                        ...prev,
                        items: prev.items.map((it, i) => (i === index ? { ...it, qty: e.target.value } : it)),
                      }))
                    }
                    title="Quantity / hours"
                    className="w-20 rounded-lg border border-white/10 bg-inset px-2 py-2 text-right text-sm text-ink"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) =>
                      setInvoice((prev) => ({
                        ...prev,
                        items: prev.items.map((it, i) => (i === index ? { ...it, price: e.target.value } : it)),
                      }))
                    }
                    placeholder="Rate $"
                    title="Rate per unit ($)"
                    className="w-24 rounded-lg border border-white/10 bg-inset px-2 py-2 text-right text-sm text-ink"
                  />
                  <span className="w-20 shrink-0 text-right text-sm font-semibold text-ink">
                    ${amount.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setInvoice((prev) => ({
                        ...prev,
                        items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : [emptyInvoiceItem()],
                      }))
                    }
                    className="rounded-lg p-2 text-ink-3 hover:bg-white/10 hover:text-accent-red"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setInvoice((prev) => ({ ...prev, items: [...prev.items, emptyInvoiceItem()] }))}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-white/5"
          >
            <Plus className="h-3.5 w-3.5" /> Add line
          </button>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                Tax % (HST)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoice.taxPct}
                  onChange={(e) => setInvoice((prev) => ({ ...prev, taxPct: e.target.value }))}
                  className="mt-1 block w-24 rounded-lg border border-white/10 bg-inset px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
                />
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                Notes (optional)
                <input
                  type="text"
                  value={invoice.notes}
                  onChange={(e) => setInvoice((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Payment terms, PO number…"
                  className="mt-1 block w-72 max-w-full rounded-lg border border-white/10 bg-inset px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
                />
              </label>
            </div>
            {(() => {
              const calc = computeInvoice(invoice)
              return (
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-ink-2">
                    <p>Subtotal ${calc.subtotal.toFixed(2)}</p>
                    <p>Tax ${calc.tax.toFixed(2)}</p>
                    <p className="text-base font-bold text-accent-green">Total ${calc.total.toFixed(2)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadInvoicePdf({ ...invoice, calc })}
                    disabled={!calc.lines.length || !invoice.billTo.trim()}
                    className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" /> Invoice PDF
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      ) : (
        <>
          {!ratesPersisted && (
            <div className="mb-4 rounded-xl border border-accent-orange/30 bg-accent-orange/10 p-4 text-sm text-accent-orange">
              Pay rates can’t be saved yet — run migration <strong>034</strong> in the Supabase SQL
              editor to create <code>guard_pay_rates</code>. Rates entered below still work for this
              session’s paystubs.
              {rateError ? <span className="mt-1 block text-xs opacity-80">{rateError}</span> : null}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 dk-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <p className="w-full text-xs font-semibold uppercase tracking-wider text-ink-3">
                Deduction formula · Net = Gross − (Gross × EI%) − ((Gross − exemption) × CPP%) − other fees
              </p>
              {[
                { id: 'eiPct', label: 'EI %', step: '0.01' },
                { id: 'cppPct', label: 'CPP %', step: '0.01' },
                { id: 'cppAnnualExemption', label: 'CPP exemption $ / year', step: '1' },
              ].map((f) => (
                <label key={f.id} className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                  {f.label}
                  <input
                    type="number"
                    min="0"
                    step={f.step}
                    value={deductionRates[f.id]}
                    onChange={(e) =>
                      setDeductionRates((prev) => ({ ...prev, [f.id]: e.target.value }))
                    }
                    className="mt-1 block w-36 rounded-lg border border-white/10 bg-inset px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
                  />
                </label>
              ))}
              <label
                className="text-[10px] font-semibold uppercase tracking-wider text-ink-3"
                title="Worked hours up to this are regular; everything past it is OT. 88h = 44h/week on a biweekly period."
              >
                OT after (hours / period)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={otThresholdHours}
                  onChange={(e) => setOtThresholdHours(e.target.value)}
                  className="mt-1 block w-36 rounded-lg border border-white/10 bg-inset px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
                  placeholder="88"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleAllPaystubsPdf}
              disabled={!guardsWithHours.length || stubBusy === 'all'}
              className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <Wallet className="h-4 w-4" /> {stubBusy === 'all' ? 'Building…' : 'All paystubs (PDF)'}
            </button>
          </div>

          {guardsWithHours.length === 0 ? (
            <div className="dk-card p-8 text-center text-ink-2">
              No guard hours in this pay period — paystubs generate from worked hours.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {guardsWithHours.map((guard) => {
                const params = paystubParamsFor(guard)
                const { stub, totals } = params
                const money = (n) => `$${n.toFixed(2)}`
                return (
                  <div key={guard.id} className="dk-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg font-semibold text-ink">{guard.name}</p>
                        <p className="mt-0.5 text-xs text-ink-2">
                          {formatMinutes(totals.regularMinutes)} regular
                          {totals.overtimeMinutes ? ` · ${formatMinutes(totals.overtimeMinutes)} OT` : ''}
                          {totals.statMinutes ? ` · ${formatMinutes(totals.statMinutes)} stat` : ''}
                          {` · ${totals.days} days`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePaystubPdf(guard)}
                        disabled={stubBusy != null}
                        className="flex shrink-0 items-center gap-2 rounded-full bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {stubBusy === guard.id ? 'Building…' : 'Paystub PDF'}
                      </button>
                    </div>

                    <div className="mt-4 flex items-end gap-2">
                      <label className="flex-1 text-xs font-semibold uppercase tracking-wider text-ink-3">
                        Hourly rate ($)
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={rates[guard.id] ?? ''}
                          onChange={(e) => setRates((prev) => ({ ...prev, [guard.id]: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-inset px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"
                          placeholder="e.g. 22.50"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSaveRate(guard.id)}
                        disabled={savingRate === guard.id}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-white/5 disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {savingRate === guard.id ? 'Saving…' : 'Save'}
                      </button>
                    </div>

                    <div className="mt-3 flex items-end gap-3">
                      <label
                        className="w-40 text-[10px] font-semibold uppercase tracking-wider text-ink-3"
                        title={`Hourly rate paid for OT hours. Blank = ${OVERTIME_MULTIPLIER}× the base rate.`}
                      >
                        OT rate ($/h)
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={otRates[guard.id] ?? ''}
                          onChange={(e) =>
                            setOtRates((prev) => ({ ...prev, [guard.id]: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-inset px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
                          placeholder={
                            rates[guard.id]
                              ? `auto ${(Number(rates[guard.id]) * OVERTIME_MULTIPLIER).toFixed(2)}`
                              : `auto ${OVERTIME_MULTIPLIER}×`
                          }
                        />
                      </label>
                      <label className="w-40 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                        Other fees ($)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={otherFees[guard.id] ?? ''}
                          onChange={(e) =>
                            setOtherFees((prev) => ({ ...prev, [guard.id]: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-inset px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
                          placeholder="0.00"
                        />
                      </label>
                      <div className="flex-1 space-y-1 text-xs text-ink-2">
                        {stub.deductionLines.map((d) => (
                          <p key={d.label} className="flex justify-between gap-2">
                            <span className="truncate">{d.label}</span>
                            <span className="shrink-0">−{money(d.amount)}</span>
                          </p>
                        ))}
                        {stub.deductionLines.length === 0 && <p>No deductions (no gross pay).</p>}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm">
                      <span className="text-ink-2">
                        Gross {money(stub.gross)} · Deductions {money(stub.totalDeductions)}
                      </span>
                      <span className="text-base font-bold text-accent-green">Net {money(stub.net)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
