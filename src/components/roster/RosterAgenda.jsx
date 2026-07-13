import { CalendarDays, Check } from 'lucide-react'
import { formatDayLabel, formatTimeRange, shiftHours, sameDay } from '../../lib/schedule.js'

function groupShiftsByDay(days, shifts) {
  return days.map((date) => {
    const list = shifts
      .filter((s) => sameDay(new Date(s.starts_at), date))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    return { date, list }
  })
}

function StatusBadge({ shift }) {
  if (shift.status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8A33D]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#E8A33D]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#E8A33D]" /> Draft
      </span>
    )
  }
  if (shift.acknowledged_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-green">
        <Check className="h-3 w-3" /> Confirmed
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-2">
      Published
    </span>
  )
}

/** Day-by-day list of scheduled shifts for the current roster range. */
export default function RosterAgenda({ days, shifts, showSite = false, onShiftClick }) {
  const groups = groupShiftsByDay(days, shifts)
  const total = shifts.length

  if (!days.length) {
    return (
      <div className="sp-card flex flex-col items-center gap-2 px-6 py-16 text-center">
        <CalendarDays className="h-8 w-8 text-ink-3" />
        <p className="text-sm font-medium text-ink">No upcoming days in this range</p>
      </div>
    )
  }

  if (!total) {
    return (
      <div className="sp-card flex flex-col items-center gap-2 px-6 py-16 text-center">
        <CalendarDays className="h-8 w-8 text-ink-3" />
        <p className="text-sm font-medium text-ink">No shifts scheduled</p>
        <p className="max-w-sm text-sm text-ink-3">
          Switch to Grid and click an empty cell to create a shift, or pick another site / week.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="px-1 text-xs text-ink-3">
        {total} shift{total === 1 ? '' : 's'} across {groups.filter((g) => g.list.length).length} day
        {groups.filter((g) => g.list.length).length === 1 ? '' : 's'} · click a row to edit
      </p>
      {groups.map(({ date, list }) => (
        <section key={date.toISOString()} className="sp-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2.5 sm:px-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
              {formatDayLabel(date)}
            </h2>
            <span className="text-[11px] font-medium text-ink-3">
              {list.length
                ? `${list.length} shift${list.length === 1 ? '' : 's'}`
                : 'Nothing scheduled'}
            </span>
          </div>
          {list.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-3">No shifts this day.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {list.map((shift) => {
                const hours = shiftHours(shift)
                const hoursLabel = `${hours.toFixed(1).replace(/\.0$/, '')}h`
                const guardName = shift.profiles?.name || (shift.guard_id ? 'Guard' : 'Open shift')
                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => onShiftClick?.(shift)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5 sm:gap-4 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{guardName}</p>
                        <StatusBadge shift={shift} />
                      </div>
                      <p className="mt-0.5 text-sm text-ink-2">
                        {formatTimeRange(shift)}
                        <span className="text-ink-3"> · {hoursLabel}</span>
                        {showSite && shift.sites?.name ? (
                          <span className="text-ink-3"> · {shift.sites.name}</span>
                        ) : null}
                      </p>
                      {shift.notes ? (
                        <p className="mt-0.5 truncate text-xs text-ink-3">{shift.notes}</p>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
