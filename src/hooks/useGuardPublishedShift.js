import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchGuardShiftForDate } from '../lib/schedule.js'

/**
 * Guard's published roster shift for a day — live via Supabase Realtime on `shifts`
 * (same rows admin publishes + emails from the roster).
 */
export function useGuardPublishedShift(guardId, dateStr) {
  const [shift, setShift] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!guardId || !dateStr) {
      setShift(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const row = await fetchGuardShiftForDate(guardId, dateStr)
      setShift(row)
    } catch {
      setShift(null)
    } finally {
      setLoading(false)
    }
  }, [guardId, dateStr])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!guardId) return undefined

    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)

    const channel = supabase
      .channel(`guard-published-shift-${guardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts', filter: `guard_id=eq.${guardId}` },
        () => reload(),
      )
      .subscribe()

    return () => {
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [guardId, reload])

  return { shift, loading, reload }
}
