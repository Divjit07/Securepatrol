import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/** Fetches a site's operating_hours override (null → company defaults). */
export function useSiteHours(siteId) {
  const [hours, setHours] = useState(null)

  useEffect(() => {
    if (!siteId) {
      setHours(null)
      return
    }
    let cancelled = false
    const load = () => {
      supabase
        .from('sites')
        .select('operating_hours')
        .eq('id', siteId)
        .single()
        .then(({ data }) => {
          if (!cancelled) setHours(data?.operating_hours || null)
        })
    }
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [siteId])

  return hours
}
