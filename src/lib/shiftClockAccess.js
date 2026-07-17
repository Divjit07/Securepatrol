import { supabase } from './supabase.js'

/**
 * Fast-path UI check: the profile flag only. The DB (`is_shift_clock_admin`,
 * migration 019) is the enforcement point — hardcoded email/name fallbacks
 * were removed in favor of the flag, which migrations 019/035 seed.
 */
export function isShiftClockAdmin(_user, profile) {
  return profile?.can_manage_shift_clock === true
}

export async function checkShiftClockAdminFromDb() {
  const { data, error } = await supabase.rpc('check_shift_clock_admin')
  if (error) return null
  return data === true
}
