/**
 * Synthetic sample record for the marketing surface.
 *
 * Every value here is authored, not real. It is labeled synthetic wherever a
 * visitor could mistake it for a customer's data (see DESIGN.md § "Truth rules").
 * The shape mirrors the real product: a scan only counts inside the ~20 m GPS
 * radius of the checkpoint's recorded coordinates, clock-in is itself a pass scan
 * on a `shift_clock_in` checkpoint, and a raised alert stays on the record.
 */

export const REPORT = {
  docRef: 'PVR-2026-0724-NGT',
  site: 'Northgate Tower',
  address: '4200 Bathurst St, North York ON',
  period: 'Fri 24 Jul 2026 · 18:00 — 06:00',
  guard: 'A. Okonkwo',
  guardId: 'G-0412',
  radius: '20 m',
  // The ledger below shows a slice of the shift, not all of it. Said plainly on the
  // sheet: on a page about auditability, a total that does not reconcile with the
  // rows under it would be the worst possible detail to get wrong.
  excerpt: 'Selected entries · 11 of 35 logged events',
  pages: 'page 1 of 4',
  rows: [
    { time: '18:02', point: 'Lobby desk', kind: 'CLOCK IN', gps: '7 m', status: 'verified' },
    { time: '18:31', point: 'L1 · Loading dock', gps: '11 m', status: 'verified' },
    { time: '19:44', point: 'L3 · North stairwell', gps: '12 m', status: 'verified' },
    { time: '21:07', point: 'L6 · Roof access', gps: '6 m', status: 'verified' },
    { time: '22:52', point: 'P2 · Parkade west', gps: '9 m', status: 'verified' },
    { time: '00:18', point: 'L4 · Elevator lobby', gps: '14 m', status: 'verified' },
    { time: '01:36', point: 'Round 5 · started 9:12 late', gps: '—', status: 'alert' },
    { time: '02:14', point: 'L3 · North stairwell', gps: '12 m', status: 'verified' },
    { time: '03:48', point: 'L5 · Mechanical room', gps: '15 m', status: 'verified' },
    { time: '05:29', point: 'P1 · Parkade east', gps: '11 m', status: 'verified' },
    { time: '06:03', point: 'Lobby desk', kind: 'CLOCK OUT', gps: '8 m', status: 'verified' },
  ],
  summary: [
    { label: 'Rounds complete', value: '6 / 6' },
    { label: 'Checkpoint passes', value: '34' },
    { label: 'Alerts raised', value: '1' },
    { label: 'Hours on site', value: '12.02' },
  ],
}

/** The chain of custody: one wall sticker to one invoice line. */
export const CHAIN = [
  {
    id: 'sticker',
    step: 'Sticker',
    title: 'An NTAG sticker goes on the wall',
    body:
      'A checkpoint is a physical object — an NFC tag or a printed QR label mounted at a real spot in the building, with its coordinates recorded when you install it.',
    meas: 'L3 · North stairwell',
  },
  {
    id: 'scan',
    step: 'Scan',
    title: 'The guard has to be standing there',
    body:
      'Tapping the tag is the only way to log the pass. There is no button that says "I was there" — the phone has to be at the tag.',
    meas: '02:14:07',
  },
  {
    id: 'gps',
    step: 'GPS',
    title: 'The scan is validated against the tag',
    body:
      'The device position is checked against the checkpoint\'s recorded coordinates. Outside roughly 20 m the scan does not count, and the guard is told why.',
    meas: '12 m / 20 m',
  },
  {
    id: 'punch',
    step: 'Punch',
    title: 'The raw record is written once',
    body:
      'Clock-in is a pass scan on a clock-in checkpoint, so attendance and patrol are the same record. Raw punches are immutable — nothing ever writes over what happened.',
    meas: 'IMMUTABLE',
  },
  {
    id: 'hours',
    step: 'Hours',
    title: 'Payroll is derived, never retyped',
    body:
      '15-minute rounding and the overtime split are calculated views over the raw punches. The guard signs the timesheet, and the accounting CSV comes off the same record.',
    meas: '12.02 h',
  },
  {
    id: 'report',
    step: 'Report',
    title: 'Your client reads the same record you billed from',
    body:
      'The building owner logs into a read-only portal or gets the PDF. It is not a summary you assembled — it is the record itself, exceptions included.',
    meas: 'PVR-2026-0724-NGT',
  },
]
