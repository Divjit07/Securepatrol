import { supabase } from './supabase.js'
import { getBestPosition, getOptionalPosition, validateScanProximity, defaultRadiusForFloor } from './gps.js'

const QUEUE_KEY = 'securepatrol_offline_scans'

export function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    /* Safari private mode — scans submit online-only */
  }
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
  scanInputMethod = 'nfc',
  nfcSerial = null,
}) {
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
    scan_input_method: scanInputMethod,
    ...(nfcSerial ? { nfc_serial: nfcSerial } : {}),
  }

  // Queue BEFORE any network call — the checkpoint metadata fetch below is a
  // live Supabase request, so doing it first made genuinely-offline scans
  // throw "Checkpoint not found" instead of ever reaching the queue.
  if (!navigator.onLine) {
    queueOfflineScan(scanRecord)
    return { ...scanRecord, checkpoint: null, offline: true, serverValidated: false }
  }

  let checkpoint = null
  try {
    const { data, error: cpError } = await supabase
      .from('checkpoints')
      .select('id, latitude, longitude, radius_metres, altitude_metres, name, checkpoint_role, floors(floor_number, elevation_metres)')
      .eq('id', checkpointId)
      .single()
    if (cpError || !data) throw new Error('Checkpoint not found')
    checkpoint = data
  } catch (err) {
    // navigator.onLine can lie (captive portal, dead basement signal): if the
    // fetch itself failed at the network layer, queue rather than drop the scan.
    if (!navigator.onLine || err instanceof TypeError || /fetch|network/i.test(err.message || '')) {
      queueOfflineScan(scanRecord)
      return { ...scanRecord, checkpoint: null, offline: true, serverValidated: false }
    }
    throw err
  }

  const floorNumber = checkpoint.floors?.floor_number ?? 1
  const checkpointAltitude =
    checkpoint.altitude_metres ?? checkpoint.floors?.elevation_metres ?? null

  let { data, error } = await supabase.from('scans').insert(scanRecord).select().single()
  // Pre-035 the nfc_serial column doesn't exist yet — retry without it.
  if (error && scanRecord.nfc_serial && /nfc_serial/.test(error.message || '')) {
    const { nfc_serial: _drop, ...legacyRecord } = scanRecord
    ;({ data, error } = await supabase.from('scans').insert(legacyRecord).select().single())
  }
  if (error) throw error

  const clientCheck =
    scanInputMethod === 'nfc'
      ? { passed: true, message: null }
      : validateScanProximity({
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
  const remaining = [...queue]

  for (const scan of queue) {
    try {
      const record = {
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
        scan_input_method: scan.scan_input_method ?? 'nfc',
        ...(scan.nfc_serial ? { nfc_serial: scan.nfc_serial } : {}),
      }
      let { error } = await supabase.from('scans').insert(record)
      if (error && record.nfc_serial && /nfc_serial/.test(error.message || '')) {
        const { nfc_serial: _drop, ...legacyRecord } = record
        ;({ error } = await supabase.from('scans').insert(legacyRecord))
      }
      if (error) throw error
      synced++
      // Persist after every success — saving only once at the end meant a
      // crash/tab-close mid-loop re-submitted already-synced scans next flush.
      remaining.splice(remaining.indexOf(scan), 1)
      saveOfflineQueue(remaining)
    } catch {
      failed++
    }
  }

  saveOfflineQueue(remaining)
  return { synced, failed }
}

export async function submitScanWithGps(checkpointId, guardId, { scanInputMethod = 'nfc', nfcSerial = null } = {}) {
  const position =
    scanInputMethod === 'nfc'
      ? (await getOptionalPosition(8000, 2)) ?? (await getBestPosition(1))
      : await getBestPosition(3)

  return submitScan({
    checkpointId,
    guardId,
    guardLat: position.latitude,
    guardLng: position.longitude,
    guardAltitude: position.altitude,
    gpsAccuracy: position.accuracy,
    scannedAt: new Date().toISOString(),
    syncMethod: navigator.onLine ? 'realtime' : 'offline_sync',
    scanInputMethod,
    nfcSerial,
  })
}

export function getPendingScanCount() {
  return getOfflineQueue().length
}
