// Deterministic scale fixture: 15 sites, 40 guards, 14 days of punches —
// pushed through the REAL payroll/clock code (nothing mocked) so /dev/scale
// and the node test can assert the math holds at production-ish volume.
// Seeded PRNG → same dataset every run, so failures are reproducible.
import {
  computeGuardHoursReport,
  computeGuardShiftForDay,
  countPatrolRounds,
} from '../../lib/clientStats.js'
import {
  applyRounding,
  computeWeeklyPayroll,
  overtimeByGuard,
  buildAccountingCsv,
  OVERTIME_WEEKLY_MINUTES,
} from '../../lib/payroll.js'
import {
  computePaystub,
  cppExemptionForPeriod,
  periodTotalsForGuard,
  DEFAULT_DEDUCTION_RATES,
  OVERTIME_MULTIPLIER,
} from '../../lib/paystub.js'
import { getScheduledShiftForDate } from '../../hooks/useClientShift.js'
import { shiftAdjustmentKey, statutoryHolidayNote } from '../../lib/shiftAdjustments.js'
import { punchState } from '../../components/ClockInCard.jsx'

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['Divjit', 'Sukhi', 'Ali', 'Maria', 'Jaspreet', 'Omar', 'Priya', 'Kevin', 'Fatima', 'Marcus', 'Simran', 'Dmitri', 'Aisha', 'Tyler', 'Gurleen', 'Hassan', 'Nina', 'Paulo', 'Harman', 'Grace']
const LAST = ['Singh', 'Khan', 'Patel', 'Nguyen', 'Gill', 'Brar', 'Silva', 'Okafor', 'Kaur', 'Sandhu', 'Ali', 'Chen', 'Dhillon', 'Reyes', 'Bassi', 'Ivanov', 'Mensah', 'Costa', 'Grewal', 'Wong']
const SITE_NAMES = ['800 Bathurst', 'Yorkdale North Tower', 'Harbourfront Plaza', 'Liberty Village Lofts', 'Scarborough Depot', 'Union Station East', 'Mississauga Gateway', 'Etobicoke Business Park', 'Vaughan Metro Centre', 'North York Medical', 'Danforth Commons', 'King West Studios', 'Brampton Logistics Hub', 'Leslieville Yards', 'Downsview Hangar']

const HOUR_PATTERNS = [
  // company default: weekdays 11–20, Sat 10–17, Sun closed
  { mon: { start: '11:00', end: '20:00' }, tue: { start: '11:00', end: '20:00' }, wed: { start: '11:00', end: '20:00' }, thu: { start: '11:00', end: '20:00' }, fri: { start: '11:00', end: '20:00' }, sat: { start: '10:00', end: '17:00' }, sun: null },
  // office: 9–17 weekdays only
  { mon: { start: '09:00', end: '17:00' }, tue: { start: '09:00', end: '17:00' }, wed: { start: '09:00', end: '17:00' }, thu: { start: '09:00', end: '17:00' }, fri: { start: '09:00', end: '17:00' }, sat: null, sun: null },
  // long days, 7 days
  { mon: { start: '08:00', end: '20:00' }, tue: { start: '08:00', end: '20:00' }, wed: { start: '08:00', end: '20:00' }, thu: { start: '08:00', end: '20:00' }, fri: { start: '08:00', end: '20:00' }, sat: { start: '08:00', end: '20:00' }, sun: { start: '08:00', end: '20:00' } },
  // overnight patrol: 20:00 → 06:00 next day
  { mon: { start: '20:00', end: '06:00' }, tue: { start: '20:00', end: '06:00' }, wed: { start: '20:00', end: '06:00' }, thu: { start: '20:00', end: '06:00' }, fri: { start: '20:00', end: '06:00' }, sat: { start: '20:00', end: '06:00' }, sun: null },
]

