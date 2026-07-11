// Live Map (/admin/map): site geofences + where each guard's phone last was.
// Positions come from scan GPS (every clock punch and patrol scan carries
// coordinates) — last scan per guard = last known phone location. Continuous
// background tracking arrives with the Capacitor app.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin,
  ScanFace,
  QrCode,
  Nfc,
  Clock,
  Plus,
  LocateFixed,
  Search,
  Pencil,
} from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { getBestPosition, parseCoordinatePaste, searchPlaces } from '../lib/gps.js'
import { createShift } from '../lib/schedule.js'
import { supabase } from '../lib/supabase.js'

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

const FRESH_MINUTES = 20

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
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

function todayDateInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminLiveMap() {
  const { user, isSuperAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sites, setSites] = useState([])
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const previewRef = useRef(null)
  const containerRef = useRef(null)
  const guardMarkersRef = useRef({})
  const panelOpenRef = useRef(false)
  const formRef = useRef(null)

  const emptyForm = {
    mode: 'new', // 'new' | 'update'
    siteId: '',
    name: '',
    address: '',
    lat: '',
    lng: '',
    radius: '120',
    createOnCall: false,
    shiftStart: '09:00',
    shiftEnd: '17:00',
  }
  const [showPanel, setShowPanel] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [addOk, setAddOk] = useState('')
  const [locating, setLocating] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [placeHits, setPlaceHits] = useState([])

  panelOpenRef.current = showPanel
  formRef.current = form

  const drawPreview = (lat, lng, radiusM) => {
    if (!previewRef.current || !mapRef.current) return
    previewRef.current.clearLayers()
    L.circle([lat, lng], {
      radius: radiusM || 120,
      color: '#FACC15',
      weight: 2,
      dashArray: '6 6',
      fillColor: '#FACC15',
      fillOpacity: 0.1,
    }).addTo(previewRef.current)
  }

  const setCoords = (lat, lng) => {
    const radius = parseInt(formRef.current?.radius, 10) || 120
    setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
    drawPreview(lat, lng, radius)
  }

  const useMyLocation = async () => {
    setLocating(true)
    setAddError('')
    try {
      const pos = await getBestPosition(2)
      setCoords(pos.latitude, pos.longitude)
      mapRef.current?.flyTo([pos.latitude, pos.longitude], 17)
    } catch (err) {
      setAddError(err.message || 'Could not get your location.')
    } finally {
      setLocating(false)
    }
  }

  const lookupAddress = async () => {
    setLookingUp(true)
    setAddError('')
    setPlaceHits([])
    try {
      const hits = await searchPlaces(form.address || form.name)
      if (!hits.length) {
        setAddError('No matches — try a fuller street address (e.g. 800 Bathurst St, Toronto).')
        return
      }
      setPlaceHits(hits)
      if (hits.length === 1) applyPlace(hits[0])
    } catch (err) {
      setAddError(err.message || 'Address lookup failed.')
    } finally {
      setLookingUp(false)
    }
  }

  const applyPlace = (place) => {
    setForm((f) => ({
      ...f,
      address: place.label,
      name: f.mode === 'new' && !f.name.trim() ? place.name : f.name,
      lat: place.latitude.toFixed(6),
      lng: place.longitude.toFixed(6),
    }))
    setPlaceHits([])
    drawPreview(place.latitude, place.longitude, parseInt(formRef.current?.radius, 10) || 120)
    mapRef.current?.flyTo([place.latitude, place.longitude], 17)
  }

  const syncClockCheckpoints = async (siteId) => {
    await Promise.all([
      supabase.rpc('ensure_clock_checkpoint', { p_site_id: siteId, p_role: 'shift_clock_in' }),
      supabase.rpc('ensure_clock_checkpoint', { p_site_id: siteId, p_role: 'shift_clock_out' }),
    ])
  }

  const maybeCreateOnCallShift = async (siteId) => {
    if (!form.createOnCall) return
    const date = todayDateInput()
    const starts = new Date(`${date}T${form.shiftStart}`)
    const ends = new Date(`${date}T${form.shiftEnd}`)
    if (ends <= starts) ends.setDate(ends.getDate() + 1)
    await createShift({
      site_id: siteId,
      guard_id: null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      break_minutes: 0,
      status: 'published',
      published_at: new Date().toISOString(),
      notes: 'On-call / live map geofence',
      color: 'amber',
      created_by: user.id,
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setAddError('')
    setAddOk('')
    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setAddError('Look up an address, tap the map, paste coordinates, or use your location.')
      return
    }
    const radius = Math.min(1000, Math.max(30, parseInt(form.radius, 10) || 120))

    setSaving(true)
    try {
      if (form.mode === 'update') {
        if (!form.siteId) throw new Error('Pick which site to update.')
        const { error } = await supabase
          .from('sites')
          .update({
            address: form.address || null,
            latitude: lat,
            longitude: lng,
            geofence_radius_m: radius,
          })
          .eq('id', form.siteId)
        if (error) throw error
        await syncClockCheckpoints(form.siteId)
        await maybeCreateOnCallShift(form.siteId)
        setAddOk('Geofence updated. Guards can Face ID clock in inside this radius.')
      } else {
        if (!form.name.trim()) throw new Error('Site name is required.')
        const { data, error } = await supabase
          .from('sites')
          .insert({
            name: form.name.trim(),
            address: form.address || null,
            admin_id: user.id,
            latitude: lat,
            longitude: lng,
            geofence_radius_m: radius,
          })
          .select('id')
          .single()
        if (error) throw error
        await syncClockCheckpoints(data.id)
        await maybeCreateOnCallShift(data.id)
        setAddOk(
          form.createOnCall
            ? 'Site geofenced and open on-call shift published for today.'
            : 'Site created with geofence. Guards can Face ID clock in inside this radius.',
        )
      }
      setForm(emptyForm)
      setShowPanel(false)
      previewRef.current?.clearLayers()
      load()
    } catch (err) {
      setAddError(err.message || 'Could not save geofence.')
    } finally {
      setSaving(false)
    }
  }

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

  useEffect(() => {
    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      drawPreview(lat, lng, parseInt(form.radius, 10) || 120)
    }
  }, [form.radius])

  const siteIds = useMemo(() => new Set(sites.map((s) => s.id)), [sites])
  const myScans = useMemo(
    () => scans.filter((s) => siteIds.has(s.checkpoints?.floors?.site_id)),
    [scans, siteIds],
  )
  const lastSeen = useMemo(() => {
    const byGuard = new Map()
    for (const s of myScans) {
      if (!byGuard.has(s.guard_id)) byGuard.set(s.guard_id, s)
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true })
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    map.setView([43.65, -79.38], 11)
    map.on('click', (e) => {
      if (panelOpenRef.current) setCoords(e.latlng.lat, e.latlng.lng)
    })
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    previewRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
      previewRef.current = null
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

    if (bounds.length && !panelOpenRef.current) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [geocodedSites.length, lastSeen, siteById])

  const flyToGuard = (guardId) => {
    const marker = guardMarkersRef.current[guardId]
    if (marker && mapRef.current) {
      mapRef.current.flyTo(marker.getLatLng(), 17, { duration: 0.8 })
      marker.openPopup()
    }
  }

  const openPanel = (mode = 'new', site = null) => {
    setAddError('')
    setAddOk('')
    setPlaceHits([])
    if (mode === 'update' && site) {
      setForm({
        ...emptyForm,
        mode: 'update',
        siteId: site.id,
        name: site.name || '',
        address: site.address || '',
        lat: site.latitude != null ? String(site.latitude) : '',
        lng: site.longitude != null ? String(site.longitude) : '',
        radius: String(site.geofence_radius_m || 120),
      })
      if (site.latitude != null && site.longitude != null) {
        drawPreview(site.latitude, site.longitude, site.geofence_radius_m || 120)
        mapRef.current?.flyTo([site.latitude, site.longitude], 16)
      }
    } else {
      setForm({ ...emptyForm, mode })
    }
    setShowPanel(true)
  }

  // Deep-link from Sites directory: /admin/map?geofence=<siteId>
  useEffect(() => {
    const siteId = searchParams.get('geofence')
    if (!siteId || !sites.length) return
    const site = sites.find((s) => s.id === siteId)
    if (!site) return
    openPanel('update', site)
    const next = new URLSearchParams(searchParams)
    next.delete('geofence')
    setSearchParams(next, { replace: true })
  }, [sites, searchParams])

  return (
    <Layout variant="admin">
      <PageHeader
        title="Live Map"
        description="Site geofences, today's clock-ins, and each guard's last known phone position (from scan GPS)."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openPanel('update')} className="dk-btn-2">
              <Pencil className="h-4 w-4" /> Set geofence
            </button>
            <button type="button" onClick={() => openPanel('new')} className="dk-cta">
              <Plus className="h-4 w-4" /> New site
            </button>
          </div>
        }
      />

      {addOk && !showPanel && (
        <div className="mb-4 rounded-xl bg-accent-green/10 px-4 py-3 text-sm font-medium text-accent-green">
          {addOk}
        </div>
      )}

      {showPanel && (
        <form onSubmit={handleSave} className="dk-card mb-5 p-5">
          <h3 className="font-display text-lg font-semibold text-ink">
            {form.mode === 'update' ? 'Geofence from address' : 'New site with geofence'}
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            Type an address and look it up — no need to visit the property. You can still tap the
            map, paste coordinates, or use your phone GPS.
          </p>

          <div className="mt-4 flex gap-1 rounded-full border border-ink/10 bg-ink/5 p-1">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, mode: 'new', siteId: '' }))}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                form.mode === 'new' ? 'bg-black text-white' : 'text-ink-2'
              }`}
            >
              New site
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, mode: 'update' }))}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                form.mode === 'update' ? 'bg-black text-white' : 'text-ink-2'
              }`}
            >
              Existing site
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {form.mode === 'update' ? (
              <div className="sm:col-span-2">
                <label className="sp-label">Site to update</label>
                <select
                  value={form.siteId}
                  onChange={(e) => {
                    const site = sites.find((s) => s.id === e.target.value)
                    setForm((f) => ({
                      ...f,
                      siteId: e.target.value,
                      name: site?.name || '',
                      address: site?.address || f.address,
                      lat: site?.latitude != null ? String(site.latitude) : f.lat,
                      lng: site?.longitude != null ? String(site.longitude) : f.lng,
                      radius: String(site?.geofence_radius_m || f.radius),
                    }))
                    if (site?.latitude != null && site?.longitude != null) {
                      setCoords(site.latitude, site.longitude)
                      mapRef.current?.flyTo([site.latitude, site.longitude], 16)
                    }
                  }}
                  required
                  className="sp-input"
                >
                  <option value="">Select site…</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.latitude == null ? ' (no GPS yet)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="sp-label">Site name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. On-call — 800 Bathurst"
                  className="sp-input"
                />
              </div>
            )}
            <div className={form.mode === 'update' ? 'sm:col-span-2' : ''}>
              <label className="sp-label">Address</label>
              <div className="flex gap-2">
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      lookupAddress()
                    }
                  }}
                  placeholder="800 Bathurst St, Toronto"
                  className="sp-input min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={lookupAddress}
                  disabled={lookingUp || !(form.address || form.name).trim()}
                  className="dk-cta shrink-0 px-4"
                >
                  <Search className={`h-4 w-4 ${lookingUp ? 'animate-pulse' : ''}`} />
                  {lookingUp ? '…' : 'Look up'}
                </button>
              </div>
              {placeHits.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-ink/10 bg-inset p-1.5">
                  {placeHits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        onClick={() => applyPlace(hit)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-ink/10"
                      >
                        {hit.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="sp-label">Latitude</label>
              <input
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                onPaste={(e) => {
                  const parsed = parseCoordinatePaste(e.clipboardData.getData('text'))
                  if (parsed) {
                    e.preventDefault()
                    setCoords(parsed.lat, parsed.lng)
                  }
                }}
                placeholder="43.664486"
                inputMode="decimal"
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Longitude</label>
              <input
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                onPaste={(e) => {
                  const parsed = parseCoordinatePaste(e.clipboardData.getData('text'))
                  if (parsed) {
                    e.preventDefault()
                    setCoords(parsed.lat, parsed.lng)
                  }
                }}
                placeholder="-79.411079"
                inputMode="decimal"
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Radius (m)</label>
              <input
                value={form.radius}
                onChange={(e) => setForm({ ...form, radius: e.target.value })}
                inputMode="numeric"
                className="sp-input"
              />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={useMyLocation} disabled={locating} className="dk-btn-2 w-full">
                <LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse' : ''}`} />
                {locating ? 'Locating…' : 'Use my location'}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-ink/10 bg-ink/5 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.createOnCall}
                onChange={(e) => setForm({ ...form, createOnCall: e.target.checked })}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Also publish an open on-call shift for today
                </span>
                <span className="mt-0.5 block text-xs text-ink-2">
                  Creates a claimable open shift at this geofence so a guard can pick it up on Roster /
                  Schedule.
                </span>
              </span>
            </label>
            {form.createOnCall && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="sp-label">Starts</label>
                  <input
                    type="time"
                    value={form.shiftStart}
                    onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
                    className="sp-input"
                  />
                </div>
                <div>
                  <label className="sp-label">Ends</label>
                  <input
                    type="time"
                    value={form.shiftEnd}
                    onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
                    className="sp-input"
                  />
                </div>
              </div>
            )}
          </div>

          {addError && (
            <p className="mt-3 rounded-xl bg-accent-red/10 px-4 py-2.5 text-sm text-accent-red">
              {addError}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="dk-cta">
              {saving
                ? 'Saving…'
                : form.mode === 'update'
                  ? 'Save geofence'
                  : 'Create site'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPanel(false)
                setPlaceHits([])
                previewRef.current?.clearLayers()
              }}
              className="dk-btn-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div
            ref={containerRef}
            className="h-[70dvh] w-full overflow-hidden rounded-2xl border border-white/10 bg-inset"
          />
          <p className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-orange" /> Seen in the last{' '}
              {FRESH_MINUTES} min
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" /> Older position
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-accent-orange bg-accent-orange/10" />{' '}
              Site geofence
            </span>
            {showPanel && (
              <span className="flex items-center gap-1.5 text-accent-orange">
                Yellow dashed = preview — tap map to move
              </span>
            )}
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
                      <span className="block truncate text-sm font-semibold text-ink">
                        {s.profiles?.name || 'Guard'}
                      </span>
                      <span className="block truncate text-xs text-ink-2">
                        {site?.name || 'Site'} ·{' '}
                        {new Date(s.scanned_at).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {s.distance_metres != null
                          ? ` · ${Math.round(s.distance_metres)}m from site`
                          : ''}
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
            <p className="mt-1 text-xs text-ink-3">From each guard&apos;s most recent scan (24h).</p>
            <div className="mt-3 space-y-2">
              {lastSeen.length === 0 && (
                <p className="text-sm text-ink-3">No guard positions in the last 24 hours.</p>
              )}
              {lastSeen.map((s) => {
                const fresh = Date.now() - new Date(s.scanned_at).getTime() < FRESH_MINUTES * 60000
                return (
                  <button
                    key={s.guard_id}
                    type="button"
                    onClick={() => flyToGuard(s.guard_id)}
                    className="flex w-full items-center gap-3 rounded-xl bg-ink/5 px-3 py-2.5 text-left transition hover:bg-ink/10"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${fresh ? 'bg-accent-green' : 'bg-zinc-500'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {s.profiles?.name || 'Guard'}
                      </span>
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
