/**
 * Synthetic sample data for the paper artifacts the record produces.
 * Authored at full fidelity, labeled synthetic on the surface. No commercial claim
 * about Kronus appears here — the wage rate belongs to a fictional guard on a
 * fictional shift, not to a Kronus price list.
 */

export const ROSTER = {
  docRef: 'RSTR-2026-W30-NGT',
  week: 'Week 30 · Mon 20 — Sun 26 Jul 2026',
  site: 'Northgate Tower',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  guards: [
    { name: 'A. Okonkwo', shifts: ['18–06', '18–06', '—', '18–06', '18–06', '—', '—'] },
    { name: 'M. Dubois', shifts: ['—', '—', '18–06', '—', '—', '18–06', '18–06'] },
    { name: 'R. Sandhu', shifts: ['06–18', '06–18', '06–18', '—', '—', '06–18', '06–18'] },
    { name: 'J. Baptiste', shifts: ['—', '—', '—', '06–18', '06–18', '—', '—'] },
    { name: 'Open', shifts: ['—', '—', '—', '—', '22–06', '—', '—'], open: true },
  ],
  published: '18 Jul, 14:22',
  invites: 4,
}

export const TIMESHEET = {
  docRef: 'PAY-2026-P14-G0412',
  guard: 'A. Okonkwo',
  guardId: 'G-0412',
  period: 'Pay period 14 · 13 — 26 Jul 2026',
  rate: '24.50',
  lines: [
    { label: 'Regular hours', detail: 'rounded to 15 min', hours: '72.00', amount: '1,764.00' },
    { label: 'Overtime', detail: 'over 44 h/week · 1.5×', hours: '6.25', amount: '229.69' },
    { label: 'Statutory holiday', detail: 'Civic Holiday · 1.5×', hours: '8.00', amount: '294.00' },
    { label: 'Adjustment', detail: 'radio handover, approved', hours: '0.50', amount: '12.25' },
  ],
  raw: '86.42',
  billable: '86.75',
  gross: '2,299.94',
  signed: 'Signed by the guard · 27 Jul, 06:11',
}

export const INCIDENT = {
  docRef: 'INC-2026-0724-014',
  site: 'Northgate Tower',
  where: 'P2 · Parkade west, bay 41',
  at: 'Fri 24 Jul 2026, 22:58',
  by: 'M. Dubois #G-0388',
  type: 'Property damage',
  severity: 'Medium',
  narrative:
    'Driver-side window of a parked vehicle found broken. Glass on the deck, nothing visible taken. Vehicle owner not on site. Photographed, taped off the bay, notified building management line at 23:04.',
  actions: ['Bay taped off', 'Building management notified', 'Police file not opened'],
  delivered: 'Emailed to the client 23:11 · PDF attached',
  photos: 2,
}

export const LABEL = {
  docRef: 'CP-NGT-L3-002',
  site: 'Northgate Tower',
  point: 'L3 · North stairwell',
  kind: 'Patrol checkpoint',
  coords: '43.7621 N · 79.4194 W',
  radius: '20 m',
  installed: '02 Jun 2026',
}

/** Deterministic module pattern for the sample label's code block. */
export function labelModules(size = 21, seed = 20260724) {
  let s = seed
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const grid = []
  for (let y = 0; y < size; y++) {
    const row = []
    for (let x = 0; x < size; x++) {
      const finder =
        (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
      if (finder) {
        const lx = x >= size - 7 ? x - (size - 7) : x
        const ly = y >= size - 7 ? y - (size - 7) : y
        const r = Math.max(Math.abs(lx - 3), Math.abs(ly - 3))
        row.push(r === 1 ? 0 : 1)
      } else {
        row.push(rnd() > 0.52 ? 1 : 0)
      }
    }
    grid.push(row)
  }
  return grid
}
