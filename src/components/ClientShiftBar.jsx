import { Calendar, Clock } from 'lucide-react'

export default function ClientShiftBar({ date, setDate, shift, setShift, stats }) {
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
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500" />
          <label className="text-sm text-slate-600">Shift</label>
          <input
            type="time"
            value={shift.start}
            onChange={(e) => setShift({ start: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-slate-400">to</span>
          <input
            type="time"
            value={shift.end}
            onChange={(e) => setShift({ end: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Checkpoints scanned</p>
            <p className="text-2xl font-bold">
              {stats.scannedCount}{' '}
              <span className="text-base font-normal text-slate-400">/ {stats.total}</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Shift compliance</p>
            <p
              className={`text-2xl font-bold ${
                stats.compliance >= 80
                  ? 'text-green-600'
                  : stats.compliance >= 50
                    ? 'text-amber-600'
                    : 'text-red-600'
              }`}
            >
              {stats.compliance}%
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total scans this shift</p>
            <p className="text-2xl font-bold">{stats.scanCount}</p>
          </div>
        </div>
      )}
    </>
  )
}
