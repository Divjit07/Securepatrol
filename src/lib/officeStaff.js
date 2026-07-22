// Office Staff data layer. Office employees are role='office' profiles who
// clock IN/OUT at an office_locations geofence (GPS), purely for hours.
// Separate from guards (guards live in the `guards` table and scan checkpoints).
import { supabase } from './supabase.js'
import { haversineDistance } from './gps.js'

// Clock-in geofence tuning — mirrors the office-clock DB trigger (migration 040).
export const OFFICE_MAX_GPS_ACCURACY_M = 100
export const OFFICE_ACCURACY_BONUS_CAP = 40

// ---- Office locations -------------------------------------------------------

export async function listOfficeLocations({ activeOnly = false } = {}) {
  let q = supabase.from('office_locations').select('*').order('name')
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export async function createOfficeLocation(patch) {
  const { data, error } = await supabase
    .from('office_locations')
    .insert({
      name: patch.name?.trim(),
      address: patch.address?.trim() || null,
      latitude: patch.latitude ?? null,
      longitude: patch.longitude ?? null,
      geofence_radius_m: patch.geofence_radius_m ?? 120,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateOfficeLocation(id, patch) {
  const { error } = await supabase.from('office_locations').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchOfficeLocation(id) {
  const { data, error } = await supabase
    .from('office_locations')
    .select('id, name, latitude, longitude, geofence_radius_m')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

// ---- Office employees (admin) ----------------------------------------------

export async function listOfficeEmployees() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, active, office_location_id, office_locations(id, name)')
    .eq('role', 'office')
    .order('name')
  if (error) throw new Error(error.message)
  return data || []
}

/** Creates the account via the admin-only edge function. */
export async function createOfficeEmployee({ name, email, password, office_location_id }) {
  const { data, error } = await supabase.functions.invoke('create-office-employee', {
    body: { name, email, password, office_location_id },
  })
  if (error) {
    let message = error.message || 'Could not create employee'
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch { /* keep generic */ }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function setEmployeeActive(id, active) {
  const { error } = await supabase.from('profiles').update({ active }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setEmployeeOffice(id, office_location_id) {
  const { error } = await supabase.from('profiles').update({ office_location_id }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ---- Clock (office employee) ------------------------------------------------

/** Live distance + inside/outside readout for the clock card. */
export function officeGeofenceStatus(position, location) {
  if (!location || location.latitude == null || location.longitude == null) {
    return { located: false, distance: null, inside: false, accuracyOk: true, accuracy: null }
  }
  const distance = haversineDistance(
    position.latitude,
    position.longitude,
    location.latitude,
    location.longitude,
  )
  const radius =
    (location.geofence_radius_m ?? 120) +
    (position.accuracy != null ? Math.min(position.accuracy * 0.75, OFFICE_ACCURACY_BONUS_CAP) : 0)
  const accuracyOk = position.accuracy == null || position.accuracy <= OFFICE_MAX_GPS_ACCURACY_M
  return {
    located: true,
    distance,
    inside: distance <= radius,
    accuracyOk,
    accuracy: position.accuracy ?? null,
  }
}

/** The employee's latest punch, so we know whether they're clocked in. */
export async function fetchOfficeClockStatus(employeeId) {
  const { data, error } = await supabase
    .from('office_clock_events')
    .select('event_type, event_at, status')
    .eq('employee_id', employeeId)
    .eq('status', 'pass')
    .order('event_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  const last = data?.[0]
  return { clockedIn: last?.event_type === 'in', last: last || null }
}

/**
 * Records an office punch (geofenced GPS). Inserts the row; the DB trigger
 * decides pass/fail from the office geofence (clock-OUT always passes).
 */
export async function officeClockPunch({ employeeId, officeLocationId, type, position, note = null }) {
  const { data, error } = await supabase
    .from('office_clock_events')
    .insert({
      employee_id: employeeId,
      office_location_id: officeLocationId,
      event_type: type,
      event_at: new Date().toISOString(),
      guard_lat: position?.latitude ?? null,
      guard_lng: position?.longitude ?? null,
      gps_accuracy: position?.accuracy ?? null,
      distance_metres: 0, // trigger recomputes
      status: 'fail', // trigger decides
      note: note?.trim() ? note.trim().slice(0, 500) : null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/** Recent punches for an employee (hours view). */
export async function listOfficeEvents(employeeId, { limit = 60 } = {}) {
  const { data, error } = await supabase
    .from('office_clock_events')
    .select('id, event_type, event_at, status, distance_metres, note')
    .eq('employee_id', employeeId)
    .order('event_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Derives worked hours from a chronological list of passing punches by pairing
 * each IN with the next OUT. Raw punches are never mutated — this is computed.
 * Returns { totalMs, pairs: [{ in, out, ms }], openIn }.
 */
export function deriveHours(events) {
  const passing = events
    .filter((e) => e.status === 'pass')
    .slice()
    .sort((a, b) => new Date(a.event_at) - new Date(b.event_at))
  const pairs = []
  let totalMs = 0
  let openIn = null
  for (const e of passing) {
    if (e.event_type === 'in') {
      openIn = e
    } else if (e.event_type === 'out' && openIn) {
      const ms = new Date(e.event_at) - new Date(openIn.event_at)
      if (ms > 0) {
        pairs.push({ in: openIn.event_at, out: e.event_at, ms })
        totalMs += ms
      }
      openIn = null
    }
  }
  return { totalMs, pairs, openIn: openIn?.event_at || null }
}
