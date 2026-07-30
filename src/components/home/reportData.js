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
      'A checkpoint is a physical object, not a row somebody created in a database. You mount an NTAG 213 sticker or a printed QR label at a real spot in the building — a stairwell landing, a loading dock, a parkade column — and its GPS coordinates are captured at the moment you install it. That fixed position becomes the thing every future scan is measured against, for as long as the site is yours.',
    detail: [
      'NTAG 213 sticker, or a printed QR label where NFC will not reach',
      'Coordinates captured at install — never typed in afterwards',
      'One tag, one fixed point, for the life of the contract',
    ],
    meas: 'L3 · North stairwell',
    image: {
      src: '/chain/01-sticker.jpg',
      w: 1200,
      h: 1607,
      alt:
        'A gloved hand presses a green Kronus checkpoint label onto the painted cinderblock wall of a building stairwell.',
    },
  },
  {
    id: 'scan',
    step: 'Scan',
    title: 'The guard has to be standing there',
    body:
      'Tapping the tag is the only way to log a pass. There is no button in the app that says "I was there", no way to mark a round complete from the car, and no supervisor override that writes a scan in after the fact. The phone has to be at the tag, and the tag does not move. If the round was not walked, the record will show it was not walked.',
    detail: [
      'NFC tap, or the camera and a QR label as the fallback',
      'Works with no signal — passes queue and sync on reconnect',
      'No manual pass entry exists, for any role, including admin',
    ],
    meas: '02:14:07',
    image: {
      src: '/chain/02-scan.jpg',
      w: 1200,
      h: 1607,
      alt:
        'A guard in a dark service corridor holds a phone against a wall-mounted checkpoint tag, which glows green under their hand.',
    },
  },
  {
    id: 'gps',
    step: 'GPS',
    title: 'The scan is validated against the tag',
    body:
      'Every scan carries the device position with it, and that position is checked against the checkpoint\'s recorded coordinates before the pass is allowed to count. Inside the radius it logs with the measured distance attached to the row. Outside it, the scan is refused and the guard is told why on the spot — so a broken round gets fixed at 02:14, not discovered by your client at nine the next morning.',
    detail: [
      'Radius set per site, 20 m by default',
      'The measured distance is stored on every pass, not just pass or fail',
      'Refusals are explained on the guard\'s screen while they can still act',
    ],
    meas: '12 m / 20 m',
    image: {
      src: '/chain/03-gps.jpg',
      w: 1200,
      h: 874,
      alt:
        'A checkpoint label on a parkade column in the foreground, a guard standing further back across the deck with a phone lit green in their hands.',
    },
  },
  {
    id: 'punch',
    step: 'Punch',
    title: 'The raw record is written once',
    body:
      'Clock-in is not a separate system bolted on beside patrol. It is a pass scan on a clock-in checkpoint, which means attendance and patrol are one record with one chain of proof behind them. Once a punch is written it is never edited. Corrections are stored as separate, attributed adjustments layered over a raw row that stays exactly as it happened, so an audit can always reach the original.',
    detail: [
      'Attendance and patrol share a single event stream',
      'Adjustments are additive and attributed — never overwrites',
      'The original punch survives every correction made on top of it',
    ],
    meas: 'IMMUTABLE',
    image: {
      src: '/chain/04-punch.jpg',
      w: 1200,
      h: 1607,
      alt:
        'A uniformed guard taps a phone to a checkpoint tag beside the lit glass doors of an office lobby on a wet street at night.',
    },
  },
  {
    id: 'hours',
    step: 'Hours',
    title: 'Payroll is derived, never retyped',
    body:
      'Fifteen-minute rounding, the overtime split and statutory holiday premiums are calculated views over the raw punches — not figures somebody keyed into a spreadsheet off a paper sheet at the end of the period. The guard reviews and signs the timesheet, and the CSV your bookkeeper imports comes off the same rows the client\'s report was built from. One record, two outputs, no reconciliation.',
    detail: [
      'Raw and rounded hours shown side by side, always both',
      'Overtime and holiday premiums applied by rule, not by hand',
      'Guard signs the sheet; the accounting export reads the same rows',
    ],
    meas: '12.02 h',
    image: {
      src: '/chain/05-hours.jpg',
      w: 1200,
      h: 1607,
      alt:
        'A tablet showing a Kronus payroll stub lying on an office desk, beside monitors and a keyboard in daylight.',
    },
  },
  {
    id: 'incident',
    step: 'Incident',
    title: 'The exception is filed from the scene',
    body:
      'When a guard finds something wrong, they write it where they are standing, on the same phone that logs the passes. Location, severity, the narrative in their own words, and photographs straight off the camera roll — attached the moment they are taken, not gathered into an email the following afternoon. The incident takes its own reference number and joins the same record as the patrol that found it.',
    detail: [
      'Photos, PDFs or DOCX attached at the scene — up to five files',
      'Location and severity captured with the report, not added later',
      'Reaches the client the same night, PDF attached',
    ],
    meas: 'INC-2026-0724-014',
    image: {
      src: '/chain/06-incident.jpg',
      w: 1200,
      h: 1607,
      alt:
        'A printed incident report with two attached photographs, lying on a desk beside a pair of reading glasses in flat morning daylight.',
    },
  },
  {
    id: 'report',
    step: 'Client',
    title: 'Your client reads the same record you billed from',
    body:
      'The building owner signs into a read-only portal scoped to their own site, or takes the PDF by email. What they read is not a summary you assembled for them the night before the meeting — it is the record itself, with the late round and the raised alert still printed on it. The page they audit and the page you invoiced from are the same page, which is the entire point.',
    detail: [
      'Read-only portal, locked to the client\'s own site and nothing else',
      'PDF and CSV export carry the same rows as the portal',
      'Exceptions stay on the record — nothing is quietly dropped',
    ],
    meas: 'PVR-2026-0724-NGT',
    image: {
      src: '/chain/07-client.jpg',
      w: 1200,
      h: 896,
      alt:
        'A building manager at their desk in morning light, reading a patrol verification report on a laptop with the printed PDF beside it.',
    },
  },
]
