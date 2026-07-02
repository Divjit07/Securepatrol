import { supabase } from './supabase.js'

export function shiftAdjustmentKey(guardId, dateStr) {
  return `${guardId}-${dateStr}`
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
