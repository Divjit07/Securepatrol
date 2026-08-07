import { supabase } from '../supabase.js'

/**
 * Athena's template layer (migration 050).
 *
 * Athena is deterministic — the same decision that removed the LLM. It
 * substitutes tokens into copy the office wrote; it cannot invent a guard, a
 * time, or a number. Every value in a rendered alert came from a patrol record.
 */

/** The tokens each template may use, so the editor can show them and validate. */
export const TEMPLATE_TOKENS = {
  alert_late: ['guard', 'site', 'time'],
  alert_no_show: ['guard', 'site', 'time'],
  alert_stale_patrol: ['guard', 'site', 'minutes', 'limit'],
  alert_email: ['count'],
  digest_admin: ['date'],
  digest_client: ['site', 'date'],
}

/** Sample values so the editor can preview without waiting for a real alert. */
export const SAMPLE_VALUES = {
  guard: 'Divjit Singh',
  site: '800 Bathurst-DJ',
  time: '11:00 AM',
  minutes: '130',
  limit: '120',
  count: '3 issues',
  date: new Date().toLocaleDateString(),
}

export async function fetchTemplates() {
  const { data, error } = await supabase
    .from('alert_templates')
    .select('*')
    .order('key')
  if (error) throw error
  return data || []
}

export async function saveTemplate(key, { subject, body, updatedBy }) {
  const { error } = await supabase
    .from('alert_templates')
    .update({ subject: subject || null, body, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) throw error
}

/**
 * Substitute {token} values. Unknown tokens are left visible rather than
 * silently blanked — an alert reading "{guard} is late" is obviously broken,
 * where " is late" looks plausible and ships a nonsense message to a client.
 */
export function renderTemplate(text, values = {}) {
  if (!text) return ''
  return text.replace(/\{(\w+)\}/g, (match, token) =>
    values[token] != null ? String(values[token]) : match,
  )
}

/** Tokens present in the text that the template does not declare. */
export function unknownTokens(text, key) {
  const declared = new Set(TEMPLATE_TOKENS[key] || [])
  const used = [...String(text || '').matchAll(/\{(\w+)\}/g)].map((m) => m[1])
  return [...new Set(used.filter((t) => !declared.has(t)))]
}
