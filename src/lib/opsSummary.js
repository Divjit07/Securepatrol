// Ops Summary engine — every number here comes from Supabase queries plus
// deterministic JS. No AI anywhere: this IS the "backend computes and
// verifies facts" layer the future assistant will call as tools; the LLM's
// only future job is rephrasing what this module already proved.
import { supabase } from './supabase.js'

export const SUMMARY_PERIODS = [
  { id: 'today', label: 'Today', days: 1 },
  { id: 'yesterday', label: 'Yesterday', days: 1, offset: 1 },
  { id: 'week', label: 'Last 7 days', days: 7 },
  { id: 'month', label: 'Last 30 days', days: 30 },
]

const LATE_MINUTES = 10
const CLOCK_ROLES = ['shift_clock_in', 'shift_clock_out']

export function periodBounds(periodId, now = new Date()) {
  const p = SUMMARY_PERIODS.find((x) => x.id === periodId) || SUMMARY_PERIODS[2]
  const end = new Date(now)
  if (p.offset) end.setDate(end.getDate() - p.offset)
  if (p.id === 'yesterday') end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - (p.days - 1))
  start.setHours(0, 0, 0, 0)
  return { start, end, days: p.days }
}

/** The previous window of identical length, ending where this one starts. */
function previousBounds({ start, days }) {
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - (days - 1))
  prevStart.setHours(0, 0, 0, 0)
  return { start: prevStart, end: prevEnd }
}

async function fetchWindow(siteIds, start, end) {
  const [{ data: floors }, { data: shifts }, { data: alerts }] = await Promise.all([
    supabase.from('floors').select('id, site_id').in('site_id', siteIds),
    supabase
      .from('shifts')
      .select('id, site_id, guard_id, starts_at, ends_at, status')
      .in('site_id', siteIds)
      .eq('status', 'published')
      .not('guard_id', 'is', null)
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString()),
    supabase
      .from('alert_events')
      .select('id, site_id, guard_id, event_type, message, acknowledged, created_at')
      .in('site_id', siteIds)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString()),
  ])

  const floorIds = (floors || []).map((f) => f.id)
  const { data: checkpoints } = floorIds.length
    ? await supabase
        .from('checkpoints')
        .select('id, name, floor_id, checkpoint_role, active')
        .in('floor_id', floorIds)
    : { data: [] }

  const cpIds = (checkpoints || []).map((c) => c.id)
  const { data: scans } = cpIds.length
    ? await supabase
        .from('scans')
        .select('id, guard_id, checkpoint_id, scanned_at, status, scan_input_method, gps_accuracy, sync_method')
        .in('checkpoint_id', cpIds)
        .gte('scanned_at', new Date(start.getTime() - 3600000).toISOString())
        .lte('scanned_at', end.toISOString())
        .order('scanned_at', { ascending: true })
    : { data: [] }

  // checkpoint_misses lands with migration 032 — treat "table missing" as
  // "no persisted misses" and compute them client-side below.
  let misses = []
  const missRes = await supabase
    .from('checkpoint_misses')
    .select('id, site_id, shift_id, guard_id, checkpoint_id, window_start, window_end')
    .in('site_id', siteIds)
    .gte('window_start', start.toISOString())
    .lte('window_start', end.toISOString())
  if (!missRes.error) misses = missRes.data || []

  let incidents = []
  const incRes = await supabase
    .from('incident_reports')
    .select('id, site_id, guard_id, created_at, reviewed_at')
    .in('site_id', siteIds)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
  if (incRes.error && /reviewed_at/.test(incRes.error.message || '')) {
    const legacy = await supabase
      .from('incident_reports')
      .select('id, site_id, guard_id, created_at')
      .in('site_id', siteIds)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    incidents = (legacy.data || []).map((r) => ({ ...r, reviewed_at: r.created_at }))
  } else {
    incidents = incRes.data || []
  }

  return {
    floors: floors || [],
    checkpoints: checkpoints || [],
    shifts: shifts || [],
    scans: scans || [],
    alerts: alerts || [],
    misses,
    incidents,
  }
}

export async function fetchOpsSummary(siteIds, periodId) {
  if (!siteIds?.length) return null
  const bounds = periodBounds(periodId)
  const prev = previousBounds(bounds)

  const [{ data: guards }, current, previous] = await Promise.all([
    supabase.from('guards').select('id, name, site_id').in('site_id', siteIds),
    fetchWindow(siteIds, bounds.start, bounds.end),
    fetchWindow(siteIds, prev.start, prev.end),
  ])

  const summary = computeWindowStats(current, guards || [], bounds)
  const prevSummary = computeWindowStats(previous, guards || [], { ...prev, days: bounds.days })

  return {
    bounds,
    guards: guards || [],
    ...summary,
    trends: buildTrends(summary, prevSummary),
  }
}

