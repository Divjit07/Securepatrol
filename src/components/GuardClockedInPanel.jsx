import { formatShiftTime } from '../lib/clientStats.js'

// Local initials avatar — the old ui-avatars.com call leaked guard names to a
// third party and blocked render on slow networks.
function initialsOf(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function ordinalDay(n) {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  const mod = n % 10
  if (mod === 1) return `${n}st`
  if (mod === 2) return `${n}nd`
  if (mod === 3) return `${n}rd`
  return `${n}th`
}

function formatClockInStamp(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `Clock in Time - ${y}-${m}-${day} ${time}`
}

function formatShiftRangeFromIso(startsAt, endsAt) {
  const fmt = (d) => {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
    const month = d.toLocaleDateString('en-US', { month: 'short' })
    const day = ordinalDay(d.getDate())
    const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '')
    return `${weekday} ${month} ${day} ${time}`
  }
  return `Shift Time - ${fmt(new Date(startsAt))} - ${fmt(new Date(endsAt))}`
}

function shiftSiteLine(siteName, publishedShift, guardShift) {
  const site = publishedShift?.sites?.name || siteName || 'Your site'
  const detail = publishedShift?.notes || guardShift?.clockInCheckpoint
  return detail ? `${site} : ${detail}` : site
}

/**
 * Guard dashboard: identity + shift status.
 * Grey while clocked out; lime green only after clock-in.
 * Shift times come from the published roster only.
 */
export default function GuardClockedInPanel({
  profile,
  siteName,
  guardShift,
  publishedShift,
  clockedIn: clockedInProp,
  loading,
}) {
  if (loading) {
    return (
      <div className="guard-clock-in-card mb-4 animate-pulse rounded-2xl p-5">
        <div className="h-16 rounded-lg bg-white/10" />
      </div>
    )
  }

  const name = profile?.name || 'Guard'
  const roleLine = `Guarding Security - BYOD`
  // Prefer the punch-based flag from the parent; fall back to punch-derived shift row.
  const clockedIn = clockedInProp ?? Boolean(guardShift)
  const signedInAt = guardShift?.isAdjusted
    ? guardShift?.clockInAt
    : guardShift?.signedInAt || guardShift?.clockInAt

  const shiftTimeLine = publishedShift
    ? formatShiftRangeFromIso(publishedShift.starts_at, publishedShift.ends_at)
    : clockedIn
      ? 'On duty · no published roster shift for today'
      : 'No shift scheduled today'
  const siteLine = shiftSiteLine(siteName, publishedShift, guardShift)

  // Grey off duty → green on duty (both identity + shift status cards).
  const cardClass = clockedIn ? 'guard-shift-status-card' : 'guard-clock-in-card'
  const titleClass = clockedIn ? 'text-white' : 'text-white'
  const bodyClass = clockedIn ? 'text-white/95' : 'text-[#B0BEC5]'
  const strongClass = clockedIn ? 'text-white' : 'text-white'

  return (
    <div className="mb-6 space-y-3">
      <div className={`${cardClass} flex items-center gap-4 rounded-2xl p-5`}>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-xl font-semibold ${strongClass}`}>{name}</p>
          <p className={`mt-1 text-sm ${bodyClass}`}>{roleLine}</p>
          {clockedIn && signedInAt ? (
            <p className={`mt-2 text-sm ${bodyClass}`}>{formatClockInStamp(signedInAt)}</p>
          ) : (
            <p className={`mt-2 text-sm ${bodyClass}`}>
              Not clocked in yet — use the shift clock below.
            </p>
          )}
        </div>
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-xl font-bold ${
            clockedIn
              ? 'border-white/40 bg-[#3e4e56] text-white'
              : 'border-white/20 bg-[#2d3840] text-white'
          }`}
        >
          {initialsOf(name)}
        </div>
      </div>

      <div
        className={`${cardClass} ${clockedIn ? '' : 'is-off-duty'} flex flex-wrap items-center gap-4 rounded-2xl p-5`}
      >
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold uppercase tracking-wide ${titleClass}`}>Shift Status</p>
          <p className={`mt-2 text-sm ${bodyClass}`}>{shiftTimeLine}</p>
          {publishedShift || clockedIn ? (
            <p className={`mt-1 text-sm font-medium ${strongClass}`}>{siteLine}</p>
          ) : (
            <p className={`mt-1 text-sm ${bodyClass}`}>
              Your admin publishes shifts on the roster — they’ll show up here and in Schedule.
            </p>
          )}
          {clockedIn && guardShift?.onShift && (
            <p className={`mt-2 text-xs uppercase tracking-wide ${bodyClass}`}>
              On shift · ends {formatShiftTime(guardShift.clockOutAt)}
            </p>
          )}
        </div>
        {clockedIn && guardShift?.onShift && (
          <a
            href="#face-clock"
            className="guard-clock-out-btn shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Clock Out
          </a>
        )}
      </div>
    </div>
  )
}
