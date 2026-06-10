import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export function useRealtime(table, filter, onInsert) {
  const [connected, setConnected] = useState(false)

  const subscribe = useCallback(() => {
    const channel = supabase
      .channel(`${table}-changes-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter },
        (payload) => onInsert?.(payload.new),
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter, onInsert])

  useEffect(() => {
    if (!onInsert) return undefined
    return subscribe()
  }, [subscribe, onInsert])

  return { connected }
}

export function useRealtimeScans(siteId, onNewScan) {
  return useRealtime('scans', siteId ? undefined : undefined, onNewScan)
}
