const EARTH_RADIUS_METRES = 6371000
export const DEFAULT_RADIUS_METRES = 8
export const MAX_GPS_ACCURACY_METRES = 15
export const VERTICAL_TOLERANCE_METRES = 5
export const FLOOR_HEIGHT_METRES = 3.5

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

/**
 * Haversine formula — horizontal distance in metres between two GPS coordinates.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function floorElevationMetres(floorNumber) {
  return Math.max(0, (floorNumber - 1) * FLOOR_HEIGHT_METRES)
}

export function validateScanProximity({
  guardLat,
  guardLng,
  guardAltitude,
  gpsAccuracy,
  checkpointLat,
  checkpointLng,
  checkpointAltitude,
  floorNumber = 1,
  radiusMetres = DEFAULT_RADIUS_METRES,
}) {
  const distance = haversineDistance(guardLat, guardLng, checkpointLat, checkpointLng)
  const maxAccuracy = Math.min(radiusMetres, MAX_GPS_ACCURACY_METRES)
  const expectedAltitude = checkpointAltitude ?? (floorNumber > 1 ? floorElevationMetres(floorNumber) : null)

  if (gpsAccuracy != null && gpsAccuracy > maxAccuracy) {
    return {
      passed: false,
      distance,
      reason: 'gps_accuracy',
      message: `GPS signal too weak (±${Math.round(gpsAccuracy)}m). Move near a window and try again.`,
    }
  }

  if (distance > radiusMetres) {
    return {
      passed: false,
      distance,
      reason: 'too_far',
      message: `You are ${distance.toFixed(0)}m away (max ${radiusMetres}m). Move closer to the checkpoint.`,
    }
  }

  if (floorNumber > 1 && expectedAltitude != null) {
    if (guardAltitude == null) {
      return {
        passed: false,
        distance,
        reason: 'altitude_required',
        message: `Floor ${floorNumber} requires altitude verification. Stand near a window so GPS can detect your floor.`,
      }
    }

    const verticalDiff = Math.abs(guardAltitude - expectedAltitude)
    if (verticalDiff > VERTICAL_TOLERANCE_METRES) {
      return {
        passed: false,
        distance,
        reason: 'wrong_floor',
        message: `Wrong floor detected. This checkpoint is on floor ${floorNumber} — go to that floor to scan.`,
      }
    }
  }

  return { passed: true, distance, reason: null, message: null }
}

export function verifyGpsProximity(guardLat, guardLng, checkpointLat, checkpointLng, radiusMetres) {
  const distance = haversineDistance(guardLat, guardLng, checkpointLat, checkpointLng)
  return {
    distance,
    passed: distance <= radiusMetres,
  }
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
        }),
      (err) => reject(new Error(err.message || 'Unable to get GPS location')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}
