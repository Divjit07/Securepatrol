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
              {stats.scannedCount} of {stats.totalCheckpoints} checkpoints · {stats.patrolScanCount} total scans
            </p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-sm text-green-800">Checkpoints scanned</p>
            <p className="text-2xl font-bold text-green-700">
              {stats.scannedCount}
              <span className="text-lg font-normal text-green-600"> / {stats.totalCheckpoints}</span>
            </p>
            <p className="mt-1 text-xs text-green-700/80">Unique checkpoints passed this shift</p>
          </div>
        </div>
      )}
    </>
  )
}
