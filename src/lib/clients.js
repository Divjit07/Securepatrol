import { supabase } from './supabase.js'

export function formatClientSiteLabel(client) {
  if (!client.site_name && !client.site_address) return 'Not assigned'
  if (client.site_name && client.site_address) return `${client.site_name} — ${client.site_address}`
  return client.site_name || client.site_address
}

export async function fetchClientsWithSites() {
  const { data, error: fnError } = await supabase.functions.invoke('list-clients')

  if (!fnError && data?.clients) {
    return data.clients
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, role, site_id, active, sites(id, name, address)')
    .eq('role', 'client')
    .order('name')

  if (profileError) throw profileError

  return (profiles || []).map((p) => {
    const site = p.sites || null
    return {
      id: p.id,
      name: p.name,
      email: '—',
      site_id: p.site_id,
      site_name: site?.name || null,
      site_address: site?.address || null,
      active: p.active ?? true,
      unassigned: !p.site_id,
    }
  })
}

export async function assignClientToSite(clientId, siteId) {
  const { error } = await supabase
    .from('profiles')
    .update({ site_id: siteId, role: 'client' })
    .eq('id', clientId)

  if (error) throw error
}

export async function removeClient(clientId) {
  const { data, error: fnError } = await supabase.functions.invoke('delete-client', {
    body: { client_id: clientId },
  })

  if (!fnError && data?.success) return { method: 'full' }

  const fnFailed = fnError || data?.error

  const { error: profileError } = await supabase.from('profiles').delete().eq('id', clientId)
  if (profileError) {
    throw new Error(
      profileError.message.includes('policy')
        ? 'Could not remove client. Deploy delete-client function or use super admin.'
        : profileError.message,
    )
  }

  return {
    method: 'partial',
    warning: fnFailed
      ? 'Client removed from app. Delete their login in Supabase → Authentication → Users if needed.'
      : null,
  }
}
