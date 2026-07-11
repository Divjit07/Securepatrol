const EARTH_RADIUS_METRES = 6371000
export const DEFAULT_RADIUS_METRES = 20
export const MAX_GPS_ACCURACY_REJECT = 65
export const VERTICAL_TOLERANCE_METRES = 18
export const FLOOR_HEIGHT_METRES = 3.5
export const ACCURACY_RADIUS_BONUS_CAP = 25
export const MIN_FLOOR_COORD_SEPARATION = 20

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

export function minDistanceToCheckpoints(lat, lng, checkpoints = []) {
  if (!checkpoints.length) return null
  return Math.min(
    ...checkpoints.map((cp) => haversineDistance(lat, lng, cp.latitude, cp.longitude)),
  )
}

/** @deprecated use minDistanceToCheckpoints */
export function distanceFromLobbyZone(lat, lng, lobbyCheckpoints = []) {
  return minDistanceToCheckpoints(lat, lng, lobbyCheckpoints)
}

export function parseCoordinatePaste(text) {
  const cleaned = text.trim().replace(/[()]/g, '')
  const parts = cleaned.split(/[,\s]+/).filter(Boolean)
  if (parts.length < 2) return null
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
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
      message: `You are ${distance.toFixed(0)}m from this checkpoint (allowed ~${Math.round(allowedRadius)}m). Stand at the tag and try again.`,
    }
  }

  if (
    floorNumber > 1 &&
    expectedAltitude != null &&
    guardAltitude != null &&
    gpsAccuracy != null &&
    gpsAccuracy <= 30
  ) {
    const verticalDiff = Math.abs(guardAltitude - expectedAltitude)
    if (verticalDiff > VERTICAL_TOLERANCE_METRES) {
      return {
        passed: false,
        distance,
        reason: 'wrong_floor',
        message: `Wrong floor detected. This checkpoint is on floor ${floorNumber}.`,
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

function readPosition(options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }) {
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
      (err) => {
        const error = new Error(err.message || 'Unable to get GPS location')
        error.code = err.code
        reject(error)
      },
      options,
    )
  })
}

export async function getBestPosition(samples = 3) {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported on this device')
  }

  const attempts = [
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 },
  ]

  const readings = []

  for (const options of attempts) {
    for (let i = 0; i < samples; i += 1) {
      try {
        readings.push(await readPosition(options))
      } catch (err) {
        if (i === 0 && options.enableHighAccuracy && err.code === 1) throw err
      }
      if (i < samples - 1) {
        await new Promise((r) => setTimeout(r, 600))
      }
    }
    if (readings.length > 0) break
  }

  if (readings.length === 0) {
    const error = new Error('Unable to get GPS location — allow location access or paste coordinates')
    error.code = 2
    throw error
  }

  return readings.reduce((best, current) =>
    (current.accuracy ?? Infinity) < (best.accuracy ?? Infinity) ? current : best,
  )
}

export function getCurrentPosition() {
  return getBestPosition(1)
}

/** Best-effort GPS for incident reports — never blocks longer than timeoutMs. */
export async function getOptionalPosition(timeoutMs = 5000, samples = 1) {
  if (!navigator.geolocation) return null

  try {
    return await Promise.race([
      getBestPosition(samples),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('GPS timeout')), timeoutMs)
      }),
    ])
  } catch {
    return null
  }
}

/**
 * Forward-geocode a street address via Photon (OpenStreetMap / Komoot).
 * Supports house numbers — Open-Meteo only matches city names.
 * Returns up to `limit` candidates with lat/lng + display label.
 */
export async function searchPlaces(query, { limit = 6, countryCode = 'CA' } = {}) {
  const q = (query || '').trim()
  if (q.length < 3) return []

  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('lang', 'en')
  // Bias toward GTA / southern Ontario so Canadian street lookups rank first
  if (countryCode === 'CA') {
    url.searchParams.set('lat', '43.65')
    url.searchParams.set('lon', '-79.38')
  }

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Address lookup failed — try again or paste coordinates.')

  const data = await res.json()
  const features = data.features || []

  const mapped = features
    .map((f) => {
      const [lng, lat] = f.geometry?.coordinates || []
      if (lat == null || lng == null) return null
      const p = f.properties || {}
      if (countryCode && p.countrycode && p.countrycode.toUpperCase() !== countryCode.toUpperCase()) {
        return null
      }
      const line = [
        [p.housenumber, p.street || p.name].filter(Boolean).join(' '),
        p.district,
        p.city || p.town || p.village || p.municipality,
        p.state,
        p.postcode,
        p.country,
      ]
        .filter(Boolean)
        .join(', ')
      const label = line || p.name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      const shortName =
        [p.housenumber, p.street || p.name].filter(Boolean).join(' ') || p.name || 'Location'
      return {
        id: `${lat},${lng},${p.osm_id || label}`,
        label,
        name: shortName,
        latitude: lat,
        longitude: lng,
      }
    })
    .filter(Boolean)

  if (mapped.length) return mapped

  // Fallback: Nominatim (also OSM) if Photon returns nothing
  const nom = new URL('https://nominatim.openstreetmap.org/search')
  nom.searchParams.set('q', q)
  nom.searchParams.set('format', 'json')
  nom.searchParams.set('addressdetails', '1')
  nom.searchParams.set('limit', String(limit))
  if (countryCode) nom.searchParams.set('countrycodes', countryCode.toLowerCase())

  const nomRes = await fetch(nom.toString(), {
    headers: { Accept: 'application/json' },
  })
  if (!nomRes.ok) return []

  const nomData = await nomRes.json()
  return (nomData || []).map((r) => ({
    id: String(r.place_id),
    label: r.display_name,
    name: [r.address?.house_number, r.address?.road].filter(Boolean).join(' ') || r.display_name.split(',')[0],
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
  }))
}