function computeWindowStats({ checkpoints, shifts, scans, alerts, misses, incidents }, guards, bounds) {
  const now = Date.now()
  const guardName = (id) => guards.find((g) => g.id === id)?.name || 'Guard'
  const cpById = new Map(checkpoints.map((c) => [c.id, c]))
  const clockInCps = new Set(checkpoints.filter((c) => c.checkpoint_role === 'shift_clock_in').map((c) => c.id))
  const clockOutCps = new Set(checkpoints.filter((c) => c.checkpoint_role === 'shift_clock_out').map((c) => c.id))
  const patrolCps = checkpoints.filter((c) => c.active && !CLOCK_ROLES.includes(c.checkpoint_role))
  const passScans = scans.filter((s) => s.status === 'pass')

  // ---- Shift-by-shift reconciliation --------------------------------------
  const shiftRows = shifts.map((shift) => {
    const startMs = new Date(shift.starts_at).getTime()
    const endMs = new Date(shift.ends_at).getTime()
    const mine = passScans.filter((s) => s.guard_id === shift.guard_id)
    const clockIn = mine.find((s) => {
      const t = new Date(s.scanned_at).getTime()
      return clockInCps.has(s.checkpoint_id) && t >= startMs - 3600000 && t <= endMs
    })
    const clockOut = mine.find((s) => {
      const t = new Date(s.scanned_at).getTime()
      return clockOutCps.has(s.checkpoint_id) && t > (clockIn ? new Date(clockIn.scanned_at).getTime() : startMs) && t <= endMs + 6 * 3600000
    })
    const lateMinutes = clockIn
      ? Math.max(0, Math.round((new Date(clockIn.scanned_at).getTime() - startMs) / 60000))
      : null
    const ended = endMs < now
    // Patrol coverage inside the shift window.
    const visited = new Set(
      mine
        .filter((s) => {
          const t = new Date(s.scanned_at).getTime()
          return t >= startMs && t <= endMs && cpById.get(s.checkpoint_id) && !CLOCK_ROLES.includes(cpById.get(s.checkpoint_id).checkpoint_role)
        })
        .map((s) => s.checkpoint_id),
    )
    return {
      shift,
      guardId: shift.guard_id,
      guardName: guardName(shift.guard_id),
      clockedIn: Boolean(clockIn),
      lateMinutes,
      isLate: lateMinutes != null && lateMinutes >= LATE_MINUTES,
      noShow: !clockIn && ended,
      missingClockOut: Boolean(clockIn) && !clockOut && ended,
      ended,
      expectedCheckpoints: patrolCps.length,
      visitedCheckpoints: visited.size,
      missedCheckpointIds: ended && clockIn ? patrolCps.filter((c) => !visited.has(c.id)).map((c) => c.id) : [],
    }
  })

  // ---- Misses: persisted rows (032) win; else the client-side reconciliation.
  const missRows = misses.length
    ? misses.map((m) => ({
        guardId: m.guard_id,
        guardName: guardName(m.guard_id),
        checkpointName: cpById.get(m.checkpoint_id)?.name || 'Checkpoint',
        at: m.window_start,
      }))
    : shiftRows.flatMap((r) =>
        r.missedCheckpointIds.map((cpId) => ({
          guardId: r.guardId,
          guardName: r.guardName,
          checkpointName: cpById.get(cpId)?.name || 'Checkpoint',
          at: r.shift.starts_at,
        })),
      )

  const missesByGuard = missRows.reduce((acc, m) => {
    acc[m.guardId] = acc[m.guardId] || { guardName: m.guardName, count: 0, checkpoints: [] }
    acc[m.guardId].count += 1
    acc[m.guardId].checkpoints.push(m.checkpointName)
    return acc
  }, {})
  const repeatOffenders = Object.entries(missesByGuard)
    .filter(([, v]) => v.count >= 2)
    .map(([guardId, v]) => ({ guardId, ...v }))
    .sort((a, b) => b.count - a.count)

  // ---- Checkpoint completion over COMPLETED, clocked-in shifts ------------
  const doneShifts = shiftRows.filter((r) => r.ended && r.clockedIn)
  const expectedVisits = doneShifts.reduce((s, r) => s + r.expectedCheckpoints, 0)
  const completedVisits = doneShifts.reduce((s, r) => s + r.visitedCheckpoints, 0)
  const completionPct = expectedVisits ? Math.round((completedVisits / expectedVisits) * 1000) / 10 : null

  // ---- Punctuality ---------------------------------------------------------
  const clockedRows = shiftRows.filter((r) => r.lateMinutes != null)
  const punctuality = Object.values(
    clockedRows.reduce((acc, r) => {
      acc[r.guardId] = acc[r.guardId] || { guardId: r.guardId, guardName: r.guardName, shifts: 0, totalLate: 0, lateCount: 0 }
      acc[r.guardId].shifts += 1
      acc[r.guardId].totalLate += r.lateMinutes
      if (r.isLate) acc[r.guardId].lateCount += 1
      return acc
    }, {}),
  )
    .map((g) => ({ ...g, avgLate: Math.round(g.totalLate / g.shifts) }))
    .sort((a, b) => a.avgLate - b.avgLate)

  // ---- Anomalies -----------------------------------------------------------
  const gpsRejects = scans.filter((s) => s.status === 'fail').length
  const missingClockOuts = shiftRows.filter((r) => r.missingClockOut)
  const offlineSynced = scans.filter((s) => s.sync_method === 'offline_sync').length

  // ---- Activity by hour ----------------------------------------------------
  const activityByHour = Array.from({ length: 24 }, () => 0)
  for (const s of passScans) activityByHour[new Date(s.scanned_at).getHours()] += 1

  // ---- Guard table ---------------------------------------------------------
  const guardTable = guards
    .map((g) => {
      const rows = shiftRows.filter((r) => r.guardId === g.id)
      if (!rows.length) return null
      const scansCount = passScans.filter((s) => s.guard_id === g.id).length
      const punct = punctuality.find((p) => p.guardId === g.id)
      return {
        guardId: g.id,
        guardName: g.name,
        shifts: rows.length,
        scans: scansCount,
        misses: missesByGuard[g.id]?.count || 0,
        avgLate: punct?.avgLate ?? null,
        noShows: rows.filter((r) => r.noShow).length,
        missingClockOuts: rows.filter((r) => r.missingClockOut).length,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.scans - a.scans)

  return {
    bounds,
    shiftStats: {
      total: shiftRows.length,
      clockedIn: shiftRows.filter((r) => r.clockedIn).length,
      late: shiftRows.filter((r) => r.isLate).length,
      noShows: shiftRows.filter((r) => r.noShow).length,
      coveragePct: shiftRows.filter((r) => r.ended).length
        ? Math.round(
            (shiftRows.filter((r) => r.ended && r.clockedIn).length /
              shiftRows.filter((r) => r.ended).length) *
              100,
          )
        : null,
    },
    checkpointStats: { expectedVisits, completedVisits, completionPct },
    missRows,
    missesByGuard,
    repeatOffenders,
    punctuality,
    anomalies: { gpsRejects, missingClockOuts, offlineSynced },
    alertStats: {
      total: alerts.length,
      open: alerts.filter((a) => !a.acknowledged).length,
      byType: alerts.reduce((acc, a) => ({ ...acc, [a.event_type]: (acc[a.event_type] || 0) + 1 }), {}),
    },
    incidentStats: {
      total: incidents.length,
      pendingReview: incidents.filter((i) => !i.reviewed_at).length,
    },
    activityByHour,
    guardTable,
    scanCount: passScans.length,
  }
}

function pctDelta(cur, prevValue) {
  if (prevValue == null || cur == null) return null
  if (prevValue === 0) return cur === 0 ? 0 : null
  return Math.round(((cur - prevValue) / prevValue) * 100)
}

function buildTrends(cur, prevSummary) {
  return {
    scans: pctDelta(cur.scanCount, prevSummary.scanCount),
    completionPct:
      cur.checkpointStats.completionPct != null && prevSummary.checkpointStats.completionPct != null
        ? Math.round((cur.checkpointStats.completionPct - prevSummary.checkpointStats.completionPct) * 10) / 10
        : null,
    misses: pctDelta(cur.missRows.length, prevSummary.missRows.length),
    alerts: pctDelta(cur.alertStats.total, prevSummary.alertStats.total),
  }
}

// ---------------------------------------------------------------------------
// Narrative: rule-based sentence assembly. This is deliberately templated —
// when the AI layer arrives it replaces THIS function only; every fact it
// narrates stays computed above.
// ---------------------------------------------------------------------------
export function buildNarrative(s, { siteLabel, periodLabel }) {
  if (!s) return []
  const out = []
  const { shiftStats, checkpointStats, missRows, repeatOffenders, punctuality, anomalies, alertStats, incidentStats, trends } = s

  // Coverage headline.
  if (shiftStats.total === 0) {
    out.push(`No published shifts at ${siteLabel} for ${periodLabel.toLowerCase()} — nothing to reconcile.`)
    return out
  }
  const cov = shiftStats.coveragePct
  out.push(
    `${siteLabel}, ${periodLabel.toLowerCase()}: ${shiftStats.total} published shift${shiftStats.total === 1 ? '' : 's'}, ` +
      (cov != null
        ? `${cov}% coverage${shiftStats.noShows ? ` — ${shiftStats.noShows} no-show${shiftStats.noShows === 1 ? '' : 's'} need follow-up` : ' with zero no-shows'}.`
        : `${shiftStats.clockedIn} clocked in so far.`),
  )

  // Checkpoints.
  if (checkpointStats.expectedVisits > 0) {
    let line = `${checkpointStats.completedVisits}/${checkpointStats.expectedVisits} checkpoint visits completed (${checkpointStats.completionPct}%).`
    if (missRows.length === 0) line += ' Clean board — no missed checkpoints.'
    out.push(line)
  }
  if (missRows.length > 0) {
    const top = missRows.slice(0, 4).map((m) => `${m.checkpointName} by ${m.guardName}`)
    out.push(`Missed: ${top.join('; ')}${missRows.length > 4 ? ` — and ${missRows.length - 4} more` : ''}.`)
  }
  for (const r of repeatOffenders) {
    out.push(
      `⚠ ${r.guardName} has ${r.count} misses this period (${[...new Set(r.checkpoints)].slice(0, 3).join(', ')}) — flag for manager follow-up.`,
    )
  }

  // Punctuality.
  if (punctuality.length) {
    const worst = punctuality[punctuality.length - 1]
    const best = punctuality[0]
    if (shiftStats.late > 0) {
      out.push(
        `${shiftStats.late} late clock-in${shiftStats.late === 1 ? '' : 's'}; slowest starter: ${worst.guardName} (avg ${worst.avgLate} min after shift start). Most punctual: ${best.guardName}.`,
      )
    } else {
      out.push('Every clock-in landed on time.')
    }
  }

  // Anomalies.
  const anomalyBits = []
  if (anomalies.missingClockOuts.length) {
    anomalyBits.push(
      `${anomalies.missingClockOuts.length} shift${anomalies.missingClockOuts.length === 1 ? '' : 's'} with no clock-out punch (${[...new Set(anomalies.missingClockOuts.map((r) => r.guardName))].join(', ')}) — payroll hours are assumed, verify before paying`,
    )
  }
  if (anomalies.gpsRejects) anomalyBits.push(`${anomalies.gpsRejects} scan${anomalies.gpsRejects === 1 ? '' : 's'} rejected by GPS validation`)
  if (anomalies.offlineSynced) anomalyBits.push(`${anomalies.offlineSynced} scan${anomalies.offlineSynced === 1 ? '' : 's'} arrived via offline sync`)
  if (anomalyBits.length) out.push(`Anomalies: ${anomalyBits.join('; ')}.`)

  // Alerts + incidents.
  if (alertStats.total) {
    out.push(
      `${alertStats.total} automated alert${alertStats.total === 1 ? '' : 's'} fired` +
        (alertStats.open ? ` — ${alertStats.open} still unacknowledged.` : ', all acknowledged.'),
    )
  }
  if (incidentStats.total) {
    out.push(
      `${incidentStats.total} incident report${incidentStats.total === 1 ? '' : 's'} filed` +
        (incidentStats.pendingReview
          ? ` — ${incidentStats.pendingReview} awaiting your review before clients can see ${incidentStats.pendingReview === 1 ? 'it' : 'them'}.`
          : ', all reviewed.'),
    )
  }

  // Trend close.
  const trendBits = []
  if (trends?.scans != null && trends.scans !== 0) trendBits.push(`scan volume ${trends.scans > 0 ? 'up' : 'down'} ${Math.abs(trends.scans)}%`)
  if (trends?.completionPct != null && trends.completionPct !== 0)
    trendBits.push(`checkpoint completion ${trends.completionPct > 0 ? 'up' : 'down'} ${Math.abs(trends.completionPct)} pts`)
  if (trends?.misses != null && trends.misses !== 0) trendBits.push(`misses ${trends.misses > 0 ? 'up' : 'down'} ${Math.abs(trends.misses)}%`)
  if (trendBits.length) out.push(`Versus the previous period: ${trendBits.join(', ')}.`)

  return out
}
