// AI Phase 1 (docs/AI_FEATURES_ROADMAP.md §5): reword the already-correct
// alert_events rows into a short plain-English digest. The model NEVER
// computes — every guard name, site, count, and timestamp comes from the rows;
// Gemini only groups and phrases them.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    // Caller-scoped client: RLS limits alert_events to the caller's sites.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return json({ error: 'Admins only' }, 403)
    }

    // Same shape as src/lib/alertEvents.js fetchOpenAlertEvents.
    const { data: events, error: evError } = await userClient
      .from('alert_events')
      .select('event_type, message, acknowledged, created_at, sites(name), profiles:guard_id(name)')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(50)
    if (evError) return json({ error: evError.message }, 500)

    if (!events?.length) {
      return json({ narrative: null, count: 0 })
    }

    // Facts the model is allowed to phrase — nothing else reaches it.
    const rows = events.map((e) => ({
      type: e.event_type,
      guard: e.profiles?.name || 'Unknown guard',
      site: e.sites?.name || 'Unknown site',
      at: e.created_at,
      message: e.message,
    }))

    const narrative = await callGemini({
      model: GEMINI_FLASH,
      systemPrompt: [
        'You summarize security-operations alerts for a site manager.',
        'You will receive a JSON array of alert rows. Rules:',
        '- ONLY reword and group the rows. Never invent, estimate, or extrapolate.',
        '- Every count you state must equal the number of matching rows.',
        '- Use the guard and site names exactly as given.',
        '- Group repeats (same guard/site/type) into one line with the count.',
        '- Max 3 short sentences, most urgent first (no_show > late > stale_patrol > missed_checkpoint).',
        '- Plain factual tone. No advice, no filler, no markdown.',
      ].join('\n'),
      userParts: [JSON.stringify(rows)],
      temperature: 0.2,
      maxOutputTokens: 256,
    })

    return json({ narrative, count: events.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Digest failed' }, 500)
  }
})