const pad = (n) => String(n).padStart(2, '0')
const localDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function atTime(dateStr, hhmm, offsetMinutes = 0) {
  const [h, m] = hhmm.split(':').map(Number)
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d, h, m + offsetMinutes, 0, 0)
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------
export function generateScaleData(seed = 42, { days = 14, guardCount = 40, siteCount = 15 } = {}) {
  const rand = mulberry32(seed)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1))

  const sites = Array.from({ length: siteCount }, (_, i) => ({
    id: `site-${i + 1}`,
    name: SITE_NAMES[i % SITE_NAMES.length],
    address: `${100 + i * 37} Example St`,
    latitude: i % 5 === 4 ? null : 43.6 + i * 0.01, // every 5th site missing GPS
    longitude: i % 5 === 4 ? null : -79.4 - i * 0.01,
    geofence_radius_m: [120, 150, 100][i % 3],
    patrol_interval_minutes: [60, 90, 120][i % 3],
    operating_hours: HOUR_PATTERNS[i % HOUR_PATTERNS.length],
  }))

  // 5–10 checkpoints per site: 1 clock-in, 1 clock-out, rest patrol.
  const checkpointsBySite = {}
  for (const site of sites) {
    const count = int(5, 10)
    checkpointsBySite[site.id] = Array.from({ length: count }, (_, j) => ({
      id: `${site.id}-cp-${j + 1}`,
      name: j === 0 ? 'Clock In' : j === 1 ? 'Clock Out' : `Checkpoint ${j - 1}`,
      checkpoint_role: j === 0 ? 'shift_clock_in' : j === 1 ? 'shift_clock_out' : 'patrol',
    }))
  }

  const guards = Array.from({ length: guardCount }, (_, i) => ({
    id: `guard-${i + 1}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}${i >= FIRST.length * LAST.length ? ` ${i}` : ''}`,
    site_id: sites[i % siteCount].id,
    hourly_rate: [18.5, 19.55, 21, 22.25, 24][i % 5],
  }))

  // Period: `days` days ending yesterday (so every shift can be complete).
  const end = new Date()
  end.setDate(end.getDate() - 1)
  const dates = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    dates.push(localDateStr(d))
  }

  const scansBySite = Object.fromEntries(sites.map((s) => [s.id, []]))
  const adjustmentsBySite = Object.fromEntries(sites.map((s) => [s.id, {}]))
  const alerts = []
  const scenarioCounts = { normal: 0, late: 0, forgot_out: 0, early_out: 0, no_show: 0, stat_holiday: 0, admin_adjusted: 0, day_off: 0, closed: 0 }

  for (const guard of guards) {
    const site = sites.find((s) => s.id === guard.site_id)
    const cps = checkpointsBySite[site.id]
    const clockIn = cps[0]
    const clockOut = cps[1]
    const patrols = cps.slice(2)

    for (const date of dates) {
      const sched = getScheduledShiftForDate(date, site.operating_hours)
      if (sched.isClosed) {
        scenarioCounts.closed += 1
        continue
      }
      // Guards work ~5 of 7 open days.
      if ((parseInt(guard.id.split('-')[1], 10) + new Date(`${date}T12:00:00`).getDay()) % 7 >= 5) {
        scenarioCounts.day_off += 1
        continue
      }

      const roll = rand()
      const overnight = sched.end < sched.start
      const endDate = overnight
        ? localDateStr(new Date(atTime(date, '12:00').getTime() + 86400000))
        : date
      const scans = scansBySite[site.id]
      const pushScan = (checkpoint, when, note = null) =>
        scans.push({
          id: `scan-${scans.length + 1}-${site.id}`,
          guard_id: guard.id,
          checkpoint_id: checkpoint.id,
          scanned_at: when.toISOString(),
          status: 'pass',
          approval_note: note,
        })

      const patrolLoop = (inAt, outAt) => {
        const interval = site.patrol_interval_minutes
        let t = new Date(inAt.getTime() + int(10, 30) * 60000)
        while (t < outAt) {
          pushScan(pick(patrols.length ? patrols : [clockIn]), t)
          t = new Date(t.getTime() + (interval - int(0, 20)) * 60000)
        }
      }

      if (roll < 0.04) {
        // No-show: nothing recorded, alert raised.
        scenarioCounts.no_show += 1
        alerts.push({ type: 'no_show', guard: guard.name, site: site.name, date, message: `${guard.name} did not clock in — shift at ${site.name} started ${sched.start}.` })
      } else if (roll < 0.08) {
        // Statutory holiday credit (admin adjustment row).
        scenarioCounts.stat_holiday += 1
        adjustmentsBySite[site.id][shiftAdjustmentKey(guard.id, date)] = {
          guard_id: guard.id,
          shift_date: date,
          clock_in_at: atTime(date, sched.start).toISOString(),
          clock_out_at: atTime(endDate, sched.end).toISOString(),
          note: statutoryHolidayNote('Test Holiday'),
        }
      } else if (roll < 0.11) {
        // Admin corrected the times after the fact.
        scenarioCounts.admin_adjusted += 1
        const inAt = atTime(date, sched.start, -8)
        const outAt = atTime(endDate, sched.end, 4)
        pushScan(clockIn, atTime(date, sched.start, int(25, 60))) // bad raw punch
        adjustmentsBySite[site.id][shiftAdjustmentKey(guard.id, date)] = {
          guard_id: guard.id,
          shift_date: date,
          clock_in_at: inAt.toISOString(),
          clock_out_at: outAt.toISOString(),
          note: 'Corrected by office',
        }
      } else if (roll < 0.19) {
        // Late clock-in (alert) + normal out.
        scenarioCounts.late += 1
        const inAt = atTime(date, sched.start, int(12, 45))
        const outAt = atTime(endDate, sched.end, int(-5, 10))
        pushScan(clockIn, inAt)
        patrolLoop(inAt, outAt)
        pushScan(clockOut, outAt)
        alerts.push({ type: 'late', guard: guard.name, site: site.name, date, message: `${guard.name} clocked in ${Math.round((inAt - atTime(date, sched.start)) / 60000)} min late at ${site.name}.` })
      } else if (roll < 0.25) {
        // Forgot to clock out → auto-end at scheduled end (legacy path).
        scenarioCounts.forgot_out += 1
        const inAt = atTime(date, sched.start, int(-10, 5))
        pushScan(clockIn, inAt)
        patrolLoop(inAt, atTime(endDate, sched.end, -30))
      } else if (roll < 0.3) {
        // Early clock-out with a typed reason.
        scenarioCounts.early_out += 1
        const inAt = atTime(date, sched.start, int(-8, 5))
        const outAt = atTime(endDate, sched.end, -int(30, 90))
        pushScan(clockIn, inAt)
        patrolLoop(inAt, outAt)
        pushScan(clockOut, outAt, 'Family emergency — cleared with supervisor')
      } else {
        // Normal day, small jitter both ends; occasional stale-patrol gap.
        scenarioCounts.normal += 1
        const inAt = atTime(date, sched.start, int(-12, 8))
        const outAt = atTime(endDate, sched.end, int(-8, 12))
        pushScan(clockIn, inAt)
        if (rand() < 0.06) {
          // one long gap → stale patrol alert
          pushScan(pick(patrols.length ? patrols : [clockIn]), new Date(inAt.getTime() + 20 * 60000))
          alerts.push({ type: 'stale_patrol', guard: guard.name, site: site.name, date, message: `${guard.name} at ${site.name}: no checkpoint scan for over ${site.patrol_interval_minutes} min.` })
        } else {
          patrolLoop(inAt, outAt)
        }
        pushScan(clockOut, outAt)
      }
    }
  }

  return { sites, guards, checkpointsBySite, scansBySite, adjustmentsBySite, alerts, dates, scenarioCounts }
}

