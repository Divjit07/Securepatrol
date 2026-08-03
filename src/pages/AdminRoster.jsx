import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Send, CalendarDays, LayoutGrid, List, X, Check } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import RosterGrid from '../components/roster/RosterGrid.jsx'
import RosterAgenda from '../components/roster/RosterAgenda.jsx'
import ShiftSheet from '../components/roster/ShiftSheet.jsx'
import RosterSitePicker, { ALL_SITES } from '../components/roster/RosterSitePicker.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import { supabase } from '../lib/supabase.js'
import {
  startOfWeek,
  addDays,
  sameDay,
  shiftHours,
  detectConflicts,
  fetchShiftsInRange,
  fetchTemplates,
  createShift,
  createShiftSeries,
  updateShift,
  deleteShift,
  deleteShiftSeries,
  copyWeek,
  publishWeek,
  formatTimeRange,
  CONFLICT_LABELS,
} from '../lib/schedule.js'
import { getScheduledShiftForDate } from '../hooks/useClientShift.js'

const DEFAULT_TEMPLATES = [
  { id: 'tpl-day', name: 'Day 9–5', start_minutes: 540, duration_minutes: 480, break_minutes: 30, color: 'blue' },
  { id: 'tpl-evening', name: 'Evening 4–12', start_minutes: 960, duration_minutes: 480, break_minutes: 30, color: 'violet' },
  { id: 'tpl-night', name: 'Night 12–8', start_minutes: 0, duration_minutes: 480, break_minutes: 30, color: 'teal' },
]

