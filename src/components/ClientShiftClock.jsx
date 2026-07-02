import { LogIn, LogOut } from 'lucide-react'
import { formatShiftTime } from '../lib/clientStats.js'

export default function ClientShiftClock({ guardShifts, scheduled, loading }) {
  if (scheduled?.isClosed) return null

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">Shift clock</h2>
        <p className="mt-1 text-sm text-slate-500">
          Guard sign-in at Main Entrance · Shift ends {scheduled?.endLabel || '8:00 PM'}
        </p>
      </div>

      {guardShifts.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">
          No guard has signed in at Main Entrance for this date yet.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {guardShifts.map((row) => (
            <div key={row.guardId} className="px-5 py-4">
              <p className="font-semibold text-slate-900">{row.guardName}</p>
              {row.statutoryHolidayLabel && (
                <p className="mt-1 text-xs font-medium text-brand-700">{row.statutoryHolidayLabel}</p>
              )}
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-green-600" />
                  {row.isStatutoryHoliday ? 'Clock in' : 'Signed in'} {formatShiftTime(row.clockInAt)}
                  {!row.isStatutoryHoliday && row.clockInCheckpoint ? ` · ${row.clockInCheckpoint}` : ''}
                </p>
                {!row.isStatutoryHoliday &&
                  row.signedInAt &&
                  row.signedInAt.getTime() !== row.clockInAt.getTime() && (
                    <p className="pl-6 text-xs text-slate-400">
                      Scanned at {formatShiftTime(row.signedInAt)}
                    </p>
                  )}
                <p className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-brand-600" />
                  {row.isStatutoryHoliday ? 'Clock out' : 'Shift ends'} {formatShiftTime(row.clockOutAt)}
                </p>
                {row.hoursLabel && (
                  <p className="text-xs text-slate-500">{row.hoursLabel}</p>
                )}
                {row.onShift && (
                  <p className="pt-1 text-xs font-medium uppercase tracking-wide text-brand-600">On shift</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
