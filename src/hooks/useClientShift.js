import { useState } from 'react'

export const DEFAULT_CLIENT_SHIFT = { start: '11:00', end: '20:00' }

/**
 * Company default schedule: Mon–Fri 11am–8pm, Sat 10am–5pm, Sunday closed.
 * Sites can override per-day via sites.operating_hours (JSONB, same shape —
 * null day = closed). Edited in Admin Overview → site card → Hours.
 */
export const DEFAULT_OPERATING_HOURS = {
  mon: { start: '11:00', end: '20:00' },
  tue: { start: '11:00', end: '20:00' },
  wed: { start: '11:00', end: '20:00' },
  thu: { start: '11:00', end: '20:00' },
  fri: { start: '11:00', end: '20:00' },
  sat: { start: '10:00', end: '17:00' },
  sun: null,
}

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function normalizeOperatingHours(operatingHours) {
  if (!operatingHours || typeof operatingHours !== 'object') return DEFAULT_OPERATING_HOURS
  return { ...DEFAULT_OPERATING_HOURS, ...operatingHours }
}

export function formatTimeLabel(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function getScheduledShiftForDate(dateStr, operatingHours) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  const dayHours = normalizeOperatingHours(operatingHours)[DAY_KEYS[day]]

  if (!dayHours?.start || !dayHours?.end) {
    return {
      start: '11:00',
      end: '20:00',
      endLabel: null,
      scheduleLabel: `${DAY_NAMES[day]} · Closed (no shift)`,
      isSaturday: day === 6,
      isClosed: true,
    }
  }

  return {
    start: dayHours.start,
    end: dayHours.end,
    endLabel: formatTimeLabel(dayHours.end),
    scheduleLabel: `${DAY_NAMES[day]} · ${formatTimeLabel(dayHours.start)} – ${formatTimeLabel(dayHours.end)}`,
    isSaturday: day === 6,
    isClosed: false,
  }
}

/** Compact weekly summary, e.g. "Mon–Fri 11:00 AM–8:00 PM · Sat 10:00 AM–5:00 PM · Sun closed" */
export function describeOperatingHours(operatingHours) {
  const hours = normalizeOperatingHours(operatingHours)
  const week = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const short = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
  const valueOf = (k) => (hours[k]?.start ? `${hours[k].start}-${hours[k].end}` : 'closed')

  const runs = []
  for (const key of week) {
    const value = valueOf(key)
    const last = runs[runs.length - 1]
    if (last && last.value === value) last.to = key
    else runs.push({ from: key, to: key, value })
  }

  return runs
    .map(({ from, to, value }) => {
      const days = from === to ? short[from] : `${short[from]}–${short[to]}`
      if (value === 'closed') return `${days} closed`
      const [start, end] = value.split('-')
      return `${days} ${formatTimeLabel(start)}–${formatTimeLabel(end)}`
    })
    .join(' · ')
}

const SHIFT_KEY = 'client-portal-shift'

function loadShift() {
  try {
    const saved = localStorage.getItem(SHIFT_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    /* ignore */
  }
  return DEFAULT_CLIENT_SHIFT
}

export function shiftBounds(dateStr, startTime, endTime) {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d, startH, startM, 0, 0)
  const end = new Date(y, m - 1, d, endH, endM, 59, 999)
  // Overnight shift (e.g. 20:00 → 06:00): the end lands on the NEXT day.
  if (end <= start) end.setDate(end.getDate() + 1)
  return { start, end }
}

/** Load scans from start of day through shift end (includes early clock-in). */
export function shiftScanBounds(dateStr, startTime, endTime) {
  const { end } = shiftBounds(dateStr, startTime, endTime)
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d, 0, 0, 0, 0)
  return { start, end }
}

export function scheduledShiftBounds(dateStr, operatingHours) {
  const schedule = getScheduledShiftForDate(dateStr, operatingHours)
  if (schedule.isClosed) return null
  return shiftBounds(dateStr, schedule.start, schedule.end)
}

export function useClientShift(operatingHours) {
  // Deep-link support: /client?date=YYYY-MM-DD opens that day (e.g. from Coverage).
  const [date, setDate] = useState(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('date')
      if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param
    } catch {
      /* ignore */
    }
    return new Date().toISOString().slice(0, 10)
  })
  const [shift, setShift] = useState(loadShift)

  const scheduled = getScheduledShiftForDate(date, operatingHours)

  const updateShift = (patch) => {
    setShift((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(SHIFT_KEY, JSON.stringify(next))
      } catch {
        /* Safari private mode */
      }
      return next
    })
  }

  return { date, setDate, shift: scheduled, scheduled, setShift: updateShift }
}
