// Runs every 10 minutes via pg_cron. Detects:
//  - late:         published shift started 10+ min ago, guard hasn't clocked in
//  - no_show:      same, 30+ min with still no clock-in
//  - stale_patrol: guard on an active shift hasn't scanned any checkpoint for
//                  longer than the site's patrol_interval_minutes
// New events are logged to alert_events (deduped) and emailed as one digest.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LATE_MINUTES = 10
const NO_SHOW_MINUTES = 30
const ALERTS_TO = Deno.env.get('ROSTER_ALERTS_TO') || Deno.env.get('INCIDENT_REPORT_TO') || 'admin@kronus.space'
const FROM_EMAIL = Deno.env.get('SCHEDULE_FROM') || Deno.env.get('INCIDENT_REPORT_FROM') || 'Kronus <onboarding@resend.dev>'

/**
 * Alert wording is editable from Athena (migration 050). Templates are loaded
 * once per run and rendered with tokens; when a row is missing — or the table
 * does not exist yet — the built-in string is used, so this function behaves
 * exactly as before against a database that has not been migrated.
 */
type Templates = Record<string, { subject: string | null; body: string }>

async function loadTemplates(db: ReturnType<typeof createClient>): Promise<Templates> {
  try {
    const { data, error } = await db.from('alert_templates').select('key, subject, body')
    if (error || !data) return {}
    return Object.fromEntries(data.map((r: any) => [r.key, { subject: r.subject, body: r.body }]))
  } catch {
    return {}
  }
}

function render(text: string, values: Record<string, string | number>) {
  return String(text).replace(/\{(\w+)\}/g, (m, token) =>
    values[token] != null ? String(values[token]) : m,
  )
}

