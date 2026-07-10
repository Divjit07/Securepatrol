// Dev-only visual harness for the Roster UI (route: /dev/roster, DEV builds
// only). Renders the grid and sheet with mock data — no auth or DB needed.
import { useMemo, useState } from 'react'
import RosterGrid from '../../components/roster/RosterGrid.jsx'
import ShiftSheet from '../../components/roster/ShiftSheet.jsx'
import { startOfWeek, addDays, detectConflicts, shiftHours } from '../../lib/schedule.js'

const GUARDS = [
  { id: 'g1', name: 'Harpreet Singh' },
  { id: 'g2', name: 'Maria Lopez' },
  { id: 'g3', name: 'Devon Clarke' },
  { id: 'g4', name: 'Rose Nguyen' },
]

function mk(id, guardId, dayOffset, startHour, endHour, extra = {}) {
  const weekStart = startOfWeek(new Date())
  const starts = addDays(weekStart, dayOffset)
  starts.setHours(startHour, 0, 0, 0)
  const ends = addDays(weekStart, dayOffset + (endHour <= startHour ? 1 : 0))
  ends.setHours(endHour, 0, 0, 0)
  return {
    id,
    site_id: 'site1',
    guard_id: guardId,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    break_minutes: 30,
    status: 'published',
    color: 'blue',
    notes: null,
    sites: { id: 'site1', name: 'Riverside Plaza' },
    ...extra,
  }
}

const INITIAL_SHIFTS = [
  mk('s1', 'g1', 0, 9, 17),
  mk('s2', 'g1', 1, 9, 17),
  mk('s3', 'g1', 2, 9, 17, { acknowledged_at: '2026-01-01' }),
  mk('s4', 'g2', 0, 16, 0, { color: 'violet' }),
  mk('s5', 'g2', 1, 16, 0, { color: 'violet', status: 'draft' }),
  mk('s6', 'g2', 2, 14, 22, { color: 'violet', status: 'draft' }),
  // Conflict demo: Devon double-booked Thursday + short rest Friday
  mk('s7', 'g3', 3, 8, 16, { color: 'teal' }),
  mk('s8', 'g3', 3, 12, 20, { color: 'teal' }),
  mk('s9', 'g3', 4, 0, 8, { color: 'teal' }),
  mk('s10', 'g4', 5, 9, 17, { color: 'rose', status: 'draft' }),
  mk('s11', 'g4', 6, 9, 17, { color: 'rose', status: 'draft', acknowledged_at: null }),
  // Open shifts
  mk('s12', null, 2, 0, 8, { color: 'amber' }),
  mk('s13', null, 5, 16, 0, { color: 'amber', status: 'draft' }),
]

export default function RosterPreview() {
  const [shifts, setShifts] = useState(INITIAL_SHIFTS)
  const [sheet, setSheet] = useState(null)
  const weekStart = startOfWeek(new Date())
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [])

  const conflicts = useMemo(() => detectConflicts(shifts), [shifts])
  const openShifts = shifts.filter((s) => !s.guard_id)
  const rows = GUARDS.map((guard) => {
    const guardShifts = shifts.filter((s) => s.guard_id === guard.id)
    return { guard, shifts: guardShifts, hours: guardShifts.reduce((sum, s) => sum + shiftHours(s), 0) }
  })

  const handleDrop = (shiftId, guardId, date) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== shiftId) return s
        const starts = new Date(s.starts_at)
        const duration = new Date(s.ends_at) - starts
        const newStarts = new Date(date)
        newStarts.setHours(starts.getHours(), starts.getMinutes(), 0, 0)
        return {
          ...s,
          guard_id: guardId,
          starts_at: newStarts.toISOString(),
          ends_at: new Date(newStarts.getTime() + duration).toISOString(),
        }
      }),
    )
  }

  return (
    <div className="min-h-dvh bg-canvas p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-1 text-2xl font-bold">Roster — dev preview</h1>
        <p className="mb-6 text-sm text-ink-2">
          Mock data harness. Drag chips between cells, click a chip to edit, click an empty cell to create.
        </p>
        <RosterGrid
          days={days}
          rows={rows}
          openShifts={openShifts}
          conflicts={conflicts}
          onCellClick={(guardId, date) => {
            const seed = new Date(date)
            seed.setHours(9, 0, 0, 0)
            setSheet({ guard_id: guardId, starts_at: seed.toISOString() })
          }}
          onShiftClick={(shift) => setSheet(shift)}
          onShiftDrop={handleDrop}
        />
        {sheet && (
          <ShiftSheet
            initial={sheet}
            guards={GUARDS}
            templates={[
              { id: 't1', name: 'Day 9–5', start_minutes: 540, duration_minutes: 480, break_minutes: 30, color: 'blue' },
              { id: 't2', name: 'Night 12–8', start_minutes: 0, duration_minutes: 480, break_minutes: 30, color: 'teal' },
            ]}
            onSave={async (values) => {
              if (sheet.id) {
                setShifts((prev) => prev.map((s) => (s.id === sheet.id ? { ...s, ...values } : s)))
              } else {
                setShifts((prev) => [
                  ...prev,
                  { ...mk(`s${Date.now()}`, null, 0, 9, 17), ...values, status: 'draft', sites: { id: 'site1', name: 'Riverside Plaza' } },
                ])
              }
            }}
            onDelete={async (shift) => setShifts((prev) => prev.filter((s) => s.id !== shift.id))}
            onClose={() => setSheet(null)}
          />
        )}
      </div>
    </div>
  )
}
