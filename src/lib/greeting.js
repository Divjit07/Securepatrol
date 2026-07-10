/** Time-aware greeting + rotating motivation for the portal home screens. */

export function daypartOf(hour) {
  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

export const GREETING_WORDS = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Still up',
}

const MOTIVATION = {
  admin: {
    morning: [
      'A clear morning starts with a clear roster.',
      'Coverage first, coffee second.',
      'Good days on site start with a good plan.',
    ],
    afternoon: [
      'Steady rounds keep quiet days quiet.',
      'Halfway through — see how coverage is holding.',
      'Consistency is the best security system.',
    ],
    evening: [
      'Night shifts run smoother when someone watches the board.',
      'Clear the alerts, set tomorrow’s roster, rest easy.',
      'Quiet evenings are earned, not lucky.',
    ],
    night: [
      'While the city sleeps, your team doesn’t.',
      'The night watch is the real watch.',
    ],
  },
  guard: {
    morning: [
      'Every round you walk keeps someone safe.',
      'Fresh shift, fresh eyes. Walk it like the first time.',
    ],
    afternoon: [
      'Presence is the deterrent. Stay visible.',
      'A checkpoint scanned is a promise kept.',
    ],
    evening: [
      'Stay sharp out there — the quiet hours count double.',
      'Good guards notice what others walk past.',
    ],
    night: [
      'The building trusts you with its quietest hours.',
      'Stay warm, stay alert, stay in touch.',
    ],
  },
}

/** Picks a line by role + daypart, rotating daily so it changes over time. */
export function motivationFor(role, daypart) {
  const pool = MOTIVATION[role]?.[daypart] || MOTIVATION.admin.afternoon
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5,
  )
  return pool[dayOfYear % pool.length]
}
