import { supabase } from './supabase.js'

export const STATUTORY_HOLIDAY_NOTE_PREFIX = 'Statutory holiday'
// A day an admin removed from payroll (junk/test punches). Raw scans stay
// immutable — the adjustment just tells every hours computation to skip the day.
export const EXCLUDED_NOTE_PREFIX = 'Excluded from payroll'

export function excludedNote(reason) {
  const trimmed = reason?.trim()
  return trimmed ? `${EXCLUDED_NOTE_PREFIX} — ${trimmed}` : EXCLUDED_NOTE_PREFIX
}

export function isExcludedAdjustment(adjustment) {
  return Boolean(adjustment?.note?.startsWith(EXCLUDED_NOTE_PREFIX))
}

export function shiftAdjustmentKey(guardId, dateStr) {
  return `${guardId}-${dateStr}`
}

export function statutoryHolidayNote(holidayName) {
  const trimmed = holidayName?.trim()
  return trimmed ? `${STATUTORY_HOLIDAY_NOTE_PREFIX} — ${trimmed}` : STATUTORY_HOLIDAY_NOTE_PREFIX
}

export function isStatutoryHolidayAdjustment(adjustment) {
  return Boolean(adjustment?.note?.startsWith(STATUTORY_HOLIDAY_NOTE_PREFIX))
}

export function statutoryHolidayName(note) {
  if (!note?.startsWith(STATUTORY_HOLIDAY_NOTE_PREFIX)) return ''
  return note.replace(`${STATUTORY_HOLIDAY_NOTE_PREFIX} — `, '').trim()
}

/** Client-facing label, e.g. "Canada Day — statutory holiday" */
export function clientStatutoryHolidayLabel(note) {
  if (!isStatutoryHolidayAdjustment({ note })) return null
  const name = statutoryHolidayName(note)
  if (!name) return 'Statutory holiday'
  return `${name} — statutory holiday`
}

export function mapShiftAdjustments(rows = []) {
  return Object.fromEntries(
    rows.map((row) => [
      shiftAdjustmentKey(row.guard_id, row.shift_date),
      row,
    ]),
  )
}

export async function fetchShiftAdjustmentsForSite(siteId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('guard_shift_adjustments')
    .select('*')
    .eq('site_id', siteId)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate)

  if (error) throw error
  return data || []
}

export async function fetchShiftAdjustmentsForDate(siteId, dateStr) {
  const { data, error } = await supabase
    .from('guard_shift_adjustments')
    .select('*')
    .eq('site_id', siteId)
    .eq('shift_date', dateStr)

  if (error) throw error
  return data || []
}

export async function saveShiftAdjustment({
  siteId,
  guardId,
  shiftDate,
  clockInAt,
  clockOutAt,
  note,
}) {
  const { data, error } = await supabase.rpc('upsert_guard_shift_adjustment', {
    p_site_id: siteId,
    p_guard_id: guardId,
    p_shift_date: shiftDate,
    p_clock_in: clockInAt,
    p_clock_out: clockOutAt,
    p_note: note || null,
  })

  if (error) throw error
  return data
}

export async function removeShiftAdjustment(guardId, shiftDate) {
  const { error } = await supabase.rpc('delete_guard_shift_adjustment', {
    p_guard_id: guardId,
    p_shift_date: shiftDate,
  })

  if (error) throw error
}

export function toTimeInputValue(date) {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export function combineDateAndTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = timeStr.split(':').map(Number)
  return new Date(y, m - 1, d, h, min, 0, 0)
}