// ---------------------------------------------------------------------------
// Run the REAL pipeline + invariant checks
// ---------------------------------------------------------------------------
export function runScalePipeline(data) {
  const t0 = performance.now()
  const perSite = data.sites.map((site) => {
    const guards = data.guards.filter((g) => g.site_id === site.id)
    const report = computeGuardHoursReport({
      scans: data.scansBySite[site.id],
      checkpoints: data.checkpointsBySite[site.id],
      guards,
      dates: data.dates,
      adjustmentsByKey: data.adjustmentsBySite[site.id],
      operatingHours: site.operating_hours,
    })
    const payRows = applyRounding(report.rows, 'quarter')
    const weekly = computeWeeklyPayroll(payRows)
    return { site, report, payRows, weekly }
  })
  const allRows = perSite.flatMap((p) => p.payRows)
  const allWeekly = perSite.flatMap((p) => p.weekly)
  const computeMs = performance.now() - t0

  // Paystubs for every guard over the full period.
  const t1 = performance.now()
  const stubs = data.guards.map((guard) => {
    const weekly = perSite.find((p) => p.site.id === guard.site_id)?.weekly || []
    const totals = periodTotalsForGuard(weekly, guard.id)
    const stub = computePaystub({ totals, rate: guard.hourly_rate, rates: DEFAULT_DEDUCTION_RATES, otherFees: 0 })
    return { guard, totals, stub }
  })
  const paystubMs = performance.now() - t1

  return { perSite, allRows, allWeekly, stubs, computeMs, paystubMs }
}

