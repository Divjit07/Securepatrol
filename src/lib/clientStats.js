import { getScheduledShiftForDate, shiftBounds, shiftScanBounds } from '../hooks/useClientShift.js'
import { isStatutoryHolidayAdjustment, clientStatutoryHolidayLabel } from './shiftAdjustments.js'

export function getPatrolCheckpoints(checkpoints = []) {
  return checkpoints.filter((cp) => (cp.checkpoint_role || 'patrol') !== 'shift_clock_out')
}

export function countPatrolRounds(scans = [], checkpoints = [], { date, shiftStart, shiftEnd } = {}) {
  const roundCps = getPatrolCheckpoints(checkpoints)
  if (!roundCps.length) return { rounds: 0, patrolScanCount: 0, patrolCheckpointCount: 0 }

  const roundIds = new Set(roundCps.map((cp) => cp.id))
  let roundScans = scans.filter((s) => s.status === 'pass' && roundIds.has(s.checkpoint_id))

  if (date && shiftStart && shiftEnd) {
    const { start, end } = shiftBounds(date, shiftStart, shiftEnd)
    roundScans = roundScans.filter((s) => {
      const t = new Date(s.scanned_at)
      return t >= start && t <= end
    })
  }

  return {
    rounds: Math.floor(roundScans.length / roundCps.length),
    patrolScanCount: roundScans.length,
    patrolCheckpointCount: roundCps.length,
  }
}

function scheduledClockInAt(dateStr, shiftStart) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [startH, startM] = shiftStart.split(':').map(Number)
  return new Date(y, m - 1, d, startH, startM, 0, 0)
}

function scheduledClockOutAt(dateStr, shiftEnd, shiftStart = null) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [endH, endM] = shiftEnd.split(':').map(Number)
  const out = new Date(y, m - 1, d, endH, endM, 0, 0)
  // Overnight shift: the scheduled end lands on the next day.
  if (shiftStart && shiftEnd <= shiftStart) out.setDate(out.getDate() + 1)
  return out
}

export function fixedShiftHours(dateStr, operatingHours) {
  const schedule = getScheduledShiftForDate(dateStr, operatingHours)
  if (schedule.isClosed) return 0
  const [startH, startM] = schedule.start.split(':').map(Number)
  const [endH, endM] = schedule.end.split(':').map(Number)
  // +1440 % 1440 keeps overnight shifts (end before start) positive.
  const minutes = (endH * 60 + endM - startH * 60 - startM + 1440) % 1440
  return Math.round((minutes / 60) * 100) / 100
}

export function formatShiftTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function hoursFromShiftTimes(clockInAt, clockOutAt) {
  const ms = clockOutAt - clockInAt
  if (ms <= 0) return 0
  return Math.round((ms / 3600000) * 100) / 100
}

export function durationFromShiftTimes(clockInAt, clockOutAt) {
  const ms = new Date(clockOutAt) - new Date(clockInAt)
  if (ms <= 0) return { hours: 0, minutes: 0, totalMinutes: 0 }

  const totalMinutes = Math.round(ms / 60000)
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    totalMinutes,
  }
}

export function formatDurationFromMinutes(totalMinutes) {
  if (totalMinutes <= 0) return '0 mins'

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes} mins`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes} mins`
}

