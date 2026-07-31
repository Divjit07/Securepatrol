/**
 * The Evidence Table — eight stations along one take.
 *
 * Three kinds of station stand on the table:
 *
 *  - Station 0 is a real 3D object, because the chain genuinely starts as one.
 *  - The two `paper` stations are documents on a WebGL sheet (PaperStage), the
 *    same stock as the hero — these are artifacts you hold, not screens.
 *  - Everything else is a product screenshot in a device frame. Painted onto a
 *    mesh, UI text softens into mush, so those stay <img> elements at 2×.
 *
 * `screen` names the exact surface — the glass, or the document reference — and
 * every line in `notes` is something a reader can point at in the thing next to
 * it. If a note stops being true, re-shoot the screenshot or delete the note.
 *
 * `cam` / `look` only apply to station 0's WebGL scene.
 */

export const STATIONS = [
  {
    id: 'tag',
    rail: 'Tag',
    where: 'On the wall',
    screen: 'Printed checkpoint label · NTAG 213',
    title: 'The chain starts as an object.',
    body:
      'Before any of this is software, it is a sticker. A checkpoint is an NTAG 213 tag — or a printed QR label where the phone has no NFC radio — fixed to one place: the inside of a stairwell door, the back of the loading dock. The day it goes up, someone stands at it and records its coordinates. Every distance and every dispute afterwards is measured against that one reading.',
    notes: [
      'CP-04 · Level 4, east stairwell — one tag, one place',
      '43.6629° N, 79.4103° W, captured the day it was mounted',
      '20 m radius — a tap from outside it is not a pass',
      'NTAG 213 by default, QR label where NFC is unavailable',
    ],
    shots: {},
    cam: [-0.72, 1.32, 2.5],
    look: [-0.54, 1.05, 0.05],
  },
  {
    id: 'guard',
    rail: 'Guard',
    where: "In the guard's hand",
    screen: 'Guard app · Shift clock and patrol dashboard',
    title: 'Clocking in is a patrol scan.',
    body:
      'There is no attendance button a guard can press from the parking lot. Opening the shift clock compares the phone against the checkpoint it should be standing at and prints the distance in metres — 19,711 m here, so the button stays locked and there is nothing to argue about. Walk inside the radius and it turns green. The punch is a patrol scan, so attendance and patrol stop being two systems somebody reconciles at month end.',
    notes: [
      '19,711 m away · EARLY WINDOW — clock-in stays locked',
      'Inside the geofence at 16 m — the button unlocks',
      'On duty: scanning, incident reports and history open up',
      'Rounds, scans and checkpoint coverage count themselves',
    ],
    shots: {
      phone: [
        '/shots/guard-1-offsite.jpg',
        '/shots/guard-2-onsite.jpg',
        '/shots/guard-3-onduty.jpg',
        '/shots/guard-4-patrol.jpg',
      ],
    },
    alt: "Kronus guard app on a phone: the shift clock refuses to unlock 19,711 m from the site, unlocks at 16 m, then shows the guard on duty with patrol rounds, scans and checkpoint coverage counting up.",
  },
  {
    id: 'incident',
    rail: 'Incident',
    where: 'When something is wrong',
    screen: 'Guard app · Site incident report → Client portal · Incidents',
    title: 'The exception is written where it is standing.',
    body:
      'Most of what a client is actually paying for is the night something was off. The guard writes it on the same phone, in front of the thing, while it is still true: what they found, what they did about it, up to five photos, taken as they type. Nothing is phoned to a supervisor or retyped in the morning. It lands in the client’s own list with the guard’s name and the time attached.',
    notes: [
      'Filed at the loading dock at 7:26 PM, 237 characters',
      'Up to five photos, PDFs or DOCX files · 10 MB each',
      'Filed against the checkpoint the guard is standing at',
      'Six reports this month, in the client portal as they land',
    ],
    shots: {
      phone: ['/shots/guard-6-incident.jpg'],
      wide: ['/shots/client-incident.jpg'],
    },
    alt: "Kronus incident report on a guard's phone describing an unsecured loading dock door, and the same report in the client portal's incident list with the guard's name and the time.",
  },
  {
    id: 'incident-paper',
    rail: 'Filed',
    where: "In your client's inbox, that night",
    screen: 'Incident report · INC-2026-0724-014 · PDF',
    title: 'It leaves as a document, not a phone call.',
    body:
      'What the guard typed at the bay becomes a filed report the moment they hit send — reference number, severity, the coordinates, the photographs off their camera roll, and a line for every action they took. Your client gets the PDF at 23:11, thirteen minutes after it happened, and it is the same record that will still be there in eighteen months when their insurer asks what the property was doing about it.',
    notes: [
      'INC-2026-0724-014 · property damage, medium severity',
      'Two photographs, keyed and attached at the scene',
      'Bay taped off, building management notified at 23:04',
      'Sent to the client 23:11 — no supervisor in the middle',
    ],
    paper: 'incident',
    shots: {},
    alt: 'A Kronus incident report on paper: property damage at Parkade west bay 41, filed by M. Dubois at 22:58, with two photographs of a broken vehicle window attached and a stamp reading sent to client 23:11.',
  },
  {
    id: 'console',
    rail: 'Console',
    where: 'In your office',
    screen: 'Admin · Overview',
    title: 'The record raises its own problems.',
    body:
      'A job runs every ten minutes, re-reads the same scans and asks three questions: has anyone failed to clock in for a shift that already started, has any site gone longer than its own limit without a scan, and is anybody late right now. The answers arrive here before your client notices them. Coverage reads 63% because two sites are genuinely behind — it is counted, not typed in before the Monday call.',
    notes: [
      'Coverage 63% · 5 on duty · 1 running late · 1 no-show',
      'NO-SHOW · shift started 9:00 PM, 40 minutes ago',
      'STALE PATROL · no scan for 130 min, site limit is 120',
      'Every site scored on its own bar — Liberty Village at 0%',
    ],
    shots: { wide: ['/shots/ops-console.jpg'] },
    alt: 'Kronus admin overview on a laptop: coverage at 63 percent, five guards on duty, one running late and one no-show, with a sites list and a needs-attention column listing a no-show, a stale patrol and a late shift.',
  },
  {
    id: 'record-paper',
    rail: 'Record',
    where: 'On the desk the next morning',
    screen: 'Patrol verification report · PVR-2026-0724-NGT',
    title: 'The whole night comes back as one page.',
    body:
      'This is the artifact the entire product exists to produce. Twelve hours of a building — every checkpoint pass with the time it happened and how far the phone was standing from the tag, the round that started nine minutes late marked in red rather than quietly dropped, and the totals at the foot counted from those rows instead of typed above them. The seal sets only once the record is complete, so a page that is still missing scans cannot be handed to anyone as if it were finished.',
    notes: [
      'PVR-2026-0724-NGT · Fri 24 Jul, 18:00 – 06:00, 12.02 h',
      'Every line carries how it was proven — the tap on the tag',
      'Round 5 started 9:12 late · ALERT RAISED, printed in red',
      'Verified seal sets on completion, never before',
    ],
    paper: 'report',
    shots: {},
    alt: 'A Kronus patrol verification report on paper for Northgate Tower, listing eleven timestamped checkpoint passes, one late round raised as an alert, six of six rounds complete and 12.02 hours on site, stamped as a verified record.',
  },
  {
    id: 'report',
    rail: 'Export',
    where: "In the bookkeeper's inbox",
    screen: 'Client portal · Reports → Scan report and Guard hours',
    title: 'The same rows, in a file they can post.',
    body:
      'Nothing on that page was assembled for it. The portal is already showing the rows, and two exports fall out of them: the scan report is the patrol, every pass in the period with its time and its floor, and the hours report is the invoice — clocked time inside each published shift, so an early arrival is not quietly billed and a shift nobody rostered is not billed at all. CSV for the bookkeeper, PDF for the client’s file, both off the same table.',
    notes: [
      'Scan report · 38 passes, 11 of 11 checkpoints, Jul 27',
      'Hours · Jul 13 – Jul 26, 14 days, 197h 40 mins total',
      'Divjit 12 days / 104h 50 · Sukhi 12 days / 92h 50',
      'Only published roster shifts are billable — nothing else',
    ],
    shots: { sheets: ['/shots/report-scans.jpg', '/shots/report-hours.jpg'] },
    alt: 'Two Kronus reports: a scan report listing 38 timestamped checkpoint passes for one shift, and a two-week guard hours report totalling 197 hours 40 minutes across two guards.',
  },
  {
    id: 'client',
    rail: 'Client',
    where: "In your client's hands",
    screen: 'Client portal · Patrol overview, desktop and phone',
    title: 'They read the record you read.',
    body:
      'The building owner gets a read-only login to the same database — not a weekly summary you assembled, not a screenshot pasted into an email. They see who is on site right now, when that guard clocked in, how many rounds have closed and which checkpoints are still outstanding, at their desk or on their phone at two in the morning. Nothing is retyped in between.',
    notes: [
      '800 Bathurst-DJ · Tuesday 11:00 AM – 8:00 PM',
      'Divjit Singh on duty, clocked in at 11:04 AM',
      '3 rounds · 30 scans · 9 of 9 checkpoints hit',
      'Read-only: they can export it, they cannot edit it',
    ],
    shots: {
      wide: ['/shots/client-portal.jpg'],
      phone: ['/shots/client-mobile.jpg'],
    },
    alt: 'Kronus client portal on a laptop and a phone: site 800 Bathurst-DJ, on duty Divjit clocked in at 11:04 AM, three patrol rounds, thirty scans and nine of nine checkpoints hit.',
  },
]

