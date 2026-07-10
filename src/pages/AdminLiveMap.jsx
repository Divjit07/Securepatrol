// Live Map (/admin/map): site geofences + where each guard's phone last was.
// Positions come from scan GPS (every clock punch and patrol scan carries
// coordinates) — last scan per guard = last known phone location. Continuous
// background tracking arrives with the Capacitor app.
import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, ScanFace, QrCode, Nfc, Clock } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { supabase } from '../lib/supabase.js'

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

const FRESH_MINUTES = 20

function initialsOf(name) {
  return (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function relativeTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m ago`
  return new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

function methodBadge(method) {
  if (method === 'face_gps') return { label: 'Face ID', Icon: ScanFace }
  if (method === 'nfc') return { label: 'NFC', Icon: Nfc }
  return { label: 'QR', Icon: QrCode }
}

export default function AdminLiveMap() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const containerRef = useRef(null)
  const guardMarkersRef = useRef({})

  const load = async () => {
    if (!user) return
    try {
      const siteList = await fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin')
      setSites(siteList)

      const since = new Date(Date.now() - 24 * 3600000).toISOString()
      const { data } = await supabase
        .from('scans')
        .select(
          'id, guard_id, scanned_at, guard_lat, guard_lng, gps_accuracy, status, scan_input_method, distance_metres, profiles:guard_id(name), checkpoints(name, checkpoint_role, floors(site_id, floor_name))',
        )
        .gte('scanned_at', since)
        .not('guard_lat', 'is', null)
        .order('scanned_at', { ascending: false })
        .limit(500)
      setScans(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    const channel = supabase
      .channel('live-map-scans')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans' }, load)
      .subscribe()
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user?.id, isSuperAdmin])

  // Latest position per guard + today's clock-ins, scoped to my sites.
  const siteIds = useMemo(() => new Set(sites.map((s) => s.id)), [sites])
  const myScans = useMemo(
    () => scans.filter((s) => siteIds.has(s.checkpoints?.floors?.site_id)),
    [scans, siteIds],
  )
  const lastSeen = useMemo(() => {
    const byGuard = new Map()
    for (const s of myScans) {
      if (!byGuard.has(s.guard_id)) byGuard.set(s.guard_id, s) // scans are desc
    }
    return [...byGuard.values()]
  }, [myScans])
  const clockIns = useMemo(() => {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    return myScans.filter(
      (s) =>
        s.checkpoints?.checkpoint_role === 'shift_clock_in' &&
        s.status === 'pass' &&
        new Date(s.scanned_at) >= dayStart,
    )
  }, [myScans])

  const siteById = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s])), [sites])
  const geocodedSites = sites.filter((s) => s.latitude != null && s.longitude != null)

  // ---- Leaflet ---------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true })
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    map.setView([43.65, -79.38], 11) // GTA default until data arrives
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    guardMarkersRef.current = {}
    const bounds = []

    for (const site of geocodedSites) {
      L.circle([site.latitude, site.longitude], {
        radius: site.geofence_radius_m ?? 120,
        color: '#96EE60',
        weight: 1.5,
        fillColor: '#96EE60',
        fillOpacity: 0.08,
      }).addTo(layer)
      L.marker([site.latitude, site.longitude], {
        icon: L.divIcon({
          className: '',
          html: `<div style="transform:translate(-50%,-100%);background:#111;border:1px solid rgba(255,255,255,0.25);color:#fff;padding:3px 8px;border-radius:999px;font:600 11px/1.2 system-ui;white-space:nowrap">${site.name}</div>`,
          iconSize: [0, 0],
        }),
      }).addTo(layer)
      bounds.push([site.latitude, site.longitude])
    }

    for (const s of lastSeen) {
      const fresh = Date.now() - new Date(s.scanned_at).getTime() < FRESH_MINUTES * 60000
      const marker = L.marker([s.guard_lat, s.guard_lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="transform:translate(-50%,-50%);width:34px;height:34px;border-radius:999px;background:${fresh ? '#96EE60' : '#52525b'};color:#0a0e09;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;border:3px solid ${fresh ? 'rgba(150,238,96,0.35)' : 'rgba(255,255,255,0.2)'};box-shadow:0 4px 14px rgba(0,0,0,0.5)">${initialsOf(s.profiles?.name)}</div>`,
          iconSize: [0, 0],
        }),
      }).addTo(layer)
      const site = siteById[s.checkpoints?.floors?.site_id]
      marker.bindPopup(
        `<strong>${s.profiles?.name || 'Guard'}</strong><br/>${s.checkpoints?.name || 'Checkpoint'}${site ? ` · ${site.name}` : ''}<br/>${relativeTime(s.scanned_at)} · ±${Math.round(s.gps_accuracy ?? 0)}m`,
      )
      guardMarkersRef.current[s.guard_id] = marker
      bounds.push([s.guard_lat, s.guard_lng])
    }

    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [geocodedSites.length, lastSeen, siteById])

  const flyToGuard = (guardId) => {
    const marker = guardMarkersRef.current[guardId]
    if (marker && mapRef.current) {
      mapRef.current.flyTo(marker.getLatLng(), 17, { duration: 0.8 })
      marker.openPopup()
    }
  }

  return (
    <Layout variant="admin">
      <PageHeader
        title="Live Map"
        description="Site geofences, today's clock-ins, and each guard's last known phone position (from scan GPS)."
      />

      {geocodedSites.length === 0 && !loading && (
        <div className="mb-4 rounded-xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-sm text-accent-orange">
          No sites have GPS coordinates yet. Set them from Overview → site card → clock icon → Location.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div ref={containerRef} className="h-[70dvh] w-full overflow-hidden rounded-2xl border border-white/10 bg-inset" />
          <p className="mt-2 flex items-center gap-4 text-xs text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-orange" /> Seen in the last {FRESH_MINUTES} min
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" /> Older position
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-accent-orange bg-accent-orange/10" /> Site geofence
            </span>
          </p>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <div className="dk-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Clock className="h-4 w-4 text-accent-orange" /> Clock-ins today
            </h2>
            <div className="mt-3 space-y-2">
              {clockIns.length === 0 && <p className="text-sm text-ink-3">No clock-ins yet today.</p>}
              {clockIns.map((s) => {
                const badge = methodBadge(s.scan_input_method)
                const site = siteById[s.checkpoints?.floors?.site_id]
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => flyToGuard(s.guard_id)}
                    className="flex w-full items-center gap-3 rounded-xl bg-ink/5 px-3 py-2.5 text-left transition hover:bg-ink/10"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-orange/20 text-[10px] font-bold text-accent-orange">
                      {initialsOf(s.profiles?.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{s.profiles?.name || 'Guard'}</span>
                      <span className="block truncate text-xs text-ink-2">
                        {site?.name || 'Site'} ·{' '}
                        {new Date(s.scanned_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        {s.distance_metres != null ? ` · ${Math.round(s.distance_metres)}m from site` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold text-ink-2">
                      <badge.Icon className="h-3 w-3" /> {badge.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="dk-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <MapPin className="h-4 w-4 text-accent-orange" /> Last known positions
            </h2>
            <p className="mt-1 text-xs text-ink-3">From each guard's most recent scan (24h).</p>
            <div className="mt-3 space-y-2">
              {lastSeen.length === 0 && <p className="text-sm text-ink-3">No guard positions in the last 24 hours.</p>}
              {lastSeen.map((s) => {
                const fresh = Date.now() - new Date(s.scanned_at).getTime() < FRESH_MINUTES * 60000
                return (
                  <button
                    key={s.guard_id}
                    type="button"
                    onClick={() => flyToGuard(s.guard_id)}
                    className="flex w-full items-center gap-3 rounded-xl bg-ink/5 px-3 py-2.5 text-left transition hover:bg-ink/10"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${fresh ? 'bg-accent-green' : 'bg-zinc-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{s.profiles?.name || 'Guard'}</span>
                      <span className="block truncate text-xs text-ink-2">
                        {s.checkpoints?.name || 'Checkpoint'} · {relativeTime(s.scanned_at)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