/** Template body if present, else the caller's built-in fallback. */
function say(
  templates: Templates,
  key: string,
  fallback: string,
  values: Record<string, string | number>,
) {
  const tpl = templates[key]?.body
  return tpl ? render(tpl, values) : fallback
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const templates = await loadTemplates(db)
    const now = new Date()
    const nowMs = now.getTime()

    // Shifts that started (or run) within the detection window.
    const { data: shifts, error: shiftErr } = await db
      .from('shifts')
      .select('id, site_id, guard_id, starts_at, ends_at, profiles:guard_id(name)')
      .eq('status', 'published')
      .not('guard_id', 'is', null)
      .lte('starts_at', new Date(nowMs - LATE_MINUTES * 60000).toISOString())
      .gt('ends_at', now.toISOString())
      .gte('starts_at', new Date(nowMs - 24 * 3600000).toISOString())
    if (shiftErr) throw shiftErr
    if (!shifts?.length) {
      return new Response(JSON.stringify({ success: true, events: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const siteIds = [...new Set(shifts.map((s) => s.site_id))]

    const [{ data: sites }, { data: floors }] = await Promise.all([
      db.from('sites').select('id, name, patrol_interval_minutes').in('id', siteIds),
      db.from('floors').select('id, site_id').in('site_id', siteIds),
    ])
    const siteById = new Map((sites || []).map((s) => [s.id, s]))
    const floorSite = new Map((floors || []).map((f) => [f.id, f.site_id]))

    const { data: checkpoints } = await db
      .from('checkpoints')
      .select('id, floor_id, checkpoint_role')
      .in('floor_id', (floors || []).map((f) => f.id))

    const cpSite = new Map<string, string>()
    const clockInCps = new Set<string>()
    for (const cp of checkpoints || []) {
      const sid = floorSite.get(cp.floor_id)
      if (!sid) continue
      cpSite.set(cp.id, sid)
      if (cp.checkpoint_role === 'shift_clock_in') clockInCps.add(cp.id)
    }

    // All pass scans by these guards since the earliest shift start (minus 1h
    // grace for early clock-ins).
    const earliest = Math.min(...shifts.map((s) => new Date(s.starts_at).getTime()))
    const { data: scans } = await db
      .from('scans')
      .select('guard_id, checkpoint_id, scanned_at')
      .in('guard_id', [...new Set(shifts.map((s) => s.guard_id))])
      .eq('status', 'pass')
      .gte('scanned_at', new Date(earliest - 3600000).toISOString())
      .order('scanned_at', { ascending: true })

    // Existing events for dedup.
    const { data: priorEvents } = await db
      .from('alert_events')
      .select('shift_id, event_type, created_at')
      .in('shift_id', shifts.map((s) => s.id))

    const hasEvent = (shiftId: string, type: string) =>
      (priorEvents || []).some((e) => e.shift_id === shiftId && e.event_type === type)
    const latestEventAt = (shiftId: string, type: string) =>
      Math.max(
        0,
        ...(priorEvents || [])
          .filter((e) => e.shift_id === shiftId && e.event_type === type)
          .map((e) => new Date(e.created_at).getTime()),
      )

    type NewEvent = { site_id: string; shift_id: string; guard_id: string; event_type: string; message: string }
    const newEvents: NewEvent[] = []

    for (const shift of shifts) {
      const site = siteById.get(shift.site_id)
      const guardName = (shift.profiles as { name?: string } | null)?.name || 'Guard'
      const startMs = new Date(shift.starts_at).getTime()
      const startLabel = new Date(shift.starts_at).toLocaleString('en-CA', {
        timeZone: 'America/Toronto',
        weekday: 'short', hour: 'numeric', minute: '2-digit',
      })

      const guardScans = (scans || []).filter(
        (sc) => sc.guard_id === shift.guard_id && cpSite.get(sc.checkpoint_id) === shift.site_id,
      )
      const clockIn = guardScans.find(
        (sc) => clockInCps.has(sc.checkpoint_id) && new Date(sc.scanned_at).getTime() >= startMs - 3600000,
      )

      if (!clockIn) {
        const minutesLate = Math.floor((nowMs - startMs) / 60000)
        if (minutesLate >= NO_SHOW_MINUTES && !hasEvent(shift.id, 'no_show')) {
          newEvents.push({
            site_id: shift.site_id, shift_id: shift.id, guard_id: shift.guard_id!,
            event_type: 'no_show',
            message: say(templates, 'alert_no_show',
              `${guardName} has NOT clocked in — shift at ${site?.name} started ${startLabel} (${minutesLate} min ago).`,
              { guard: guardName, site: site?.name ?? '', time: startLabel, minutes: minutesLate }),
          })
        } else if (minutesLate >= LATE_MINUTES && minutesLate < NO_SHOW_MINUTES && !hasEvent(shift.id, 'late')) {
          newEvents.push({
            site_id: shift.site_id, shift_id: shift.id, guard_id: shift.guard_id!,
            event_type: 'late',
            message: say(templates, 'alert_late',
              `${guardName} is running late — shift at ${site?.name} started ${startLabel}, no clock-in yet.`,
              { guard: guardName, site: site?.name ?? '', time: startLabel }),
          })
        }
        continue
      }

      // Clocked in → stale patrol check.
      const interval = (site?.patrol_interval_minutes ?? 120) * 60000
      const shiftScans = guardScans.filter((sc) => new Date(sc.scanned_at).getTime() >= startMs - 3600000)
      const lastScanMs = Math.max(...shiftScans.map((sc) => new Date(sc.scanned_at).getTime()))
      const gapMs = nowMs - lastScanMs
      if (gapMs >= interval && latestEventAt(shift.id, 'stale_patrol') < lastScanMs + gapMs - interval) {
        // Only re-alert once per gap: the latest stale event must predate this gap.
        if (latestEventAt(shift.id, 'stale_patrol') <= lastScanMs) {
          newEvents.push({
            site_id: shift.site_id, shift_id: shift.id, guard_id: shift.guard_id!,
            event_type: 'stale_patrol',
            message: say(templates, 'alert_stale_patrol',
              `${guardName} at ${site?.name}: no checkpoint scan for ${Math.floor(gapMs / 60000)} minutes (site limit ${site?.patrol_interval_minutes ?? 120}).`,
              { guard: guardName, site: site?.name ?? '', minutes: Math.floor(gapMs / 60000), limit: site?.patrol_interval_minutes ?? 120 }),
          })
        }
      }
    }

    let emailed = false
    let emailError: string | null = null

    if (newEvents.length) {
      const { error: insErr } = await db.from('alert_events').insert(newEvents)
      if (insErr) throw insErr

      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        const items = newEvents
          .map((e) => `<li style="margin-bottom:8px"><strong style="color:${e.event_type === 'no_show' ? '#dc2626' : '#d97706'}">[${e.event_type.replace('_', ' ').toUpperCase()}]</strong> ${e.message}</li>`)
          .join('')
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: ALERTS_TO,
            subject: templates['alert_email']?.subject
              ? render(templates['alert_email'].subject!, {
                  count: `${newEvents.length} issue${newEvents.length > 1 ? 's' : ''}`,
                })
              : `Kronus alerts: ${newEvents.length} issue${newEvents.length > 1 ? 's' : ''} need attention`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:560px">
              <h2 style="color:#0a1628">Roster alerts</h2>
              <ul style="padding-left:18px">${items}</ul>
              <p style="color:#94a3b8;font-size:12px">${say(templates, 'alert_email', 'Kronus automated monitoring · every 10 minutes', { count: newEvents.length })}</p>
            </div>`,
          }),
        })
        emailed = res.ok
        if (!res.ok) emailError = `Resend ${res.status}`
      } else {
        emailError = 'RESEND_API_KEY not configured'
      }
    }

    return new Response(
      JSON.stringify({ success: true, events: newEvents.length, emailed, email_error: emailError }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
