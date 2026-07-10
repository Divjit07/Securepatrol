import { supabase } from './supabase.js'

/** Open (unacknowledged) roster alerts — RLS scopes to the admin's sites. */
export async function fetchOpenAlertEvents(limit = 12) {
  const { data, error } = await supabase
    .from('alert_events')
    .select('id, site_id, guard_id, event_type, message, created_at, sites(name)')
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function acknowledgeAlertEvent(id) {
  const { error } = await supabase.from('alert_events').update({ acknowledged: true }).eq('id', id)
  if (error) throw error
}

export const ALERT_TYPE_LABELS = {
  late: 'Late',
  no_show: 'No-show',
  stale_patrol: 'Stale patrol',
}
