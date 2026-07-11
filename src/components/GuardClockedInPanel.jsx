import { formatShiftTime } from '../lib/clientStats.js'
import { formatTimeLabel } from '../hooks/useClientShift.js'

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

function formatShiftRangeLine(dateStr, startTime, endTime) {
  const start = new Date(`${dateStr}T${startTime}:00`)
  const end = new Date(`${dateStr}T${endTime}:00`)
  const fmt = (d) => {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
    const month = d.toLocaleDateString('en-US', { month: 'short' })
    const day = ordinalDay(d.getDate())
    const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '')
    return `${weekday} ${month} ${day} ${time}`
  }
  return `Shift Time - ${fmt(start)} - ${fmt(end)}`
}

/** Guard dashboard: clocked-in identity card + lime shift status (reference layout). */
export default function GuardClockedInPanel({
  profile,
  siteName,
  scheduled,
  guardShift,
  publishedShift,
  loading,
}) {
  if (scheduled?.isClosed) return null

  if (loading) {
    return (
      <div className="guard-clock-in-card mb-4 animate-pulse rounded-2xl p-5">
        <div className="h-16 rounded-lg bg-white/10" />
      </div>
    )
  }

  const name = profile?.name || 'Guard'
  const roleLine = `Guarding Security - BYOD`
  const clockedIn = Boolean(guardShift)
  // Admin shift-clock edits win over the raw punch time for display.
  const signedInAt = guardShift?.isAdjusted
    ? guardShift?.clockInAt
    : guardShift?.signedInAt || guardShift?.clockInAt
  const shiftTimeLine = publishedShift
    ? formatShiftRangeFromIso(publishedShift.starts_at, publishedShift.ends_at)
    : formatShiftRangeLine(
        guardShift?.date || new Date().toISOString().slice(0, 10),
        scheduled?.start || '11:00',
        scheduled?.end || '20:00',
      )
  const siteLine = shiftSiteLine(siteName, publishedShift, guardShift)

  return (
    <div className="mb-6 space-y-3">
      <div className="guard-clock-in-card flex items-center gap-4 rounded-2xl p-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold text-white">{name}</p>
          <p className="mt-1 text-sm text-[#B0BEC5]">{roleLine}</p>
          {clockedIn && signedInAt ? (
            <p className="mt-2 text-sm text-[#B0BEC5]">{formatClockInStamp(signedInAt)}</p>
          ) : (
            <p className="mt-2 text-sm text-[#B0BEC5]">
              Not clocked in yet — use Face ID clock-in below.
            </p>
          )}
        </div>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/20 bg-[#2d3840] text-xl font-bold text-white">
          {initialsOf(name)}
        </div>
      </div>

      {clockedIn && (
        <div className="guard-shift-status-card flex flex-wrap items-center gap-4 rounded-2xl p-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-wide text-white">Shift Status</p>
            <p className="mt-2 text-sm text-white/95">{shiftTimeLine}</p>
            <p className="mt-1 text-sm font-medium text-white">{siteLine}</p>
            {guardShift.onShift && (
              <p className="mt-2 text-xs uppercase tracking-wide text-white/80">
                On shift · ends {formatShiftTime(guardShift.clockOutAt)}
              </p>
            )}
          </div>
          {guardShift.onShift && (
            <a
              href="#face-clock"
              className="guard-clock-out-btn shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Clock Out
            </a>
          )}
        </div>
      )}

      {!clockedIn && scheduled && (
        <div className="guard-shift-status-card rounded-2xl p-5">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Shift Status</p>
          <p className="mt-2 text-sm text-white/95">
            {publishedShift
              ? formatShiftRangeFromIso(publishedShift.starts_at, publishedShift.ends_at)
              : scheduled.scheduleLabel || `${formatTimeLabel(scheduled.start)} – ${formatTimeLabel(scheduled.end)}`}
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            {shiftSiteLine(siteName, publishedShift, null)}
          </p>
        </div>
      )}
    </div>
  )
}
