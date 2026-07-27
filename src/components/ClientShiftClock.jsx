import { LogIn, LogOut } from 'lucide-react'
import { formatShiftTime } from '../lib/clientStats.js'

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
    <div className="overflow-hidden rounded-xl border border-white/10 bg-surface shadow-sm">
      <div className="border-b border-white/5 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-ink">Shift clock</h2>
        <p className="mt-1 text-sm text-ink-2">
          Guard clock-in (GPS / NFC) · Shift ends {scheduled?.endLabel || '8:00 PM'}
        </p>
      </div>

      {guardShifts.length === 0 ? (
        <p className="p-8 text-center text-sm text-ink-2">
          No guard has clocked in for this date yet.
        </p>
      ) : (
        <div className="divide-y divide-white/5">
          {guardShifts.map((row) => (
            <div key={row.guardId} className="px-5 py-4">
              <p className="font-semibold text-ink">{row.guardName}</p>
              {row.statutoryHolidayLabel && (
                <p className="mt-1 text-xs font-medium text-accent-cyan-line">{row.statutoryHolidayLabel}</p>
              )}
              {row.arrivedEarly && (
                <p className="mt-1 text-xs font-medium text-accent-green">Arrived early</p>
              )}
              <div className="mt-2 space-y-1 text-sm text-ink-2">
                <p className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-accent-green" />
                  {row.isStatutoryHoliday ? 'Clock in' : 'Clocked in'} {formatShiftTime(row.clockInAt)}
                  {!row.isStatutoryHoliday && row.clockInCheckpoint ? ` · ${row.clockInCheckpoint}` : ''}
                </p>
                <p className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-accent-cyan-line" />
                  {row.isStatutoryHoliday ? 'Clock out' : 'Shift ends'} {formatShiftTime(row.clockOutAt)}
                </p>
                {row.hoursLabel && (
                  <p className="text-xs text-ink-2">{row.hoursLabel}</p>
                )}
                {row.onShift && (
                  <p className="pt-1 text-xs font-medium uppercase tracking-wide text-accent-cyan-line">On shift</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
