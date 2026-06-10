import { supabase } from './supabase.js'

/**
 * Load all guards with site name + address for admin views.
 */
export async function fetchGuardsWithSites() {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, role, site_id, active, sites(id, name, address)')
    .eq('role', 'guard')
    .order('name')

  if (profileError) throw profileError

  const { data: guardRows } = await supabase
    .from('guards')
    .select('id, email, site_id, active')

  const guardById = Object.fromEntries((guardRows || []).map((g) => [g.id, g]))

  return (profiles || []).map((p) => {
    const g = guardById[p.id]
    const site = p.sites || null
    return {
      id: p.id,
      name: p.name,
      email: g?.email || '—',
      site_id: p.site_id || g?.site_id || null,
      site_name: site?.name || null,
      site_address: site?.address || null,
      active: p.active ?? g?.active ?? true,
      unassigned: !(p.site_id || g?.site_id),
    }
  })
}

export function formatSiteLabel(guard) {
  if (!guard.site_name && !guard.site_address) return 'Not assigned'
  if (guard.site_name && guard.site_address) return `${guard.site_name} — ${guard.site_address}`
  return guard.site_name || guard.site_address
}

export async function assignGuardToSite(guardId, siteId, name, email) {
  await supabase.from('profiles').update({ site_id: siteId, role: 'guard' }).eq('id', guardId)

  const { data: existing } = await supabase.from('guards').select('id').eq('id', guardId).maybeSingle()

  if (existing) {
    await supabase.from('guards').update({ site_id: siteId }).eq('id', guardId)
  } else {
    await supabase.from('guards').insert({
      id: guardId,
      name,
      email: email && email !== '—' ? email : `${name.replace(/\s/g, '').toLowerCase()}@guard.local`,
      site_id: siteId,
      active: true,
    })
  }
}

/**
 * Remove a guard completely (login + profile + guards row).
 * Uses Edge Function when deployed; falls back to DB delete.
 */
export async function removeGuard(guardId) {
  const { data, error: fnError } = await supabase.functions.invoke('delete-guard', {
    body: { guard_id: guardId },
  })

  if (!fnError && data?.success) return { method: 'full' }

  const fnFailed = fnError || data?.error

  // Fallback: remove from app tables (auth user may remain in Supabase)
  const { error: guardError } = await supabase.from('guards').delete().eq('id', guardId)
  if (guardError) throw new Error(guardError.message)

  const { error: profileError } = await supabase.from('profiles').delete().eq('id', guardId)
  if (profileError) {
    throw new Error(
      profileError.message.includes('policy')
        ? 'Could not remove guard. Run supabase/migrations/004_guard_delete_policy.sql or deploy delete-guard function.'
        : profileError.message,
    )
  }

  return {
    method: 'partial',
    warning: fnFailed
      ? 'Guard removed from app. Delete their login in Supabase → Authentication → Users if needed.'
      : null,
  }
}
