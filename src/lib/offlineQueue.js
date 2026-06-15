import { supabase } from './supabase.js'
import { getCurrentPosition, validateScanProximity, defaultRadiusForFloor } from './gps.js'

const QUEUE_KEY = 'securepatrol_offline_scans'

export function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveOfflineQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function queueOfflineScan(scan) {
  const queue = getOfflineQueue()
  queue.push({ ...scan, queuedAt: new Date().toISOString() })
  saveOfflineQueue(queue)
  return queue.length
}

export async function submitScan({
  checkpointId,
  guardId,
  guardLat,
  guardLng,
  guardAltitude = null,
  gpsAccuracy = null,
  scannedAt,
  syncMethod = 'realtime',
}) {
  const { data: checkpoint, error: cpError } = await supabase
    .from('checkpoints')
    .select('id, latitude, longitude, radius_metres, altitude_metres, name, floors(floor_number, elevation_metres)')
    .eq('id', checkpointId)
    .single()

  if (cpError || !checkpoint) {
    throw new Error('Checkpoint not found')
  }

  const floorNumber = checkpoint.floors?.floor_number ?? 1
  const checkpointAltitude =
    checkpoint.altitude_metres ?? checkpoint.floors?.elevation_metres ?? null

  const scanRecord = {
    checkpoint_id: checkpointId,
    guard_id: guardId,
    scanned_at: scannedAt || new Date().toISOString(),
    guard_lat: guardLat,
    guard_lng: guardLng,
    guard_altitude: guardAltitude,
    gps_accuracy: gpsAccuracy,
    distance_metres: 0,
    status: 'fail',
    sync_method: syncMethod,
  }

  if (!navigator.onLine) {
    queueOfflineScan(scanRecord)
    return {
      ...scanRecord,
      checkpoint,
      offline: true,
      serverValidated: false,
    }
  }

  const { data, error } = await supabase.from('scans').insert(scanRecord).select().single()
  if (error) throw error

  const clientCheck = validateScanProximity({
    guardLat,
    guardLng,
    guardAltitude,
    gpsAccuracy,
    checkpointLat: checkpoint.latitude,
    checkpointLng: checkpoint.longitude,
    checkpointAltitude,
    floorNumber,
    radiusMetres: checkpoint.radius_metres ?? defaultRadiusForFloor(floorNumber),
  })

  return {
    ...data,
    checkpoint,
    offline: false,
    serverValidated: true,
    failureMessage: data.status === 'fail' ? clientCheck.message : null,
  }
}

export async function flushOfflineQueue() {
  if (!navigator.onLine) return { synced: 0, failed: 0 }

  const queue = getOfflineQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  const remaining = []

  for (const scan of queue) {
    try {
      const { error } = await supabase.from('scans').insert({
        checkpoint_id: scan.checkpoint_id,
        guard_id: scan.guard_id,
        scanned_at: scan.scanned_at,
        guard_lat: scan.guard_lat,
        guard_lng: scan.guard_lng,
        guard_altitude: scan.guard_altitude ?? null,
        gps_accuracy: scan.gps_accuracy ?? null,
        distance_metres: 0,
        status: 'fail',
        sync_method: 'offline_sync',
      })
      if (error) throw error
      synced++
    } catch {
      failed++
      remaining.push(scan)
    }
  }

  saveOfflineQueue(remaining)
  return { synced, failed }
}

export async function submitScanWithGps(checkpointId, guardId) {
  const position = await getCurrentPosition()
  return submitScan({
    checkpointId,
    guardId,
    guardLat: position.latitude,
    guardLng: position.longitude,
    guardAltitude: position.altitude,
    gpsAccuracy: position.accuracy,
    scannedAt: new Date().toISOString(),
    syncMethod: navigator.onLine ? 'realtime' : 'offline_sync',
  })
}

export function getPendingScanCount() {
  return getOfflineQueue().length
}
