const EARTH_RADIUS_METRES = 6371000
export const DEFAULT_RADIUS_METRES = 15
export const MAX_GPS_ACCURACY_REJECT = 65
export const VERTICAL_TOLERANCE_METRES = 10
export const FLOOR_HEIGHT_METRES = 3.5
export const ACCURACY_RADIUS_BONUS_CAP = 25
export const LOBBY_STACK_RADIUS_METRES = 25
export const MIN_UPPER_FLOOR_LOBBY_SEPARATION = 25

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

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

export function defaultRadiusForFloor() {
  return DEFAULT_RADIUS_METRES
}

export function effectiveRadiusMetres(radiusMetres, gpsAccuracy) {
  const base = radiusMetres ?? DEFAULT_RADIUS_METRES
  const bonus =
    gpsAccuracy != null ? Math.min(gpsAccuracy * 0.75, ACCURACY_RADIUS_BONUS_CAP) : 0
  return base + bonus
}

export function minDistanceToLobbyCheckpoints(guardLat, guardLng, lobbyCheckpoints = []) {
  if (!lobbyCheckpoints.length) return null
  return Math.min(
    ...lobbyCheckpoints.map((cp) => haversineDistance(guardLat, guardLng, cp.latitude, cp.longitude)),
  )
}

export function distanceFromLobbyZone(lat, lng, lobbyCheckpoints = []) {
  return minDistanceToLobbyCheckpoints(lat, lng, lobbyCheckpoints)
}

function isAltitudeConfirmed(guardAltitude, expectedAltitude) {
  if (guardAltitude == null || expectedAltitude == null) return false
  return Math.abs(guardAltitude - expectedAltitude) <= VERTICAL_TOLERANCE_METRES
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
  lobbyCheckpoints = [],
}) {
  const distance = haversineDistance(guardLat, guardLng, checkpointLat, checkpointLng)
  const allowedRadius = effectiveRadiusMetres(radiusMetres, gpsAccuracy)
  const expectedAltitude = checkpointAltitude ?? (floorNumber > 1 ? floorElevationMetres(floorNumber) : null)

  if (gpsAccuracy != null && gpsAccuracy > MAX_GPS_ACCURACY_REJECT) {
    return {
      passed: false,
      distance,
      reason: 'gps_accuracy',
      message: `GPS signal too weak (±${Math.round(gpsAccuracy)}m). Move near a window or doorway and try again.`,
    }
  }

  if (distance > allowedRadius) {
    return {
      passed: false,
      distance,
      reason: 'too_far',
      message: `You are ${distance.toFixed(0)}m away (allowed ~${Math.round(allowedRadius)}m with current GPS). Stand at the tag and try again.`,
    }
  }

  if (floorNumber > 1 && expectedAltitude != null && guardAltitude != null) {
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

  if (floorNumber > 1 && lobbyCheckpoints.length > 0 && !isAltitudeConfirmed(guardAltitude, expectedAltitude)) {
    const lobbyDist = minDistanceToLobbyCheckpoints(guardLat, guardLng, lobbyCheckpoints)

    if (lobbyDist != null && lobbyDist > distance * 1.5) {
      // Guard is clearly closer to this checkpoint than the lobby — allow
    } else if (lobbyDist != null) {
      const insideLobbyBubble = lobbyCheckpoints.some((cp) => {
        const lobbyRadius = effectiveRadiusMetres(cp.radius_metres ?? DEFAULT_RADIUS_METRES, gpsAccuracy)
        return haversineDistance(guardLat, guardLng, cp.latitude, cp.longitude) <= lobbyRadius
      })

      if (insideLobbyBubble && distance <= allowedRadius && lobbyDist <= distance + 5) {
        return {
          passed: false,
          distance,
          reason: 'lobby_stack',
          message: `Ground-floor GPS detected. Go to floor ${floorNumber} to scan. If you are on floor ${floorNumber}, re-capture this checkpoint GPS away from the lobby (far end of hall, near a window).`,
        }
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

function readPosition() {
  return new Promise((resolve, reject) => {
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
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  })
}

export async function getBestPosition(samples = 3) {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported on this device')
  }

  const readings = []
  for (let i = 0; i < samples; i += 1) {
    try {
      readings.push(await readPosition())
    } catch {
      // keep trying remaining samples
    }
    if (i < samples - 1) {
      await new Promise((r) => setTimeout(r, 800))
    }
  }

  if (readings.length === 0) {
    throw new Error('Unable to get GPS location — move near a window or doorway')
  }

  return readings.reduce((best, current) =>
    (current.accuracy ?? Infinity) < (best.accuracy ?? Infinity) ? current : best,
  )
}

export function getCurrentPosition() {
  return getBestPosition(1)
}
