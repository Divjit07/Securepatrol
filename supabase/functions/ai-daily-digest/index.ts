// Daily emailed operations digest — fully templated, no LLM.
//  - Admin digest: full detail from get_admin_summary_data (039).
//  - Client digest: reassurance summary from get_client_summary_data — the SQL
//    never returns names/pay, so nothing sensitive can leak.
// Runs daily via pg_cron (039) or manually by an authenticated admin. Every
// number is computed by the database; this function only formats it into email.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// One digest run per hour per warm isolate (cron fires daily; this blunts abuse).
const RUN_COOLDOWN_MS = 60 * 60_000
let lastRunAt = 0

const ADMIN_TO = Deno.env.get('ROSTER_ALERTS_TO') || Deno.env.get('INCIDENT_REPORT_TO') || 'admin@prodsec.ca'
const CLIENT_TO = Deno.env.get('CLIENT_DIGEST_TO') || ADMIN_TO // sandbox: owner only
const FROM_EMAIL = Deno.env.get('SCHEDULE_FROM') || Deno.env.get('INCIDENT_REPORT_FROM') || 'SecurePatrol <onboarding@resend.dev>'

const esc = (s: unknown) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))

const fmtT = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }) : '—'

// deno-lint-ignore no-explicit-any
function renderAdminNarrative(d: any): string {
  const lines: string[] = []
  const shifts = d?.shifts || []
  if (shifts.length) {
    const worked = shifts.filter((s: any) => s.clock_in_at).length
    const late = shifts.filter((s: any) => (s.late_minutes || 0) > 0).length
    const noShow = shifts.filter((s: any) => s.no_show).length
    lines.push(`<strong>Coverage:</strong> ${shifts.length} shift${shifts.length === 1 ? '' : 's'} — ${worked} worked, ${late} late, ${noShow} no-show${noShow === 1 ? '' : 's'}.`)
    for (const s of shifts) {
      const who = esc(s.guard || 'Unassigned')
      if (s.no_show) { lines.push(`• ${who}: no-show.`); continue }
      const lateTxt = (s.late_minutes || 0) > 0 ? ` (late ${s.late_minutes}m)` : ''
      const out = s.clock_out_at ? fmtT(s.clock_out_at) : (s.missing_clock_out ? 'no clock-out' : 'on shift')
      lines.push(`• ${who}: ${fmtT(s.clock_in_at)} → ${out}${lateTxt}.`)
    }
  }
  const cp = d?.checkpoints || {}
  lines.push(`<strong>Patrols:</strong> ${cp.pass_scans || 0} scan${(cp.pass_scans || 0) === 1 ? '' : 's'}, ${cp.gps_rejects || 0} GPS reject${(cp.gps_rejects || 0) === 1 ? '' : 's'}.`)

  const misses = d?.misses || []
  if (misses.length) {
    lines.push(`<strong>Missed checkpoints:</strong> ${misses.length}.`)
    for (const m of misses.slice(0, 8)) lines.push(`• ${esc(m.guard)} missed ${esc(m.checkpoint)} at ${fmtT(m.window_start)}.`)
    const repeats = Object.entries(d?.repeat_miss_counts || {}).filter(([, n]) => (n as number) > 1)
    if (repeats.length) lines.push(`Repeat offenders: ${repeats.map(([n, c]) => `${esc(n)} (${c})`).join(', ')}.`)
  }

  const a = d?.alerts || {}
  if ((a.total || 0) > 0) {
    const byType = Object.entries(a.by_type || {}).map(([t, c]) => `${c} ${esc(String(t).replace(/_/g, ' '))}`).join(', ')
    lines.push(`<strong>Alerts:</strong> ${a.total} (${a.unacknowledged || 0} unacknowledged)${byType ? ` — ${byType}` : ''}.`)
  }
  const inc = d?.incidents || {}
  if ((inc.total || 0) > 0) lines.push(`<strong>Incidents:</strong> ${inc.total} report${inc.total === 1 ? '' : 's'}.`)

  return lines.join('<br>')
}

