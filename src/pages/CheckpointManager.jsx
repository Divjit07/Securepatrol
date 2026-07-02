import { useEffect, useState } from 'react'
import { Plus, QrCode, Trash2, Copy, Check, Printer, Pencil, X } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import QrPrintModal from '../components/QrPrintModal.jsx'
import {
  floorElevationMetres,
  defaultRadiusForFloor,
  minDistanceToCheckpoints,
  parseCoordinatePaste,
  MIN_FLOOR_COORD_SEPARATION,
  getBestPosition,
} from '../lib/gps.js'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'

export default function CheckpointManager() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState('')
  const [floors, setFloors] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showFloorForm, setShowFloorForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    floor_id: '',
    latitude: '',
    longitude: '',
    radius_metres: 20,
    altitude_metres: '',
    coordPaste: '',
    checkpoint_role: 'patrol',
  })
  const [floorForm, setFloorForm] = useState({ floor_name: '', floor_number: 1 })
  const [generateQrAfterSave, setGenerateQrAfterSave] = useState(true)
  const [qrModal, setQrModal] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsMessage, setGpsMessage] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const selectedSiteName = sites.find((s) => s.id === selectedSite)?.name || ''

  const copyCheckpointId = async (id) => {
    await navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const loadFloors = async (siteId) => {
    const { data } = await supabase
      .from('floors')
      .select('*')
      .eq('site_id', siteId)
      .order('floor_number')
    setFloors(data || [])
    return data || []
  }

  const loadCheckpoints = async (floorList) => {
    if (!floorList.length) {
      setCheckpoints([])
      return []
    }
    const { data } = await supabase
      .from('checkpoints')
      .select('*, floors(floor_name)')
      .in('floor_id', floorList.map((f) => f.id))
      .eq('active', true)
      .order('name')
    setCheckpoints(data || [])
    return data || []
  }

  useEffect(() => {
    if (!user) return
    fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin').then((s) => {
      setSites(s)
      if (s.length) setSelectedSite(s[0].id)
    })
  }, [user?.id])

  useEffect(() => {
    if (!selectedSite) return
    loadFloors(selectedSite)
  }, [selectedSite])

  useEffect(() => {
    loadCheckpoints(floors)
  }, [floors])

  const openQrModal = (items, title) => {
    setQrModal({
      checkpoints: Array.isArray(items) ? items : [items],
      title,
    })
  }

  const createFloor = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase
      .from('floors')
      .insert({
        site_id: selectedSite,
        ...floorForm,
        floor_number: Number(floorForm.floor_number),
        elevation_metres: floorElevationMetres(Number(floorForm.floor_number)),
      })
      .select('*')
      .single()

    if (error) {
      alert(error.message)
      return
    }

    setFloorForm({ floor_name: '', floor_number: 1 })
    setShowFloorForm(false)
    await loadFloors(selectedSite)
  }

  const createCheckpoint = async (e) => {
    e.preventDefault()

    const floor = floors.find((f) => f.id === form.floor_id)
    const lat = parseFloat(form.latitude)
    const lng = parseFloat(form.longitude)

    if (floor?.floor_number > 1 && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      const lobbyCheckpoints = checkpoints.filter((cp) => {
        const cpFloor = floors.find((f) => f.id === cp.floor_id)
        return cpFloor?.floor_number === 1
      })
      const separation = minDistanceToCheckpoints(lat, lng, lobbyCheckpoints)
      if (separation != null && separation < MIN_FLOOR_COORD_SEPARATION) {
        const proceed = confirm(
          `These coordinates are only ${separation.toFixed(0)}m from the lobby checkpoint on the map. ` +
            `Guards on floor ${floor.floor_number} may fail scans, and ground-floor spoofing may still work. ` +
            `Use Google Maps to pin a spot on floor ${floor.floor_number} that is at least ${MIN_FLOOR_COORD_SEPARATION}m away from the lobby (window / far corner). Save anyway?`,
        )
        if (!proceed) return
      }
    }

    const altitudeValue =
      form.altitude_metres !== ''
        ? parseFloat(form.altitude_metres)
        : floor
          ? floorElevationMetres(floor.floor_number)
          : null

    const { data, error } = await supabase
      .from('checkpoints')
      .insert({
        name: form.name,
        floor_id: form.floor_id,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        altitude_metres: altitudeValue,
        radius_metres: parseInt(form.radius_metres, 10) || defaultRadiusForFloor(),
        checkpoint_role: form.checkpoint_role,
      })
      .select('*, floors(floor_name)')
      .single()

    if (error) {
      alert(error.message)
      return
    }

    setForm({ name: '', floor_id: '', latitude: '', longitude: '', altitude_metres: '', radius_metres: 20, coordPaste: '', checkpoint_role: 'patrol' })
    setShowForm(false)
    await loadCheckpoints(floors)

    if (generateQrAfterSave) {
      openQrModal(data, `${data.name} — QR label`)
    }
  }

  const deleteCheckpoint = async (id) => {
    if (!confirm('Delete this checkpoint? It will be removed from patrol routes. Scan history is kept.')) return

    const { error } = await supabase.from('checkpoints').update({ active: false }).eq('id', id)
    if (error) {
      alert(`Could not delete checkpoint: ${error.message}`)
      return
    }

    setCheckpoints((prev) => prev.filter((c) => c.id !== id))
  }

  const startRename = (cp) => {
    setEditingId(cp.id)
    setEditName(cp.name)
  }

  const cancelRename = () => {
    setEditingId(null)
    setEditName('')
  }

  const saveRename = async (id) => {
    const trimmed = editName.trim()
    if (!trimmed) {
      alert('Checkpoint name cannot be empty.')
      return
    }

    const { error } = await supabase.from('checkpoints').update({ name: trimmed }).eq('id', id)
    if (error) {
      alert(`Could not rename checkpoint: ${error.message}`)
      return
    }

    setCheckpoints((prev) =>
      prev.map((cp) => (cp.id === id ? { ...cp, name: trimmed } : cp)),
    )
    cancelRename()
  }

  const deleteFloor = async (floor) => {
    const count = checkpoints.filter((cp) => cp.floor_id === floor.id).length
    const message =
      count > 0
        ? `Delete "${floor.floor_name}" and its ${count} checkpoint${count === 1 ? '' : 's'}? Scan history is kept but checkpoints will be removed from patrol routes.`
        : `Delete floor "${floor.floor_name}"? This cannot be undone.`

    if (!confirm(message)) return

    if (count > 0) {
      const { error: deactivateError } = await supabase
        .from('checkpoints')
        .update({ active: false })
        .eq('floor_id', floor.id)

      if (deactivateError) {
        alert(`Could not remove checkpoints: ${deactivateError.message}`)
        return
      }
    }

    const { error } = await supabase.from('floors').delete().eq('id', floor.id)
    if (error) {
      alert(`Could not delete floor: ${error.message}`)
      return
    }

    const nextFloors = floors.filter((f) => f.id !== floor.id)
    setFloors(nextFloors)
    setCheckpoints((prev) => prev.filter((cp) => cp.floor_id !== floor.id))
  }

  const printFloorLabels = (floor) => {
    const floorCheckpoints = checkpoints.filter((cp) => cp.floor_id === floor.id)
    if (!floorCheckpoints.length) {
      alert(`No checkpoints on ${floor.floor_name} yet. Add a checkpoint first, then print its QR label.`)
      return
    }
    openQrModal(floorCheckpoints, `${floor.floor_name} — all checkpoint labels`)
  }

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setGpsMessage({ type: 'error', text: 'This browser does not support GPS. Paste coordinates instead.' })
      return
    }

    setGpsLoading(true)
    setGpsMessage({ type: 'info', text: 'Getting location… allow access if your browser asks.' })

    try {
      const pos = await getBestPosition(2)
      setForm((f) => ({
        ...f,
        latitude: pos.latitude.toFixed(6),
        longitude: pos.longitude.toFixed(6),
        altitude_metres:
          pos.altitude != null ? pos.altitude.toFixed(1) : f.altitude_metres,
      }))
      setGpsMessage({
        type: 'success',
        text: `Location captured (±${Math.round(pos.accuracy ?? 0)}m accuracy).`,
      })
    } catch (err) {
      const code = err?.code
      let text = 'Could not get GPS. Paste coordinates manually instead.'

      if (code === 1 || err.message?.includes('denied')) {
        text =
          'Location blocked. Click the lock icon in your browser address bar → allow Location for this site, then try again.'
      } else if (code === 3 || err.message?.includes('Timeout')) {
        text =
          'GPS timed out. On a laptop, Wi‑Fi location is weak — paste coordinates from Maps or try on your phone.'
      } else if (code === 2 || err.message?.includes('unavailable')) {
        text = 'GPS unavailable on this device. Paste coordinates instead.'
      }

      setGpsMessage({ type: 'error', text })
    } finally {
      setGpsLoading(false)
    }
  }

  const applyCoordPaste = () => {
    const parsed = parseCoordinatePaste(form.coordPaste)
    if (!parsed) {
      alert('Paste coordinates like: 43.6532, -79.3832')
      return
    }
    setForm((f) => ({
      ...f,
      latitude: parsed.lat.toFixed(6),
      longitude: parsed.lng.toFixed(6),
    }))
  }

  const applyFloorAltitude = (floorId) => {
    const floor = floors.find((f) => f.id === floorId)
    if (!floor) return
    setForm((f) => ({
      ...f,
      altitude_metres: String(floorElevationMetres(floor.floor_number)),
    }))
  }

  return (
    <Layout variant="admin">
      <PageHeader
        title="Checkpoints"
        description="Add floors and checkpoints, then print QR labels to stick on site."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowFloorForm(true)} className="sp-btn-secondary">
              Add floor
            </button>
            <button type="button" onClick={() => setShowForm(true)} className="sp-btn-primary">
              <Plus className="h-4 w-4" /> Add checkpoint
            </button>
          </div>
        }
      />

      {sites.length > 1 && (
        <select
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
          className="sp-input mb-6 max-w-xs"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      {showFloorForm && (
        <form onSubmit={createFloor} className="sp-card mb-6 p-6">
          <h3 className="font-display text-lg font-semibold">New floor</h3>
          <p className="mt-1 text-sm text-slate-500">
            Floors group checkpoints. QR labels are generated per checkpoint after you add them.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="sp-label">Floor name</label>
              <input
                placeholder="e.g. Lobby"
                value={floorForm.floor_name}
                onChange={(e) => setFloorForm({ ...floorForm, floor_name: e.target.value })}
                required
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Floor number</label>
              <input
                type="number"
                value={floorForm.floor_number}
                onChange={(e) => setFloorForm({ ...floorForm, floor_number: e.target.value })}
                required
                className="sp-input"
              />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" className="sp-btn-primary">Create floor</button>
            <button type="button" onClick={() => setShowFloorForm(false)} className="sp-btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {showForm && (
        <form onSubmit={createCheckpoint} className="sp-card mb-6 p-6">
          <h3 className="font-display text-lg font-semibold">New checkpoint</h3>
          <p className="mb-4 text-sm text-slate-600">
            Stand at the tag location, tap <strong>Use my GPS</strong>, or paste coordinates from any maps app.
            Upper floors: use a spot away from the lobby.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="sp-label">Checkpoint name</label>
              <input
                placeholder="e.g. Main entrance"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Floor</label>
              <select
                value={form.floor_id}
                onChange={(e) => {
                  const floor = floors.find((f) => f.id === e.target.value)
                  setForm({
                    ...form,
                    floor_id: e.target.value,
                    radius_metres: 20,
                    altitude_metres: floor ? String(floorElevationMetres(floor.floor_number)) : '',
                  })
                }}
                required
                className="sp-input"
              >
                <option value="">Select floor</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>{f.floor_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="sp-label">GPS radius (metres)</label>
              <input
                type="number"
                value={form.radius_metres}
                onChange={(e) => setForm({ ...form, radius_metres: e.target.value })}
                className="sp-input"
              />
          <p className="mt-1 text-xs text-slate-500">Default 20m + indoor GPS tolerance.</p>
            </div>
            <div>
              <label className="sp-label">Checkpoint type</label>
              <select
                value={form.checkpoint_role}
                onChange={(e) => setForm({ ...form, checkpoint_role: e.target.value })}
                className="sp-input"
              >
                <option value="patrol">Patrol checkpoint</option>
                <option value="shift_clock_in">Shift clock-in (Main Entrance)</option>
                <option value="shift_clock_out">Shift clock-out</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Clock-in starts the shift timer for client hours reports.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="sp-label">Paste coordinates (optional)</label>
              <div className="flex gap-2">
                <input
                  value={form.coordPaste}
                  onChange={(e) => setForm({ ...form, coordPaste: e.target.value })}
                  placeholder="43.653226, -79.383184"
                  className="sp-input flex-1"
                />
                <button type="button" onClick={applyCoordPaste} className="sp-btn-secondary shrink-0">
                  Apply
                </button>
              </div>
            </div>
            <div>
              <label className="sp-label">Latitude</label>
              <input
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                required
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Longitude</label>
              <input
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                required
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Altitude (metres)</label>
              <div className="flex gap-2">
                <input
                  value={form.altitude_metres}
                  onChange={(e) => setForm({ ...form, altitude_metres: e.target.value })}
                  placeholder="Auto from floor number"
                  className="sp-input flex-1"
                />
                {form.floor_id && (
                  <button
                    type="button"
                    onClick={() => applyFloorAltitude(form.floor_id)}
                    className="sp-btn-secondary shrink-0 text-xs"
                  >
                    Floor default
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">Floor 1 = 0m, floor 2 = 3.5m, floor 5 = 14m, etc.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={gpsLoading}
            className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100 disabled:opacity-60"
          >
            {gpsLoading ? 'Getting GPS…' : 'Use my current GPS location'}
          </button>
          {gpsMessage && (
            <p
              className={`mt-2 text-sm ${
                gpsMessage.type === 'error'
                  ? 'text-red-700'
                  : gpsMessage.type === 'success'
                    ? 'text-green-700'
                    : 'text-slate-600'
              }`}
            >
              {gpsMessage.text}
            </p>
          )}
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={generateQrAfterSave}
              onChange={(e) => setGenerateQrAfterSave(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            Generate printable QR label after saving
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Also copy the checkpoint UUID to write NFC tags with NFC Tools.
          </p>
          <div className="mt-5 flex gap-3">
            <button type="submit" className="sp-btn-primary">Create checkpoint</button>
            <button type="button" onClick={() => setShowForm(false)} className="sp-btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="sp-card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-display font-semibold">Floors</h2>
            <p className="text-sm text-slate-500">
              Manage floors, print QR labels, or remove a floor added by mistake.
            </p>
          </div>
          <button type="button" onClick={() => setShowFloorForm(true)} className="sp-btn-secondary py-2 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add floor
          </button>
        </div>

        {floors.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No floors yet. Click <strong>Add floor</strong> above to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-5 py-3 font-medium">Floor</th>
                <th className="px-5 py-3 font-medium">Checkpoints</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {floors.map((floor) => {
                const count = checkpoints.filter((cp) => cp.floor_id === floor.id).length
                return (
                  <tr key={floor.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{floor.floor_name}</p>
                      <p className="text-xs text-slate-500">Level {floor.floor_number}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {count} checkpoint{count === 1 ? '' : 's'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => printFloorLabels(floor)}
                          className="sp-btn-secondary py-2 text-xs"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Print QRs
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteFloor(floor)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete floor
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="sp-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display font-semibold">Checkpoints</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Floor</th>
              <th className="px-4 py-3 font-medium">GPS</th>
              <th className="px-4 py-3 font-medium">Radius</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">ID (NFC)</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {checkpoints.map((cp) => (
              <tr key={cp.id}>
                <td className="px-4 py-3">
                  {editingId === cp.id ? (
                    <div className="flex min-w-[12rem] items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(cp.id)
                          if (e.key === 'Escape') cancelRename()
                        }}
                        autoFocus
                        className="sp-input py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => saveRename(cp.id)}
                        className="rounded-lg p-1.5 text-green-600 hover:bg-green-50"
                        title="Save name"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cp.name}</span>
                      <button
                        type="button"
                        onClick={() => startRename(cp)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                        title="Rename checkpoint"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{cp.floors?.floor_name}</td>
                <td className="px-4 py-3 text-xs">{cp.latitude?.toFixed(4)}, {cp.longitude?.toFixed(4)}</td>
                <td className="px-4 py-3">{cp.radius_metres}m</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {cp.checkpoint_role === 'shift_clock_in'
                    ? 'Clock in'
                    : cp.checkpoint_role === 'shift_clock_out'
                      ? 'Clock out'
                      : 'Patrol'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{cp.id.slice(0, 8)}…</span>
                    <button
                      type="button"
                      onClick={() => copyCheckpointId(cp.id)}
                      className="text-slate-500 hover:text-brand-600"
                      title="Copy full UUID for NFC tag"
                    >
                      {copiedId === cp.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openQrModal(cp, `${cp.name} — QR label`)}
                      className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50"
                      title="Generate & print QR label"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCheckpoint(cp.id)}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {checkpoints.length === 0 && (
          <p className="p-8 text-center text-slate-500">No checkpoints yet. Add a floor, then add checkpoints.</p>
        )}
      </div>

      {qrModal && (
        <QrPrintModal
          checkpoints={qrModal.checkpoints}
          siteName={selectedSiteName}
          title={qrModal.title}
          onClose={() => setQrModal(null)}
        />
      )}
    </Layout>
  )
}
