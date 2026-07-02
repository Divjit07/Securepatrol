import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { shiftBounds } from './useClientShift.js'
import { countPatrolRounds, computeGuardShiftForDay } from '../lib/clientStats.js'

export function useClientSiteData(siteId, date, shift) {
  const [site, setSite] = useState(null)
  const [floors, setFloors] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [guards, setGuards] = useState([])
  const [scans, setScans] = useState([])
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

    if (cps?.length) {
      const { start, end } = shiftBounds(date, shift.start, shift.end)
      const { data: scanData } = await supabase
        .from('scans')
        .select('*, profiles:guard_id(name)')
        .in('checkpoint_id', cps.map((c) => c.id))
        .eq('status', 'pass')
        .gte('scanned_at', start.toISOString())
        .lte('scanned_at', end.toISOString())
        .order('scanned_at', { ascending: false })

      setScans(scanData || [])
    } else {
      setScans([])
    }

    setLoading(false)
  }, [siteId, date, shift.start, shift.end])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!siteId) return undefined

    const channel = supabase
      .channel(`client-site_${siteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans' }, async (payload) => {
        const checkpointId = payload.new.checkpoint_id
        if (!checkpointIdsRef.current.has(checkpointId)) return
        if (payload.new.status !== 'pass') return

        const { start, end } = shiftBounds(date, shift.start, shift.end)
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
  }, [siteId, date, shift.start, shift.end])

  const scansByCheckpoint = scans.reduce((acc, scan) => {
    if (!acc[scan.checkpoint_id] || new Date(scan.scanned_at) > new Date(acc[scan.checkpoint_id].scanned_at)) {
      acc[scan.checkpoint_id] = scan
    }
    return acc
  }, {})

  const scannedCount = checkpoints.filter((cp) => scansByCheckpoint[cp.id]).length
  const { rounds, patrolScanCount, patrolCheckpointCount } = countPatrolRounds(scans, checkpoints)

  const guardShifts = guards
    .map((guard) => {
      const dayShift = computeGuardShiftForDay(
        scans.filter((s) => s.guard_id === guard.id),
        checkpoints,
        { shiftStart: shift.start, shiftEnd: shift.end, date },
      )
      if (!dayShift) return null
      return {
        guardId: guard.id,
        guardName: guard.name,
        clockIn: dayShift.clockInAt,
        clockOut: dayShift.clockOutAt,
        clockOutPending: dayShift.clockOutPending,
        durationLabel: dayShift.durationLabel,
        hoursWorked: dayShift.hoursWorked,
      }
    })
    .filter(Boolean)

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
    groupedByFloor,
  }
}
