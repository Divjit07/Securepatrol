import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Is this guard currently clocked in? True when their most recent clock event
 * (pass scan on a shift_clock_in/out checkpoint, last 16h — survives overnight
 * shifts) is a clock-IN. Drives the gated guard app.
 *
 * ONE shared store per guard: the layout nav, dashboard, and ClockGate all
 * read the same state, so a punch anywhere locks/unlocks the whole portal
 * instantly — no instance is left showing stale state until its own 60s poll.
 */
const EMPTY = { loading: true, clockedIn: false, lastEvent: null }

const store = {
  guardId: null,
  state: EMPTY,
  listeners: new Set(),
  inflight: null,
}

function publish(state) {
  store.state = state
  store.listeners.forEach((fn) => fn(state))
}

async function fetchStatus(guardId) {
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
  if (error) return { ...store.state, loading: false }
  const last = data?.[0] || null
  return {
    loading: false,
    clockedIn: last?.checkpoints?.checkpoint_role === 'shift_clock_in',
    lastEvent: last,
  }
}

/** Refetch and broadcast to every mounted consumer (call after a punch). */
export function refreshClockStatus(guardId = store.guardId) {
  if (!guardId) return Promise.resolve()
  if (store.guardId !== guardId) {
    store.guardId = guardId
    publish(EMPTY)
  }
  if (!store.inflight) {
    store.inflight = fetchStatus(guardId)
      .then((state) => publish(state))
      .finally(() => {
        store.inflight = null
      })
  }
  return store.inflight
}

export function useGuardClockStatus(guardId) {
  const [state, setState] = useState(() =>
    guardId && store.guardId === guardId ? store.state : EMPTY,
  )

  useEffect(() => {
    if (!guardId) return undefined
    const listener = (s) => setState(s)
    store.listeners.add(listener)
    if (store.guardId === guardId && !store.state.loading) {
      setState(store.state)
    } else {
      refreshClockStatus(guardId)
    }
    const onFocus = () => refreshClockStatus(guardId)
    window.addEventListener('focus', onFocus)
    const interval = setInterval(() => refreshClockStatus(guardId), 60_000)
    return () => {
      store.listeners.delete(listener)
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [guardId])

  const refresh = useCallback(() => refreshClockStatus(guardId), [guardId])

  return { ...state, refresh }
}
