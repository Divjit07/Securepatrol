import { supabase } from './supabase.js'
import { getUserEmail, SCAN_APPROVER_EMAIL } from './scanApproval.js'

export const SHIFT_CLOCK_ADMIN_EMAIL = 'rose@prodsec.ca'

export function isShiftClockAdmin(user, profile) {
  if (profile?.can_manage_shift_clock === true) return true
  const email = getUserEmail(user)
  if (email === SHIFT_CLOCK_ADMIN_EMAIL || email === SCAN_APPROVER_EMAIL) return true
  const name = profile?.name?.trim().toLowerCase() || ''
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  return isAdmin && name.startsWith('divjit')
}

export async function checkShiftClockAdminFromDb() {
  const { data, error } = await supabase.rpc('check_shift_clock_admin')
  if (error) return null
  return data === true
}
