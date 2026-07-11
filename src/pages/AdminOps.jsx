import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Clock,
  MapPin,
  Radio,
  Users,
  CalendarDays,
  ArrowUpRight,
} from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import { supabase } from '../lib/supabase.js'
import {
  fetchShiftsOverlapping,
  fetchClockStatusByGuard,
  formatTimeRange,
  formatTime,
  shiftHours,
} from '../lib/schedule.js'

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function relativeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m ago`
}

function ShiftHoverCard({ shift, clock, children }) {
  const [open, setOpen] = useState(false)
  const guardName = shift.profiles?.name || (shift.guard_id ? 'Guard' : 'Open shift')
  const siteName = shift.sites?.name || 'Site'
  const now = new Date()
  const start = new Date(shift.starts_at)
  const end = new Date(shift.ends_at)
  const live = start <= now && end > now
  const upcoming = start > now
  const status = live ? 'Live now' : upcoming ? 'Upcoming' : 'Ended'
  const hours = shiftHours(shift)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <div className="animate-rise absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-ink/10 bg-surface p-4 shadow-2xl shadow-black/30">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-ink">{guardName}</p>
              <p className="mt-0.5 text-xs text-ink-2">{siteName}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                live
                  ? 'bg-accent-green/20 text-accent-green'
                  : upcoming
                    ? 'bg-black text-white'
                    : 'bg-ink/10 text-ink-2'
              }`}
            >
              {status}
            </span>
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-ink-2">
            <p>
              <span className="font-semibold text-ink">Shift</span> · {formatTimeRange(shift)}
            </p>
            <p>
              <span className="font-semibold text-ink">Duration</span> · {hours.toFixed(1).replace(/\.0$/, '')}h
              {shift.break_minutes ? ` · ${shift.break_minutes}m break` : ''}
            </p>
            <p>
              <span className="font-semibold text-ink">Clock</span> ·{' '}
              {clock?.clockedIn
                ? `In since ${formatTime(clock.scannedAt)} (${relativeAgo(clock.scannedAt)})`
                : clock
                  ? `Last out ${formatTime(clock.scannedAt)}`
                  : 'No clock punch yet'}
            </p>
            {clock?.checkpointName && (
              <p>
                <span className="font-semibold text-ink">Punch at</span> · {clock.checkpointName}
              </p>
            )}
            {shift.notes && (
              <p>
                <span className="font-semibold text-ink">Notes</span> · {shift.notes}
              </p>
            )}
            <p>
              <span className="font-semibold text-ink">Ack</span> ·{' '}
              {shift.acknowledged_at ? `Confirmed ${formatTime(shift.acknowledged_at)}` : 'Not confirmed'}
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              to="/admin/roster"
              className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Roster <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link
              to="/admin/map"
              className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-semibold text-black"
            >
              Live Map
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function GuardChip({ name, clockedIn, detail }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 ${
        clockedIn
          ? 'border-accent-green/30 bg-accent-green/15'
          : 'border-ink/10 bg-ink/5'
      }`}
      title={detail}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
          clockedIn ? 'bg-accent-green text-black' : 'bg-black text-white'
        }`}
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-ink">{name}</span>
        {detail && <span className="block truncate text-[10px] text-ink-2">{detail}</span>}
      </span>
      {clockedIn && <span className="h-2 w-2 shrink-0 rounded-full bg-accent-green" />}
    </div>
  )
}

