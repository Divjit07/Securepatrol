import { getScheduledShiftForDate, shiftBounds } from '../hooks/useClientShift.js'

export function getPatrolCheckpoints(checkpoints = []) {
  return checkpoints.filter((cp) => (cp.checkpoint_role || 'patrol') === 'patrol')
}

export function countPatrolRounds(scans = [], checkpoints = []) {
  const patrolCps = getPatrolCheckpoints(checkpoints)
  if (!patrolCps.length) return { rounds: 0, patrolScanCount: 0, patrolCheckpointCount: 0 }

  const patrolIds = new Set(patrolCps.map((cp) => cp.id))
  const patrolScans = scans.filter((s) => s.status === 'pass' && patrolIds.has(s.checkpoint_id))

  return {
    rounds: Math.floor(patrolScans.length / patrolCps.length),
    patrolScanCount: patrolScans.length,
    patrolCheckpointCount: patrolCps.length,
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
  return schedule.isSaturday ? 6 : 9
}

export function formatShiftTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function computeGuardShiftForDay(guardScans, checkpoints, { date }) {
  const schedule = getScheduledShiftForDate(date)
  if (schedule.isClosed) return null

  const { start: shiftStart, end: shiftEnd } = schedule
  const passScans = [...guardScans]
    .filter((s) => s.status === 'pass')
    .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))

  if (!passScans.length) return null

  const clockInIds = new Set(
    checkpoints.filter((cp) => cp.checkpoint_role === 'shift_clock_in').map((cp) => cp.id),
  )

  const { start, end } = shiftBounds(date, shiftStart, shiftEnd)
  const inWindow = passScans.filter((s) => {
    const t = new Date(s.scanned_at)
    return t >= start && t <= end
  })

  if (!inWindow.length) return null

  const clockInScan = inWindow.find((s) => clockInIds.has(s.checkpoint_id))
  if (!clockInScan) return null

  const clockInAt = scheduledClockInAt(date, shiftStart)
  const clockOutAt = scheduledClockOutAt(date, shiftEnd)
  const signedInAt = new Date(clockInScan.scanned_at)
  const hoursWorked = fixedShiftHours(date)
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const onShift = date === todayStr && now < clockOutAt

  return {
    clockInAt,
    clockOutAt,
    signedInAt,
    onShift,
    clockInCheckpoint: checkpoints.find((cp) => cp.id === clockInScan.checkpoint_id)?.name,
    hoursWorked,
    scanCount: inWindow.length,
  }
}

export function computeGuardHoursReport({
  scans = [],
  checkpoints = [],
  guards = [],
  dates = [],
}) {
  const rows = []

  for (const date of dates) {
    for (const guard of guards) {
      const guardScans = scans.filter((s) => s.guard_id === guard.id)
      const dayShift = computeGuardShiftForDay(guardScans, checkpoints, { date })

      if (!dayShift) continue

      rows.push({
        date,
        guardId: guard.id,
        guardName: guard.name,
        clockIn: dayShift.clockInAt,
        clockOut: dayShift.clockOutAt,
        hoursWorked: dayShift.hoursWorked,
        clockInCheckpoint: dayShift.clockInCheckpoint,
      })
    }
  }

  const totalByGuard = rows.reduce((acc, row) => {
    acc[row.guardId] = acc[row.guardId] || { name: row.guardName, hours: 0, days: 0 }
    acc[row.guardId].hours += row.hoursWorked
    acc[row.guardId].days += 1
    return acc
  }, {})

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
