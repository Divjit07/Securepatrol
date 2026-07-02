import { Calendar, Clock } from 'lucide-react'

export default function ClientShiftBar({ date, setDate, scheduled, stats }) {
  return (
    <>
      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${scheduled?.isClosed ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}`}>
          <Clock className="h-4 w-4 shrink-0 opacity-70" />
          <span>{scheduled?.scheduleLabel || '11:00 AM – 8:00 PM'}</span>
        </div>
      </div>

      {scheduled?.isClosed && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The building is closed on Sundays. No patrol shift or hours are recorded for this date.
        </div>
      )}

      {stats && !scheduled?.isClosed && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Patrol rounds</p>
            <p className="text-2xl font-bold">{stats.rounds}</p>
            <p className="mt-1 text-xs text-slate-400">
              {stats.patrolScanCount} scans across {stats.patrolCheckpointCount} checkpoints
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total scans this shift</p>
            <p className="text-2xl font-bold">{stats.scanCount}</p>
          </div>
        </div>
      )}

      {stats?.guardShifts?.length > 0 && !scheduled?.isClosed && (
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-display text-sm font-semibold text-slate-800">Shift clock</h2>
            <p className="text-xs text-slate-500">
              Clock in: Main Entrance · Clock out: automatic at {scheduled?.endLabel || '8:00 PM'}
              {scheduled?.isSaturday ? ' (Saturday)' : ''}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.guardShifts.map((row) => (
              <div key={row.guardId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{row.guardName}</p>
                  <p className="text-xs text-slate-500">
                    In {row.clockIn?.toLocaleTimeString()} · Out {row.clockOut?.toLocaleTimeString()} (auto)
                  </p>
                </div>
                <p className={`text-lg font-bold ${row.clockOutPending ? 'text-brand-600' : 'text-brand-700'}`}>
                  {row.durationLabel}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
