// Geofenced Face ID clock-in/out. A punch is a scan on the site's
// shift_clock_in / shift_clock_out checkpoint with scan_input_method 'face_gps'
// — so payroll, the admin shift clock, and late/no-show alerts all read it with
// zero changes. The DB trigger re-validates the geofence server-side.
import { supabase } from './supabase.js'
import { haversineDistance } from './gps.js'

export const CLOCK_ACCURACY_BONUS_CAP = 40

export async function fetchSiteGeofence(siteId) {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, latitude, longitude, geofence_radius_m')
    .eq('id', siteId)
    .single()
  if (error) throw error
  return data
}

/** Distance + inside/outside for the live "you are Xm away" readout. */
export function geofenceStatus(position, site) {
  if (!site || site.latitude == null || site.longitude == null) {
    return { located: false, distance: null, inside: false, radius: null }
  }
  const distance = haversineDistance(
    position.latitude,
    position.longitude,
    site.latitude,
    site.longitude,
  )
  const radius =
    (site.geofence_radius_m ?? 120) +
    (position.accuracy != null
      ? Math.min(position.accuracy * 0.75, CLOCK_ACCURACY_BONUS_CAP)
      : 0)
  return { located: true, distance, inside: distance <= radius, radius }
}

/**
 * Records the punch. Face ID must already be verified by the caller —
 * this inserts the scan; the DB trigger sets pass/fail from the site geofence.
 */
export async function clockPunch({ guardId, siteId, type, position, note = null }) {
  const role = type === 'out' ? 'shift_clock_out' : 'shift_clock_in'

  const { data: checkpointId, error: rpcError } = await supabase.rpc('ensure_clock_checkpoint', {
    p_site_id: siteId,
    p_role: role,
  })
  if (rpcError) throw new Error(rpcError.message)

  const { data: scan, error } = await supabase
    .from('scans')
    .insert({
      checkpoint_id: checkpointId,
      guard_id: guardId,
      scanned_at: new Date().toISOString(),
      guard_lat: position.latitude,
      guard_lng: position.longitude,
      guard_altitude: position.altitude ?? null,
      gps_accuracy: position.accuracy ?? null,
      distance_metres: 0, // trigger recomputes
      status: 'fail', // trigger decides pass/fail
      sync_method: 'realtime',
      scan_input_method: 'face_gps',
      // Early clock-out reason (rides the existing approval_note column).
      approval_note: note?.trim() ? note.trim().slice(0, 500) : null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  return scan
}
