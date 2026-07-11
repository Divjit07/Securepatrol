import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Is this guard currently clocked in? True when their most recent clock event
 * (pass scan on a shift_clock_in/out checkpoint, last 16h — survives overnight
 * shifts) is a clock-IN. Drives the gated guard app: patrol tools unlock only
 * while on the clock.
 */
export function useGuardClockStatus(guardId) {
  const [state, setState] = useState({ loading: true, clockedIn: false, lastEvent: null })

  const refresh = useCallback(async () => {
    if (!guardId) return
    const since = new Date(Date.now() - 16 * 3600000).toISOString()
    const { data, error } = await supabase
      .from('scans')
      .select('id, scanned_at, checkpoints!inner(checkpoint_role)')
      .eq('guard_id', guardId)
      .eq('status', 'pass')
      .in('checkpoints.checkpoint_role', ['shift_clock_in', 'shift_clock_out'])
      .gte('scanned_at', since)
      .order('scanned_at', { ascending: false })
      .limit(1)
    if (error) {
      setState((prev) => ({ ...prev, loading: false }))
      return
    }
    const last = data?.[0] || null
    setState({
      loading: false,
      clockedIn: last?.checkpoints?.checkpoint_role === 'shift_clock_in',
      lastEvent: last,
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