export default function AdminOps() {
  const { user, profile } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [shifts, setShifts] = useState([])
  const [clockByGuard, setClockByGuard] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [filter, setFilter] = useState('all') // all | live | clocked

  const reload = useCallback(async () => {
    if (!user?.id || !profile?.role) return
    setLoading(true)
    try {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const [siteRows, guardRows, shiftRows, clockMap] = await Promise.all([
        fetchSitesForAdmin(user.id, profile.role),
        fetchGuardsWithSites(),
        fetchShiftsOverlapping(dayStart, dayEnd),
        fetchClockStatusByGuard(16),
      ])

      const siteIds = new Set(siteRows.map((s) => s.id))
      setSites(siteRows)
      setGuards(guardRows.filter((g) => g.active && (!g.site_id || siteIds.has(g.site_id))))
      setShifts(shiftRows.filter((s) => siteIds.has(s.site_id)))
      setClockByGuard(clockMap)
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load ops board')
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.role])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000)
    const refresh = setInterval(reload, 60_000)
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(tick)
      clearInterval(refresh)
      window.removeEventListener('focus', onFocus)
    }
  }, [reload])

  useEffect(() => {
    const channel = supabase
      .channel('ops-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scans' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  const liveShifts = useMemo(
    () => shifts.filter((s) => new Date(s.starts_at) <= now && new Date(s.ends_at) > now),
    [shifts, now],
  )

  const upcomingShifts = useMemo(
    () =>
      shifts
        .filter((s) => new Date(s.starts_at) > now)
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
    [shifts, now],
  )

  const clockedInList = useMemo(() => {
    const list = []
    for (const [guardId, clock] of clockByGuard) {
      if (!clock.clockedIn) continue
      const guard = guards.find((g) => g.id === guardId)
      list.push({
        guardId,
        name: clock.guardName || guard?.name || 'Guard',
        siteId: clock.siteId || guard?.site_id,
        siteName: clock.siteName || guard?.site_name || 'Site',
        clock,
        shift: liveShifts.find((s) => s.guard_id === guardId) || null,
      })
    }
    return list.sort((a, b) => a.siteName.localeCompare(b.siteName) || a.name.localeCompare(b.name))
  }, [clockByGuard, guards, liveShifts])

  const siteBoards = useMemo(() => {
    return sites.map((site) => {
      const siteGuards = guards.filter((g) => g.site_id === site.id)
      const siteLive = liveShifts.filter((s) => s.site_id === site.id)
      const siteUpcoming = upcomingShifts.filter((s) => s.site_id === site.id).slice(0, 6)
      const siteClocked = clockedInList.filter((c) => c.siteId === site.id)
      const scheduledIds = new Set(siteLive.map((s) => s.guard_id).filter(Boolean))
      const late = siteLive.filter((s) => s.guard_id && !clockByGuard.get(s.guard_id)?.clockedIn)

      return {
        site,
        siteGuards,
        siteLive,
        siteUpcoming,
        siteClocked,
        scheduledCount: scheduledIds.size,
        late,
      }
    })
  }, [sites, guards, liveShifts, upcomingShifts, clockedInList, clockByGuard])

  const visibleBoards = useMemo(() => {
    if (filter === 'live') return siteBoards.filter((b) => b.siteLive.length > 0)
    if (filter === 'clocked') return siteBoards.filter((b) => b.siteClocked.length > 0)
    return siteBoards
  }, [siteBoards, filter])

  return (
    <Layout variant="admin">
      <PageHeader
        title="Ops Board"
        description="All sites · who’s clocked in · shifts live now. Hover any shift for full details."
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/admin/map"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#FFFFFF] px-4 py-2.5 text-sm font-semibold text-black"
            >
              <Radio className="h-4 w-4" /> Live Map
            </Link>
            <Link
              to="/admin/roster"
              className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white"
            >
              <CalendarDays className="h-4 w-4" /> Roster
            </Link>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl bg-accent-red/10 px-4 py-3 text-sm font-medium text-accent-red">
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-accent-green/30 bg-accent-green/20 p-4">
          <div className="inline-flex rounded-full bg-[#FFFFFF] px-3 py-1 text-[11px] font-semibold text-black shadow-sm ring-1 ring-black/10">
            Clocked in
          </div>
          <p className="mt-3 flex items-end gap-2 text-3xl font-light tracking-tight text-ink">
            <Users className="mb-1 h-5 w-5 text-accent-green" />
            {clockedInList.length}
          </p>
        </div>
        <div className="rounded-2xl border border-accent-orange/35 bg-accent-orange/20 p-4">
          <div className="inline-flex rounded-full bg-[#FFFFFF] px-3 py-1 text-[11px] font-semibold text-black shadow-sm ring-1 ring-black/10">
            Shifts live
          </div>
          <p className="mt-3 flex items-end gap-2 text-3xl font-light tracking-tight text-ink">
            <Activity className="mb-1 h-5 w-5 text-accent-orange" />
            {liveShifts.length}
          </p>
        </div>
        <div className="rounded-2xl border border-accent-cyan-line/30 bg-accent-cyan/50 p-4">
          <div className="inline-flex rounded-full bg-[#FFFFFF] px-3 py-1 text-[11px] font-semibold text-black shadow-sm ring-1 ring-black/10">
            Upcoming today
          </div>
          <p className="mt-3 flex items-end gap-2 text-3xl font-light tracking-tight text-ink">
            <Clock className="mb-1 h-5 w-5 text-accent-cyan-line" />
            {upcomingShifts.length}
          </p>
        </div>
        <div className="rounded-2xl border border-ink/15 bg-ink/10 p-4">
          <div className="inline-flex rounded-full bg-[#FFFFFF] px-3 py-1 text-[11px] font-semibold text-black shadow-sm ring-1 ring-black/10">
            Sites
          </div>
          <p className="mt-3 flex items-end gap-2 text-3xl font-light tracking-tight text-ink">
            <MapPin className="mb-1 h-5 w-5 text-ink-2" />
            {sites.length}
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: 'All sites' },
          { id: 'live', label: 'Live shifts' },
          { id: 'clocked', label: 'Clocked in' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === f.id
                ? 'bg-black text-white'
                : 'border border-black/10 bg-[#FFFFFF] text-black'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-2">
          Updates live · {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      {loading && !sites.length ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : visibleBoards.length === 0 ? (
        <div className="sp-card p-10 text-center text-sm text-ink-2">
          Nothing matching this filter right now.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {visibleBoards.map(
            ({ site, siteGuards, siteLive, siteUpcoming, siteClocked, scheduledCount, late }) => (
              <section key={site.id} className="sp-card overflow-visible p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">{site.name}</h2>
                    <p className="mt-0.5 text-xs text-ink-2">{site.address || 'No address'}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <span className="rounded-full bg-[#FFFFFF] px-2.5 py-1 text-[10px] font-semibold text-black ring-1 ring-black/10">
                      {siteClocked.length} clocked in
                    </span>
                    <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold text-white">
                      {siteLive.length} live
                    </span>
                  </div>
                </div>

                {/* Clocked in now */}
                <div className="mb-4">
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-2">
                    Clocked in now
                  </h3>
                  {siteClocked.length === 0 ? (
                    <p className="text-xs text-ink-2">Nobody clocked in at this site.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {siteClocked.map((c) => (
                        <GuardChip
                          key={c.guardId}
                          name={c.name}
                          clockedIn
                          detail={`${relativeAgo(c.clock.scannedAt)}${
                            c.shift ? ` · ${formatTimeRange(c.shift)}` : ''
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Live shifts */}
                <div className="mb-4">
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-2">
                    Shifts live now · {scheduledCount} guards scheduled
                  </h3>
                  {siteLive.length === 0 ? (
                    <p className="text-xs text-ink-2">No published shifts overlapping now.</p>
                  ) : (
                    <div className="space-y-2">
                      {siteLive.map((shift) => {
                        const clock = shift.guard_id ? clockByGuard.get(shift.guard_id) : null
                        const latePunch = shift.guard_id && !clock?.clockedIn
                        return (
                          <ShiftHoverCard key={shift.id} shift={shift} clock={clock}>
                            <button
                              type="button"
                              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition hover:brightness-[0.98] ${
                                latePunch
                                  ? 'border-accent-red/30 bg-accent-red/10'
                                  : 'border-ink/10 bg-ink/5'
                              }`}
                            >
                              <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                  clock?.clockedIn
                                    ? 'bg-accent-green text-black'
                                    : 'bg-black text-white'
                                }`}
                              >
                                {initialsOf(shift.profiles?.name || 'Open')}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-ink">
                                  {shift.profiles?.name || 'Open shift'}
                                </span>
                                <span className="block text-xs text-ink-2">
                                  {formatTimeRange(shift)}
                                  {latePunch ? ' · not clocked in' : clock?.clockedIn ? ' · on the clock' : ''}
                                </span>
                              </span>
                              <span className="rounded-full bg-[#FFFFFF] px-2.5 py-1 text-[10px] font-semibold text-black ring-1 ring-black/10">
                                Hover
                              </span>
                            </button>
                          </ShiftHoverCard>
                        )
                      })}
                    </div>
                  )}
                  {late.length > 0 && (
                    <p className="mt-2 text-xs font-medium text-accent-red">
                      {late.length} scheduled but not clocked in
                    </p>
                  )}
                </div>

                {/* Upcoming */}
                {siteUpcoming.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-2">
                      Coming up today
                    </h3>
                    <div className="space-y-2">
                      {siteUpcoming.map((shift) => {
                        const clock = shift.guard_id ? clockByGuard.get(shift.guard_id) : null
                        return (
                          <ShiftHoverCard key={shift.id} shift={shift} clock={clock}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-paper px-3 py-2 text-left transition hover:bg-ink/5"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[10px] font-bold text-ink">
                                {initialsOf(shift.profiles?.name || 'Open')}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-ink">
                                  {shift.profiles?.name || 'Open shift'}
                                </span>
                                <span className="block text-xs text-ink-2">{formatTimeRange(shift)}</span>
                              </span>
                            </button>
                          </ShiftHoverCard>
                        )
                      })}
                    </div>
                  </div>
                )}

                {siteGuards.length === 0 && siteLive.length === 0 && (
                  <p className="text-xs text-ink-2">No guards assigned to this site yet.</p>
                )}
              </section>
            ),
          )}
        </div>
      )}

      {/* Global clocked-in rail when filtering all */}
      {filter === 'all' && clockedInList.length > 0 && (
        <div className="mt-6 sp-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Everyone clocked in · all sites</h2>
          <div className="flex flex-wrap gap-2">
            {clockedInList.map((c) => (
              <GuardChip
                key={c.guardId}
                name={c.name}
                clockedIn
                detail={`${c.siteName} · ${relativeAgo(c.clock.scannedAt)}`}
              />
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
