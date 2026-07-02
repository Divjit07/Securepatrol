import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CalendarHeart, Clock, RotateCcw, Save } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import { getScheduledShiftForDate, shiftBounds } from '../hooks/useClientShift.js'
import { computeGuardShiftForDay, formatShiftDuration, formatShiftTime } from '../lib/clientStats.js'
import {
  combineDateAndTime,
  fetchShiftAdjustmentsForDate,
  isStatutoryHolidayAdjustment,
  mapShiftAdjustments,
  removeShiftAdjustment,
  saveShiftAdjustment,
  shiftAdjustmentKey,
  statutoryHolidayNote,
  toTimeInputValue,
} from '../lib/shiftAdjustments.js'

function findClockInScan(guardScans, checkpoints, dateStr, shift) {
  const clockInIds = new Set(
    checkpoints.filter((cp) => cp.checkpoint_role === 'shift_clock_in').map((cp) => cp.id),
  )
  const { start, end } = shiftBounds(dateStr, shift.start, shift.end)

  return [...guardScans]
    .filter((s) => s.status === 'pass')
    .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))
    .find((s) => {
      const t = new Date(s.scanned_at)
      return t >= start && t <= end && clockInIds.has(s.checkpoint_id)
    })
}

export default function AdminShiftClock() {
  const { user, isSuperAdmin, canApproveScans } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [selectedSite, setSelectedSite] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [checkpoints, setCheckpoints] = useState([])
  const [scans, setScans] = useState([])
  const [adjustments, setAdjustments] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [holidayName, setHolidayName] = useState('')

  const scheduled = useMemo(() => getScheduledShiftForDate(date), [date])

  const siteGuards = useMemo(
    () => guards.filter((g) => g.site_id === selectedSite && g.active),
    [guards, selectedSite],
  )

  const loadSiteData = async () => {
    if (!selectedSite || scheduled.isClosed) {
      setCheckpoints([])
      setScans([])
      setAdjustments({})
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
        setLoading(false)
        return
      }

      const [{ data: cps }, adjRows] = await Promise.all([
        supabase
          .from('checkpoints')
          .select('id, name, checkpoint_role, floor_id')
          .in('floor_id', floors.map((f) => f.id))
          .eq('active', true),
        fetchShiftAdjustmentsForDate(selectedSite, date),
      ])

      const checkpointList = cps || []
      setCheckpoints(checkpointList)
      setAdjustments(mapShiftAdjustments(adjRows))

      const cpIds = checkpointList.map((c) => c.id)
      if (!cpIds.length) {
        setScans([])
        setLoading(false)
        return
      }

      const { start, end } = shiftBounds(date, scheduled.start, scheduled.end)
      const { data: scanData, error } = await supabase
        .from('scans')
        .select('id, guard_id, checkpoint_id, scanned_at, status')
        .in('checkpoint_id', cpIds)
        .eq('status', 'pass')
        .gte('scanned_at', start.toISOString())
        .lte('scanned_at', end.toISOString())
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
    if (!user || !canApproveScans) return

    const role = isSuperAdmin ? 'super_admin' : 'admin'
    fetchSitesForAdmin(user.id, role).then((siteList) => {
      setSites(siteList)
      if (siteList.length) setSelectedSite(siteList[0].id)
    })

    fetchGuardsWithSites().then(setGuards)
  }, [user?.id, canApproveScans, isSuperAdmin])

  useEffect(() => {
    if (!selectedSite) return
    setEditing(null)
    loadSiteData()
  }, [selectedSite, date])

  if (!canApproveScans) {
    return <Navigate to="/admin" replace />
  }

  const rows = siteGuards.map((guard) => {
    const guardScans = scans.filter((s) => s.guard_id === guard.id)
    const adjustment = adjustments[shiftAdjustmentKey(guard.id, date)]
    const dayShift = computeGuardShiftForDay(guardScans, checkpoints, { date, adjustment })
    const clockInScan = findClockInScan(guardScans, checkpoints, date, scheduled)

    return {
      guard,
      dayShift,
      adjustment,
      clockInScan,
    }
  })

  const startEdit = (row, { statutoryHoliday = false } = {}) => {
    const defaults = row.dayShift || {
      clockInAt: combineDateAndTime(date, scheduled.start),
      clockOutAt: combineDateAndTime(date, scheduled.end),
    }

    setEditing({
      guardId: row.guard.id,
      clockIn: toTimeInputValue(defaults.clockInAt),
      clockOut: toTimeInputValue(defaults.clockOutAt),
      note: statutoryHoliday
        ? statutoryHolidayNote(holidayName)
        : row.adjustment?.note || '',
      statutoryHoliday,
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

  const handleCreditHolidayForAll = async () => {
    if (!holidayName.trim()) {
      setMessage({ type: 'error', text: 'Enter a holiday name first (e.g. Canada Day).' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const clockInAt = combineDateAndTime(date, scheduled.start)
      const clockOutAt = combineDateAndTime(date, scheduled.end)
      const note = statutoryHolidayNote(holidayName)
      let credited = 0
      let skipped = 0

      for (const guard of siteGuards) {
        const adjustment = adjustments[shiftAdjustmentKey(guard.id, date)]
        if (adjustment) {
          skipped += 1
          continue
        }

        const guardScans = scans.filter((s) => s.guard_id === guard.id)
        const existingShift = computeGuardShiftForDay(guardScans, checkpoints, { date })
        if (existingShift) {
          skipped += 1
          continue
        }

        await saveShiftAdjustment({
          siteId: selectedSite,
          guardId: guard.id,
          shiftDate: date,
          clockInAt: clockInAt.toISOString(),
          clockOutAt: clockOutAt.toISOString(),
          note,
        })
        credited += 1
      }

      if (credited === 0) {
        setMessage({
          type: 'error',
          text: 'No guards were credited. Everyone already has a shift or override for this date.',
        })
      } else {
        setMessage({
          type: 'success',
          text: `Statutory holiday added for ${credited} guard${credited === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''}.`,
        })
      }

      setEditing(null)
      await loadSiteData()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to add statutory holiday' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveHolidayForAll = async () => {
    const holidayAdjustments = siteGuards.filter((guard) =>
      isStatutoryHolidayAdjustment(adjustments[shiftAdjustmentKey(guard.id, date)]),
    )

    if (!holidayAdjustments.length) {
      setMessage({ type: 'error', text: 'No statutory holiday entries to remove for this date.' })
      return
    }

    if (
      !window.confirm(
        `Remove statutory holiday entries for ${holidayAdjustments.length} guard${holidayAdjustments.length === 1 ? '' : 's'} on this date?`,
      )
    ) {
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      for (const guard of holidayAdjustments) {
        await removeShiftAdjustment(guard.id, date)
      }

      setMessage({ type: 'success', text: 'Statutory holiday entries removed.' })
      setEditing(null)
      await loadSiteData()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove statutory holiday' })
    } finally {
      setSaving(false)
    }
  }

  const statutoryHolidayCount = rows.filter(({ adjustment }) =>
    isStatutoryHolidayAdjustment(adjustment),
  ).length

  return (
    <Layout variant="admin">
      <PageHeader
        title="Shift Clock"
        description="View guard sign-in times, edit clock-in/out, or add paid statutory holidays when guards did not scan."
      />

      <div className="sp-card mb-6 flex flex-wrap items-end gap-4 p-6">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Site</label>
          <select
            className="sp-input w-full"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
          <input
            type="date"
            className="sp-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {scheduled.isClosed ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          {scheduled.scheduleLabel}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-600">{scheduled.scheduleLabel}</p>

          <div className="sp-card mb-6 p-6">
            <div className="flex items-start gap-3">
              <CalendarHeart className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900">Statutory holiday</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Add a paid holiday for guards who did not scan Main Entrance. Uses the scheduled shift
                  hours for this date ({scheduled.start}–{scheduled.end}).
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Holiday name
                    </label>
                    <input
                      type="text"
                      className="sp-input w-full"
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      placeholder="e.g. Canada Day"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={saving || !siteGuards.length}
                    onClick={handleCreditHolidayForAll}
                    className="sp-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
                  >
                    <CalendarHeart className="h-4 w-4" />
                    Credit all guards
                  </button>
                  {statutoryHolidayCount > 0 && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleRemoveHolidayForAll}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Remove holiday ({statutoryHolidayCount})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {message && (
            <p
              className={`mb-4 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
            >
              {message.text}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          ) : (
            <div className="sp-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">Guard</th>
                      <th className="px-6 py-3 font-medium">Main Entrance scan</th>
                      <th className="px-6 py-3 font-medium">Clock in</th>
                      <th className="px-6 py-3 font-medium">Clock out</th>
                      <th className="px-6 py-3 font-medium">Hours</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(({ guard, dayShift, adjustment, clockInScan }) => {
                      const isEditing = editing?.guardId === guard.id

                      return (
                        <tr key={guard.id}>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">{guard.name}</p>
                            {dayShift?.isAdjusted && !isStatutoryHolidayAdjustment(adjustment) && (
                              <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                Adjusted
                              </span>
                            )}
                            {isStatutoryHolidayAdjustment(adjustment) && (
                              <span className="mt-1 inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                Statutory holiday
                              </span>
                            )}
                            {dayShift?.onShift && (
                              <span className="mt-1 ml-1 inline-block rounded bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
                                On shift
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {clockInScan
                              ? formatShiftTime(new Date(clockInScan.scanned_at))
                              : '—'}
                          </td>
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input
                                type="time"
                                className="sp-input"
                                value={editing.clockIn}
                                onChange={(e) =>
                                  setEditing((prev) => ({ ...prev, clockIn: e.target.value }))
                                }
                              />
                            ) : (
                              dayShift ? formatShiftTime(dayShift.clockInAt) : '—'
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input
                                type="time"
                                className="sp-input"
                                value={editing.clockOut}
                                onChange={(e) =>
                                  setEditing((prev) => ({ ...prev, clockOut: e.target.value }))
                                }
                              />
                            ) : (
                              dayShift ? formatShiftTime(dayShift.clockOutAt) : '—'
                            )}
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {dayShift
                              ? formatShiftDuration(dayShift.clockInAt, dayShift.clockOutAt)
                              : '—'}
                          </td>
                          <td className="px-6 py-4">
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
                                    className="sp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {!dayShift && (
                                  <button
                                    type="button"
                                    onClick={() => startEdit({ guard, dayShift, adjustment }, { statutoryHoliday: true })}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                                  >
                                    <CalendarHeart className="h-3.5 w-3.5" />
                                    Add holiday
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => startEdit({ guard, dayShift, adjustment })}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  {dayShift ? 'Edit times' : 'Set times'}
                                </button>
                                {adjustment && (
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => handleReset(guard.id)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50"
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
                <p className="p-8 text-center text-slate-500">No active guards at this site.</p>
              )}
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
