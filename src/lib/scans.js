import { supabase } from './supabase.js'

export async function fetchCheckpointsForSite(siteId) {
  const { data: floors, error: floorError } = await supabase
    .from('floors')
    .select('id, floor_name, floor_number')
    .eq('site_id', siteId)
    .order('floor_number')

  if (floorError) throw floorError
  if (!floors?.length) return []

  const floorIds = floors.map((f) => f.id)
  const { data: checkpoints, error: cpError } = await supabase
    .from('checkpoints')
    .select('*')
    .in('floor_id', floorIds)
    .eq('active', true)
    .order('name')

  if (cpError) throw cpError

  const floorMap = Object.fromEntries(floors.map((f) => [f.id, f]))
  return (checkpoints || []).map((cp) => ({
    ...cp,
    floor: floorMap[cp.floor_id],
  }))
}

export async function fetchTodayScansForGuard(guardId) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('scans')
    .select('*, checkpoints(name, floor_id)')
    .eq('guard_id', guardId)
    .gte('scanned_at', startOfDay.toISOString())
    .order('scanned_at', { ascending: false })

  if (error) throw error
  return data || []
}

export function isHistoricalShiftView(dateStr, shiftEnd) {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr < today) return true
  if (dateStr > today) return false

  const [endH, endM] = shiftEnd.split(':').map(Number)
  const [y, m, d] = dateStr.split('-').map(Number)
  const shiftEndTime = new Date(y, m - 1, d, endH, endM, 59, 999)
  return Date.now() > shiftEndTime.getTime()
}

/** Client portal: green when a checkpoint passed during the selected shift window. */
export function getClientCheckpointStatus(latestScan) {
  if (!latestScan) return 'missed'
  if (latestScan.status === 'fail') return 'failed'
  return 'on_time'
}

export function getCheckpointStatus(checkpoint, latestScan, alertMinutes = 60, { historical = false } = {}) {
  if (!latestScan) {
    const hoursSinceMidnight = (Date.now() - new Date().setHours(0, 0, 0, 0)) / 60000
    if (hoursSinceMidnight > alertMinutes) return 'missed'
    return 'pending'
  }

  if (latestScan.status === 'fail') return 'failed'
  if (historical) return 'on_time'

  const scanTime = new Date(latestScan.scanned_at)
  const minutesSinceScan = (Date.now() - scanTime.getTime()) / 60000

  if (minutesSinceScan <= alertMinutes) return 'on_time'
  return 'late'
}

export function statusColor(status) {
  switch (status) {
    case 'on_time':
    case 'pass':
      return 'green'
    case 'late':
      return 'yellow'
    case 'missed':
    case 'failed':
    case 'fail':
      return 'red'
    default:
      return 'gray'
  }
}

export async function fetchSitesForAdmin(userId, role) {
  let query = supabase.from('sites').select('*').order('name')
  if (role === 'admin') {
    query = query.eq('admin_id', userId)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Recent clock-in / clock-out events across the given sites, newest first.
 * Derived from pass scans on shift_clock_in / shift_clock_out checkpoints.
 * Returns [{ id, guardId, guardName, siteId, type: 'in'|'out', at }].
 * Caller supplies site names (it already has them).
 */
export async function fetchRecentClockEvents(siteIds, { limit = 25, sinceHours = 24 } = {}) {
  if (!siteIds?.length) return []

  const { data: floors } = await supabase.from('floors').select('id, site_id').in('site_id', siteIds)
  if (!floors?.length) return []
  const floorSite = Object.fromEntries(floors.map((f) => [f.id, f.site_id]))

  const { data: cps } = await supabase
    .from('checkpoints')
    .select('id, checkpoint_role, floor_id')
    .in('floor_id', floors.map((f) => f.id))
    .in('checkpoint_role', ['shift_clock_in', 'shift_clock_out'])
  if (!cps?.length) return []
  const cpMeta = Object.fromEntries(
    cps.map((c) => [c.id, { role: c.checkpoint_role, siteId: floorSite[c.floor_id] }]),
  )

  const since = new Date(Date.now() - sinceHours * 3600000).toISOString()
  const { data: scans } = await supabase
    .from('scans')
    .select('id, guard_id, checkpoint_id, scanned_at, profiles:guard_id(name)')
    .in('checkpoint_id', cps.map((c) => c.id))
    .eq('status', 'pass')
    .gte('scanned_at', since)
    .order('scanned_at', { ascending: false })
    .limit(limit)

  return (scans || []).map((s) => {
    const meta = cpMeta[s.checkpoint_id] || {}
    return {
      id: s.id,
      guardId: s.guard_id,
      guardName: s.profiles?.name || 'Guard',
      siteId: meta.siteId,
      type: meta.role === 'shift_clock_in' ? 'in' : 'out',
      at: s.scanned_at,
    }
  })
}

export async function fetchScansWithDetails(filters = {}) {
  let query = supabase
    .from('scans')
    .select(`
      *,
      checkpoints(name, latitude, longitude, floors(floor_name, site_id, sites(name))),
      profiles:guard_id(name)
    `)
    .order('scanned_at', { ascending: false })

  if (filters.siteId) {
    query = query.eq('checkpoints.floors.site_id', filters.siteId)
  }
  if (filters.guardId) {
    query = query.eq('guard_id', filters.guardId)
  }
  if (filters.fromDate) {
    query = query.gte('scanned_at', filters.fromDate)
  }
  if (filters.toDate) {
    query = query.lte('scanned_at', filters.toDate)
  }
  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}
