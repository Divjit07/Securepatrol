import { shiftBounds } from '../hooks/useClientShift.js'

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

function formatDuration(ms) {
  if (ms <= 0) return '0m'
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function formatHoursDecimal(ms) {
  return Math.round((ms / 3600000) * 100) / 100
}

export function computeGuardShiftForDay(guardScans, checkpoints, { shiftStart, shiftEnd, date }) {
  const passScans = [...guardScans]
    .filter((s) => s.status === 'pass')
    .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))

  if (!passScans.length) return null

  const clockInIds = new Set(
    checkpoints.filter((cp) => cp.checkpoint_role === 'shift_clock_in').map((cp) => cp.id),
  )
  const clockOutIds = new Set(
    checkpoints.filter((cp) => cp.checkpoint_role === 'shift_clock_out').map((cp) => cp.id),
  )

  const { start, end } = shiftBounds(date, shiftStart, shiftEnd)
  const inWindow = passScans.filter((s) => {
    const t = new Date(s.scanned_at)
    return t >= start && t <= end
  })

  if (!inWindow.length) return null

  const clockInScan = inWindow.find((s) => clockInIds.has(s.checkpoint_id))
  if (!clockInScan) return null

  const clockInAt = new Date(clockInScan.scanned_at)
  const clockInCheckpoint = checkpoints.find((cp) => cp.id === clockInScan.checkpoint_id)?.name

  const clockOutScan = [...inWindow]
    .reverse()
    .find((s) => clockOutIds.has(s.checkpoint_id) && new Date(s.scanned_at) > clockInAt)

  if (!clockOutScan) {
    return {
      clockInAt,
      clockOutAt: null,
      clockOutPending: true,
      clockInCheckpoint,
      clockOutCheckpoint: null,
      durationMs: 0,
      durationLabel: 'Awaiting clock-out',
      hoursWorked: 0,
      scanCount: inWindow.length,
    }
  }

  const clockOutAt = new Date(clockOutScan.scanned_at)
  const durationMs = Math.max(0, clockOutAt - clockInAt)

  return {
    clockInAt,
    clockOutAt,
    clockOutPending: false,
    clockInCheckpoint,
    clockOutCheckpoint: checkpoints.find((cp) => cp.id === clockOutScan.checkpoint_id)?.name,
    durationMs,
    durationLabel: formatDuration(durationMs),
    hoursWorked: formatHoursDecimal(durationMs),
    scanCount: inWindow.length,
  }
}

export function computeGuardHoursReport({
  scans = [],
  checkpoints = [],
  guards = [],
  dates = [],
  shift = { start: '11:00', end: '20:00' },
}) {
  const rows = []

  for (const date of dates) {
    for (const guard of guards) {
      const guardScans = scans.filter((s) => s.guard_id === guard.id)
      const dayShift = computeGuardShiftForDay(guardScans, checkpoints, {
        shiftStart: shift.start,
        shiftEnd: shift.end,
        date,
      })

      if (!dayShift || dayShift.clockOutPending) continue

      rows.push({
        date,
        guardId: guard.id,
        guardName: guard.name,
        clockIn: dayShift.clockInAt,
        clockOut: dayShift.clockOutAt,
        hoursWorked: dayShift.hoursWorked,
        durationLabel: dayShift.durationLabel,
        clockInCheckpoint: dayShift.clockInCheckpoint,
        clockOutCheckpoint: dayShift.clockOutCheckpoint,
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

export { formatDuration, formatHoursDecimal }
