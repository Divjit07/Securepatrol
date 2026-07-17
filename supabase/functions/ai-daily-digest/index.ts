// AI Phase 2+3 (docs/AI_FEATURES_ROADMAP.md): daily emailed digests.
//  - Admin digest: full-detail narrative from get_admin_summary_data (039).
//  - Client digest: reassurance narrative from get_client_summary_data — the
//    SQL never returns names/pay, so the model cannot leak them.
// Runs daily via pg_cron (039) or manually by an authenticated admin.
// The model only rephrases the SQL JSON — it never computes a number.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGemini, GEMINI_FLASH } from '../_shared/gemini.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Spam/quota guard: one digest run per hour per warm isolate, no matter who
// calls. (The cron fires once a day; this blunts anon-key abuse.)
const RUN_COOLDOWN_MS = 60 * 60_000
let lastRunAt = 0

const ADMIN_TO = Deno.env.get('ROSTER_ALERTS_TO') || Deno.env.get('INCIDENT_REPORT_TO') || 'admin@prodsec.ca'
const CLIENT_TO = Deno.env.get('CLIENT_DIGEST_TO') || ADMIN_TO // sandbox: owner only
const FROM_EMAIL = Deno.env.get('SCHEDULE_FROM') || Deno.env.get('INCIDENT_REPORT_FROM') || 'SecurePatrol <onboarding@resend.dev>'

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
      const { data: profile } = await userClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
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
        adminSections.push(`<h3>${site.name}</h3><p>Data fetch failed: ${(aErr || cErr)!.message}</p>`)
        continue
      }

      // Quiet site (no shifts, no scans, no alerts) → one line, zero AI calls.
      const quiet =
        (adminData?.shifts?.length ?? 0) === 0 &&
        (adminData?.checkpoints?.pass_scans ?? 0) === 0 &&
        (adminData?.alerts?.total ?? 0) === 0
      if (quiet) {
        adminSections.push(`<h3>${site.name}</h3><p>No shifts, scans, or alerts in the last 24 hours.</p>`)
        continue
      }

      const [adminNarrative, clientNarrative] = await Promise.all([
        callGemini({
          model: GEMINI_FLASH,
          systemPrompt: [
            'You write the daily operations digest for a security company manager.',
            'You get one JSON blob of already-computed facts for one site. Rules:',
            '- ONLY restate facts from the JSON. Never invent, estimate, or extrapolate.',
            '- Cover: shift coverage (who worked, clock in/out, late minutes), checkpoint',
            '  completion, misses (name the guard and checkpoint), repeat offenders,',
            '  GPS rejects, alerts, incidents.',
            '- Use exact names and times from the JSON (times are ISO; write them as local-style times).',
            '- 4-8 short sentences. Plain, factual, most important first. No markdown, no advice.',
          ].join('\n'),
          userParts: [JSON.stringify(adminData)],
          temperature: 0.2,
          maxOutputTokens: 512,
        }).catch((e) => `Narrative unavailable (${e.message}). Raw facts: ${JSON.stringify(adminData)}`),
        callGemini({
          model: GEMINI_FLASH,
          systemPrompt: [
            'You write a brief daily security-coverage update for a property owner (the client).',
            'You get one JSON blob of already-computed facts. Rules:',
            '- ONLY restate facts from the JSON. Never invent numbers.',
            '- The JSON deliberately contains no guard names, pay, or internal detail — do not',
            '  speculate about any of that.',
            '- Reassuring, professional tone: confirm coverage, checkpoint visits, and that any',
            '  delays were reviewed by management.',
            '- 2-4 short sentences. No markdown.',
          ].join('\n'),
          userParts: [JSON.stringify(clientData)],
          temperature: 0.3,
          maxOutputTokens: 256,
        }).catch(() => null),
      ])

      adminSections.push(`<h3 style="margin-bottom:4px">${site.name}</h3><p style="margin-top:0">${adminNarrative}</p>`)
      if (clientNarrative) {
        clientSections.push(`<h3 style="margin-bottom:4px">${site.name}</h3><p style="margin-top:0">${clientNarrative}</p>`)
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
      wrap('Daily ops digest', adminSections,
        'Every number is computed by the database; AI only phrases it. SecurePatrol automated digest.'),
    )
    results.admin = adminRes.ok

    if (clientSections.length) {
      const clientRes = await send(
        CLIENT_TO,
        `Your security coverage update — ${dateLabel}`,
        wrap('Coverage update', clientSections,
          'Prepared automatically from verified patrol records. Productive Security Inc.'),
      )
      results.client = clientRes.ok
    }

    return json({ success: true, sites: sites.length, emailed: results })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Digest failed' }, 500)
  }
})