export function formatShiftDuration(clockInAt, clockOutAt) {
  return formatDurationFromMinutes(durationFromShiftTimes(clockInAt, clockOutAt).totalMinutes)
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Derive one day's pay window from Face ID / NFC clock punches.
 * Clock-in and clock-out punches are the source of truth. Site operating
 * hours (or an optional published roster shift) only define the search
 * window and the legacy auto-end when someone clocks in but never out.
 * Admin adjustments always win.
 */
export function computeGuardShiftForDay(guardScans, checkpoints, { date, adjustment, operatingHours, publishedShift }) {
  const schedule = getScheduledShiftForDate(date, operatingHours)

  let shiftStart = schedule.start
  let shiftEnd = schedule.end
  if (publishedShift?.starts_at && publishedShift?.ends_at) {
    const ps = new Date(publishedShift.starts_at)
    const pe = new Date(publishedShift.ends_at)
    shiftStart = `${String(ps.getHours()).padStart(2, '0')}:${String(ps.getMinutes()).padStart(2, '0')}`
    shiftEnd = `${String(pe.getHours()).padStart(2, '0')}:${String(pe.getMinutes()).padStart(2, '0')}`
  } else if (schedule.isClosed) {
    return null
  }

  const passScans = [...guardScans]
    .filter((s) => s.status === 'pass')
    .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))

  if (!passScans.length && !adjustment) return null

  const clockInIds = new Set(
    checkpoints.filter((cp) => cp.checkpoint_role === 'shift_clock_in').map((cp) => cp.id),
  )
  const clockOutIds = new Set(
    checkpoints.filter((cp) => cp.checkpoint_role === 'shift_clock_out').map((cp) => cp.id),
  )

  // Clock-in: from midnight through scheduled end (early sign-in allowed).
  const { start: scanStart, end: scheduledEnd } = shiftScanBounds(date, shiftStart, shiftEnd)
  const { start: shiftStartBound } = shiftBounds(date, shiftStart, shiftEnd)
  // Clock-out may run past the scheduled end (overtime) — search to end of the
  // calendar day, or 6h past the scheduled end for overnight/late shifts.
  const [y, m, d] = date.split('-').map(Number)
  const calendarDayEnd = new Date(y, m - 1, d, 23, 59, 59, 999)
  const dayEnd = new Date(Math.max(calendarDayEnd.getTime(), scheduledEnd.getTime() + 6 * 3600000))

  const clockInScan = passScans.find((s) => {
    const t = new Date(s.scanned_at)
    return t >= scanStart && t <= dayEnd && clockInIds.has(s.checkpoint_id)
  })

  if (!clockInScan && !adjustment) return null

  const defaultClockIn = scheduledClockInAt(date, shiftStart)
  const defaultClockOut = scheduledClockOutAt(date, shiftEnd, shiftStart)
  const signedInAt = clockInScan ? new Date(clockInScan.scanned_at) : defaultClockIn

  const clockOutScan = clockInScan
    ? passScans.find((s) => {
        const t = new Date(s.scanned_at)
        return t > signedInAt && t <= dayEnd && clockOutIds.has(s.checkpoint_id)
      })
    : null

  let clockInAt = signedInAt
  // Punch-to-punch when both exist; otherwise legacy auto-end at scheduled end.
  let clockOutAt = clockOutScan ? new Date(clockOutScan.scanned_at) : defaultClockOut
  let hoursWorked = hoursFromShiftTimes(clockInAt, clockOutAt)
  let isAdjusted = false
  const arrivedEarly = Boolean(clockInScan && signedInAt < defaultClockIn)

  const inWindow = passScans.filter((s) => {
    const t = new Date(s.scanned_at)
    return t >= shiftStartBound && t <= scheduledEnd
  })

  // Scheduled shift length for THIS site/day: the published roster shift when
  // one exists (12–6 = 6h), otherwise the site's own operating hours. Statutory
  // holidays credit this — never a shared company-default template.
  const scheduledShiftMinutes =
    publishedShift?.starts_at && publishedShift?.ends_at
      ? Math.max(0, Math.round((new Date(publishedShift.ends_at) - new Date(publishedShift.starts_at)) / 60000))
      : Math.round(fixedShiftHours(date, operatingHours) * 60)

  if (adjustment) {
    clockInAt = new Date(adjustment.clock_in_at)
    clockOutAt = new Date(adjustment.clock_out_at)
    hoursWorked = isStatutoryHolidayAdjustment(adjustment)
      ? scheduledShiftMinutes / 60
      : hoursFromShiftTimes(clockInAt, clockOutAt)
    isAdjusted = true
  }

  const now = new Date()
  const onShift =
    date === localDateStr(now) && !clockOutScan && !adjustment && now < defaultClockOut

  return {
    clockInAt,
    clockOutAt,
    signedInAt,
    onShift,
    isAdjusted,
    isStatutoryHoliday: isStatutoryHolidayAdjustment(adjustment),
    statutoryHolidayLabel: adjustment ? clientStatutoryHolidayLabel(adjustment.note) : null,
    arrivedEarly,
    clockInCheckpoint: clockInScan
      ? checkpoints.find((cp) => cp.id === clockInScan.checkpoint_id)?.name
      : 'Manual entry',
    hoursWorked,
    scheduledShiftMinutes,
    scanCount: inWindow.length,
    hasClockOutPunch: Boolean(clockOutScan) || isAdjusted,
    // Guard's early clock-out reason (typed at punch time, stored on the scan).
    clockOutNote: clockOutScan?.approval_note || null,
  }
}

