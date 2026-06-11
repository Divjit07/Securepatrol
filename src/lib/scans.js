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

export function getCheckpointStatus(checkpoint, latestScan, alertMinutes = 60) {
  if (!latestScan) {
    const hoursSinceMidnight = (Date.now() - new Date().setHours(0, 0, 0, 0)) / 60000
    if (hoursSinceMidnight > alertMinutes) return 'missed'
    return 'pending'
  }

  if (latestScan.status === 'fail') return 'failed'

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

export async function fetchScansWithDetails(filters = {}) {
  let query = supabase
    .from('scans')
    .select(`
      *,
      checkpoints(name, latitude, longitude, floors(floor_name, site_id, sites(name))),
      profiles:guard_id(name, email)
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