export default function AdminRoster() {
  const { user, profile } = useAuth()
  const [sites, setSites] = useState([])
  const [siteId, setSiteId] = useState('')
  const [guards, setGuards] = useState([])
  const [shifts, setShifts] = useState([])
  const [templates, setTemplates] = useState([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [numDays, setNumDays] = useState(7)
  const [view, setView] = useState('grid') // grid | agenda
  const [sheet, setSheet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [banner, setBanner] = useState(null)

  const isAllSites = siteId === ALL_SITES
  const rangeEnd = useMemo(() => addDays(weekStart, numDays), [weekStart, numDays])
  // Grid shows today + future only — past columns in the current week are hidden.
  const days = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: numDays }, (_, i) => addDays(weekStart, i)).filter((d) => {
      const day = new Date(d)
      day.setHours(0, 0, 0, 0)
      return day >= today
    })
  }, [weekStart, numDays])
  const thisWeekStart = useMemo(() => startOfWeek(new Date()), [])
  const canGoPrev = weekStart.getTime() > thisWeekStart.getTime()

  useEffect(() => {
    if (!user?.id || !profile?.role) return
    fetchSitesForAdmin(user.id, profile.role)
      .then((data) => {
        setSites(data)
        setSiteId((prev) => {
          if (prev === ALL_SITES) return ALL_SITES
          if (prev && data.some((s) => s.id === prev)) return prev
          return data[0]?.id || ''
        })
      })
      .catch((err) => setBanner({ tone: 'error', text: err.message }))
  }, [user?.id, profile?.role])

  const reload = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    try {
      const querySiteId = siteId === ALL_SITES ? null : siteId
      const [shiftRows, guardRows, templateRows] = await Promise.all([
        fetchShiftsInRange(querySiteId, weekStart, rangeEnd),
        fetchGuardsWithSites(),
        siteId === ALL_SITES
          ? Promise.resolve([])
          : fetchTemplates(siteId).catch(() => []),
      ])
      const siteIds = new Set(sites.map((s) => s.id))
      // Guards are a shared pool — ANY active guard can be rostered at ANY site
      // (multiple shifts/day across locations). Home site is just a default now,
      // not a constraint. Guards with no home site are included too.
      const activeGuards = guardRows.filter(
        (g) => g.active && (!g.site_id || siteIds.has(g.site_id)),
      )
      setShifts(
        siteId === ALL_SITES
          ? shiftRows.filter((s) => siteIds.has(s.site_id))
          : shiftRows,
      )
      setGuards(
        siteId === ALL_SITES
          ? activeGuards.sort(
              (a, b) =>
                (a.site_name || '').localeCompare(b.site_name || '') ||
                a.name.localeCompare(b.name),
            )
          : [...activeGuards].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setTemplates(templateRows.length ? templateRows : DEFAULT_TEMPLATES)
    } catch (err) {
      setBanner({ tone: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }, [siteId, weekStart, rangeEnd, sites])

  useEffect(() => {
    reload()
  }, [reload])

  // Stay fresh: refetch on focus + shift/guard changes.
  useEffect(() => {
    if (!siteId) return undefined
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    const channel = supabase.channel(`roster-${siteId}`)
    if (siteId === ALL_SITES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => reload())
    } else {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts', filter: `site_id=eq.${siteId}` },
        () => reload(),
      )
    }
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => reload())
    channel.subscribe()
    return () => {
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [siteId, reload])

  const conflicts = useMemo(() => detectConflicts(shifts), [shifts])
  const openShifts = useMemo(() => shifts.filter((s) => !s.guard_id), [shifts])
  const draftCount = useMemo(() => shifts.filter((s) => s.status === 'draft').length, [shifts])
  const totalHours = useMemo(
    () =>
      shifts.reduce((sum, s) => {
        if (!days.some((d) => sameDay(d, new Date(s.starts_at)))) return sum
        return sum + shiftHours(s)
      }, 0),
    [shifts, days],
  )

  const rows = useMemo(
    () =>
      guards.map((guard) => {
        const guardShifts = shifts.filter((s) => s.guard_id === guard.id)
        const hours = guardShifts.reduce((sum, s) => {
          if (!days.some((d) => sameDay(d, new Date(s.starts_at)))) return sum
          return sum + shiftHours(s)
        }, 0)
        return { guard, shifts: guardShifts, hours }
      }),
    [guards, shifts, days],
  )

  // Coverage %: minutes of operating window(s) with ≥1 shift.
  const selectedSite = isAllSites ? null : sites.find((s) => s.id === siteId)
  const coveragePct = useMemo(() => {
    if (!days.length) return 0
    const sitesForCoverage = isAllSites ? sites : selectedSite ? [selectedSite] : []
    if (!sitesForCoverage.length) return 0
    let windowMin = 0
    let coveredMin = 0
    for (const site of sitesForCoverage) {
      const siteShifts = isAllSites ? shifts.filter((s) => s.site_id === site.id) : shifts
      for (const day of days) {
        const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
        const sched = getScheduledShiftForDate(dateStr, site.operating_hours)
        if (sched.isClosed) continue
        const [sh, sm] = sched.start.split(':').map(Number)
        const [eh, em] = sched.end.split(':').map(Number)
        const winStart = new Date(day)
        winStart.setHours(sh, sm, 0, 0)
        const winEnd = new Date(day)
        winEnd.setHours(eh, em, 0, 0)
        const winLen = (winEnd - winStart) / 60000
        windowMin += winLen
        let dayCovered = 0
        for (const s of siteShifts) {
          const a = Math.max(new Date(s.starts_at), winStart)
          const b = Math.min(new Date(s.ends_at), winEnd)
          if (b > a) dayCovered += (b - a) / 60000
        }
        coveredMin += Math.min(dayCovered, winLen)
      }
    }
    return windowMin ? Math.min(100, Math.round((coveredMin / windowMin) * 100)) : 0
  }, [days, shifts, selectedSite, isAllSites, sites])

  const conflictList = useMemo(() => {
    const out = []
    for (const [shiftId, types] of conflicts) {
      const shift = shifts.find((s) => s.id === shiftId)
      if (!shift) continue
      const guardName = shift.profiles?.name || 'Open shift'
      out.push({
        id: shiftId,
        shift,
        title: [...types].map((t) => CONFLICT_LABELS[t] || t).join(' · '),
        detail: `${guardName} · ${new Date(shift.starts_at).toLocaleDateString([], { weekday: 'short' })} ${formatTimeRange(shift)}`,
      })
    }
    return out.slice(0, 4)
  }, [conflicts, shifts])

  const flash = (tone, text) => {
    setBanner({ tone, text })
    setTimeout(() => setBanner(null), 5000)
  }

  const handleCellClick = (guardId, date) => {
    const seed = new Date(date)
    seed.setHours(9, 0, 0, 0)
    const guard = guards.find((g) => g.id === guardId)
    setSheet({
      guard_id: guardId,
      starts_at: seed.toISOString(),
      site_id: isAllSites ? guard?.site_id || null : siteId,
    })
  }

  const handleShiftDrop = async (shiftId, guardId, date) => {
    const shift = shifts.find((s) => s.id === shiftId)
    if (!shift) return
    const starts = new Date(shift.starts_at)
    const duration = new Date(shift.ends_at) - starts
    const newStarts = new Date(date)
    newStarts.setHours(starts.getHours(), starts.getMinutes(), 0, 0)
    const patch = {
      guard_id: guardId,
      starts_at: newStarts.toISOString(),
      ends_at: new Date(newStarts.getTime() + duration).toISOString(),
    }
    // Optimistic move; reload reconciles.
    setShifts((prev) => prev.map((s) => (s.id === shiftId ? { ...s, ...patch } : s)))
    try {
      await updateShift(shiftId, patch)
    } catch (err) {
      flash('error', err.message)
    }
    reload()
  }

  const handleSave = async (values, repeatOpts) => {
    const targetSiteId =
      (siteId !== ALL_SITES ? siteId : null) ||
      values.site_id ||
      sheet?.site_id ||
      guards.find((g) => g.id === (values.guard_id || sheet?.guard_id))?.site_id

    if (!targetSiteId) {
      flash('error', 'Pick a site (or a guard assigned to a site) before saving.')
      throw new Error('No site')
    }

    if (sheet?.id) {
      await updateShift(sheet.id, values)
    } else if (repeatOpts) {
      await createShiftSeries(
        { ...values, site_id: targetSiteId, status: 'draft', created_by: user.id },
        repeatOpts,
      )
    } else {
      await createShift({ ...values, site_id: targetSiteId, status: 'draft', created_by: user.id })
    }
    reload()
  }

  const handleDelete = async (shift, series) => {
    if (series && shift.recurrence_id) {
      await deleteShiftSeries(shift.recurrence_id, shift.starts_at)
    } else {
      await deleteShift(shift.id)
    }
    reload()
  }

  const handleCopyWeek = async () => {
    if (isAllSites) {
      flash('error', 'Pick a single site to copy last week.')
      return
    }
    try {
      const copied = await copyWeek(siteId, weekStart)
      flash(copied.length ? 'success' : 'error', copied.length ? `Copied ${copied.length} shifts from last week as drafts.` : 'Last week has no shifts to copy.')
      reload()
    } catch (err) {
      flash('error', err.message)
    }
  }

  const handlePublish = async () => {
    if (isAllSites) {
      flash('error', 'Pick a single site to publish drafts.')
      return
    }
    setPublishing(true)
    try {
      const result = await publishWeek(siteId, weekStart, rangeEnd, user.id)
      if (result.method !== 'function') {
        // Shifts are live in-app, but NOBODY was emailed — never bury that in a success toast.
        flash(
          'error',
          `Published ${result.published} shifts, but NO emails were sent — the publish-schedule function isn't deployed. Guards only see this in the app.`,
        )
      } else {
        const parts = [`Published ${result.published} shifts — ${result.emailed} guards emailed.`]
        if (result.skipped?.length) {
          parts.push(`No email on file for: ${result.skipped.join(', ')} — tell them directly.`)
        }
        if (result.emailError) parts.push(`Email issue: ${result.emailError}`)
        flash(result.skipped?.length || result.emailError ? 'error' : 'success', parts.join(' '))
      }
      reload()
    } catch (err) {
      flash('error', err.message)
    } finally {
      setPublishing(false)
    }
  }

  const weekLabel = days.length
    ? `${days[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${days[days.length - 1].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'No upcoming days'

  return (
    <Layout variant="admin">
      <PageHeader
        title="Roster"
        description="Drag, drop, and publish guard schedules. Drafts stay invisible to guards until you publish."
        action={
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || !draftCount || isAllSites}
            title={isAllSites ? 'Pick a single site to publish drafts' : undefined}
            className={`inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition ${
              draftCount && !publishing && !isAllSites
                ? 'hover:bg-zinc-800 active:scale-[0.98]'
                : 'cursor-default'
            } ${publishing || isAllSites ? 'opacity-50' : ''}`}
          >
            <Send className="h-4 w-4" />
            {publishing
              ? 'Publishing…'
              : isAllSites
                ? 'Pick a site to publish'
                : draftCount
                  ? `Publish ${draftCount} draft${draftCount > 1 ? 's' : ''}`
                  : 'All published'}
          </button>
        }
      />

      {banner && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            banner.tone === 'success' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {sites.length > 0 && (
          <RosterSitePicker sites={sites} value={siteId || ALL_SITES} onChange={setSiteId} />
        )}

        <div className="flex items-center gap-1 rounded-xl border border-ink/10 bg-ink/5 p-1">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -numDays))}
            disabled={!canGoPrev}
            className="rounded-lg p-2 text-ink-2 hover:bg-ink/10 disabled:pointer-events-none disabled:opacity-30"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-ink/10">
            Today
          </button>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, numDays))} className="rounded-lg p-2 text-ink-2 hover:bg-ink/10" aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm font-semibold text-ink">{weekLabel}</span>

        {/* Coverage and scheduled hours read as status on the toolbar, where they
            sit beside the range they describe instead of holding a column open. */}
        <div className="flex items-center gap-2 border-l border-ink/10 pl-3">
          <span className="inline-flex items-baseline gap-1.5 rounded-full bg-ink/5 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Coverage</span>
            <span className="text-sm font-bold tabular-nums text-ink">{coveragePct}%</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5 rounded-full bg-ink/5 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Scheduled</span>
            <span className="text-sm font-bold tabular-nums text-ink">{Math.round(totalHours)}h</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyWeek}
            disabled={isAllSites}
            title={isAllSites ? 'Pick a single site to copy last week' : undefined}
            className="rounded-full border border-ink/10 bg-ink/5 px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Copy Last Week
          </button>
          <div className="flex rounded-full border border-ink/10 bg-ink/5 p-1">
            {[
              { id: 'grid', label: 'Grid', icon: LayoutGrid },
              { id: 'agenda', label: 'By day', icon: List },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  view === id
                    ? 'bg-black text-white shadow-sm'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-full border border-ink/10 bg-ink/5 p-1">
            {[7, 14].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumDays(n)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  numDays === n
                    ? 'bg-black text-white shadow-sm'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                {n === 7 ? 'Weekly' : 'Biweekly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The grid is the task, so it gets the full width. Coverage/Scheduled and
          Copy Last Week moved into the toolbar above; conflicts and open shifts
          sit below. Boxing the week into 9 of 12 columns was clipping Sat/Sun
          off the right edge, which is what made scheduling feel walled in. */}
      <div className="space-y-5">
        <div>
          {loading && !shifts.length ? (
            <div className="sp-card flex items-center justify-center gap-3 px-6 py-16 text-sm text-ink-3">
              <CalendarDays className="h-5 w-5 animate-pulse" /> Loading roster…
            </div>
          ) : view === 'agenda' ? (
            <RosterAgenda
              days={days}
              shifts={shifts}
              showSite={isAllSites}
              onShiftClick={(shift) => setSheet(shift)}
            />
          ) : (
            <RosterGrid
              days={days}
              rows={rows}
              openShifts={openShifts}
              conflicts={conflicts}
              showSite={isAllSites}
              onCellClick={handleCellClick}
              onShiftClick={(shift) => setSheet(shift)}
              onShiftDrop={handleShiftDrop}
            />
          )}
        </div>

        {/* Supporting detail, below the week rather than beside it */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Optimizations</h3>
            {conflictList.length === 0 ? (
              <div className="rounded-2xl border border-ink/10 bg-ink/5 p-4 text-sm text-ink-2">
                No conflicts — {rows.filter((r) => r.shifts.length).length} of {rows.length} guards scheduled.
              </div>
            ) : (
              <div className="space-y-2">
                {conflictList.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSheet(c.shift)}
                    className="w-full rounded-2xl border border-ink/10 bg-ink/5 p-4 text-left transition hover:bg-ink/10"
                  >
                    <p className="text-sm font-semibold text-ink">{c.title}</p>
                    <p className="mt-0.5 text-xs text-ink-2">{c.detail}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="dk-inset p-4">
            <h3 className="text-sm font-semibold text-ink">
              Open Shifts <span className="text-accent-orange">({openShifts.length})</span>
            </h3>
            <div className="mt-3 space-y-3">
              {openShifts.length === 0 && (
                <p className="text-xs text-ink-3">No unassigned shifts in this range.</p>
              )}
              {openShifts.slice(0, 5).map((shift) => (
                <div key={shift.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {new Date(shift.starts_at).toLocaleDateString([], { weekday: 'long' })} {formatTimeRange(shift)}
                    </p>
                    <p className="text-xs text-ink-3">
                      {shift.status === 'draft' ? 'Draft — publish to broadcast' : 'Published — guards can claim'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(shift, false).then(() => flash('success', 'Open shift removed.'))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-2 transition hover:bg-ink/5"
                    aria-label="Remove open shift"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet(shift)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white transition hover:bg-zinc-800"
                    aria-label="Assign open shift"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {sheet && (
        <ShiftSheet
          initial={sheet}
          guards={guards}
          templates={templates}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSheet(null)}
        />
      )}
    </Layout>
  )
}
