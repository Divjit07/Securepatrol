import { useState } from 'react'
import { Plus, AlertTriangle, Check, Inbox } from 'lucide-react'
import {
  sameDay,
  shiftHours,
  formatTimeRangeCompact,
  CONFLICT_LABELS,
} from '../../lib/schedule.js'
import { SHIFT_CHIP_STYLES } from '../../lib/brandPalette.js'

const COLOR_STYLES = SHIFT_CHIP_STYLES

function conflictTitle(types) {
  return [...types].map((t) => CONFLICT_LABELS[t] || t).join(' · ')
}

export function ShiftChip({ shift, conflicts, onClick, draggable = true }) {
  const types = conflicts?.get(shift.id)
  const isDraft = shift.status === 'draft'
  const isOpen = !shift.guard_id

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/shift-id', shift.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(shift)
      }}
      title={types ? conflictTitle(types) : shift.notes || undefined}
      className={`group/chip block w-full cursor-grab rounded-xl px-2.5 py-2 text-left transition active:cursor-grabbing ${
        COLOR_STYLES[shift.color] || COLOR_STYLES.blue
      } ${types ? 'ring-2 ring-accent-red' : ''}`}
    >
      <span className="flex items-center gap-1">
        <span className="truncate text-[11px] font-bold">
          {formatTimeRangeCompact(shift)}
        </span>
        {types && <AlertTriangle className="h-3 w-3 shrink-0 text-accent-red" />}
      </span>
      <span className="mt-0.5 flex items-center gap-1 text-[10px] opacity-70">
        {shiftHours(shift).toFixed(1).replace(/\.0$/, '')}h
        {isOpen && (
          <span className="rounded-full bg-black/10 px-1.5 font-bold uppercase tracking-wide">
            Open
          </span>
        )}
        {isDraft ? (
          <span className="flex items-center gap-1 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-700" /> Draft
          </span>
        ) : shift.acknowledged_at ? (
          <Check className="h-3 w-3 text-emerald-800" />
        ) : null}
      </span>
    </button>
  )
}

function DayCell({ date, guardId, shifts, conflicts, isToday, onCellClick, onShiftClick, onShiftDrop }) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      role="gridcell"
      onClick={() => onCellClick?.(guardId, date)}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const shiftId = e.dataTransfer.getData('text/shift-id')
        if (shiftId) onShiftDrop?.(shiftId, guardId, date)
      }}
      className={`group min-h-[104px] cursor-pointer space-y-1.5 border-b border-l border-ink/10 p-1.5 transition ${
        isToday ? 'bg-accent-cyan/5' : ''
      } ${shifts.length === 0 ? 'hatch-empty' : ''} ${dragOver ? 'bg-accent-cyan/10 ring-2 ring-inset ring-accent-cyan-line/60' : 'hover:bg-ink/5'}`}
    >
      {shifts.map((s) => (
        <ShiftChip key={s.id} shift={s} conflicts={conflicts} onClick={onShiftClick} />
      ))}
      {/* Clicking an empty cell is how a shift gets created, so the affordance
          has to be visible at rest — a hover-only "+" makes the whole grid read
          as a static report. */}
      {shifts.length === 0 && (
        <span className="pointer-events-none flex h-full min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl text-ink-3 opacity-45 transition group-hover:bg-ink/5 group-hover:opacity-100">
          <Plus className="h-4 w-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Add shift</span>
        </span>
      )}
    </div>
  )
}

/**
 * Week grid: guards as rows, days as columns, "Open shifts" lane on top.
 * Pure presentational — all data and mutation handlers come from props.
 */
export default function RosterGrid({
  days,
  rows,
  openShifts,
  conflicts,
  showSite = false,
  onCellClick,
  onShiftClick,
  onShiftDrop,
}) {
  const today = new Date()
  // The whole week must be reachable without horizontal scrolling. On a 1408px
  // window the content area is ~1060px after the rail and page padding, so the
  // week is budgeted to 144 + 7×128 = 1040. Biweekly (14 days) still scrolls,
  // by necessity.
  const gridTemplate = { gridTemplateColumns: `144px repeat(${days.length}, minmax(128px, 1fr))` }

  const headBase =
    'sticky top-0 z-10 border-b border-ink/10 bg-surface/95 px-2 py-2.5 backdrop-blur'
  const rowLabelBase =
    'sticky left-0 z-[5] flex flex-col justify-center border-b border-ink/10 bg-surface px-3 py-2'

  return (
    <div className="sp-card overflow-hidden">
      <div className="overflow-x-auto">
        <div role="grid" className="grid min-w-fit" style={gridTemplate}>
          {/* Header row */}
          <div className={`${headBase} sticky left-0 z-20`} />
          {days.map((d) => {
            const isToday = sameDay(d, today)
            return (
              <div key={d.toISOString()} className={`${headBase} border-l border-ink/10 text-center`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? 'text-accent-orange' : 'text-ink-3'}`}>
                  {d.toLocaleDateString([], { weekday: 'short' })}
                </p>
                <p className={`text-sm font-bold ${isToday ? 'text-accent-orange' : 'text-ink'}`}>
                  {d.getDate()}
                </p>
              </div>
            )
          })}

          {/* Open shifts lane */}
          <div className={`${rowLabelBase} bg-accent-orange/10`}>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-orange">
              <Inbox className="h-3.5 w-3.5" /> Open shifts
            </span>
            <span className="text-[10px] text-accent-orange/70">
              {openShifts.length ? `${openShifts.length} unassigned` : 'None'}
            </span>
          </div>
          {days.map((d) => (
            <DayCell
              key={`open-${d.toISOString()}`}
              date={d}
              guardId={null}
              shifts={openShifts.filter((s) => sameDay(new Date(s.starts_at), d))}
              conflicts={conflicts}
              isToday={sameDay(d, today)}
              onCellClick={onCellClick}
              onShiftClick={onShiftClick}
              onShiftDrop={onShiftDrop}
            />
          ))}

          {/* Guard rows */}
          {rows.map(({ guard, shifts, hours }) => (
            <div key={guard.id} className="contents">
              <div className={rowLabelBase}>
                <span className="truncate text-sm font-semibold text-ink">{guard.name}</span>
                {showSite && guard.site_name && (
                  <span className="truncate text-[10px] font-medium text-ink-2">{guard.site_name}</span>
                )}
                <span className="text-[11px] text-ink-3">
                  {hours.toFixed(1).replace(/\.0$/, '')}h scheduled
                </span>
              </div>
              {days.map((d) => (
                <DayCell
                  key={`${guard.id}-${d.toISOString()}`}
                  date={d}
                  guardId={guard.id}
                  shifts={shifts.filter((s) => sameDay(new Date(s.starts_at), d))}
                  conflicts={conflicts}
                  isToday={sameDay(d, today)}
                  onCellClick={onCellClick}
                  onShiftClick={onShiftClick}
                  onShiftDrop={onShiftDrop}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {rows.length === 0 && (
        <div className="px-6 py-12 text-center text-sm text-ink-3">
          No guards assigned{showSite ? ' yet' : ' to this site yet'} — add guards first, then schedule them here.
        </div>
      )}
    </div>
  )
}
