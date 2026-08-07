import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { dayActivityBounds, formatTimeLabel } from './useClientShift.js'
import { countPatrolRounds, computeGuardShiftForDay, formatShiftDuration, getPatrolCheckpoints } from '../lib/clientStats.js'
import { fetchShiftAdjustmentsForDate, mapShiftAdjustments, shiftAdjustmentKey } from '../lib/shiftAdjustments.js'

export function useClientSiteData(siteId, date, shift, guardId = null) {
  const [site, setSite] = useState(null)
  const [floors, setFloors] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [guards, setGuards] = useState([])
  const [scans, setScans] = useState([])
  const [adjustments, setAdjustments] = useState({})
  const [dayShiftsByGuard, setDayShiftsByGuard] = useState({})
  const [loading, setLoading] = useState(true)
  const checkpointIdsRef = useRef(new Set())

  const loadData = useCallback(async () => {
    if (!siteId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const [{ data: siteData }, { data: floorData }, { data: guardData }] = await Promise.all([
      supabase.from('sites').select('*').eq('id', siteId).single(),
      supabase.from('floors').select('*').eq('site_id', siteId).order('floor_number'),
      supabase.from('guards').select('id, name, email, active').eq('site_id', siteId).order('name'),
    ])

    setSite(siteData)
    setFloors(floorData || [])
    setGuards(guardData || [])

    if (!floorData?.length) {
      setCheckpoints([])
      setScans([])
      checkpointIdsRef.current = new Set()
      setLoading(false)
      return
    }

    const { data: cps } = await supabase
      .from('checkpoints')
      .select('*')
      .in('floor_id', floorData.map((f) => f.id))
      .eq('active', true)

    const floorMap = Object.fromEntries(floorData.map((f) => [f.id, f]))
    const checkpointList = (cps || []).map((cp) => ({ ...cp, floor: floorMap[cp.floor_id] }))
    setCheckpoints(checkpointList)
    checkpointIdsRef.current = new Set(checkpointList.map((cp) => cp.id))

    // Load the day's activity regardless of the site's operating hours: a guard
    // may be rostered on a "closed" day, or patrol past the scheduled end, and
    // the client must still see it.
    if (cps?.length) {
      const { start, end } = dayActivityBounds(date, shift.start, shift.end)
      // Published roster shifts overlapping this day — the source of truth for
      // each guard's shift window (a new site follows its schedule, not the
      // company-default template).
      const [y, m, d] = date.split('-').map(Number)
      const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0)
      const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999)
      const [{ data: scanData }, adjRows, { data: shiftRows }] = await Promise.all([
        (() => {
          let query = supabase
            .from('scans')
            .select('*, profiles:guard_id(name)')
            .in('checkpoint_id', cps.map((c) => c.id))
            .eq('status', 'pass')
            .gte('scanned_at', start.toISOString())
            .lte('scanned_at', end.toISOString())
            .order('scanned_at', { ascending: false })
          if (guardId) query = query.eq('guard_id', guardId)
          return query
        })(),
        fetchShiftAdjustmentsForDate(siteId, date),
        supabase
          .from('shifts')
          .select('id, guard_id, starts_at, ends_at')
          .eq('site_id', siteId)
          .eq('status', 'published')
          .not('guard_id', 'is', null)
          .lt('starts_at', dayEnd.toISOString())
          .gt('ends_at', dayStart.toISOString()),
      ])

      setScans(scanData || [])
      setAdjustments(mapShiftAdjustments(adjRows))
      const byGuard = {}
      for (const s of shiftRows || []) {
        if (!byGuard[s.guard_id]) byGuard[s.guard_id] = s
      }
      setDayShiftsByGuard(byGuard)
    } else {
      setScans([])
      setAdjustments({})
      setDayShiftsByGuard({})
    }

    setLoading(false)
  }, [siteId, date, shift.start, shift.end, guardId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!siteId) return undefined
    const onFocus = () => loadData()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [siteId, loadData])

  useEffect(() => {
    if (!siteId) return undefined

    const channel = supabase
      .channel(`client-site_${siteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans' }, async (payload) => {
        const checkpointId = payload.new.checkpoint_id
        if (!checkpointIdsRef.current.has(checkpointId)) return
        if (payload.new.status !== 'pass') return
        if (guardId && payload.new.guard_id !== guardId) return

        const { start, end } = dayActivityBounds(date, shift.start, shift.end)
        const scannedAt = new Date(payload.new.scanned_at)
        if (scannedAt < start || scannedAt > end) return

        const { data } = await supabase
          .from('scans')
          .select('*, profiles:guard_id(name)')
          .eq('id', payload.new.id)
          .single()

        if (!data) return

        setScans((prev) => [data, ...prev.filter((s) => s.id !== data.id)])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [siteId, date, shift.start, shift.end, guardId])

  const scansByCheckpoint = scans.reduce((acc, scan) => {
    if (!acc[scan.checkpoint_id] || new Date(scan.scanned_at) > new Date(acc[scan.checkpoint_id].scanned_at)) {
      acc[scan.checkpoint_id] = scan
    }
    return acc
  }, {})

  // Coverage counts patrol-role checkpoints only (clock-in/out tags are GPS-clock
  // fallbacks, never part of a patrol round).
  const patrolCheckpoints = getPatrolCheckpoints(checkpoints)
  const scannedCount = patrolCheckpoints.filter((cp) => scansByCheckpoint[cp.id]).length
  const { rounds, patrolScanCount, patrolCheckpointCount } = countPatrolRounds(scans, checkpoints, {
    date,
    shiftStart: shift.start,
    shiftEnd: shift.end,
  })

  const guardShifts = guards
    .filter((guard) => !guardId || guard.id === guardId)
    .map((guard) => {
      const adjustment = adjustments[shiftAdjustmentKey(guard.id, date)]
      const dayShift = computeGuardShiftForDay(
        scans.filter((s) => s.guard_id === guard.id),
        checkpoints,
        { date, adjustment, operatingHours: site?.operating_hours, publishedShift: dayShiftsByGuard[guard.id] },
      )
      if (!dayShift) return null
      return {
        guardId: guard.id,
        guardName: guard.name,
        clockInAt: dayShift.clockInAt,
        clockOutAt: dayShift.clockOutAt,
        signedInAt: dayShift.signedInAt,
        clockInCheckpoint: dayShift.clockInCheckpoint,
        onShift: dayShift.onShift,
        isAdjusted: dayShift.isAdjusted,
        isStatutoryHoliday: dayShift.isStatutoryHoliday,
        statutoryHolidayLabel: dayShift.statutoryHolidayLabel,
        arrivedEarly: dayShift.arrivedEarly,
        hoursWorked: dayShift.hoursWorked,
        hoursLabel: formatShiftDuration(dayShift.clockInAt, dayShift.clockOutAt),
      }
    })
    .filter(Boolean)

  // The header pill must read the ROSTER, not the building's opening hours. A
  // guard rostered 07:00-20:00 on a site that "opens" at 11:00 is working a
  // 07:00 shift, and labelling it 11:00 misreports the day to the client.
  // Operating hours stay the fallback only when nothing is published.
  const publishedToday = Object.values(dayShiftsByGuard).filter((s) => s?.starts_at && s?.ends_at)
  const rosterHoursLabel = publishedToday.length
    ? (() => {
        const starts = publishedToday.map((s) => new Date(s.starts_at))
        const ends = publishedToday.map((s) => new Date(s.ends_at))
        const from = new Date(Math.min(...starts))
        const to = new Date(Math.max(...ends))
        const hhmm = (d) =>
          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        const day = from.toLocaleDateString([], { weekday: 'long' })
        return `${day} · ${formatTimeLabel(hhmm(from))} – ${formatTimeLabel(hhmm(to))}`
      })()
    : null

  const groupedByFloor = floors.map((floor) => ({
    floor,
    checkpoints: checkpoints.filter((cp) => cp.floor_id === floor.id),
  }))

  return {
    site,
    floors,
    checkpoints,
    guards,
    scans,
    loading,
    scansByCheckpoint,
    scannedCount,
    rounds,
    patrolScanCount,
    patrolCheckpointCount,
    guardShifts,
    rosterHoursLabel,
    groupedByFloor,
    reload: loadData,
  }
}
