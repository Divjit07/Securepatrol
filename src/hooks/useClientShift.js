import { useState } from 'react'

export const DEFAULT_CLIENT_SHIFT = { start: '11:00', end: '20:00' }

/** Fixed site schedule: Mon–Fri 11am–8pm, Sat 11am–5pm, Sunday closed. */
export function getScheduledShiftForDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()

  if (day === 0) {
    return {
      start: '11:00',
      end: '20:00',
      endLabel: null,
      scheduleLabel: 'Sunday · Building closed (no shift)',
      isSaturday: false,
      isClosed: true,
    }
  }

  const start = '11:00'
  const end = day === 6 ? '17:00' : '20:00'
  const endLabel = day === 6 ? '5:00 PM' : '8:00 PM'
  const scheduleLabel =
    day === 6 ? 'Saturday · 11:00 AM – 5:00 PM' : 'Monday–Friday · 11:00 AM – 8:00 PM (auto clock-out)'

  return { start, end, endLabel, scheduleLabel, isSaturday: day === 6, isClosed: false }
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
  return { start, end }
}

export function scheduledShiftBounds(dateStr) {
  const schedule = getScheduledShiftForDate(dateStr)
  if (schedule.isClosed) return null
  return shiftBounds(dateStr, schedule.start, schedule.end)
}

export function useClientShift() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState(loadShift)

  const scheduled = getScheduledShiftForDate(date)

  const updateShift = (patch) => {
    setShift((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(SHIFT_KEY, JSON.stringify(next))
      return next
    })
  }

  return { date, setDate, shift: scheduled, scheduled, setShift: updateShift }
}
