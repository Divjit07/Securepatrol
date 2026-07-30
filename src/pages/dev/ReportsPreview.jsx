// Dev-only visual harness for the client's paperwork (/dev/reports) — feeds the
// real Reports and Incidents pages a seeded dataset through their `demo` prop,
// so what gets screenshotted is the shipping page, not a copy of it.
//
//   /dev/reports              scan report for one shift
//   /dev/reports?view=hours   guard hours for a two-week pay period
//   /dev/reports?view=incident  the incident the client reads
import { useSearchParams } from 'react-router-dom'
import ClientReports from '../ClientReports.jsx'
import ClientIncidents from '../ClientIncidents.jsx'

const SITE = {
  id: 'demo-site',
  name: '800 Bathurst-DJ',
  address: '800 Bathurst Street, Toronto, Ontario, M5S 1Y6, Canada',
  operating_hours: null,
}

const GUARDS = [
  { id: 'g-div', name: 'Divjit Singh' },
  { id: 'g-sukhi', name: 'Sukhi Kaur' },
]

const PATROL = [
  ['Main Entrance', 'Ground Floor'],
  ['Lobby Desk', 'Ground Floor'],
  ['Mail Room', 'Ground Floor'],
  ['Loading Dock', 'Ground Floor'],
  ['Parking Level B', 'Basement'],
  ['East Stairwell', '4th Floor'],
  ['West Stairwell', '4th Floor'],
  ['Rooftop Access', '12th Floor'],
  ['Mechanical Room', 'Penthouse'],
]

const CHECKPOINTS = [
  { id: 'cp-in', name: 'Clock In', checkpoint_role: 'shift_clock_in', floors: { floor_name: 'Ground Floor' } },
  { id: 'cp-out', name: 'Clock Out', checkpoint_role: 'shift_clock_out', floors: { floor_name: 'Ground Floor' } },
  ...PATROL.map(([name, floor], i) => ({
    id: `cp-${i}`,
    name,
    checkpoint_role: 'patrol',
    floors: { floor_name: floor },
  })),
]

const CP_BY_ID = Object.fromEntries(CHECKPOINTS.map((c) => [c.id, c]))

const iso = (date, h, m) => {
  const [y, mo, d] = date.split('-').map(Number)
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
}

const weekday = (date) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/**
 * Divjit works the seeded July roster (Mon–Fri 11:00–20:00, Sat 10:00–17:00);
 * Sukhi covers the day shift ahead of him. Sundays the site is dark.
 */
function rosterFor(date, guardId) {
  const day = weekday(date)
  if (day === 0) return null
  if (guardId === 'g-sukhi') {
    return day === 6 ? { start: [7, 0], end: [13, 0] } : { start: [7, 0], end: [15, 0] }
  }
  return day === 6 ? { start: [10, 0], end: [17, 0] } : { start: [11, 0], end: [20, 0] }
}