export function computeGuardHoursReport({
  scans = [],
  checkpoints = [],
  guards = [],
  dates = [],
  adjustmentsByKey = {},
  operatingHours = null,
  publishedShifts = [],
}) {
  const rows = []
  const shiftByGuardDate = new Map()
  for (const s of publishedShifts) {
    if (!s.guard_id || !s.starts_at) continue
    const key = `${s.guard_id}-${localDateStr(new Date(s.starts_at))}`
    const prev = shiftByGuardDate.get(key)
    // Prefer the shift that overlaps most of the local day (first published wins if tie).
    if (!prev) shiftByGuardDate.set(key, s)
  }

  for (const date of dates) {
    for (const guard of guards) {
      const guardScans = scans.filter((s) => s.guard_id === guard.id)
      const adjustment = adjustmentsByKey[`${guard.id}-${date}`]
      const publishedShift = shiftByGuardDate.get(`${guard.id}-${date}`)
      const dayShift = computeGuardShiftForDay(guardScans, checkpoints, {
        date,
        adjustment,
        operatingHours,
        publishedShift,
      })

      if (!dayShift) continue

      const statutoryHoliday = isStatutoryHolidayAdjustment(adjustment)
      const durationMinutes = statutoryHoliday
        ? dayShift.scheduledShiftMinutes
        : durationFromShiftTimes(dayShift.clockInAt, dayShift.clockOutAt).totalMinutes

      rows.push({
        date,
        guardId: guard.id,
        guardName: guard.name,
        clockIn: dayShift.clockInAt,
        clockOut: dayShift.clockOutAt,
        hoursWorked: dayShift.hoursWorked,
        durationMinutes,
        hoursLabel: statutoryHoliday
          ? formatDurationFromMinutes(durationMinutes)
          : formatShiftDuration(dayShift.clockInAt, dayShift.clockOutAt),
        clockInCheckpoint: dayShift.clockInCheckpoint,
        isAdjusted: dayShift.isAdjusted,
        isStatutoryHoliday: dayShift.isStatutoryHoliday,
        statutoryHolidayLabel: dayShift.statutoryHolidayLabel,
        clockOutNote: dayShift.clockOutNote,
      })
    }
  }

  const totalByGuard = rows.reduce((acc, row) => {
    acc[row.guardId] = acc[row.guardId] || { name: row.guardName, hours: 0, totalMinutes: 0, days: 0 }
    acc[row.guardId].hours += row.hoursWorked
    acc[row.guardId].totalMinutes += row.durationMinutes
    acc[row.guardId].days += 1
    return acc
  }, {})

  for (const guardId of Object.keys(totalByGuard)) {
    totalByGuard[guardId].hoursLabel = formatDurationFromMinutes(totalByGuard[guardId].totalMinutes)
  }

  return { rows, totalByGuard }
}

export function dateRangeDays(fromDateStr, toDateStr) {
  const dates = []
  const from = new Date(`${fromDateStr}T12:00:00`)
  const to = new Date(`${toDateStr}T12:00:00`)
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    dates.push(localDateStr(d))
  }
  return dates
}

export function defaultPayPeriodEnd() {
  return new Date().toISOString().slice(0, 10)
}

export function defaultPayPeriodStart() {
  const d = new Date()
  d.setDate(d.getDate() - 13)
  return d.toISOString().slice(0, 10)
}
