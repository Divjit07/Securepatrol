import { supabase } from './supabase.js'

export const SCAN_APPROVER_EMAIL = 'divjit007@gmail.com'

export function getUserEmail(user) {
  return user?.email?.toLowerCase() || user?.user_metadata?.email?.toLowerCase() || ''
}

export function isScanApprover(user, profile) {
  if (profile?.can_approve_scans === true) return true
  if (getUserEmail(user) === SCAN_APPROVER_EMAIL) return true
  const name = profile?.name?.trim().toLowerCase() || ''
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  return isAdmin && name.startsWith('divjit')
}

export async function checkScanApproverFromDb() {
  const { data, error } = await supabase.rpc('check_scan_approver')
  if (error) return null
  return data === true
}

export async function approveCheckpointScan(checkpointId, guardId, note) {
  const { data, error } = await supabase.rpc('approve_checkpoint_scan', {
    p_checkpoint_id: checkpointId,
    p_guard_id: guardId,
    p_note: note || null,
  })

  if (error) throw error
  return data
}

export async function fetchRecentAdminApprovals(limit = 25) {
  const { data, error } = await supabase
    .from('scans')
    .select(`
      id,
      scanned_at,
      approval_note,
      checkpoints(name, floors(floor_name, sites(name))),
      guard:profiles!scans_guard_id_profiles_fkey(name),
      approver:profiles!scans_approved_by_fkey(name)
    `)
    .eq('sync_method', 'admin_override')
    .order('scanned_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}
