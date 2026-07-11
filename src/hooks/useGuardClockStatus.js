import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Is this guard currently clocked in? True when their most recent clock event
 * (pass scan on a shift_clock_in/out checkpoint, last 16h — survives overnight
 * shifts) is a clock-IN. A clock-OUT clears them. Drives the gated guard app.
 */
export function useGuardClockStatus(guardId) {
  const [state, setState] = useState({ loading: true, clockedIn: false, lastEvent: null })

  const refresh = useCallback(async () => {
    if (!guardId) return
    const since = new Date(Date.now() - 16 * 3600000).toISOString()

    const { data: cps } = await supabase
      .from('checkpoints')
      .select('id, checkpoint_role')
      .in('checkpoint_role', ['shift_clock_in', 'shift_clock_out'])
      .eq('active', true)
    const cpById = new Map((cps || []).map((c) => [c.id, c]))
    const cpIds = [...cpById.keys()]
    if (!cpIds.length) {
      setState({ loading: false, clockedIn: false, lastEvent: null })
      return
    }

    const { data, error } = await supabase
      .from('scans')
      .select('id, scanned_at, checkpoint_id')
      .eq('guard_id', guardId)
      .eq('status', 'pass')
      .in('checkpoint_id', cpIds)
      .gte('scanned_at', since)
      .order('scanned_at', { ascending: false })
      .limit(1)
    if (error) {
      setState((prev) => ({ ...prev, loading: false }))
      return
    }
    const last = data?.[0] || null
    const role = last ? cpById.get(last.checkpoint_id)?.checkpoint_role : null
    setState({
      loading: false,
      clockedIn: role === 'shift_clock_in',
      lastEvent: last ? { ...last, checkpoint_role: role } : null,
    })
  }, [guardId])

  useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(refresh, 60_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [refresh])

  return { ...state, refresh }
}