export function runScaleChecks(data, pipeline) {
  const { allRows, allWeekly, stubs, perSite } = pipeline
  const checks = []
  const add = (name, pass, detail = '') => checks.push({ name, pass, detail })
  const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps

  // --- Hours rows -----------------------------------------------------------
  add('Every shift row has non-negative paid minutes', allRows.every((r) => r.payMinutes >= 0), `${allRows.length} rows`)
  add(
    'Clock-out is always after clock-in',
    allRows.every((r) => new Date(r.payClockOut) > new Date(r.payClockIn) || r.isStatutoryHoliday),
  )
  add(
    '15-min rounding never moves a punch more than 7.5 min',
    allRows.every(
      (r) =>
        r.isStatutoryHoliday ||
        (Math.abs(new Date(r.payClockIn) - new Date(r.clockIn)) <= 450000 &&
          Math.abs(new Date(r.payClockOut) - new Date(r.clockOut)) <= 450000),
    ),
  )
  add(
    'No shift longer than 16h (overnight windows handled)',
    allRows.every((r) => r.payMinutes <= 16 * 60),
    `max ${Math.max(...allRows.map((r) => r.payMinutes))} min`,
  )

  // --- Weekly OT split ------------------------------------------------------
  add(
    'Weekly regular capped at 40h and regular+OT = worked',
    allWeekly.every(
      (w) =>
        w.regularMinutes <= OVERTIME_WEEKLY_MINUTES &&
        w.regularMinutes + w.overtimeMinutes === w.workedMinutes &&
        w.overtimeMinutes >= 0,
    ),
    `${allWeekly.length} guard-weeks, ${allWeekly.filter((w) => w.overtimeMinutes > 0).length} with OT`,
  )
  add(
    'Stat holiday minutes never count toward OT',
    allWeekly.every((w) => w.totalMinutes === w.workedMinutes + w.statMinutes),
  )
  const rowMinutes = allRows.reduce((s, r) => s + r.payMinutes, 0)
  const weeklyMinutes = allWeekly.reduce((s, w) => s + w.workedMinutes + w.statMinutes, 0)
  add('Sum of daily rows equals sum of weekly summaries', rowMinutes === weeklyMinutes, `${(rowMinutes / 60).toFixed(1)}h both sides`)

  // --- Paystub math ---------------------------------------------------------
  add(
    'Gross = Σ(hours × rate) with OT ×1.5 on every stub',
    stubs.every(({ totals, stub, guard }) => {
      const expected =
        (totals.regularMinutes / 60) * guard.hourly_rate +
        (totals.overtimeMinutes / 60) * guard.hourly_rate * OVERTIME_MULTIPLIER +
        (totals.statMinutes / 60) * guard.hourly_rate
      return near(stub.gross, expected)
    }),
    `${stubs.length} paystubs`,
  )
  add(
    'Net = Gross − (Gross×EI%) − ((Gross−exemption)×CPP%) on every stub',
    stubs.every(({ stub }) => {
      const exemption = cppExemptionForPeriod(DEFAULT_DEDUCTION_RATES.cppAnnualExemption, 14)
      const ei = stub.gross * (DEFAULT_DEDUCTION_RATES.eiPct / 100)
      const cpp = Math.max(0, stub.gross - exemption) * (DEFAULT_DEDUCTION_RATES.cppPct / 100)
      return near(stub.net, stub.gross - ei - cpp)
    }),
  )
  add('No negative net pay', stubs.every(({ stub }) => stub.net >= 0))
  add(
    'Period totals match the weekly rows they came from',
    stubs.every(({ guard, totals }) => {
      const weekly = perSite.find((p) => p.site.id === guard.site_id)?.weekly || []
      const worked = weekly.filter((w) => w.guardId === guard.id).reduce((s, w) => s + w.regularMinutes + w.overtimeMinutes, 0)
      return worked === totals.regularMinutes + totals.overtimeMinutes
    }),
  )

  // --- Accounting CSV -------------------------------------------------------
  const csv = buildAccountingCsv(allWeekly)
  add('Accounting CSV has one row per guard-week + header', csv.length === allWeekly.length + 1)

  // --- Clock traffic light (pure logic) --------------------------------------
  const win = { start: new Date('2026-07-11T10:00:00'), end: new Date('2026-07-11T17:00:00') }
  const at = (h, m) => new Date(2026, 6, 11, h, m)
  add(
    'Clock-in traffic light: grey→yellow→green→red→shift-over',
    punchState('in', win, at(9, 40)).tone === 'grey' &&
      punchState('in', win, at(9, 40)).allowed === false &&
      punchState('in', win, at(9, 50)).tone === 'yellow' &&
      punchState('in', win, at(10, 5)).tone === 'green' &&
      punchState('in', win, at(10, 30)).tone === 'red' &&
      punchState('in', win, at(17, 30)).shiftOver === true &&
      punchState('in', win, at(17, 30)).allowed === false,
  )
  add(
    'Clock-out traffic light: green on shift, red when overdue, always allowed',
    punchState('out', win, at(12, 0)).tone === 'green' &&
      punchState('out', win, at(12, 0)).allowed === true &&
      punchState('out', win, at(17, 20)).tone === 'red' &&
      punchState('out', win, at(17, 20)).allowed === true,
  )
  const nightWin = { start: new Date('2026-07-11T20:00:00'), end: new Date('2026-07-12T06:00:00') }
  add(
    'Overnight shift: late at 23:00, shift-over next morning',
    punchState('in', nightWin, new Date('2026-07-11T23:00:00')).tone === 'red' &&
      punchState('in', nightWin, new Date('2026-07-12T06:30:00')).shiftOver === true &&
      punchState('in', nightWin, new Date('2026-07-11T19:50:00')).tone === 'yellow',
  )

  // --- Per-day derivation ----------------------------------------------------
  const sample = data.sites[0]
  const sampleGuard = data.guards.find((g) => g.site_id === sample.id)
  const sampleDay = data.dates.find((d) => {
    const shift = computeGuardShiftForDay(
      data.scansBySite[sample.id].filter((s) => s.guard_id === sampleGuard.id),
      data.checkpointsBySite[sample.id],
      { date: d, adjustment: data.adjustmentsBySite[sample.id][shiftAdjustmentKey(sampleGuard.id, d)], operatingHours: sample.operating_hours },
    )
    return Boolean(shift)
  })
  add('computeGuardShiftForDay resolves a worked day for a sample guard', Boolean(sampleDay), sampleDay || 'none found')

  const rounds = countPatrolRounds(
    data.scansBySite[sample.id],
    data.checkpointsBySite[sample.id],
    { date: data.dates[0], shiftStart: '08:00', shiftEnd: '20:00' },
  )
  add('Patrol rounds counter returns sane numbers', rounds.rounds >= 0 && rounds.patrolScanCount >= 0)

  // --- Early clock-out notes survive the pipeline -----------------------------
  const notedRows = perSite.flatMap((p) => p.report.rows).filter((r) => r.clockOutNote)
  const generatedNotes = Object.values(data.scansBySite).flat().filter((s) => s.approval_note && s.checkpoint_id.includes('cp-2')).length
  add('Early clock-out reasons flow through to admin rows', notedRows.length > 0 && notedRows.length <= generatedNotes, `${notedRows.length} noted rows (${generatedNotes} noted punches)`)

  return checks
}
