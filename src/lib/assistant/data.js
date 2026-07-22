// Ops-assistant data layer. These are the deterministic queries the intent bot
// runs — the exact same lookups the old AI tools used, but client-side through
// the RLS-scoped Supabase client (row security still limits results to the
// admin's own sites, same as before). Every number the assistant reports comes
// from here; the intent layer only phrases it.
import { supabase } from '../supabase.js'

const CLOCK_ROLES = ['shift_clock_in', 'shift_clock_out']

/** Who is clocked in right now (+ recent clock-outs), across the admin's sites. */
export async function getOnShiftNow() {
  const { data: guards, error: gErr } = await supabase
    .from('guards')
    .select('id, name, active, sites(name)')
    .eq('active', true)
  if (gErr) throw new Error(gErr.message)
  if (!guards?.length) return { on_shift: [], recently_clocked_out: [] }

  const since = new Date(Date.now() - 16 * 3600000).toISOString()
  const { data: punches, error: pErr } = await supabase
    .from('scans')
    .select('guard_id, scanned_at, approval_note, checkpoints!inner(checkpoint_role)')
    .in('guard_id', guards.map((g) => g.id))
    .eq('status', 'pass')
    .in('checkpoints.checkpoint_role', CLOCK_ROLES)
    .gte('scanned_at', since)
    .order('scanned_at', { ascending: false })
  if (pErr) throw new Error(pErr.message)

  const lastByGuard = new Map()
  for (const p of punches || []) {
    if (!lastByGuard.has(p.guard_id)) {
      lastByGuard.set(p.guard_id, {
        at: p.scanned_at,
        role: p.checkpoints?.checkpoint_role,
        note: p.approval_note || null,
      })
    }
  }

  const on_shift = []
  const recently_clocked_out = []
  for (const g of guards) {
    const last = lastByGuard.get(g.id)
    if (!last) continue
    const site = g.sites?.name || null
    if (last.role === 'shift_clock_in') {
      on_shift.push({ guard: g.name, site, clocked_in_at: last.at })
    } else {
      recently_clocked_out.push({ guard: g.name, site, clocked_out_at: last.at, note: last.note })
    }
  }
  on_shift.sort((a, b) => new Date(a.clocked_in_at) - new Date(b.clocked_in_at))
  return { on_shift, recently_clocked_out }
}

export async function listSites() {
  const { data, error } = await supabase.from('sites').select('id, name').order('name')
  if (error) throw new Error(error.message)
  return data || []
}

/** Paired clock-in/out sessions + total minutes for one guard in a window. */
export async function getHours(guardId, startISO, endISO) {
  const { data, error } = await supabase
    .from('scans')
    .select('scanned_at, checkpoints!inner(checkpoint_role)')
    .eq('guard_id', guardId)
    .eq('status', 'pass')
    .in('checkpoints.checkpoint_role', CLOCK_ROLES)
    .gte('scanned_at', startISO)
    .lte('scanned_at', endISO)
    .order('scanned_at', { ascending: true })
    .limit(500)
  if (error) throw new Error(error.message)

  const sessions = []
  let openIn = null
  for (const s of data || []) {
    const role = s.checkpoints?.checkpoint_role
    if (role === 'shift_clock_in') {
      if (!openIn) openIn = s.scanned_at
    } else if (openIn) {
      sessions.push({
        clock_in: openIn,
        clock_out: s.scanned_at,
        minutes: Math.round((new Date(s.scanned_at) - new Date(openIn)) / 60000),
      })
      openIn = null
    }
  }
  if (openIn) sessions.push({ clock_in: openIn, clock_out: null, minutes: null })
  const total = sessions.reduce((sum, x) => sum + (x.minutes || 0), 0)
  return { sessions, total_minutes: total, open: sessions.some((x) => !x.clock_out) }
}

/** Raw clock punches for one guard in a window, newest first. */
export async function getClockEvents(guardId, startISO, endISO) {
  const { data, error } = await supabase
    .from('scans')
    .select('scanned_at, approval_note, scan_input_method, checkpoints!inner(checkpoint_role)')
    .eq('guard_id', guardId)
    .eq('status', 'pass')
    .in('checkpoints.checkpoint_role', CLOCK_ROLES)
    .gte('scanned_at', startISO)
    .lte('scanned_at', endISO)
    .order('scanned_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data || []).map((s) => ({
    at: s.scanned_at,
    type: s.checkpoints?.checkpoint_role === 'shift_clock_in' ? 'clock_in' : 'clock_out',
    note: s.approval_note || null,
    by_admin: s.scan_input_method === 'admin',
  }))
}

/** Published roster shifts in a window, optionally filtered by site/guard. */
export async function getSchedule({ startISO, endISO, siteId, guardId }) {
  let q = supabase
    .from('shifts')
    .select('starts_at, ends_at, guard_id, profiles:guard_id(name), sites(name)')
    .eq('status', 'published')
    .gte('starts_at', startISO)
    .lte('starts_at', endISO)
    .order('starts_at', { ascending: true })
    .limit(100)
  if (siteId) q = q.eq('site_id', siteId)
  if (guardId) q = q.eq('guard_id', guardId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []).map((s) => ({
    guard: s.profiles?.name || null,
    site: s.sites?.name || null,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
  }))
}

/** Patrol pass-scans per checkpoint, GPS-reject count, and recorded misses. */
export async function getPatrolActivity(siteId, startISO, endISO) {
  const { data: floors, error: fErr } = await supabase.from('floors').select('id').eq('site_id', siteId)
  if (fErr) throw new Error(fErr.message)
  const floorIds = (floors || []).map((f) => f.id)
  if (!floorIds.length) return { checkpoints: [], gps_rejects: 0, misses: [] }

  const { data: cps, error: cErr } = await supabase
    .from('checkpoints')
    .select('id, name, checkpoint_role')
    .in('floor_id', floorIds)
    .eq('active', true)
  if (cErr) throw new Error(cErr.message)
  const patrolCps = (cps || []).filter((c) => !CLOCK_ROLES.includes(c.checkpoint_role || ''))
  const cpIds = (cps || []).map((c) => c.id)

  const [{ data: scans, error: sErr }, missRes] = await Promise.all([
    supabase
      .from('scans')
      .select('checkpoint_id, status')
      .in('checkpoint_id', cpIds)
      .gte('scanned_at', startISO)
      .lte('scanned_at', endISO)
      .limit(2000),
    supabase
      .from('checkpoint_misses')
      .select('guard_id, checkpoint_id, window_start, profiles:guard_id(name)')
      .eq('site_id', siteId)
      .gte('window_start', startISO)
      .lte('window_start', endISO)
      .limit(100),
  ])
  if (sErr) throw new Error(sErr.message)

  const passCount = new Map()
  let gpsRejects = 0
  for (const s of scans || []) {
    if (s.status === 'pass') passCount.set(s.checkpoint_id, (passCount.get(s.checkpoint_id) || 0) + 1)
    else gpsRejects += 1
  }
  const cpName = new Map((cps || []).map((c) => [c.id, c.name]))
  return {
    checkpoints: patrolCps.map((c) => ({ name: c.name, pass_scans: passCount.get(c.id) || 0 })),
    gps_rejects: gpsRejects,
    misses: (missRes.data || []).map((m) => ({
      guard: m.profiles?.name || 'Guard',
      checkpoint: cpName.get(m.checkpoint_id) || 'Checkpoint',
      at: m.window_start,
    })),
  }
}
