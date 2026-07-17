// Live Clock board: who is clocked in/out RIGHT NOW across the admin's sites,
// plus the admin force clock-out (migration 037 RPC). Status derives from the
// same signal as the guard app (last pass clock punch in a 16h window), so the
// board and the guard's phone can never disagree.
import { supabase } from './supabase.js'

const WINDOW_HOURS = 16

/**
 * One row per active guard at the given sites:
 * { guard, siteName, clockedIn, clockInAt, clockOutAt, lastNote, lastMethod }
 * clockInAt = the IN punch that opened the current/most-recent session;
 * clockOutAt = the OUT punch that closed it (null while clocked in).
 */
export async function fetchLiveClockBoard(siteIds) {
  if (!siteIds?.length) return []

  const [{ data: guards, error: gErr }, { data: sites, error: sErr }] = await Promise.all([
    supabase.from('guards').select('id, name, site_id, active').in('site_id', siteIds).eq('active', true),
    supabase.from('sites').select('id, name').in('id', siteIds),
  ])
  if (gErr) throw gErr
  if (sErr) throw sErr
  if (!guards?.length) return []

  const since = new Date(Date.now() - WINDOW_HOURS * 3600000).toISOString()
  const { data: punches, error: pErr } = await supabase
    .from('scans')
    .select('guard_id, scanned_at, approval_note, scan_input_method, checkpoints!inner(checkpoint_role)')
    .in('guard_id', guards.map((g) => g.id))
    .eq('status', 'pass')
    .in('checkpoints.checkpoint_role', ['shift_clock_in', 'shift_clock_out'])
    .gte('scanned_at', since)
    .order('scanned_at', { ascending: false })
  if (pErr) throw pErr

  const siteName = new Map((sites || []).map((s) => [s.id, s.name]))
  const byGuard = new Map()
  for (const p of punches || []) {
    if (!byGuard.has(p.guard_id)) byGuard.set(p.guard_id, [])
    byGuard.get(p.guard_id).push(p)
  }

  return guards
    .map((guard) => {
      const list = byGuard.get(guard.id) || [] // newest first
      const last = list[0] || null
      const clockedIn = last?.checkpoints?.checkpoint_role === 'shift_clock_in'
      // Session pair: while clocked in, the IN is the last punch; after clock-out,
      // the IN is the first shift_clock_in older than that OUT.
      const clockInAt = clockedIn
        ? last.scanned_at
        : list.find((p) => p.checkpoints?.checkpoint_role === 'shift_clock_in')?.scanned_at || null
      return {
        guard,
        siteId: guard.site_id,
        siteName: siteName.get(guard.site_id) || 'Site',
        clockedIn,
        clockInAt,
        clockOutAt: !clockedIn && last ? last.scanned_at : null,
        lastNote: (!clockedIn && last?.approval_note) || null,
        lastMethod: last?.scan_input_method || null,
        hasPunches: Boolean(last),
      }
    })
    .sort((a, b) => {
      // Clocked-in first (longest on shift at top), then recent clock-outs.
      if (a.clockedIn !== b.clockedIn) return a.clockedIn ? -1 : 1
      const ta = new Date(a.clockInAt || a.clockOutAt || 0)
      const tb = new Date(b.clockInAt || b.clockOutAt || 0)
      return a.clockedIn ? ta - tb : tb - ta
    })
}

/** Force clock-out via the 037 RPC — inserts a real admin_override OUT punch. */
export async function adminClockOutGuard(guardId, note) {
  const { data, error } = await supabase.rpc('admin_clock_out_guard', {
    p_guard_id: guardId,
    p_note: note || null,
  })
  if (error) throw new Error(error.message)
  return data
}
