import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CalendarHeart, Clock, RotateCcw, Save } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import { getScheduledShiftForDate, shiftBounds, shiftScanBounds } from '../hooks/useClientShift.js'
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
  statutoryHolidayName,
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
  const { user, isSuperAdmin, canManageShiftClock } = useAuth()
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

      const { start, end } = shiftScanBounds(date, scheduled.start, scheduled.end)
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
    if (!user || !canManageShiftClock) return

    const role = isSuperAdmin ? 'super_admin' : 'admin'
    fetchSitesForAdmin(user.id, role).then((siteList) => {
      setSites(siteList)
      if (siteList.length) setSelectedSite(siteList[0].id)
    })

    fetchGuardsWithSites().then(setGuards)
  }, [user?.id, canManageShiftClock, isSuperAdmin])

  useEffect(() => {
    if (!selectedSite) return
    setEditing(null)
    loadSiteData()
  }, [selectedSite, date])

  if (!canManageShiftClock) {
    return <Navigate to="/admin" replace />
  }

  const rows = siteGuards.map((guard) => {
    const guardScans = scans.filter((s) => s.guard_id === guard.id)
    const adjustment = adjustments[shiftAdjustmentKey(guard.id, date)]
    const dayShift = computeGuardShiftForDay(guardScans, checkpoints, {
      date,
      adjustment,
      operatingHours: selectedSiteHours,
    })
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
    const isHoliday = statutoryHoliday || isStatutoryHolidayAdjustment(row.adjustment)

    setEditing({
      guardId: row.guard.id,
      clockIn: toTimeInputValue(defaults.clockInAt),
      clockOut: toTimeInputValue(defaults.clockOutAt),
      statutoryHoliday: isHoliday,
      holidayName: isHoliday ? statutoryHolidayName(row.adjustment?.note) : '',
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

      let note = editing.note
      if (editing.statutoryHoliday) {
        if (!editing.holidayName?.trim()) {
          throw new Error('Enter a holiday name (e.g. Canada Day)')
        }
        note = statutoryHolidayNote(editing.holidayName)
      }

      await saveShiftAdjustment({
        siteId: selectedSite,
        guardId,
        shiftDate: date,
        clockInAt: clockInAt.toISOString(),
        clockOutAt: clockOutAt.toISOString(),
        note,
      })

      setMessage({
        type: 'success',
        text: editing.statutoryHoliday ? 'Statutory holiday saved.' : 'Shift times saved.',
      })
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
        description="View guard sign-in times, edit clock-in/out per guard, or add a paid statutory holiday with a note."
      />

      <div className="sp-card mb-6 flex flex-wrap items-end gap-4 p-6">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Site</label>
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
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Date</label>
          <input
            type="date"
            className="sp-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {scheduled.isClosed ? (
        <div className="rounded-xl border border-white/10 bg-surface p-8 text-center text-ink-2">
          {scheduled.scheduleLabel}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-2">
            {scheduled.scheduleLabel}. Use <strong>Add holiday</strong> on a guard to credit hours
            (e.g. 11:00 AM–8:00 PM) with a statutory holiday note — it will show on the client portal.
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
                      <th className="px-6 py-3 font-medium">Main Entrance scan</th>
                      <th className="px-6 py-3 font-medium">Clock in</th>
                      <th className="px-6 py-3 font-medium">Clock out</th>
                      <th className="px-6 py-3 font-medium">Hours</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map(({ guard, dayShift, adjustment, clockInScan }) => {
                      const isEditing = editing?.guardId === guard.id

                      return (
                        <tr key={guard.id}>
                          <td className="px-6 py-4">
                            <p className="font-medium text-ink">{guard.name}</p>
                            {dayShift?.isAdjusted && !isStatutoryHolidayAdjustment(adjustment) && (
                              <span className="mt-1 inline-block rounded bg-accent-orange/15 px-2 py-0.5 text-xs font-medium text-accent-orange">
                                Adjusted
                              </span>
                            )}
                            {isStatutoryHolidayAdjustment(adjustment) && (
                              <span className="mt-1 inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                Statutory holiday
                              </span>
                            )}
                            {dayShift?.onShift && (
                              <span className="mt-1 ml-1 inline-block rounded bg-accent-cyan/15 px-2 py-0.5 text-xs font-medium text-brand-800">
                                On shift
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-ink-2">
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
                                <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
                                  <input
                                    type="checkbox"
                                    checked={editing.statutoryHoliday}
                                    onChange={(e) =>
                                      setEditing((prev) => ({
                                        ...prev,
                                        statutoryHoliday: e.target.checked,
                                        holidayName: e.target.checked ? prev.holidayName : '',
                                      }))
                                    }
                                  />
                                  Statutory holiday
                                </label>
                                {editing.statutoryHoliday ? (
                                  <input
                                    type="text"
                                    className="sp-input w-full min-w-[200px]"
                                    placeholder="Holiday name, e.g. Canada Day"
                                    value={editing.holidayName}
                                    onChange={(e) =>
                                      setEditing((prev) => ({ ...prev, holidayName: e.target.value }))
                                    }
                                  />
                                ) : (
                                  <textarea
                                    className="sp-input w-full min-w-[200px]"
                                    rows={2}
                                    placeholder="Note (optional)"
                                    value={editing.note}
                                    onChange={(e) =>
                                      setEditing((prev) => ({ ...prev, note: e.target.value }))
                                    }
                                  />
                                )}
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
                                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/5"
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
                                    onClick={() =>
                                      startEdit({ guard, dayShift, adjustment }, { statutoryHoliday: true })
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-accent-green/15"
                                  >
                                    <CalendarHeart className="h-3.5 w-3.5" />
                                    Add holiday
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => startEdit({ guard, dayShift, adjustment })}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/5"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  {dayShift ? 'Edit times' : 'Set times'}
                                </button>
                                {adjustment && (
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => handleReset(guard.id)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-accent-orange hover:bg-accent-orange/10"
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
