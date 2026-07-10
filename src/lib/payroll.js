import { supabase } from './supabase.js'

export const OVERTIME_WEEKLY_MINUTES = 40 * 60
export const ROUNDING_MODES = [
  { id: 'exact', label: 'Exact' },
  { id: 'quarter', label: '15-min rounding' },
]

/** Nearest-quarter rounding (7.5-minute split) — the labor-safe default. */
export function roundToQuarterHour(date) {
  const d = new Date(date)
  const mins = d.getMinutes() + d.getSeconds() / 60
  const rounded = Math.round(mins / 15) * 15
  d.setMinutes(0, 0, 0)
  d.setMinutes(rounded)
  return d
}

/**
 * Apply payroll rounding to hours-report rows. Statutory holidays keep their
 * fixed credited minutes; worked shifts get nearest-15 on both punches.
 * Raw punches are preserved — only display/payroll fields change.
 */
export function applyRounding(rows, mode) {
  if (mode !== 'quarter') {
    return rows.map((row) => ({ ...row, payClockIn: row.clockIn, payClockOut: row.clockOut, payMinutes: row.durationMinutes }))
  }
  return rows.map((row) => {
    if (row.isStatutoryHoliday) {
      return { ...row, payClockIn: row.clockIn, payClockOut: row.clockOut, payMinutes: row.durationMinutes }
    }
    const payClockIn = roundToQuarterHour(row.clockIn)
    const payClockOut = roundToQuarterHour(row.clockOut)
    return {
      ...row,
      payClockIn,
      payClockOut,
      payMinutes: Math.max(0, Math.round((payClockOut - payClockIn) / 60000)),
    }
  })
}

function weekStartOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

export function formatMinutes(mins) {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

/**
 * Weekly regular/overtime split per guard. Statutory-holiday minutes are
 * credited separately and never count toward the overtime threshold.
 */
export function computeWeeklyPayroll(payRows) {
  const weeks = new Map() // `${guardId}|${weekStart}` -> summary
  for (const row of payRows) {
    const weekStart = weekStartOf(row.date)
    const key = `${row.guardId}|${weekStart}`
    if (!weeks.has(key)) {
      weeks.set(key, {
        guardId: row.guardId,
        guardName: row.guardName,
        weekStart,
        workedMinutes: 0,
        statMinutes: 0,
        days: 0,
      })
    }
    const w = weeks.get(key)
    if (row.isStatutoryHoliday) w.statMinutes += row.payMinutes
    else w.workedMinutes += row.payMinutes
    w.days += 1
  }

  return [...weeks.values()]
    .map((w) => {
      const regular = Math.min(w.workedMinutes, OVERTIME_WEEKLY_MINUTES)
      const overtime = Math.max(0, w.workedMinutes - OVERTIME_WEEKLY_MINUTES)
      return { ...w, regularMinutes: regular, overtimeMinutes: overtime, totalMinutes: w.workedMinutes + w.statMinutes }
    })
    .sort((a, b) => a.guardName.localeCompare(b.guardName) || a.weekStart.localeCompare(b.weekStart))
}

export function overtimeByGuard(weeklyRows) {
  const totals = {}
  for (const w of weeklyRows) {
    totals[w.guardId] = (totals[w.guardId] || 0) + w.overtimeMinutes
  }
  return totals
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Accounting export: one row per guard per week, regular/OT/stat split. */
export function buildAccountingCsv(weeklyRows, approvalsByKey = {}) {
  const toDecimal = (mins) => (mins / 60).toFixed(2)
  return [
    ['Guard', 'Week starting', 'Days', 'Regular hours', 'Overtime hours', 'Stat holiday hours', 'Total hours', 'Timesheet'],
    ...weeklyRows.map((w) => [
      w.guardName,
      w.weekStart,
      w.days,
      toDecimal(w.regularMinutes),
      toDecimal(w.overtimeMinutes),
      toDecimal(w.statMinutes),
      toDecimal(w.totalMinutes),
      approvalsByKey[`${w.guardId}|${w.weekStart}`] ? 'Approved by guard' : 'Not approved',
    ]),
  ]
}

// ---------------------------------------------------------------------------
// Timesheet approvals (guard sign-off)
// ---------------------------------------------------------------------------

export async function fetchApprovalsForSite(siteId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('timesheet_approvals')
    .select('guard_id, week_start, hours_snapshot, approved_at')
    .eq('site_id', siteId)
    .gte('week_start', fromDate)
    .lte('week_start', toDate)
  if (error) throw error
  return Object.fromEntries((data || []).map((a) => [`${a.guard_id}|${a.week_start}`, a]))
}

export async function fetchMyApproval(guardId, weekStart) {
  const { data, error } = await supabase
    .from('timesheet_approvals')
    .select('*')
    .eq('guard_id', guardId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function approveTimesheet({ guardId, siteId, weekStart, hours }) {
  const { data, error } = await supabase
    .from('timesheet_approvals')
    .insert({ guard_id: guardId, site_id: siteId, week_start: weekStart, hours_snapshot: hours })
    .select()
  if (error) throw error
  return data?.[0]
}
