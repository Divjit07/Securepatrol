import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Clock, LogOut, RefreshCw, Search, ArrowUpRight } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchLiveClockBoard, adminClockOutGuard } from '../lib/adminClock.js'

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function fmtSince(iso) {
  if (!iso) return null
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Live clock board: current in/out state per guard + admin force clock-out. */
export default function AdminLiveClock() {
  const { user, isSuperAdmin, canManageShiftClock, privilegesLoading } = useAuth()
  const [sites, setSites] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('all')
  const [confirming, setConfirming] = useState(null) // guardId
  const [outNote, setOutNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)

  const load = async (siteList = sites) => {
    if (!siteList.length) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchLiveClockBoard(siteList.map((s) => s.id)))
    } catch (err) {
      setError(err.message || 'Failed to load the clock board')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || !canManageShiftClock) return
    fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin').then((siteList) => {
      setSites(siteList)
      load(siteList)
    })
  }, [user?.id, canManageShiftClock, isSuperAdmin])

  // The board is "live": refresh every 60s like the guard-side clock status.
  useEffect(() => {
    if (!sites.length) return undefined
    const id = setInterval(() => load(), 60_000)
    return () => clearInterval(id)
  }, [sites])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (siteFilter !== 'all' && r.siteId !== siteFilter) return false
      if (q && !r.guard.name.toLowerCase().includes(q) && !r.siteName.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, siteFilter])

  const clockedInCount = rows.filter((r) => r.clockedIn).length

  const handleClockOut = async (guardId) => {
    setBusy(guardId)
    setMessage(null)
    try {
      await adminClockOutGuard(guardId, outNote)
      setConfirming(null)
      setOutNote('')
      setMessage({ type: 'success', text: 'Guard clocked out — the punch is on their record.' })
      await load()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not clock the guard out' })
    } finally {
      setBusy(null)
    }
  }

  if (!canManageShiftClock) {
    if (privilegesLoading) {
      return (
        <Layout>
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
          </div>
        </Layout>
      )
    }
    return <Navigate to="/admin" replace />
  }

  return (
    <Layout variant="admin">
      <PageHeader
        title="Live Clock"
        description="Who is on the clock right now — and clock a guard out remotely when they forget."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-accent-green" />
          <span className="text-sm font-semibold text-ink tabular-nums">{clockedInCount}</span>
          <span className="text-sm text-ink-2">clocked in now</span>
        </div>
        {sites.length > 1 && (
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="rounded-full border-0 bg-[#FFFFFF] px-4 py-2.5 text-sm font-semibold text-black ring-1 ring-black/10"
            aria-label="Filter by site"
          >
            <option value="all">All sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guard or site…"
            className="rounded-full border-0 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red">{error}</div>
      )}
      {message && (
        <p className={`mb-4 text-sm ${message.type === 'success' ? 'text-accent-green' : 'text-accent-red'}`}>
          {message.text}
        </p>
      )}

      {loading && !rows.length ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : (
        <div className="sp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-white/5 text-ink-2">
                <tr>
                  <th className="px-6 py-3 font-medium">Guard</th>
                  <th className="px-6 py-3 font-medium">Site</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Clock in</th>
                  <th className="px-6 py-3 font-medium">Clock out</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-ink-3">
                      {rows.length ? 'No guards match your filter.' : 'No active guards at your sites.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.guard.id}>
                      <td className="px-6 py-4 font-medium text-ink">{r.guard.name}</td>
                      <td className="px-6 py-4 text-ink-2">{r.siteName}</td>
                      <td className="px-6 py-4">
                        {r.clockedIn ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-green/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-green">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
                            On shift · {fmtSince(r.clockInAt)}
                          </span>
                        ) : r.hasPunches ? (
                          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                            Clocked out
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-ink-3">
                            No punches today
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 tabular-nums text-ink-2">{fmtTime(r.clockInAt)}</td>
                      <td className="px-6 py-4 tabular-nums">
                        {r.clockedIn ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <>
                            <span className="text-ink-2">{fmtTime(r.clockOutAt)}</span>
                            {r.lastMethod === 'admin' && (
                              <span className="ml-1.5 rounded-full bg-accent-orange/15 px-2 py-0.5 text-[10px] font-semibold text-accent-orange">
                                by admin
                              </span>
                            )}
                            {r.lastNote && (
                              <span
                                className="mt-0.5 block max-w-[14rem] truncate text-xs text-ink-3"
                                title={r.lastNote}
                              >
                                {r.lastNote}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {confirming === r.guard.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={outNote}
                              onChange={(e) => setOutNote(e.target.value)}
                              maxLength={500}
                              autoFocus
                              placeholder="Reason (optional)"
                              className="sp-input w-full min-w-[200px] text-sm"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy === r.guard.id}
                                onClick={() => handleClockOut(r.guard.id)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                              >
                                <LogOut className="h-3.5 w-3.5" />
                                {busy === r.guard.id ? 'Clocking out…' : 'Confirm clock out'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirming(null)
                                  setOutNote('')
                                }}
                                disabled={busy === r.guard.id}
                                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-white/15"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {r.clockedIn && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirming(r.guard.id)
                                  setOutNote('')
                                  setMessage(null)
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-black ring-1 ring-black/10 transition hover:bg-zinc-100"
                              >
                                <LogOut className="h-3.5 w-3.5" />
                                Clock out
                              </button>
                            )}
                            <Link
                              to={`/admin/shift-clock?site=${r.siteId}`}
                              className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-ink-2 transition hover:bg-white/10"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              Shift Clock
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-ink-3">
        Admin clock-outs insert a real punch marked “by admin” with your name on it — the guard’s app
        updates instantly and payroll reads it like any other clock-out. Raw punches stay immutable.
      </p>
    </Layout>
  )
}
