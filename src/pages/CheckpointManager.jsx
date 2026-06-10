import { useEffect, useState } from 'react'
import { Plus, QrCode, Trash2, Copy, Check, Printer } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import QrPrintModal from '../components/QrPrintModal.jsx'
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
  })
  const [floorForm, setFloorForm] = useState({ floor_name: '', floor_number: 1 })
  const [generateQrAfterSave, setGenerateQrAfterSave] = useState(true)
  const [qrModal, setQrModal] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

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
    const { data, error } = await supabase
      .from('checkpoints')
      .insert({
        name: form.name,
        floor_id: form.floor_id,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radius_metres: parseInt(form.radius_metres, 10) || 20,
      })
      .select('*, floors(floor_name)')
      .single()

    if (error) {
      alert(error.message)
      return
    }

    setForm({ name: '', floor_id: '', latitude: '', longitude: '', radius_metres: 20 })
    setShowForm(false)
    await loadCheckpoints(floors)

    if (generateQrAfterSave) {
      openQrModal(data, `${data.name} — QR label`)
    }
  }

  const deleteCheckpoint = async (id) => {
    if (!confirm('Delete this checkpoint?')) return
    await supabase.from('checkpoints').delete().eq('id', id)
    setCheckpoints((prev) => prev.filter((c) => c.id !== id))
  }

  const deleteFloor = async (floor) => {
    const count = checkpoints.filter((cp) => cp.floor_id === floor.id).length
    const message =
      count > 0
        ? `Delete "${floor.floor_name}" and its ${count} checkpoint${count === 1 ? '' : 's'}? Scan history for those checkpoints will also be removed. This cannot be undone.`
        : `Delete floor "${floor.floor_name}"? This cannot be undone.`

    if (!confirm(message)) return

    const { error } = await supabase.from('floors').delete().eq('id', floor.id)
    if (error) {
      alert(error.message)
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

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
      },
      () => alert('Could not get GPS location'),
      { enableHighAccuracy: true },
    )
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
                onChange={(e) => setForm({ ...form, floor_id: e.target.value })}
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
          </div>
          <button
            type="button"
            onClick={useCurrentLocation}
            className="mt-3 text-sm font-medium text-brand-600 hover:underline"
          >
            Use my current GPS location
          </button>
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
              <th className="px-4 py-3 font-medium">ID (NFC)</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {checkpoints.map((cp) => (
              <tr key={cp.id}>
                <td className="px-4 py-3 font-medium">{cp.name}</td>
                <td className="px-4 py-3">{cp.floors?.floor_name}</td>
                <td className="px-4 py-3 text-xs">{cp.latitude?.toFixed(4)}, {cp.longitude?.toFixed(4)}</td>
                <td className="px-4 py-3">{cp.radius_metres}m</td>
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
