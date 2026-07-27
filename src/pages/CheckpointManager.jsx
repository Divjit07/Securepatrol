import { useEffect, useState } from 'react'
import { Plus, Trash2, Copy, Check, Pencil, X } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import {
  floorElevationMetres,
  defaultRadiusForFloor,
  minDistanceToCheckpoints,
  MIN_FLOOR_COORD_SEPARATION,
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
  const [copiedId, setCopiedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

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
        latitude: Number.isNaN(lat) ? null : lat,
        longitude: Number.isNaN(lng) ? null : lng,
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

  return (
    <Layout variant="admin">
      <PageHeader
        title="Checkpoints"
        description="Add floors and checkpoints, then write each checkpoint's UUID to an NFC tag."
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
          <p className="mt-1 text-sm text-ink-2">
            Floors group checkpoints. Each checkpoint gets a UUID you write to its NFC tag.
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
          <p className="mb-4 text-sm text-ink-2">
            Give it a name and save — the NFC tag verifies the visit. After saving, copy the
            checkpoint's UUID and write it to the tag.
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
              <label className="sp-label">Checkpoint type</label>
              <select
                value={form.checkpoint_role}
                onChange={(e) => setForm({ ...form, checkpoint_role: e.target.value })}
                className="sp-input"
              >
                <option value="patrol">Patrol checkpoint (patrol verification only)</option>
                <option value="shift_clock_in">Dedicated clock-in tag (separate from patrol — for the clock in/out NFC fallback)</option>
                <option value="shift_clock_out">Dedicated clock-out tag (optional — without it, hours auto-end at the scheduled / site closing time)</option>
              </select>
              <p className="mt-1 text-xs text-ink-2">
                Guards clock in/out with GPS by default; a dedicated clock tag is only the NFC fallback.
                Patrol checkpoints (e.g. Main Entrance) are for patrol verification and never clock anyone in.
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink-2">
            After saving, copy the checkpoint's UUID and write it to its NFC tag (e.g. with NFC Tools).
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="font-display font-semibold">Floors</h2>
            <p className="text-sm text-ink-2">
              Manage floors, or remove a floor added by mistake.
            </p>
          </div>
          <button type="button" onClick={() => setShowFloorForm(true)} className="sp-btn-secondary py-2 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add floor
          </button>
        </div>

        {floors.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-2">
            No floors yet. Click <strong>Add floor</strong> above to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-ink-2">
              <tr>
                <th className="px-5 py-3 font-medium">Floor</th>
                <th className="px-5 py-3 font-medium">Checkpoints</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {floors.map((floor) => {
                const count = checkpoints.filter((cp) => cp.floor_id === floor.id).length
                return (
                  <tr key={floor.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{floor.floor_name}</p>
                      <p className="text-xs text-ink-2">Level {floor.floor_number}</p>
                    </td>
                    <td className="px-5 py-3 text-ink-2">
                      {count} checkpoint{count === 1 ? '' : 's'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => deleteFloor(floor)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-accent-red/15 px-3 py-2 text-xs font-semibold text-accent-red transition hover:bg-accent-red/15"
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
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="font-display font-semibold">Checkpoints</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-ink-2">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Floor</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">ID (NFC)</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
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
                        className="rounded-lg p-1.5 text-accent-green hover:bg-accent-green/15"
                        title="Save name"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="rounded-lg p-1.5 text-ink-2 hover:bg-white/10"
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
                        className="rounded-lg p-1 text-ink-3 hover:bg-white/10 hover:text-accent-cyan-line"
                        title="Rename checkpoint"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{cp.floors?.floor_name}</td>
                <td className="px-4 py-3 text-xs text-ink-2">
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
                      className="text-ink-2 hover:text-accent-cyan-line"
                      title="Copy full UUID for NFC tag"
                    >
                      {copiedId === cp.id ? <Check className="h-4 w-4 text-accent-green" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => deleteCheckpoint(cp.id)}
                      className="rounded-lg p-1.5 text-accent-red hover:bg-accent-red/15"
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
          <p className="p-8 text-center text-ink-2">No checkpoints yet. Add a floor, then add checkpoints.</p>
        )}
      </div>

    </Layout>
  )
}