/** Every screenshot in the room, in reading order — the fallback's source list. */
export function mediaOf(station) {
  return [
    ...(station.shots.phone || []).map((src) => ({ src, kind: 'phone' })),
    ...(station.shots.wide || []).map((src) => ({ src, kind: 'wide' })),
    ...(station.shots.sheets || []).map((src) => ({ src, kind: 'wide' })),
  ]
}

/**
 * How long a station sits still. Within one leg of the walk, scroll from 0 to
 * HOLD_IN changes nothing, HOLD_OUT to 1 changes nothing, and the swap happens
 * in between — so more than half of every leg is a station holding perfectly
 * still, which is the only way anyone reads the caption.
 */
export const HOLD_IN = 0.34
export const HOLD_OUT = 0.78

/** Eased position within a leg: hold, cross, hold. */
export function legProgress(f) {
  const u = Math.min(1, Math.max(0, (f - HOLD_IN) / (HOLD_OUT - HOLD_IN)))
  return u * u * (3 - 2 * u)
}

/**
 * The guard's four screens play across station 1's hold — raw scroll units, so
 * they advance at a steady rate while the phone itself is not moving.
 */
export const PHONE_SEQUENCE = { start: 0.82, end: 1.3 }

/** srcset for a shot that has a matching `@2x` sibling. */
export function shotSrcSet(src) {
  // The four real-device guard shots predate the @2x pipeline — leave them be.
  if (/guard-[1-5]-/.test(src)) return undefined
  return `${src} 1x, ${src.replace(/(\.[a-z]+)$/i, '@2x$1')} 2x`
}
