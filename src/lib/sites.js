import { supabase } from './supabase.js'

export async function deleteSite(siteId) {
  const { error } = await supabase.from('sites').delete().eq('id', siteId)
  if (error) throw error
}
