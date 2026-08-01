// Publishes draft shifts in a date range, then emails each affected guard
// their schedule via Resend with an .ics calendar attachment.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM_EMAIL = Deno.env.get('SCHEDULE_FROM') || Deno.env.get('INCIDENT_REPORT_FROM') || 'Kronus <onboarding@resend.dev>'

type Shift = {
  id: string
  guard_id: string | null
  starts_at: string
  ends_at: string
  break_minutes: number
  notes: string | null
  site_name?: string
}

const SCHEDULE_TZ = 'America/Toronto'

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeIcs(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function buildIcs(shifts: Shift[], siteName: string) {
  const events = shifts
    .map(
      // The UID domain is an identity, NOT branding — do not rename it to
      // kronus. Calendars match a re-published shift to the invite already in
      // the guard's calendar by this UID; changing it turns every future update
      // into a duplicate event instead of an edit.
      (s) => `BEGIN:VEVENT
UID:shift-${s.id}@securepatrol
DTSTAMP:${icsDate(new Date().toISOString())}
DTSTART:${icsDate(s.starts_at)}
DTEND:${icsDate(s.ends_at)}
SUMMARY:${escapeIcs(`Shift — ${siteName}`)}
DESCRIPTION:${escapeIcs(s.notes || 'Kronus scheduled shift')}
LOCATION:${escapeIcs(siteName)}
END:VEVENT`,
    )
    .join('\n')

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kronus//Roster//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events}
END:VCALENDAR`
}

function formatShiftLine(s: Shift) {
  const start = new Date(s.starts_at)
  const end = new Date(s.ends_at)
  const day = start.toLocaleDateString('en-CA', {
    timeZone: SCHEDULE_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const timeOpts: Intl.DateTimeFormatOptions = {
    timeZone: SCHEDULE_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }
  const time = `${start.toLocaleTimeString('en-CA', timeOpts)} – ${end.toLocaleTimeString('en-CA', timeOpts)}`
  return `<tr><td style="padding:8px 16px;font-weight:600">${day}</td><td style="padding:8px 16px">${time}</td><td style="padding:8px 16px;color:#64748b">${s.notes ?? ''}</td></tr>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { site_id, range_start, range_end } = await req.json()
    if (!site_id || !range_start || !range_end) {
      throw new Error('site_id, range_start and range_end are required')
    }

    // Caller identity (must be an admin) — checked with their own JWT.
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData?.user) throw new Error('Not authenticated')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', userData.user.id)
      .single()
    if (!callerProfile || !['super_admin', 'admin'].includes(callerProfile.role)) {
      throw new Error('Only admins can publish schedules')
    }

    const { data: site } = await admin.from('sites').select('id, name').eq('id', site_id).single()
    if (!site) throw new Error('Site not found')

    // Publish drafts in range.
    const { data: published, error: pubError } = await admin
      .from('shifts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('site_id', site_id)
      .eq('status', 'draft')
      .gte('starts_at', range_start)
      .lt('starts_at', range_end)
      .select('id, guard_id, starts_at, ends_at, break_minutes, notes')
    if (pubError) throw pubError

    const shifts: Shift[] = published || []

    // Group per guard; open shifts are broadcast to every active site guard.
    const byGuard = new Map<string, Shift[]>()
    const openShifts: Shift[] = []
    for (const s of shifts) {
      if (!s.guard_id) {
        openShifts.push(s)
        continue
      }
      if (!byGuard.has(s.guard_id)) byGuard.set(s.guard_id, [])
      byGuard.get(s.guard_id)!.push(s)
    }

    const { data: siteGuards } = await admin
      .from('guards')
      .select('id, name, email, active')
      .eq('site_id', site_id)

    const guardById = new Map((siteGuards || []).map((g) => [g.id, g]))

    // Open shifts go to all active guards so anyone can claim.
    if (openShifts.length) {
      for (const g of siteGuards || []) {
        if (!g.active) continue
        if (!byGuard.has(g.id)) byGuard.set(g.id, [])
      }
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    let emailed = 0
    let emailError: string | null = resendKey ? null : 'RESEND_API_KEY not configured'
    // Guards with no real address on file get no email — surface who, so the
    // admin knows to reach them another way instead of assuming everyone knows.
    const skippedGuards: string[] = []

    if (resendKey) {
      for (const [guardId, guardShifts] of byGuard) {
        const guard = guardById.get(guardId)
        if (!guard?.email || guard.email.endsWith('@guard.local')) {
          if (guard) skippedGuards.push(guard.name)
          continue
        }

        const rows = guardShifts.sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map(formatShiftLine).join('')
        const openRows = openShifts.map(formatShiftLine).join('')
        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#0a1628">Your schedule is out — ${site.name}</h2>
            ${guardShifts.length ? `<p>Hi ${guard.name}, your upcoming shifts:</p>
            <table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:12px">${rows}</table>
            <p style="color:#64748b;font-size:13px">A calendar file is attached — open it to add these shifts to your phone's calendar.</p>` : ''}
            ${openRows ? `<h3 style="color:#0a1628">Open shifts available</h3>
            <table style="border-collapse:collapse;width:100%;background:#fffbeb;border-radius:12px">${openRows}</table>
            <p style="color:#64748b;font-size:13px">First come, first served — claim in the Kronus app.</p>` : ''}
            <p style="color:#94a3b8;font-size:12px">Kronus</p>
          </div>`

        const attachments = guardShifts.length
          ? [{ filename: 'shifts.ics', content: btoa(unescape(encodeURIComponent(buildIcs(guardShifts, site.name)))) }]
          : []

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: guard.email,
            subject: guardShifts.length
              ? `Your ${site.name} schedule — ${guardShifts.length} shift${guardShifts.length > 1 ? 's' : ''} published`
              : `Open shifts available at ${site.name}`,
            html,
            attachments,
          }),
        })
        if (res.ok) emailed++
        else emailError = `Resend ${res.status}: ${await res.text()}`
      }
    }

    await admin.from('schedule_publications').insert({
      site_id,
      published_by: userData.user.id,
      range_start: range_start.slice(0, 10),
      range_end: range_end.slice(0, 10),
      shift_count: shifts.length,
      emails_sent: emailed,
      email_error: emailError,
    })

    return new Response(
      JSON.stringify({
        success: true,
        published: shifts.length,
        emailed,
        skipped: skippedGuards,
        email_error: emailError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
