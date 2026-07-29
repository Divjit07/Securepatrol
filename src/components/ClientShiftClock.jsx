import { LogIn, LogOut, Timer, MapPin } from 'lucide-react'
import { formatShiftTime } from '../lib/clientStats.js'
import { KPI_TONES } from '../lib/brandPalette.js'

const initials = (name) =>
  (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

/** Colourful in/out time cell (bento-gradient face). */
function TimeCell({ icon: Icon, tone, label, time, sub }) {
  return (
    <div className={`relative flex-1 overflow-hidden rounded-2xl p-4 shadow-[var(--card-shine)] ${tone.bg}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-4 w-4 ${tone.icon}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${tone.sub}`}>{label}</span>
      </div>
      <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${tone.ink}`}>{time}</p>
      {sub && <p className={`mt-0.5 truncate text-[11px] font-medium ${tone.sub}`}>{sub}</p>}
    </div>
  )
}

export default function ClientShiftClock({ guardShifts, scheduled, loading }) {
  if (scheduled?.isClosed) return null

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="dk-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Shift clock</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Clock-in via GPS geofence · NFC fallback · Shift ends {scheduled?.endLabel || '8:00 PM'}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-cyan/15 px-2.5 py-1 text-[11px] font-semibold text-accent-cyan-line">
          <MapPin className="h-3 w-3" /> GPS / NFC
        </span>
      </div>

      {guardShifts.length === 0 ? (
        <div className="hatch-empty flex items-center justify-center rounded-2xl border border-[color:var(--hairline)] py-12 text-center">
          <p className="px-6 text-sm text-ink-3">No guard has clocked in for this date yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {guardShifts.map((row) => (
            <div
              key={row.guardId}
              className="rounded-[24px] border border-[color:var(--hairline)] bg-[var(--fill-subtle)] p-4 transition-all duration-300 hover:border-[color:var(--hairline-strong)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ECFAB5] to-[#96EE60] text-sm font-bold text-[#12290d] shadow-[0_6px_16px_-6px_rgba(150,238,96,0.6)]">
                    {initials(row.guardName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">{row.guardName}</p>
                    <p className="truncate text-xs text-ink-3">
                      {row.statutoryHolidayLabel
                        ? row.statutoryHolidayLabel
                        : row.arrivedEarly
                          ? 'Arrived early'
                          : row.clockInCheckpoint || 'Clocked in on site'}
                    </p>
                  </div>
                </div>
                {row.onShift ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-green/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-green">
                    <span className="live-dot" /> On shift
                  </span>
                ) : row.hoursLabel ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-cyan/15 px-3 py-1 text-[11px] font-bold text-accent-cyan-line">
                    <Timer className="h-3 w-3" /> {row.hoursLabel}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex items-stretch gap-2.5">
                <TimeCell
                  icon={LogIn}
                  tone={KPI_TONES.lime}
                  label={row.isStatutoryHoliday ? 'Clock in' : 'Clocked in'}
                  time={formatShiftTime(row.clockInAt)}
                  sub={!row.isStatutoryHoliday && row.clockInCheckpoint ? row.clockInCheckpoint : 'GPS geofence'}
                />
                <div className="flex items-center">
                  <span className="h-px w-4 bg-[color:var(--hairline-strong)]" />
                </div>
                <TimeCell
                  icon={LogOut}
                  tone={KPI_TONES.sky}
                  label={row.isStatutoryHoliday ? 'Clock out' : 'Shift ends'}
                  time={formatShiftTime(row.clockOutAt)}
                  sub={row.onShift ? 'scheduled' : 'signed out'}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
