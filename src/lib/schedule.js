import { supabase } from './supabase.js'

export const SHIFT_COLORS = ['blue', 'violet', 'teal', 'amber', 'rose']

export const MIN_REST_HOURS = 8

// ---------------------------------------------------------------------------
// Date helpers (all local-time; shifts stored as timestamptz)
// ---------------------------------------------------------------------------

export function startOfWeek(date) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function shiftHours(shift) {
  const ms = new Date(shift.ends_at) - new Date(shift.starts_at)
  return Math.max(0, ms / 3600000 - (shift.break_minutes || 0) / 60)
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatTimeRange(shift) {
  return `${formatTime(shift.starts_at)} – ${formatTime(shift.ends_at)}`
}

/**
 * Compact range for the roster grid, where a chip is ~110px wide and the full
 * form ("12:00 AM – 8:00 AM") truncates. Drops the minutes when they are zero —
 * which is most shifts — and the meridiem on the start when both halves share
 * it: "9 AM – 5 PM", "12 AM – 8 AM", "9:30 AM – 5 PM".
 */
export function formatTimeRangeCompact(shift) {
  const compact = (iso) => {
    const d = new Date(iso)
    const time = d.getMinutes() === 0
      ? d.toLocaleTimeString([], { hour: 'numeric' })
      : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return time.replace(/\s+/g, ' ').trim()
  }
  const a = compact(shift.starts_at)
  const b = compact(shift.ends_at)
  const meridiem = /(AM|PM)$/i.exec(a)?.[1]
  const shareMeridiem = meridiem && new RegExp(`${meridiem}$`, 'i').test(b)
  return `${shareMeridiem ? a.replace(/\s*(AM|PM)$/i, '') : a} – ${b}`
}

export function formatDayLabel(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const SHIFT_SELECT =
  'id, site_id, guard_id, starts_at, ends_at, break_minutes, status, notes, color, recurrence_id, published_at, acknowledged_at, claimed_at, sites(id, name), profiles:guard_id(id, name)'

export async function fetchShiftsInRange(siteId, rangeStart, rangeEnd) {
  let query = supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .gte('starts_at', rangeStart.toISOString())
    .lt('starts_at', rangeEnd.toISOString())
    .neq('status', 'cancelled')
    .order('starts_at')

  if (siteId) query = query.eq('site_id', siteId)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/** Guard's own upcoming published shifts plus claimable open shifts. */
export async function fetchGuardSchedule(guardId, rangeStart, rangeEnd) {
  const { data, error } = await supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .eq('status', 'published')
    .gte('starts_at', rangeStart.toISOString())
    .lt('starts_at', rangeEnd.toISOString())
    .order('starts_at')

  if (error) throw error
  const rows = data || []
  return {
    mine: rows.filter((s) => s.guard_id === guardId),
    open: rows.filter((s) => !s.guard_id),
  }
}

/** Guards on duty right now (published shifts in progress) — RLS-scoped. */
export async function fetchOnDutyNow() {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('shifts')
    .select('id, guard_id, site_id')
    .eq('status', 'published')
    .not('guard_id', 'is', null)
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso)
  if (error) throw error
  return new Set((data || []).map((s) => s.guard_id)).size
}

/** Published shifts overlapping [rangeStart, rangeEnd) — includes overnight carries. */
export async function fetchShiftsOverlapping(rangeStart, rangeEnd, { siteId } = {}) {
  let query = supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .eq('status', 'published')
    .lt('starts_at', rangeEnd.toISOString())
    .gt('ends_at', rangeStart.toISOString())
    .order('starts_at')

  if (siteId) query = query.eq('site_id', siteId)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Latest clock punch per guard in the last `hours` hours.
 * Returns Map<guardId, { clockedIn, scannedAt, role }>.
 */
export async function fetchClockStatusByGuard(hours = 16) {
  const since = new Date(Date.now() - hours * 3600000).toISOString()
  const { data, error } = await supabase
    .from('scans')
    .select(
      'id, guard_id, scanned_at, profiles:guard_id(id, name), checkpoints!inner(checkpoint_role, name, floors(site_id, sites(id, name)))',
    )
    .eq('status', 'pass')
    .in('checkpoints.checkpoint_role', ['shift_clock_in', 'shift_clock_out'])
    .gte('scanned_at', since)
    .order('scanned_at', { ascending: false })
    .limit(500)

  if (error) throw error

  const byGuard = new Map()
  for (const row of data || []) {
    if (byGuard.has(row.guard_id)) continue
    const role = row.checkpoints?.checkpoint_role
    byGuard.set(row.guard_id, {
      clockedIn: role === 'shift_clock_in',
      scannedAt: row.scanned_at,
      role,
      checkpointName: row.checkpoints?.name || null,
      siteId: row.checkpoints?.floors?.site_id || null,
      siteName: row.checkpoints?.floors?.sites?.name || null,
      guardName: row.profiles?.name || 'Guard',
    })
  }
  return byGuard
}

/** The guard's next published shift (current one first if in progress). */
export async function fetchNextShift(guardId) {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .eq('guard_id', guardId)
    .eq('status', 'published')
    .gt('ends_at', nowIso)
    .order('starts_at')
    .limit(1)

  if (error) throw error
  return data?.[0] || null
}

/** Published roster shift overlapping a calendar day (what admin emails on publish). */
export async function fetchGuardShiftForDate(guardId, dateStr) {
  if (!guardId || !dateStr) return null

  const [y, m, d] = dateStr.split('-').map(Number)
  const startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0)
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999)

  const { data, error } = await supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .eq('guard_id', guardId)
    .eq('status', 'published')
    .lte('starts_at', endOfDay.toISOString())
    .gte('ends_at', startOfDay.toISOString())
    .order('starts_at')
    .limit(1)

  if (error) throw error
  return data?.[0] || null
}

// ---------------------------------------------------------------------------
// Mutations (admin)
// ---------------------------------------------------------------------------

export async function createShift(shift) {
  const { data, error } = await supabase.from('shifts').insert(shift).select(SHIFT_SELECT)
  if (error) throw error
  return data?.[0]
}

/**
 * Create a repeating series: materializes one row per occurrence linked by a
 * shift_recurrences row so the series can be edited/deleted together.
 */
export async function createShiftSeries(shift, { frequency, count }) {
  const { data: rec, error: recError } = await supabase
    .from('shift_recurrences')
    .insert({ frequency })
    .select('id')
    .single()
  if (recError) throw recError

  const stepDays = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : null
  const rows = []
  for (let i = 0; i < count; i++) {
    const starts = new Date(shift.starts_at)
    const ends = new Date(shift.ends_at)
    if (stepDays != null) {
      starts.setDate(starts.getDate() + stepDays * i)
      ends.setDate(ends.getDate() + stepDays * i)
    } else {
      starts.setMonth(starts.getMonth() + i)
      ends.setMonth(ends.getMonth() + i)
    }
    rows.push({
      ...shift,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      recurrence_id: rec.id,
    })
  }

  const { data, error } = await supabase.from('shifts').insert(rows).select(SHIFT_SELECT)
  if (error) throw error
  return data || []
}

export async function updateShift(shiftId, patch) {
  const { data, error } = await supabase
    .from('shifts')
    .update(patch)
    .eq('id', shiftId)
    .select(SHIFT_SELECT)
  if (error) throw error
  return data?.[0]
}

export async function deleteShift(shiftId) {
  const { error } = await supabase.from('shifts').delete().eq('id', shiftId)
  if (error) throw error
}

export async function deleteShiftSeries(recurrenceId, fromIso) {
  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('recurrence_id', recurrenceId)
    .gte('starts_at', fromIso)
  if (error) throw error
}

/** Copy every non-cancelled shift from the previous week into this week as drafts. */
export async function copyWeek(siteId, weekStart) {
  const prevStart = addDays(weekStart, -7)
  const source = await fetchShiftsInRange(siteId, prevStart, weekStart)
  if (!source.length) return []

  const rows = source.map((s) => ({
    site_id: s.site_id,
    guard_id: s.guard_id,
    starts_at: addDays(new Date(s.starts_at), 7).toISOString(),
    ends_at: addDays(new Date(s.ends_at), 7).toISOString(),
    break_minutes: s.break_minutes,
    notes: s.notes,
    color: s.color,
    status: 'draft',
  }))

  const { data, error } = await supabase.from('shifts').insert(rows).select(SHIFT_SELECT)
  if (error) throw error
  return data || []
}

/**
 * Publish all drafts in range. Tries the Edge Function (emails + .ics via
 * Resend); falls back to a direct DB publish when it isn't deployed.
 */
export async function publishWeek(siteId, rangeStart, rangeEnd, publishedBy) {
  const payload = {
    site_id: siteId,
    range_start: rangeStart.toISOString(),
    range_end: rangeEnd.toISOString(),
  }

  const { data, error: fnError } = await supabase.functions.invoke('publish-schedule', {
    body: payload,
  })
  if (!fnError && data?.success) {
    return {
      published: data.published,
      emailed: data.emailed,
      skipped: data.skipped || [],
      emailError: data.email_error || null,
      method: 'function',
    }
  }

  // Fallback: publish without emails.
  const { data: rows, error } = await supabase
    .from('shifts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('site_id', siteId)
    .eq('status', 'draft')
    .gte('starts_at', rangeStart.toISOString())
    .lt('starts_at', rangeEnd.toISOString())
    .select('id')
  if (error) throw error

  await supabase.from('schedule_publications').insert({
    site_id: siteId,
    published_by: publishedBy,
    range_start: rangeStart.toISOString().slice(0, 10),
    range_end: rangeEnd.toISOString().slice(0, 10),
    shift_count: rows?.length || 0,
    email_error: 'publish-schedule function not deployed; no emails sent',
  })

  return { published: rows?.length || 0, emailed: 0, skipped: [], emailError: null, method: 'direct' }
}

// ---------------------------------------------------------------------------
// Mutations (guard)
// ---------------------------------------------------------------------------

export async function claimOpenShift(shiftId) {
  const { data, error } = await supabase.rpc('claim_open_shift', { p_shift_id: shiftId })
  if (error) throw error
  if (!data?.length) throw new Error('This shift was just claimed by someone else.')
  return data[0]
}

export async function acknowledgeShift(shiftId) {
  const { data, error } = await supabase.rpc('acknowledge_shift', { p_shift_id: shiftId })
  if (error) throw error
  return data?.[0] || null
}

// ---------------------------------------------------------------------------
// Conflict engine (shared by admin grid + guard claim UI)
// ---------------------------------------------------------------------------

function overlaps(a, b) {
  return new Date(a.starts_at) < new Date(b.ends_at) && new Date(b.starts_at) < new Date(a.ends_at)
}

/**
 * Returns conflicts for each shift keyed by shift id:
 *   overlap  – same guard double-booked
 *   rest     – less than MIN_REST_HOURS between this guard's shifts
 */
export function detectConflicts(shifts) {
  const byGuard = new Map()
  for (const s of shifts) {
    if (!s.guard_id || s.status === 'cancelled') continue
    if (!byGuard.has(s.guard_id)) byGuard.set(s.guard_id, [])
    byGuard.get(s.guard_id).push(s)
  }

  const conflicts = new Map()
  const add = (id, type) => {
    if (!conflicts.has(id)) conflicts.set(id, new Set())
    conflicts.get(id).add(type)
  }

  for (const list of byGuard.values()) {
    list.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (overlaps(list[i], list[j])) {
          add(list[i].id, 'overlap')
          add(list[j].id, 'overlap')
        }
      }
      if (i > 0) {
        const rest = (new Date(list[i].starts_at) - new Date(list[i - 1].ends_at)) / 3600000
        if (rest >= 0 && rest < MIN_REST_HOURS) {
          add(list[i].id, 'rest')
          add(list[i - 1].id, 'rest')
        }
      }
    }
  }

  return conflicts
}

export const CONFLICT_LABELS = {
  overlap: 'Double-booked',
  rest: `Less than ${MIN_REST_HOURS}h rest`,
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function fetchTemplates(siteId) {
  let query = supabase.from('shift_templates').select('*').order('start_minutes')
  if (siteId) query = query.or(`site_id.eq.${siteId},site_id.is.null`)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createTemplate(template) {
  const { data, error } = await supabase.from('shift_templates').insert(template).select()
  if (error) throw error
  return data?.[0]
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('shift_templates').delete().eq('id', id)
  if (error) throw error
}
