// Admin "Office Staff" section. Manage office locations (with a geofence) and
// office employees who clock in/out by GPS geofence. Separate from guards.
import { useEffect, useState } from 'react'
import { Users, MapPin, Plus, LocateFixed, Building2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import {
  listOfficeLocations,
  createOfficeLocation,
  updateOfficeLocation,
  listOfficeEmployees,
  createOfficeEmployee,
  setEmployeeActive,
  setEmployeeOffice,
} from '../lib/officeStaff.js'
import { getBestPosition, parseCoordinatePaste } from '../lib/gps.js'

function Toggle({ on, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        on ? 'bg-accent-green' : 'bg-white/15'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function OfficeLocationForm({ onCreated }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState('120')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const useMyLocation = async () => {
    setError(null)
    try {
      const pos = await getBestPosition(3)
      setLat(pos.latitude.toFixed(6))
      setLng(pos.longitude.toFixed(6))
    } catch {
      setError('Could not read your location.')
    }
  }

  const onPaste = (text) => {
    const parsed = parseCoordinatePaste(text)
    if (parsed) {
      setLat(String(parsed.lat))
      setLng(String(parsed.lng))
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required.')
    if (lat.trim() === '' || lng.trim() === '') return setError('Set the office location (coordinates).')
    setBusy(true)
    setError(null)
    try {
      await createOfficeLocation({
        name,
        address,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        geofence_radius_m: Math.min(1000, Math.max(30, parseInt(radius, 10) || 120)),
      })
      setName(''); setAddress(''); setLat(''); setLng(''); setRadius('120'); setOpen(false)
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="sp-btn-ghost text-sm">
        <Plus className="h-4 w-4" /> Add office location
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="sp-card space-y-3 p-4">
      <input className="sp-input w-full" placeholder="Office name (e.g. Head Office)" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="sp-input w-full" placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <input className="sp-input w-full" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} onPaste={(e) => onPaste(e.clipboardData.getData('text'))} />
        <input className="sp-input w-full" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <input className="sp-input w-28" type="number" min="30" max="1000" placeholder="Radius m" value={radius} onChange={(e) => setRadius(e.target.value)} />
        <button type="button" onClick={useMyLocation} className="sp-btn-ghost text-xs">
          <LocateFixed className="h-4 w-4" /> Use my location
        </button>
        <span className="text-xs text-ink-3">or paste Google Maps coords into Latitude</span>
      </div>
      {error && <p className="text-sm text-accent-red">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="sp-btn-primary text-sm">{busy ? 'Saving…' : 'Save office'}</button>
        <button type="button" onClick={() => setOpen(false)} className="sp-btn-ghost text-sm">Cancel</button>
      </div>
    </form>
  )
}

function EmployeeForm({ locations, onCreated }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [officeId, setOfficeId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || password.length < 6) {
      return setError('Name, email, and a 6+ character password are required.')
    }
    setBusy(true)
    setError(null)
    try {
      await createOfficeEmployee({
        name,
        email,
        password,
        office_location_id: officeId || null,
      })
      setName(''); setEmail(''); setPassword(''); setOfficeId(''); setOpen(false)
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="sp-btn-primary text-sm">
        <Plus className="h-4 w-4" /> Add office employee
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="sp-card space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input className="sp-input w-full" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="sp-input w-full" type="email" placeholder="Email (login)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="sp-input w-full" type="password" placeholder="Temporary password (6+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <select className="sp-input w-full" value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
          <option value="">— Assign office —</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-ink-3">
        The employee clocks in/out by being at their assigned office (GPS geofence) and logging in with this email + password.
      </p>
      {error && <p className="text-sm text-accent-red">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="sp-btn-primary text-sm">{busy ? 'Creating…' : 'Create employee'}</button>
        <button type="button" onClick={() => setOpen(false)} className="sp-btn-ghost text-sm">Cancel</button>
      </div>
    </form>
  )
}

export default function AdminOfficeStaff() {
  const [locations, setLocations] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      const [locs, emps] = await Promise.all([listOfficeLocations(), listOfficeEmployees()])
      setLocations(locs)
      setEmployees(emps)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (emp, on) => {
    setEmployees((xs) => xs.map((e) => (e.id === emp.id ? { ...e, active: on } : e)))
    try { await setEmployeeActive(emp.id, on) } catch (err) { setError(err.message); load() }
  }
  const changeOffice = async (emp, officeId) => {
    setEmployees((xs) => xs.map((e) => (e.id === emp.id ? { ...e, office_location_id: officeId } : e)))
    try { await setEmployeeOffice(emp.id, officeId || null) } catch (err) { setError(err.message); load() }
  }

  return (
    <Layout variant="admin">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-accent-orange" />
          <h1 className="text-xl font-semibold text-ink">Office Staff</h1>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          Office employees clock in/out by being at an office location (GPS geofence) to track hours. Separate from security guards.
        </p>

        {error && <p className="mt-4 rounded-xl bg-accent-red/10 px-4 py-3 text-sm text-accent-red">{error}</p>}

        {/* Office locations */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-2">
              <MapPin className="h-4 w-4" /> Office locations
            </h2>
          </div>
          {locations.length === 0 && !loading && (
            <p className="mb-3 text-sm text-ink-3">No office locations yet. Add one so employees have a place to clock in.</p>
          )}
          {locations.length > 0 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {locations.map((l) => (
                <div key={l.id} className="sp-card flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                    <p className="truncate text-xs text-ink-3">
                      {l.latitude != null ? `${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)} · ${l.geofence_radius_m}m` : 'No coordinates'}
                    </p>
                  </div>
                  <Toggle on={l.active} onChange={(on) => updateOfficeLocation(l.id, { active: on }).then(load)} label="Active" />
                </div>
              ))}
            </div>
          )}
          <OfficeLocationForm onCreated={load} />
        </section>

        {/* Employees */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-2">
              <Building2 className="h-4 w-4" /> Employees
            </h2>
            <EmployeeForm locations={locations.filter((l) => l.active)} onCreated={load} />
          </div>

          {loading ? (
            <p className="text-sm text-ink-3">Loading…</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-ink-3">No office employees yet.</p>
          ) : (
            <div className="sp-card divide-y divide-white/5 overflow-hidden">
              {employees.map((emp) => (
                <div key={emp.id} className={`flex flex-wrap items-center gap-3 p-4 ${emp.active ? '' : 'opacity-50'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{emp.name}</p>
                    <p className="text-xs text-ink-3">{emp.office_locations?.name || 'No office assigned'}</p>
                  </div>

                  <select
                    className="sp-input h-9 w-40 text-sm"
                    value={emp.office_location_id || ''}
                    onChange={(e) => changeOffice(emp, e.target.value)}
                  >
                    <option value="">— Office —</option>
                    {locations.filter((l) => l.active).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2 text-xs text-ink-2">
                    Active
                    <Toggle on={emp.active} onChange={(on) => toggleActive(emp, on)} label="Active" />
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
