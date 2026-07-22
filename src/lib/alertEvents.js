import { supabase } from './supabase.js'

/** Open (unacknowledged) roster alerts — RLS scopes to the admin's sites. */
export async function fetchOpenAlertEvents(limit = 12) {
  return fetchAlertEvents({ acknowledged: false, limit })
}

/**
 * Fetch roster alert events with optional filters.
 * @param {{ acknowledged?: boolean | null, siteId?: string, eventType?: string, limit?: number }} opts
 *   acknowledged: true = only acked, false = only open, null/undefined = all
 */
export async function fetchAlertEvents({
  acknowledged = null,
  siteId,
  eventType,
  limit = 100,
} = {}) {
  let q = supabase
    .from('alert_events')
    .select('id, site_id, guard_id, event_type, message, acknowledged, created_at, sites(name), profiles:guard_id(name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (acknowledged === true || acknowledged === false) q = q.eq('acknowledged', acknowledged)
  if (siteId) q = q.eq('site_id', siteId)
  if (eventType) q = q.eq('event_type', eventType)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

const NARRATIVE_CACHE_KEY = 'sp-alert-narrative'
const NARRATIVE_TTL_MS = 10 * 60_000

/**
 * Templated summary of the open alerts (edge function ai-alert-digest — now
 * fully deterministic, no LLM). Returns { narrative: string|null, count }.
 * Every name and count comes straight from alert_events. Cached in
 * sessionStorage for 10 min just to avoid the round trip on page revisits.
 */
export async function fetchAlertNarrative() {
  try {
    const raw = sessionStorage.getItem(NARRATIVE_CACHE_KEY)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Date.now() - cached.at < NARRATIVE_TTL_MS) return cached.data
    }
  } catch {
    /* storage unavailable — fall through */
  }

  const { data, error } = await supabase.functions.invoke('ai-alert-digest', { body: {} })
  if (error) throw new Error(error.message || 'Digest unavailable')
  if (data?.error) throw new Error(data.error)

  // Only cache real digests — an empty result must re-check next visit,
  // otherwise a just-fired alert stays invisible for the whole TTL.
  if (data?.narrative) {
    try {
      sessionStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
    } catch {
      /* best effort */
    }
  }
  return data
}

export async function acknowledgeAlertEvent(id) {
  const { error } = await supabase.from('alert_events').update({ acknowledged: true }).eq('id', id)
  if (error) throw error
}

export const ALERT_TYPE_LABELS = {
  late: 'Late',
  no_show: 'No-show',
  stale_patrol: 'Stale patrol',
  missed_checkpoint: 'Missed checkpoint',
}

export const ALERT_TYPE_TONE = {
  late: 'amber',
  no_show: 'red',
  stale_patrol: 'cyan',
  missed_checkpoint: 'amber',
}