function daysBetween(from, to) {
  const out = []
  const [y, m, d] = from.split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  const [ey, em, ed] = to.split('-').map(Number)
  const last = new Date(ey, em - 1, ed)
  while (cursor <= last) {
    out.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
        cursor.getDate(),
      ).padStart(2, '0')}`,
    )
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/**
 * One worked day: the clock-in punch, N patrol rounds through every checkpoint,
 * and the clock-out punch. Minutes are nudged per round so no two days look
 * stamped out by a machine.
 */
function dayScans(date, guardId, rounds) {
  const roster = rosterFor(date, guardId)
  if (!roster) return []
  const [sh, sm] = roster.start
  const [eh, em] = roster.end
  const seed = date.charCodeAt(8) * 3 + date.charCodeAt(9) + guardId.charCodeAt(2) * 5
  const jitter = (n) => ((seed + n * 37) % 7) - 3

  const rows = [
    { id: `${date}-${guardId}-in`, checkpoint_id: 'cp-in', scanned_at: iso(date, sh, sm - 3 + jitter(0)) },
  ]

  const span = (eh * 60 + em - (sh * 60 + sm) - 40) / rounds
  for (let r = 0; r < rounds; r += 1) {
    const base = sh * 60 + sm + 20 + r * span
    PATROL.forEach((_, i) => {
      const at = base + i * 3 + jitter(r * 10 + i)
      rows.push({
        id: `${date}-${guardId}-${r}-${i}`,
        checkpoint_id: `cp-${i}`,
        scanned_at: iso(date, Math.floor(at / 60), Math.round(at % 60)),
      })
    })
  }

  rows.push({
    id: `${date}-${guardId}-out`,
    checkpoint_id: 'cp-out',
    scanned_at: iso(date, eh, em + 1 + jitter(3)),
  })

  return rows.map((r) => ({ ...r, guard_id: guardId, status: 'pass', distance_metres: 8 + (jitter(1) + 3) * 2 }))
}

const SCAN_DAY = '2026-07-27'
const HOURS_FROM = '2026-07-13'
const HOURS_TO = '2026-07-26'

const guardName = (id) => GUARDS.find((g) => g.id === id)?.name

/** The scan tab shows one shift in full — 4 rounds, both punches, newest first. */
const DAY_SCANS = dayScans(SCAN_DAY, 'g-div', 4)
  .map((s) => ({
    ...s,
    checkpoint: CP_BY_ID[s.checkpoint_id],
    profiles: { name: guardName(s.guard_id) },
  }))
  .sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))

const HOURS_DAYS = daysBetween(HOURS_FROM, HOURS_TO)

const HOURS_SCANS = HOURS_DAYS.flatMap((date) => [
  ...dayScans(date, 'g-div', weekday(date) === 6 ? 3 : 4),
  ...dayScans(date, 'g-sukhi', weekday(date) === 6 ? 3 : 4),
])

const PUBLISHED_SHIFTS = HOURS_DAYS.flatMap((date) =>
  GUARDS.flatMap((g) => {
    const roster = rosterFor(date, g.id)
    if (!roster) return []
    return [
      {
        id: `${date}-${g.id}`,
        guard_id: g.id,
        starts_at: iso(date, roster.start[0], roster.start[1]),
        ends_at: iso(date, roster.end[0], roster.end[1]),
      },
    ]
  }),
)

const INCIDENT_REPORTS = [
  {
    id: 'ir-1',
    created_at: iso(SCAN_DAY, 19, 26),
    description:
      'Loading dock roll-up door found unsecured on round 3 — latch had not engaged and the door was sitting about four inches open. Swept the dock and the adjacent corridor, nothing disturbed and no persons on site. Closed and confirmed the latch, then re-scanned the dock checkpoint. Recommend building maintenance look at the strike plate; this is the second time this month it has not caught.',
    guard_lat: 43.66287,
    guard_lng: -79.41031,
    attachments: [],
    guard: { name: 'Divjit Singh' },
  },
  {
    id: 'ir-2',
    created_at: iso('2026-07-24', 11, 41),
    description:
      'Water pooling under the sprinkler riser in Parking Level B, roughly two metres across and spreading slowly toward the drain. No sign of active spray. Coned the area, photographed it, and left a note at the lobby desk for the next shift. Building super notified by phone at 11:44 AM.',
    guard_lat: 43.66281,
    guard_lng: -79.41042,
    attachments: [],
    guard: { name: 'Sukhi Kaur' },
  },
  {
    id: 'ir-3',
    created_at: iso('2026-07-21', 19, 8),
    description:
      'Individual sleeping in the east stairwell between levels 3 and 4. Woke him, no confrontation, walked him out through the main entrance at 7:14 PM. Not a tenant and no property taken. Advised him the building is private. Checked the stairwell door on level 3 — the closer is slow and the latch does not catch if it is pushed gently.',
    guard_lat: 43.66294,
    guard_lng: -79.41018,
    attachments: [],
    guard: { name: 'Divjit Singh' },
  },
  {
    id: 'ir-4',
    created_at: iso('2026-07-17', 14, 52),
    description:
      'Fire panel in the Ground Floor electrical room showing a trouble light on zone 6 (Penthouse mechanical). No alarm, no smoke, and the mechanical room checked clear on round 2. Logged the panel reading and left it in trouble rather than silencing it. Fire-alarm contractor should see this before the weekend.',
    guard_lat: 43.66285,
    guard_lng: -79.41027,
    attachments: [],
    guard: { name: 'Sukhi Kaur' },
  },
  {
    id: 'ir-5',
    created_at: iso('2026-07-15', 20, 33),
    description:
      'Two vehicles parked in the visitor bays on Parking Level B without permits, plates recorded. Neither moved across rounds 2, 3 and 4. Left notices on both windshields. Property manager may want to escalate to towing if they are still there in the morning.',
    guard_lat: 43.66279,
    guard_lng: -79.41044,
    attachments: [],
    guard: { name: 'Divjit Singh' },
  },
  {
    id: 'ir-6',
    created_at: iso('2026-07-14', 9, 12),
    description:
      'Graffiti on the west face of the loading dock, roughly one metre by half a metre, spray paint. Not present at end of the previous shift, so it happened overnight. Photographed and reported; no other damage found on the perimeter walk.',
    guard_lat: 43.66276,
    guard_lng: -79.41051,
    attachments: [],
    guard: { name: 'Sukhi Kaur' },
  },
]

export default function ReportsPreview() {
  const [params] = useSearchParams()
  const view = params.get('view') || 'scans'

  if (view === 'incident') {
    return <ClientIncidents demo={{ site: SITE, reports: INCIDENT_REPORTS }} />
  }

  return (
    <ClientReports
      demo={{
        site: SITE,
        tab: view === 'hours' ? 'hours' : 'scans',
        scanFrom: SCAN_DAY,
        scanTo: SCAN_DAY,
        hoursFrom: HOURS_FROM,
        hoursTo: HOURS_TO,
        scans: DAY_SCANS,
        checkpoints: CHECKPOINTS,
        guards: GUARDS,
        hoursScans: HOURS_SCANS,
        publishedShifts: PUBLISHED_SHIFTS,
      }}
    />
  )
}
