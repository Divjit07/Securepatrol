import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Clock, RotateCcw, Save } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import RosterSitePicker from '../components/roster/RosterSitePicker.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import { getScheduledShiftForDate, shiftScanBounds } from '../hooks/useClientShift.js'
import { computeGuardSessionsForDay, formatDurationFromMinutes, formatShiftTime } from '../lib/clientStats.js'
import {
  combineDateAndTime,
  fetchShiftAdjustmentsForDate,
  isExcludedAdjustment,
  mapShiftAdjustments,
  removeShiftAdjustment,
  saveShiftAdjustment,
  shiftAdjustmentKey,
  toTimeInputValue,
} from '../lib/shiftAdjustments.js'

function findClockInScan(guardScans, checkpoints, dateStr, shift) {
  const clockInIds = new Set(
    checkpoints.filter((cp) => cp.checkpoint_role === 'shift_clock_in').map((cp) => cp.id),
  )
  const { start, end } = shiftScanBounds(dateStr, shift.start, shift.end)

  return [...guardScans]
    .filter((s) => s.status === 'pass')
    .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))
    .find((s) => {
      const t = new Date(s.scanned_at)
      return t >= start && t <= end && clockInIds.has(s.checkpoint_id)
    })
}

export default function AdminShiftClock() {
  const { user, isSuperAdmin, canManageShiftClock, privilegesLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [selectedSite, setSelectedSite] = useState('')
  const [date, setDate] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  })
  const [checkpoints, setCheckpoints] = useState([])
  const [scans, setScans] = useState([])
  const [adjustments, setAdjustments] = useState({})
  const [dayShifts, setDayShifts] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const selectedSiteHours = useMemo(
    () => sites.find((s) => s.id === selectedSite)?.operating_hours || null,
    [sites, selectedSite],
  )
  const scheduled = useMemo(
    () => getScheduledShiftForDate(date, selectedSiteHours),
    [date, selectedSiteHours],
  )

  const siteGuards = useMemo(
    () => guards.filter((g) => g.site_id === selectedSite && g.active),
    [guards, selectedSite],
  )

  const loadSiteData = async () => {
    if (!selectedSite || scheduled.isClosed) {
      setCheckpoints([])
      setScans([])
      setAdjustments({})
      setDayShifts([])
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const { data: floors } = await supabase.from('floors').select('id').eq('site_id', selectedSite)

      if (!floors?.length) {
        setCheckpoints([])
        setScans([])
        setAdjustments({})
        setDayShifts([])
        setLoading(false)
        return
      }

      const dayStart = (() => {
        const [y, m, d] = date.split('-').map(Number)
        return new Date(y, m - 1, d, 0, 0, 0, 0)
      })()
      const dayEnd = (() => {
        const [y, m, d] = date.split('-').map(Number)
        return new Date(y, m - 1, d, 23, 59, 59, 999)
      })()

      const [{ data: cps }, adjRows, { data: shiftRows }] = await Promise.all([
        supabase
          .from('checkpoints')
          .select('id, name, checkpoint_role, floor_id')
          .in('floor_id', floors.map((f) => f.id))
          .eq('active', true),
        fetchShiftAdjustmentsForDate(selectedSite, date),
        supabase
          .from('shifts')
          .select('id, guard_id, starts_at, ends_at')
          .eq('site_id', selectedSite)
          .eq('status', 'published')
          .not('guard_id', 'is', null)
          .gte('starts_at', dayStart.toISOString())
          .lte('starts_at', dayEnd.toISOString()),
      ])

      const checkpointList = cps || []
      setDayShifts(shiftRows || [])
      setCheckpoints(checkpointList)
      setAdjustments(mapShiftAdjustments(adjRows))

      const cpIds = checkpointList.map((c) => c.id)
      if (!cpIds.length) {
        setScans([])
        setLoading(false)
        return
      }

      const { data: scanData, error } = await supabase
        .from('scans')
        .select('id, guard_id, checkpoint_id, scanned_at, status, approval_note')
        .in('checkpoint_id', cpIds)
        .eq('status', 'pass')
        .gte('scanned_at', dayStart.toISOString())
        .lte('scanned_at', dayEnd.toISOString())
        .order('scanned_at', { ascending: true })

      if (error) throw error
      setScans(scanData || [])
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load shift data' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || !canManageShiftClock) return

    const role = isSuperAdmin ? 'super_admin' : 'admin'
    fetchSitesForAdmin(user.id, role).then((siteList) => {
      setSites(siteList)
      // Deep link (?site=) from the Live Clock board wins over the default.
      const wanted = searchParams.get('site')
      if (wanted && siteList.some((s) => s.id === wanted)) setSelectedSite(wanted)
      else if (siteList.length) setSelectedSite(siteList[0].id)
    })

    fetchGuardsWithSites().then(setGuards)
  }, [user?.id, canManageShiftClock, isSuperAdmin])

  useEffect(() => {
    if (!selectedSite) return
    setEditing(null)
    loadSiteData()
  }, [selectedSite, date])

  if (!canManageShiftClock) {
    // Access flags resolve async (DB checks) — don't bounce until they land.
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

  const rows = siteGuards.map((guard) => {
    const guardScans = scans.filter((s) => s.guard_id === guard.id)
    const adjustment = adjustments[shiftAdjustmentKey(guard.id, date)]
    const publishedShift = dayShifts.find((s) => s.guard_id === guard.id)
    const day = computeGuardSessionsForDay(guardScans, checkpoints, {
      date,
      adjustment,
      operatingHours: selectedSiteHours,
      publishedShift,
    })
    const clockInScan = findClockInScan(guardScans, checkpoints, date, scheduled)

    return {
      guard,
      day,
      adjustment,
      clockInScan,
    }
  })

  const startEdit = (row) => {
    // Edit collapses the day to one manual correction: first clock-in → last
    // clock-out across all of the guard's sessions.
    const sessions = row.day?.sessions || []
    const firstIn = sessions[0]?.clockInAt || combineDateAndTime(date, scheduled.start)
    const lastOut = sessions[sessions.length - 1]?.clockOutAt || combineDateAndTime(date, scheduled.end)
    setEditing({
      guardId: row.guard.id,
      clockIn: toTimeInputValue(firstIn),
      clockOut: toTimeInputValue(lastOut),
      note: row.adjustment?.note || '',
    })
    setMessage(null)
  }

  const cancelEdit = () => {
    setEditing(null)
  }

  const handleSave = async (guardId) => {
    if (!editing || editing.guardId !== guardId) return

    setSaving(true)
    setMessage(null)

    try {
      const clockInAt = combineDateAndTime(date, editing.clockIn)
      const clockOutAt = combineDateAndTime(date, editing.clockOut)

      if (clockOutAt <= clockInAt) {
        throw new Error('Clock-out must be after clock-in')
      }

      await saveShiftAdjustment({
        siteId: selectedSite,
        guardId,
        shiftDate: date,
        clockInAt: clockInAt.toISOString(),
        clockOutAt: clockOutAt.toISOString(),
        note: editing.note,
      })

      setMessage({ type: 'success', text: 'Shift times saved.' })
      setEditing(null)
      await loadSiteData()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save shift times' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (guardId) => {
    if (!window.confirm('Remove manual override and revert to scan-based shift times?')) return

    setSaving(true)
    setMessage(null)

    try {
      await removeShiftAdjustment(guardId, date)
      setMessage({ type: 'success', text: 'Shift override removed.' })
      setEditing(null)
      await loadSiteData()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to reset shift times' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout variant="admin">
      <PageHeader
        title="Shift Clock"
        description="View guard sign-in times and edit clock-in/out per guard."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {sites.length > 0 && (
          <RosterSitePicker
            sites={sites}
            value={selectedSite}
            onChange={setSelectedSite}
            allowAll={false}
          />
        )}
        <input
          type="date"
          className="rounded-full border-0 bg-[#FFFFFF] px-4 py-3 text-sm font-semibold text-black ring-1 ring-black/10"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
        />
      </div>

      {scheduled.isClosed ? (
        <div className="rounded-xl border border-white/10 bg-surface p-8 text-center text-ink-2">
          {scheduled.scheduleLabel}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-2">
            {scheduled.scheduleLabel}. Use <strong>Edit times</strong> to correct a guard's clock-in
            or clock-out — the change shows on payroll and the client portal.
          </p>

          {message && (
            <p
              className={`mb-4 text-sm ${message.type === 'success' ? 'text-accent-green' : 'text-accent-red'}`}
            >
              {message.text}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
            </div>
          ) : (
            <div className="sp-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-ink-2">
                    <tr>
                      <th className="px-6 py-3 font-medium">Guard</th>
                      <th className="px-6 py-3 font-medium">Clock-in scan</th>
                      <th className="px-6 py-3 font-medium">Clock in</th>
                      <th className="px-6 py-3 font-medium">Clock out</th>
                      <th className="px-6 py-3 font-medium">Hours</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map(({ guard, day, adjustment, clockInScan }) => {
                      const isEditing = editing?.guardId === guard.id
                      const sessions = day?.sessions || []
                      const multi = sessions.length > 1

                      return (
                        <tr key={guard.id}>
                          <td className="px-6 py-4 align-top">
                            <p className="font-medium text-ink">{guard.name}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {!day && adjustment && isExcludedAdjustment(adjustment) && (
                                <span
                                  className="rounded-full bg-[#EF4444]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#EF4444]"
                                  title="An admin removed this day from payroll — punches are kept. Reset restores it."
                                >
                                  Excluded from payroll
                                </span>
                              )}
                              {day?.isAdjusted && (
                                <span className="rounded-full bg-black px-2.5 py-0.5 text-[10px] font-semibold text-white">
                                  Adjusted
                                </span>
                              )}
                              {multi && (
                                <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[10px] font-semibold text-ink-2">
                                  {sessions.length} sessions
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top text-ink-2">
                            {clockInScan
                              ? formatShiftTime(new Date(clockInScan.scanned_at))
                              : '—'}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {isEditing ? (
                              <input
                                type="time"
                                className="sp-input"
                                value={editing.clockIn}
                                onChange={(e) =>
                                  setEditing((prev) => ({ ...prev, clockIn: e.target.value }))
                                }
                              />
                            ) : !sessions.length ? (
                              '—'
                            ) : multi ? (
                              <div className="divide-y divide-black/[0.06]">
                                {sessions.map((s) => (
                                  <div key={s.index} className="flex min-h-[4rem] items-center gap-2.5">
                                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black/[0.06] text-[10px] font-bold text-ink-2">
                                      {s.index + 1}
                                    </span>
                                    <span className="tabular-nums">{formatShiftTime(s.clockInAt)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="tabular-nums">{formatShiftTime(sessions[0].clockInAt)}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {isEditing ? (
                              <input
                                type="time"
                                className="sp-input"
                                value={editing.clockOut}
                                onChange={(e) =>
                                  setEditing((prev) => ({ ...prev, clockOut: e.target.value }))
                                }
                              />
                            ) : !sessions.length ? (
                              '—'
                            ) : (
                              <div className={multi ? 'divide-y divide-black/[0.06]' : ''}>
                                {sessions.map((s) => (
                                  <div
                                    key={s.index}
                                    className={`flex flex-col justify-center gap-1 ${multi ? 'min-h-[4rem]' : ''}`}
                                  >
                                    {s.onShift ? (
                                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-green/10 px-2.5 py-0.5 text-xs font-semibold text-accent-green">
                                        <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
                                        On shift
                                      </span>
                                    ) : (
                                      <span className="tabular-nums">{formatShiftTime(s.clockOutAt)}</span>
                                    )}
                                    {s.clockOutNote && (
                                      <span
                                        className="inline-flex w-fit max-w-[14rem] items-center truncate rounded-full bg-accent-orange/10 px-2 py-0.5 text-[11px] font-medium text-accent-orange"
                                        title={s.clockOutNote}
                                      >
                                        Early out · {s.clockOutNote}
                                      </span>
                                    )}
                                    {s.missingClockOut && (
                                      <span className="inline-flex w-fit rounded-full bg-accent-red/10 px-2 py-0.5 text-[11px] font-medium text-accent-red">
                                        No clock-out — assumed
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 align-top font-medium">
                            {!sessions.length ? (
                              '—'
                            ) : multi ? (
                              <div>
                                <div className="divide-y divide-black/[0.06]">
                                  {sessions.map((s) => (
                                    <div
                                      key={s.index}
                                      className="flex min-h-[4rem] items-center tabular-nums text-ink-2"
                                    >
                                      {formatDurationFromMinutes(s.durationMinutes)}
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 flex items-baseline gap-1.5 border-t border-black/10 pt-2.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                                    Total
                                  </span>
                                  <span className="font-semibold tabular-nums text-ink">
                                    {formatDurationFromMinutes(day.totalMinutes)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="font-semibold tabular-nums">
                                {formatDurationFromMinutes(day.totalMinutes)}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {isEditing ? (
                              <div className="space-y-2">
                                <textarea
                                  className="sp-input w-full min-w-[200px]"
                                  rows={2}
                                  placeholder="Note (optional)"
                                  value={editing.note}
                                  onChange={(e) =>
                                    setEditing((prev) => ({ ...prev, note: e.target.value }))
                                  }
                                />
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => handleSave(guard.id)}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="rounded-full bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-black ring-1 ring-black/10 transition hover:bg-zinc-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit({ guard, day, adjustment })}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-black ring-1 ring-black/10 transition hover:bg-zinc-100"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  {day ? 'Edit times' : 'Set times'}
                                </button>
                                {adjustment && (
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => handleReset(guard.id)}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-black ring-1 ring-black/10 transition hover:bg-zinc-100 disabled:opacity-50"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reset
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {siteGuards.length === 0 && (
                <p className="p-8 text-center text-ink-2">No active guards at this site.</p>
              )}
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
