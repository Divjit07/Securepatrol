import { getScheduledShiftForDate, shiftBounds } from '../hooks/useClientShift.js'

export function getPatrolCheckpoints(checkpoints = []) {
  return checkpoints.filter((cp) => (cp.checkpoint_role || 'patrol') !== 'shift_clock_out')
}

export function countPatrolRounds(scans = [], checkpoints = []) {
  const roundCps = getPatrolCheckpoints(checkpoints)
  if (!roundCps.length) return { rounds: 0, patrolScanCount: 0, patrolCheckpointCount: 0 }

  const roundIds = new Set(roundCps.map((cp) => cp.id))
  const roundScans = scans.filter((s) => s.status === 'pass' && roundIds.has(s.checkpoint_id))

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

function scheduledClockOutAt(dateStr, shiftEnd) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [endH, endM] = shiftEnd.split(':').map(Number)
  return new Date(y, m - 1, d, endH, endM, 0, 0)
}

export function fixedShiftHours(dateStr) {
  const schedule = getScheduledShiftForDate(dateStr)
  if (schedule.isClosed) return 0
  return schedule.isSaturday ? 7 : 9
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

export function computeGuardShiftForDay(guardScans, checkpoints, { date, adjustment }) {
  const schedule = getScheduledShiftForDate(date)
  if (schedule.isClosed) return null

  const { start: shiftStart, end: shiftEnd } = schedule
  const passScans = [...guardScans]
    .filter((s) => s.status === 'pass')
    .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))

  if (!passScans.length && !adjustment) return null

  const clockInIds = new Set(
    checkpoints.filter((cp) => cp.checkpoint_role === 'shift_clock_in').map((cp) => cp.id),
  )

  const { start, end } = shiftBounds(date, shiftStart, shiftEnd)
  const inWindow = passScans.filter((s) => {
    const t = new Date(s.scanned_at)
    return t >= start && t <= end
  })

  const clockInScan = inWindow.find((s) => clockInIds.has(s.checkpoint_id))

  if (!clockInScan && !adjustment) return null

  const defaultClockIn = scheduledClockInAt(date, shiftStart)
  const defaultClockOut = scheduledClockOutAt(date, shiftEnd)
  const signedInAt = clockInScan ? new Date(clockInScan.scanned_at) : defaultClockIn

  let clockInAt = defaultClockIn
  let clockOutAt = defaultClockOut
  let hoursWorked = fixedShiftHours(date)
  let isAdjusted = false

  if (adjustment) {
    clockInAt = new Date(adjustment.clock_in_at)
    clockOutAt = new Date(adjustment.clock_out_at)
    hoursWorked = hoursFromShiftTimes(clockInAt, clockOutAt)
    isAdjusted = true
  }

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const onShift = date === todayStr && now < clockOutAt

  return {
    clockInAt,
    clockOutAt,
    signedInAt,
    onShift,
    isAdjusted,
    clockInCheckpoint: clockInScan
      ? checkpoints.find((cp) => cp.id === clockInScan.checkpoint_id)?.name
      : 'Manual entry',
    hoursWorked,
    scanCount: inWindow.length,
  }
}

export function computeGuardHoursReport({
  scans = [],
  checkpoints = [],
  guards = [],
  dates = [],
  adjustmentsByKey = {},
}) {
  const rows = []

  for (const date of dates) {
    for (const guard of guards) {
      const guardScans = scans.filter((s) => s.guard_id === guard.id)
      const adjustment = adjustmentsByKey[`${guard.id}-${date}`]
      const dayShift = computeGuardShiftForDay(guardScans, checkpoints, { date, adjustment })

      if (!dayShift) continue

      rows.push({
        date,
        guardId: guard.id,
        guardName: guard.name,
        clockIn: dayShift.clockInAt,
        clockOut: dayShift.clockOutAt,
        hoursWorked: dayShift.hoursWorked,
        durationMinutes: durationFromShiftTimes(dayShift.clockInAt, dayShift.clockOutAt).totalMinutes,
        hoursLabel: formatShiftDuration(dayShift.clockInAt, dayShift.clockOutAt),
        clockInCheckpoint: dayShift.clockInCheckpoint,
        isAdjusted: dayShift.isAdjusted,
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
    dates.push(d.toISOString().slice(0, 10))
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