// deno-lint-ignore no-explicit-any
function renderClientNarrative(d: any): string {
  const cov = d?.coverage || {}
  const cp = d?.checkpoints || {}
  const lines: string[] = []
  lines.push(`Coverage: ${cov.shifts_covered || 0} of ${cov.shifts_scheduled || 0} scheduled shift${(cov.shifts_scheduled || 0) === 1 ? '' : 's'} staffed.`)
  lines.push(`Checkpoints: ${cp.confirmed_visits || 0} of ${cp.total || 0} confirmed visit${(cp.total || 0) === 1 ? '' : 's'}.`)
  if ((d?.reviewed_delays || 0) > 0) lines.push(`${d.reviewed_delays} delay${d.reviewed_delays === 1 ? '' : 's'} noted — all reviewed by management.`)
  return lines.join('<br>')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    // Cron calls carry the anon key (no user); manual calls must be an admin.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (user) {
      const { data: profile } = await userClient.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
        return json({ error: 'Admins only' }, 403)
      }
    }

    if (Date.now() - lastRunAt < RUN_COOLDOWN_MS) {
      return json({ skipped: true, reason: 'cooldown — digest already ran recently' })
    }
    lastRunAt = Date.now()

    const db = createClient(supabaseUrl, serviceKey)
    const end = new Date()
    const start = new Date(end.getTime() - 24 * 3600000)

    const { data: sites, error: sitesErr } = await db.from('sites').select('id, name')
    if (sitesErr) throw sitesErr
    if (!sites?.length) return json({ success: true, sites: 0, emailed: false })

    const adminSections: string[] = []
    const clientSections: string[] = []

    for (const site of sites) {
      const [{ data: adminData, error: aErr }, { data: clientData, error: cErr }] = await Promise.all([
        db.rpc('get_admin_summary_data', { p_site_id: site.id, p_start: start.toISOString(), p_end: end.toISOString() }),
        db.rpc('get_client_summary_data', { p_site_id: site.id, p_start: start.toISOString(), p_end: end.toISOString() }),
      ])
      if (aErr || cErr) {
        adminSections.push(`<h3>${esc(site.name)}</h3><p>Data fetch failed: ${esc((aErr || cErr)!.message)}</p>`)
        continue
      }

      const quiet =
        (adminData?.shifts?.length ?? 0) === 0 &&
        (adminData?.checkpoints?.pass_scans ?? 0) === 0 &&
        (adminData?.alerts?.total ?? 0) === 0
      if (quiet) {
        adminSections.push(`<h3>${esc(site.name)}</h3><p>No shifts, scans, or alerts in the last 24 hours.</p>`)
        continue
      }

      adminSections.push(`<h3 style="margin-bottom:4px">${esc(site.name)}</h3><p style="margin-top:0">${renderAdminNarrative(adminData)}</p>`)
      const clientNarrative = renderClientNarrative(clientData)
      if (clientNarrative) {
        clientSections.push(`<h3 style="margin-bottom:4px">${esc(site.name)}</h3><p style="margin-top:0">${clientNarrative}</p>`)
      }
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return json({ success: true, emailed: false, reason: 'RESEND_API_KEY not configured' })

    const dateLabel = end.toLocaleDateString('en-CA', { timeZone: 'America/Toronto', month: 'short', day: 'numeric' })
    const wrap = (title: string, sections: string[], footer: string) =>
      `<div style="font-family:system-ui,sans-serif;max-width:560px">
        <h2 style="color:#0a1628">${title}</h2>
        ${sections.join('')}
        <p style="color:#94a3b8;font-size:12px">${footer}</p>
      </div>`

    const send = (to: string, subject: string, html: string) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
      })

    const results: Record<string, boolean> = {}
    const adminRes = await send(
      ADMIN_TO,
      `SecurePatrol ops digest — ${dateLabel}`,
      wrap('Daily ops digest', adminSections, 'Every figure is computed directly from your patrol records. SecurePatrol automated digest.'),
    )
    results.admin = adminRes.ok

    if (clientSections.length) {
      const clientRes = await send(
        CLIENT_TO,
        `Your security coverage update — ${dateLabel}`,
        wrap('Coverage update', clientSections, 'Prepared automatically from verified patrol records. Productive Security Inc.'),
      )
      results.client = clientRes.ok
    }

    return json({ success: true, sites: sites.length, emailed: results })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Digest failed' }, 500)
  }
})
