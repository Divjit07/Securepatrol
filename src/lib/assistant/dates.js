// Deterministic natural-language date-range parser for the ops assistant.
// Turns "yesterday", "this week", "last 7 days", "June", "last month" into an
// explicit { start, end, label } with ISO timestamps. No LLM — pure date math.
// The owner operates in America/Toronto; formatting uses that zone.

const TZ = 'America/Toronto'

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Monday-based week start.
function startOfWeek(d) {
  const x = startOfDay(d)
  const day = (x.getDay() + 6) % 7 // Mon=0 … Sun=6
  x.setDate(x.getDate() - day)
  return x
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/**
 * Parse a relative/absolute range out of free text.
 * Returns { start: ISO, end: ISO, label } or null when nothing matches.
 */
export function parseRange(text, now = new Date()) {
  const t = ` ${text.toLowerCase()} `
  const end = new Date(now)

  const range = (start, endAt, label) => ({
    start: start.toISOString(),
    end: endAt.toISOString(),
    label,
  })

  // "last 7 days" / "past 30 days" / "last 24 hours"
  const nDays = t.match(/\b(?:last|past)\s+(\d{1,3})\s+day/)
  if (nDays) {
    const n = Math.min(365, parseInt(nDays[1], 10))
    return range(new Date(now.getTime() - n * 86400000), end, `last ${n} days`)
  }
  const nHours = t.match(/\b(?:last|past)\s+(\d{1,3})\s+hour/)
  if (nHours) {
    const n = Math.min(168, parseInt(nHours[1], 10))
    return range(new Date(now.getTime() - n * 3600000), end, `last ${n} hours`)
  }

  if (/\btoday\b/.test(t)) return range(startOfDay(now), end, 'today')
  if (/\byesterday\b/.test(t)) {
    const s = startOfDay(now)
    s.setDate(s.getDate() - 1)
    return range(s, startOfDay(now), 'yesterday')
  }
  if (/\b(this week|so far this week)\b/.test(t)) return range(startOfWeek(now), end, 'this week')
  if (/\b(last week|past week|previous week)\b/.test(t)) {
    const thisWeek = startOfWeek(now)
    const s = new Date(thisWeek)
    s.setDate(s.getDate() - 7)
    return range(s, thisWeek, 'last week')
  }
  if (/\b(last 14|biweekly|two weeks|last two weeks|fortnight)\b/.test(t)) {
    return range(new Date(now.getTime() - 14 * 86400000), end, 'last 14 days')
  }
  if (/\bthis month\b/.test(t)) {
    return range(new Date(now.getFullYear(), now.getMonth(), 1), end, 'this month')
  }
  if (/\blast month\b/.test(t)) {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const e = new Date(now.getFullYear(), now.getMonth(), 1)
    return range(s, e, 'last month')
  }
  if (/\bthis year\b/.test(t)) {
    return range(new Date(now.getFullYear(), 0, 1), end, 'this year')
  }

  // A bare month name → that month in the current year (or last year if future).
  for (let i = 0; i < MONTHS.length; i += 1) {
    const re = new RegExp(`\\b${MONTHS[i]}\\b`)
    if (re.test(t)) {
      let year = now.getFullYear()
      if (i > now.getMonth()) year -= 1 // "June" in March → last June
      const s = new Date(year, i, 1)
      const e = new Date(year, i + 1, 1)
      return range(s, e, MONTHS[i][0].toUpperCase() + MONTHS[i].slice(1) + ` ${year}`)
    }
  }

  return null
}

export function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-CA', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit',
  })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-CA', {
    timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric',
  })
}

export function fmtHoursMinutes(totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
