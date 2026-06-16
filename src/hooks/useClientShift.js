import { useState } from 'react'

export const DEFAULT_CLIENT_SHIFT = { start: '11:00', end: '20:00' }

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

export function useClientShift() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState(loadShift)

  const updateShift = (patch) => {
    setShift((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(SHIFT_KEY, JSON.stringify(next))
      return next
    })
  }

  return { date, setDate, shift, setShift: updateShift }
}
