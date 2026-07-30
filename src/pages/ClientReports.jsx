import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  CalendarX2,
  Clock4,
  Download,
  FileText,
  Info,
  MapPin,
  ScanLine,
  Users,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { AnimatedNumber } from '../components/overview/widgets.jsx'
import { KPI_TONES } from '../lib/brandPalette.js'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useReveal } from '../lib/motion.js'
import { BRAND } from '../lib/brand.js'
import {
  computeGuardHoursReport,
  dateRangeDays,
  defaultPayPeriodEnd,
  defaultPayPeriodStart,
  formatDurationFromMinutes,
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

const DAY_MONTH = { month: 'short', day: 'numeric' }

/** "Jul 16 – Jul 29 · 14 days" for the active filter range. */
function describeRange(fromDate, toDate) {
  const from = localDayStart(fromDate)
  const to = localDayStart(toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  const days = Math.max(1, Math.round((to - from) / 86_400_000) + 1)
  const label =
    fromDate === toDate
      ? from.toLocaleDateString([], DAY_MONTH)
      : `${from.toLocaleDateString([], DAY_MONTH)} – ${to.toLocaleDateString([], DAY_MONTH)}`
  return { label, days }
}

function DateField({ label, value, onChange }) {
  return (
    <label className="block w-[10.5rem]">
      <span className="dk-label">{label}</span>
      <input
        type="date"
        value={value}
        onChange={onChange}
        className="sp-input mt-1.5 px-3 py-2.5"
      />
    </label>
  )
}

/** Colourful KPI face (brand pastel gradient, dark ink) — reads on Night + Day. */
function FaceStat({ tone, label, value, hint, icon: Icon }) {
  const t = KPI_TONES[tone]
  return (
    <div data-reveal className={`bento-face ${t.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${t.sub}`}>{label}</p>
        <Icon className={`h-5 w-5 shrink-0 ${t.icon}`} />
      </div>
      <p className={`num mt-5 text-3xl font-semibold tracking-tight ${t.ink}`}>
        <AnimatedNumber value={value} />
        {hint && <span className={`ml-1.5 text-sm font-semibold ${t.sub}`}>{hint}</span>}
      </p>
    </div>
  )
}

function TableSkeleton({ rows = 6 }) {
  return (
    <div className="dk-card divide-y divide-white/5 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-3 w-14 animate-pulse rounded-full bg-white/10" />
          <div className="h-3 w-40 animate-pulse rounded-full bg-white/[0.07]" />
          <div className="ml-auto h-3 w-16 animate-pulse rounded-full bg-white/[0.07]" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="dk-card hatch-empty px-6 py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-orange/15 text-accent-orange">
        <Icon className="h-7 w-7" />
      </span>
      <p className="mt-4 font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-2">{hint}</p>
    </div>
  )
}

const TH = 'dk-label px-5 py-3 text-left whitespace-nowrap'
const TD = 'px-5 py-3.5 align-middle'
const ROW = 'border-t border-white/5 transition-colors first:border-t-0 hover:bg-white/[0.03]'

/** Brand pastel chips — fixed pastel + dark ink, so contrast holds in both themes. */
const CHIP_HOURS = 'num inline-flex rounded-full bg-[#ECFAB5] px-2.5 py-1 text-sm font-semibold text-[#173611]'
const CHIP_REGULAR = 'inline-flex rounded-full bg-[#D9F0FF] px-2.5 py-1 text-xs font-semibold text-[#1d3d52]'
const CHIP_HOLIDAY = 'inline-flex rounded-full bg-[#96EE60] px-2.5 py-1 text-xs font-semibold text-[#173611]'

/** One pastel per guard so multi-guard periods stay scannable. */
const GUARD_TONES = ['lime', 'sky', 'lavender', 'blossom', 'moss']
const GUARD_DOTS = ['#96EE60', '#D9F0FF', '#ECEEFE', '#FBE4E3', '#7FD09F']

/**
 * `demo` is the dev-only harness seam (/dev/reports): it seeds every row the
 * page would have fetched and short-circuits the queries, so the screenshot
 * harness renders this exact page instead of a look-alike that can drift.
 */
export default function ClientReports({ demo = null }) {
  const { profile } = useAuth()
  const siteId = demo ? demo.site.id : profile?.site_id
  const [site, setSite] = useState(demo?.site ?? null)
  const [tab, setTab] = useState(demo?.tab ?? 'scans')
  const [scanFilters, setScanFilters] = useState({
    fromDate: demo?.scanFrom ?? new Date().toISOString().slice(0, 10),
    toDate: demo?.scanTo ?? new Date().toISOString().slice(0, 10),
  })
  const [hoursFilters, setHoursFilters] = useState({
    fromDate: demo?.hoursFrom ?? defaultPayPeriodStart(),
    toDate: demo?.hoursTo ?? defaultPayPeriodEnd(),
  })
  const [scans, setScans] = useState(demo?.scans ?? [])
  const [checkpoints, setCheckpoints] = useState(demo?.checkpoints ?? [])
  const [guards, setGuards] = useState(demo?.guards ?? [])
  const [hoursScans, setHoursScans] = useState(demo?.hoursScans ?? [])
  const [hoursAdjustments, setHoursAdjustments] = useState({})
  const [publishedShifts, setPublishedShifts] = useState(demo?.publishedShifts ?? [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!siteId || demo) return
    supabase.from('sites').select('*').eq('id', siteId).single().then(({ data }) => setSite(data))
  }, [siteId, demo])

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

    const [{ data, error }, adjRows, { data: shiftRows }] = await Promise.all([
      supabase
        .from('scans')
        .select('id, guard_id, checkpoint_id, scanned_at, status')
        .in('checkpoint_id', cpIds)
        .eq('status', 'pass')
        .gte('scanned_at', from.toISOString())
        .lte('scanned_at', to.toISOString())
        .order('scanned_at', { ascending: true }),
      fetchShiftAdjustmentsForSite(siteId, hoursFilters.fromDate, hoursFilters.toDate),
      supabase
        .from('shifts')
        .select('id, guard_id, starts_at, ends_at')
        .eq('site_id', siteId)
        .eq('status', 'published')
        .not('guard_id', 'is', null)
        .gte('starts_at', from.toISOString())
        .lte('starts_at', to.toISOString()),
    ])

    if (error) {
      alert(error.message)
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
    if (siteId && !demo && tab === 'scans') loadScans()
  }, [siteId, demo, tab, scanFilters.fromDate, scanFilters.toDate])

  useEffect(() => {
    if (siteId && !demo && tab === 'hours') loadHoursData()
  }, [siteId, demo, tab, hoursFilters.fromDate, hoursFilters.toDate])

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
    doc.text(`${BRAND.name} Scan Report`, 14, 20)
    doc.setFontSize(9)
    doc.text(BRAND.tagline, 14, 26)
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

  const scanStats = useMemo(
    () => ({
      total: scans.length,
      checkpointsHit: new Set(scans.map((s) => s.checkpoint_id)).size,
      checkpointsTotal: checkpoints.length,
      guardsSeen: new Set(scans.map((s) => s.guard_id)).size,
    }),
    [scans, checkpoints],
  )

  const hoursReport = computeGuardHoursReport({
    scans: hoursScans,
    checkpoints,
    guards,
    dates: dateRangeDays(hoursFilters.fromDate, hoursFilters.toDate),
    adjustmentsByKey: hoursAdjustments,
    operatingHours: site?.operating_hours,
    publishedShifts,
  })

  const exportHoursPdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(`${BRAND.name} Guard Hours Report`, 14, 20)
    doc.setFontSize(9)
    doc.text(BRAND.tagline, 14, 26)
    doc.setFontSize(11)
    doc.text(`Site: ${site?.name || ''}`, 14, 33)
    doc.text(`Pay period: ${hoursFilters.fromDate} to ${hoursFilters.toDate}`, 14, 40)
    doc.text('Hours: actual clocked time within each published shift (GPS clock-in, NFC fallback)', 14, 47)
    doc.text('Only published roster shifts are billed — see the per-day breakdown below', 14, 54)

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

  const hoursTotals = Object.values(hoursReport.totalByGuard)
  const guardOrder = Object.keys(hoursReport.totalByGuard)
  const guardDot = (guardId) =>
    GUARD_DOTS[Math.max(0, guardOrder.indexOf(guardId)) % GUARD_DOTS.length]
  const grandTotalLabel = formatDurationFromMinutes(
    hoursTotals.reduce((minutes, g) => minutes + g.totalMinutes, 0),
  )
  const activeRange = describeRange(
    tab === 'scans' ? scanFilters.fromDate : hoursFilters.fromDate,
    tab === 'scans' ? scanFilters.toDate : hoursFilters.toDate,
  )
  const contentRef = useReveal({
    deps: [tab, loading, scans.length, hoursReport.rows.length],
  })

  if (!siteId) {
    return (
      <Layout variant="client">
        <div className="rounded-xl border border-accent-orange/30 bg-accent-orange/10 p-8 text-center">
          <h1 className="text-lg font-semibold text-accent-orange">No site assigned</h1>
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

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="dk-seg w-full sm:max-w-md" role="tablist" aria-label="Report type">
          {[
            { id: 'scans', label: 'Scan report', icon: ScanLine },
            { id: 'hours', label: 'Guard hours (2 weeks)', icon: Clock4 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className="dk-seg-item"
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
        {activeRange && (
          <p className="inline-flex shrink-0 items-center gap-2 rounded-full border border-accent-orange/25 bg-accent-orange/10 px-3.5 py-2 text-sm text-ink-2">
            <CalendarRange className="h-4 w-4 text-accent-orange" />
            <span className="num font-semibold text-ink">{activeRange.label}</span>
            <span aria-hidden className="text-ink-2">
              ·
            </span>
            <span className="num">{activeRange.days}</span>
            {activeRange.days === 1 ? 'day' : 'days'}
          </p>
        )}
      </div>

      {tab === 'scans' ? (
        <div ref={contentRef} className="space-y-4">
          <div
            data-reveal
            className="dk-card flex flex-wrap items-end justify-between gap-4 p-4 sm:p-5"
          >
            <div className="flex flex-wrap gap-3">
              <DateField
                label="From"
                value={scanFilters.fromDate}
                onChange={(e) => setScanFilters({ ...scanFilters, fromDate: e.target.value })}
              />
              <DateField
                label="To"
                value={scanFilters.toDate}
                onChange={(e) => setScanFilters({ ...scanFilters, toDate: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportScanCsv}
                disabled={!scans.length}
                className="dk-btn-2 rounded-full px-4 py-2.5"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
              <button
                type="button"
                onClick={exportScanPdf}
                disabled={!scans.length}
                className="dk-cta px-4 py-2.5"
              >
                <FileText className="h-4 w-4" /> Download PDF
              </button>
            </div>
          </div>

          {loading ? (
            <TableSkeleton />
          ) : scans.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title="No checkpoint scans in this period"
              hint="Widen the date range — patrol scans appear here the moment a guard taps a checkpoint."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <FaceStat
                  tone="lime"
                  icon={ScanLine}
                  label="Scans logged"
                  value={scanStats.total}
                />
                <FaceStat
                  tone="sky"
                  icon={MapPin}
                  label="Checkpoints hit"
                  value={scanStats.checkpointsHit}
                  hint={`of ${scanStats.checkpointsTotal}`}
                />
                <FaceStat
                  tone="lavender"
                  icon={Users}
                  label="Guards on site"
                  value={scanStats.guardsSeen}
                />
              </div>

              <div data-reveal className="dk-card overflow-hidden">
                <table className="hidden w-full text-sm sm:table">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className={TH}>Date</th>
                      <th className={TH}>Time</th>
                      <th className={TH}>Checkpoint</th>
                      <th className={TH}>Floor</th>
                      <th className={TH}>Guard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => {
                      const at = new Date(scan.scanned_at)
                      return (
                        <tr key={scan.id} className={ROW}>
                          <td className={`${TD} num whitespace-nowrap text-ink-2`}>
                            {at.toLocaleDateString([], DAY_MONTH)}
                          </td>
                          <td className={`${TD} num whitespace-nowrap font-medium text-ink`}>
                            {formatShiftTime(at)}
                          </td>
                          <td className={`${TD} font-medium text-ink`}>
                            <span
                              aria-hidden
                              className="mr-2.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-orange align-middle"
                            />
                            {scan.checkpoint?.name}
                          </td>
                          <td className={`${TD} text-ink-2`}>
                            {scan.checkpoint?.floors?.floor_name || '—'}
                          </td>
                          <td className={`${TD} text-ink-2`}>{scan.profiles?.name}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <ul className="divide-y divide-white/5 sm:hidden">
                  {scans.map((scan) => {
                    const at = new Date(scan.scanned_at)
                    return (
                      <li key={scan.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {scan.checkpoint?.name}
                          </p>
                          <p className="truncate text-xs text-ink-2">
                            {scan.checkpoint?.floors?.floor_name
                              ? `${scan.checkpoint.floors.floor_name} · `
                              : ''}
                            {scan.profiles?.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="num text-sm font-medium text-ink">{formatShiftTime(at)}</p>
                          <p className="num text-xs text-ink-2">
                            {at.toLocaleDateString([], DAY_MONTH)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      ) : (
        <div ref={contentRef} className="space-y-4">
          <p
            data-reveal
            className="flex items-start gap-2.5 rounded-2xl border border-accent-cyan-line/25 bg-accent-cyan/10 px-4 py-3 text-sm leading-relaxed text-ink-2"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-cyan-line" />
            <span>
              Guards <strong className="font-semibold text-ink">clock in with GPS</strong> (NFC tag
              as fallback) at the start of a published shift. Hours below are the{' '}
              <strong className="font-semibold text-ink">actual clocked time</strong> within each
              scheduled shift — only rostered shifts are billed.
            </span>
          </p>

          <div
            data-reveal
            className="dk-card flex flex-wrap items-end justify-between gap-4 p-4 sm:p-5"
          >
            <div className="flex flex-wrap gap-3">
              <DateField
                label="Pay period start"
                value={hoursFilters.fromDate}
                onChange={(e) => setHoursFilters({ ...hoursFilters, fromDate: e.target.value })}
              />
              <DateField
                label="Pay period end"
                value={hoursFilters.toDate}
                onChange={(e) => setHoursFilters({ ...hoursFilters, toDate: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={exportHoursPdf}
              disabled={!hoursReport.rows.length}
              className="dk-cta px-4 py-2.5"
            >
              <FileText className="h-4 w-4" /> Download hours PDF
            </button>
          </div>

          {loading ? (
            <TableSkeleton />
          ) : hoursReport.rows.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="No shift hours recorded in this period"
              hint="Hours land here once a guard clocks in on a published shift at your site."
            />
          ) : (
            <>
              <div>
                <div className="mb-2.5 flex items-baseline justify-between gap-3">
                  <p className="deck-eyebrow text-ink-2">Clocked hours by guard</p>
                  {hoursTotals.length > 1 && (
                    <p className="text-sm text-ink-2">
                      Total <span className="num font-semibold text-ink">{grandTotalLabel}</span>
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {hoursTotals.map((g, i) => {
                    const t = KPI_TONES[GUARD_TONES[i % GUARD_TONES.length]]
                    return (
                      <div key={g.name} data-reveal className={`bento-face ${t.bg}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`truncate text-base font-semibold ${t.ink}`}>{g.name}</p>
                            <p className={`text-xs font-medium ${t.sub}`}>
                              <span className="num">{g.days}</span> days worked
                            </p>
                          </div>
                          <Clock4 className={`h-5 w-5 shrink-0 ${t.icon}`} />
                        </div>
                        <p className={`num mt-6 text-3xl font-semibold tracking-tight ${t.ink}`}>
                          {g.hoursLabel}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div data-reveal className="dk-card overflow-hidden">
                <table className="hidden w-full text-sm lg:table">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className={TH}>Date</th>
                      <th className={TH}>Guard</th>
                      <th className={TH}>Clock in</th>
                      <th className={TH}>Clock out</th>
                      <th className={`${TH} text-right`}>Hours</th>
                      <th className={TH}>Day type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoursReport.rows.map((row) => (
                      <tr key={`${row.date}-${row.guardId}`} className={ROW}>
                        <td className={`${TD} num whitespace-nowrap text-ink-2`}>{row.date}</td>
                        <td className={`${TD} whitespace-nowrap font-medium text-ink`}>
                          <span
                            aria-hidden
                            className="mr-2.5 inline-block h-2 w-2 rounded-full align-middle"
                            style={{ background: guardDot(row.guardId) }}
                          />
                          {row.guardName}
                        </td>
                        <td className={`${TD} num whitespace-nowrap text-ink`}>
                          {formatShiftTime(row.clockIn)}
                        </td>
                        <td className={`${TD} num whitespace-nowrap text-ink`}>
                          {formatShiftTime(row.clockOut)}
                          {row.missingClockOut && (
                            <span className="ml-2 text-xs text-ink-2">est.</span>
                          )}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-right`}>
                          <span className={CHIP_HOURS}>{row.hoursLabel}</span>
                        </td>
                        <td className={TD}>
                          <span
                            className={row.statutoryHolidayLabel ? CHIP_HOLIDAY : CHIP_REGULAR}
                          >
                            {row.statutoryHolidayLabel || 'Regular shift'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <ul className="divide-y divide-white/5 lg:hidden">
                  {hoursReport.rows.map((row) => (
                    <li key={`${row.date}-${row.guardId}`} className="px-4 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="num text-sm font-medium text-ink">{row.date}</p>
                        <span className={CHIP_HOURS}>{row.hoursLabel}</span>
                      </div>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: guardDot(row.guardId) }}
                        />
                        <span>{row.guardName}</span>
                        <span aria-hidden>·</span>
                        <span className="num">
                          {formatShiftTime(row.clockIn)} – {formatShiftTime(row.clockOut)}
                        </span>
                        {row.statutoryHolidayLabel && (
                          <span className={CHIP_HOLIDAY}>{row.statutoryHolidayLabel}</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  )
}
