// Intent catalogue for the ops assistant. Each intent declares example phrasings
// (for the matcher), which entities it needs, a default date range, the query it
// runs, and a template that turns the result into plain English. No LLM: the
// template only formats numbers the database already computed.
import {
  getOnShiftNow, listSites, getHours, getClockEvents, getSchedule, getPatrolActivity,
} from './data.js'
import { fmtTime, fmtDate, fmtDateTime, fmtHoursMinutes } from './dates.js'

const intents = [
  {
    id: 'on_shift_now',
    examples: [
      'who is on shift', 'who is working now', 'who is clocked in', 'who is on duty',
      'anyone on shift', 'guards on shift', 'who is currently working',
      'who is on shift right now and when did they clock in', 'is anyone working',
      'who is on duty now',
    ],
    keywords: ['onshift'],
    needs: [],
    async run() { return getOnShiftNow() },
    render(r) {
      const lines = []
      if (!r.on_shift.length) {
        lines.push('No one is clocked in right now.')
      } else {
        lines.push(`On shift right now (${r.on_shift.length}):`)
        for (const g of r.on_shift) {
          lines.push(`• ${g.guard}${g.site ? ` — ${g.site}` : ''} · clocked in ${fmtTime(g.clocked_in_at)}`)
        }
      }
      if (r.recently_clocked_out.length) {
        lines.push('')
        lines.push('Recently clocked out:')
        for (const g of r.recently_clocked_out.slice(0, 6)) {
          lines.push(`• ${g.guard}${g.site ? ` — ${g.site}` : ''} · out ${fmtTime(g.clocked_out_at)}${g.note ? ` (note: ${g.note})` : ''}`)
        }
      }
      return lines.join('\n')
    },
  },

  {
    id: 'guard_hours',
    examples: [
      'how many hours did guard work', 'hours for guard this week', 'time worked by guard',
      'guard hours this week', 'total hours guard', 'how much did guard work',
    ],
    keywords: ['hours'],
    needs: ['guard'],
    defaultRange: 'this week',
    async run({ guard, range }) { return getHours(guard.id, range.start, range.end) },
    render(r, { guard, range }) {
      if (!r.sessions.length) return `${guard.name} has no clock punches ${range.label}.`
      const lines = [`${guard.name} — ${fmtHoursMinutes(r.total_minutes)} ${range.label} (${r.sessions.length} session${r.sessions.length === 1 ? '' : 's'}):`]
      for (const s of r.sessions) {
        lines.push(
          s.clock_out
            ? `• ${fmtDate(s.clock_in)}: ${fmtTime(s.clock_in)} → ${fmtTime(s.clock_out)} (${fmtHoursMinutes(s.minutes)})`
            : `• ${fmtDate(s.clock_in)}: ${fmtTime(s.clock_in)} → still on the clock`,
        )
      }
      if (r.open) lines.push('An open session isn’t counted in the total until clock-out.')
      return lines.join('\n')
    },
  },

  {
    id: 'clock_events',
    examples: [
      'clock events for guard', 'when did guard clock in', 'guard clock in and out times',
      'clock punches for guard today', 'what time did guard clock in', 'guard punches',
      'last 10 clock outs for guard', 'last clock ins for guard', 'give me clock outs for guard',
      'recent punches for guard', 'guard last clock out', 'last 10 punches for guard',
    ],
    keywords: ['clock'],
    needs: ['guard'],
    defaultRange: 'last 7 days',
    async run({ guard, range }) { return getClockEvents(guard.id, range.start, range.end) },
    render(r, { guard, range }) {
      if (!r.length) return `${guard.name} has no clock punches ${range.label}.`
      const lines = [`${guard.name} — clock punches (${range.label}):`]
      for (const e of r.slice(0, 12)) {
        lines.push(`• ${e.type === 'clock_in' ? 'Clock in ' : 'Clock out'} · ${fmtDateTime(e.at)}${e.by_admin ? ' (by admin)' : ''}${e.note ? ` — ${e.note}` : ''}`)
      }
      if (r.length > 12) lines.push(`…and ${r.length - 12} more.`)
      return lines.join('\n')
    },
  },

  {
    id: 'schedule',
    examples: [
      'what is on the schedule this week', 'schedule for this week', 'who is scheduled',
      'shifts this week', 'roster for this week', 'upcoming shifts', 'schedule for guard',
      'when does guard shift end', 'what time does guard finish', 'when does guard shift start',
      'when is guard next shift', 'when does guard finish today',
    ],
    keywords: ['schedule', 'shift', 'end'],
    needs: [],
    optional: ['guard', 'site'],
    defaultRange: 'this week',
    async run({ range, guard, site }) {
      return getSchedule({ startISO: range.start, endISO: range.end, guardId: guard?.id, siteId: site?.id })
    },
    render(r, { range, guard, site }) {
      const scope = guard ? ` for ${guard.name}` : site ? ` at ${site.name}` : ''
      if (!r.length) return `No published shifts${scope} ${range.label}.`
      const lines = [`Published shifts${scope} ${range.label} (${r.length}):`]
      for (const s of r.slice(0, 40)) {
        lines.push(`• ${fmtDate(s.starts_at)} ${fmtTime(s.starts_at)}–${fmtTime(s.ends_at)}${s.guard ? ` · ${s.guard}` : ' · unassigned'}${s.site ? ` · ${s.site}` : ''}`)
      }
      if (r.length > 40) lines.push(`…and ${r.length - 40} more.`)
      return lines.join('\n')
    },
  },

  {
    id: 'patrol_activity',
    examples: [
      'patrol activity at site', 'missed checkpoints at site', 'gps rejects at site',
      'checkpoint misses', 'how many patrols at site', 'checkpoint activity for site',
    ],
    keywords: ['patrol', 'checkpoint', 'missed', 'reject'],
    needs: ['site'],
    defaultRange: 'last 7 days',
    async run({ site, range }) { return getPatrolActivity(site.id, range.start, range.end) },
    render(r, { site, range }) {
      const lines = [`Patrol activity — ${site.name}, ${range.label}:`]
      const totalPass = r.checkpoints.reduce((n, c) => n + c.pass_scans, 0)
      lines.push(`• ${totalPass} passing checkpoint scan${totalPass === 1 ? '' : 's'} across ${r.checkpoints.length} checkpoint${r.checkpoints.length === 1 ? '' : 's'}.`)
      lines.push(`• ${r.gps_rejects} GPS-rejected scan${r.gps_rejects === 1 ? '' : 's'}.`)
      if (r.misses.length) {
        lines.push(`• ${r.misses.length} recorded miss${r.misses.length === 1 ? '' : 'es'}:`)
        for (const m of r.misses.slice(0, 10)) {
          lines.push(`   – ${m.guard} missed ${m.checkpoint} · ${fmtDateTime(m.at)}`)
        }
      } else {
        lines.push('• No recorded checkpoint misses.')
      }
      return lines.join('\n')
    },
  },

  {
    id: 'list_sites',
    examples: ['list my sites', 'what sites do i have', 'show my sites', 'my locations', 'which sites'],
    keywords: ['sites'],
    needs: [],
    async run() { return listSites() },
    render(r) {
      if (!r.length) return 'You don’t have any sites yet.'
      return [`Your sites (${r.length}):`, ...r.map((s) => `• ${s.name}`)].join('\n')
    },
  },
]

export default intents
