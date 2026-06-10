import { useEffect, useState } from 'react'
import { Plus, QrCode, Trash2, Copy, Check } from 'lucide-react'
import QRCode from 'qrcode'
import Layout from '../components/Layout.jsx'
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
  const [qrModal, setQrModal] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const copyCheckpointId = async (id) => {
    await navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
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
    supabase
      .from('floors')
      .select('*')
      .eq('site_id', selectedSite)
      .order('floor_number')
      .then(({ data }) => setFloors(data || []))
  }, [selectedSite])

  useEffect(() => {
    if (!floors.length) {
      setCheckpoints([])
      return
    }
    supabase
      .from('checkpoints')
      .select('*, floors(floor_name)')
      .in('floor_id', floors.map((f) => f.id))
      .order('name')
      .then(({ data }) => setCheckpoints(data || []))
  }, [floors])

  const createFloor = async (e) => {
    e.preventDefault()
    await supabase.from('floors').insert({
      site_id: selectedSite,
      ...floorForm,
      floor_number: Number(floorForm.floor_number),
    })
    setFloorForm({ floor_name: '', floor_number: 1 })
    setShowFloorForm(false)
    const { data } = await supabase.from('floors').select('*').eq('site_id', selectedSite).order('floor_number')
    setFloors(data || [])
  }

  const createCheckpoint = async (e) => {
    e.preventDefault()
    await supabase.from('checkpoints').insert({
      name: form.name,
      floor_id: form.floor_id,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius_metres: parseInt(form.radius_metres, 10) || 20,
    })
    setForm({ name: '', floor_id: '', latitude: '', longitude: '', radius_metres: 20 })
    setShowForm(false)
    const { data } = await supabase
      .from('checkpoints')
      .select('*, floors(floor_name)')
      .in('floor_id', floors.map((f) => f.id))
    setCheckpoints(data || [])
  }

  const deleteCheckpoint = async (id) => {
    if (!confirm('Delete this checkpoint?')) return
    await supabase.from('checkpoints').delete().eq('id', id)
    setCheckpoints((prev) => prev.filter((c) => c.id !== id))
  }

  const showQr = async (checkpoint) => {
    const url = `${window.location.origin}/checkpoint/${checkpoint.id}`
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 })
    setQrModal({ ...checkpoint, dataUrl, url })
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Checkpoint Manager</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFloorForm(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Add Floor
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Checkpoint
          </button>
        </div>
      </div>

      {sites.length > 1 && (
        <select
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
          className="mb-4 rounded-lg border border-slate-300 px-3 py-2"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      {showFloorForm && (
        <form onSubmit={createFloor} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">New Floor</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Floor name (e.g. Lobby)"
              value={floorForm.floor_name}
              onChange={(e) => setFloorForm({ ...floorForm, floor_name: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="number"
              placeholder="Floor number"
              value={floorForm.floor_number}
              onChange={(e) => setFloorForm({ ...floorForm, floor_number: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Create</button>
            <button type="button" onClick={() => setShowFloorForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {showForm && (
        <form onSubmit={createCheckpoint} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">New Checkpoint</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Checkpoint name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2"
            />
            <select
              value={form.floor_id}
              onChange={(e) => setForm({ ...form, floor_id: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Select floor</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.floor_name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Radius (metres)"
              value={form.radius_metres}
              onChange={(e) => setForm({ ...form, radius_metres: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="Latitude"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="Longitude"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <button
            type="button"
            onClick={useCurrentLocation}
            className="mt-3 text-sm text-brand-600 hover:underline"
          >
            Use my current GPS location
          </button>
          <p className="mt-1 text-xs text-slate-500">
            Write the checkpoint UUID to the NFC tag using NFC Tools app after creation.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                    <button type="button" onClick={() => showQr(cp)} className="text-brand-600 hover:text-brand-700">
                      <QrCode className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => deleteCheckpoint(cp.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {checkpoints.length === 0 && (
          <p className="p-8 text-center text-slate-500">No checkpoints yet.</p>
        )}
      </div>

      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setQrModal(null)}>
          <div className="rounded-xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">{qrModal.name}</h3>
            <img src={qrModal.dataUrl} alt="QR Code" className="mx-auto mt-4" />
            <p className="mt-2 font-mono text-xs text-slate-500 break-all">{qrModal.id}</p>
            <p className="mt-1 text-xs text-slate-400">Print and place as QR fallback</p>
            <button type="button" onClick={() => setQrModal(null)} className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm">Close</button>
          </div>
        </div>
      )}
    </Layout>
  )
}
