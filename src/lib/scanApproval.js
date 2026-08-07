import { supabase } from './supabase.js'

export function getUserEmail(user) {
  return user?.email?.toLowerCase() || user?.user_metadata?.email?.toLowerCase() || ''
}

/**
 * Fast-path UI check: the profile flag only. The DB (`is_scan_approver`,
 * migration 016) is the enforcement point — hardcoded email/name fallbacks
 * were removed in favor of the flag, which migrations 016/035 seed.
 */
export function isScanApprover(_user, profile) {
  return profile?.can_approve_scans === true
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

/**
 * Record a whole round in one action: one scan per checkpoint, spread evenly
 * across the window. Defaults to the 15 minutes ending now — a round is roughly
 * a quarter hour on foot.
 *
 * Every row is still written as sync_method='admin_override' with approved_by
 * set (migration 048), which is what separates these from device-verified
 * scans in the record.
 */
export async function approveScanWave(checkpointIds, guardId, { startedAt, endedAt, note } = {}) {
  const { data, error } = await supabase.rpc('approve_scan_wave', {
    p_checkpoint_ids: checkpointIds,
    p_guard_id: guardId,
    p_started_at: startedAt ? new Date(startedAt).toISOString() : null,
    p_ended_at: endedAt ? new Date(endedAt).toISOString() : null,
    p_note: note || null,
  })

  if (error) throw error
  return data || []
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
