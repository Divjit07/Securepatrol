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

// ---------------------------------------------------------------------------
// Quota protection (free tier = hard $0, but requests/day are limited).
// Per warm isolate: identical alert sets are served from cache without
// touching Gemini; per-user cooldown stops refresh-spamming; a daily budget
// hard-caps total model calls no matter what.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 10 * 60_000 // reuse a digest for 10 min
const USER_COOLDOWN_MS = 60_000 // at most 1 model call per user per minute
const DAILY_MODEL_CALL_BUDGET = 200 // backstop well under free-tier limits

const digestCache = new Map<string, { narrative: string; count: number; at: number }>()
const lastCallByUser = new Map<string, number>()
let budgetDay = new Date().toDateString()
let modelCallsToday = 0

function takeBudget(): boolean {
  const today = new Date().toDateString()
  if (today !== budgetDay) {
    budgetDay = today
    modelCallsToday = 0
  }
  if (modelCallsToday >= DAILY_MODEL_CALL_BUDGET) return false
  modelCallsToday += 1
  return true
}

async function eventsHash(userId: string, rows: unknown): Promise<string> {
  const data = new TextEncoder().encode(userId + JSON.stringify(rows))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

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

    // Same alerts, same user → serve the cached digest, no model call.
    const key = await eventsHash(user.id, rows)
    const cached = digestCache.get(key)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return json({ narrative: cached.narrative, count: cached.count, cached: true })
    }

    // Per-user cooldown + global daily budget before any model call.
    const lastCall = lastCallByUser.get(user.id) || 0
    if (Date.now() - lastCall < USER_COOLDOWN_MS) {
      // Alerts changed within the cooldown: serve the stale digest if we have
      // one, else quietly no-op — the page's own list is always live anyway.
      return cached
        ? json({ narrative: cached.narrative, count: cached.count, cached: true })
        : json({ narrative: null, count: events.length, throttled: true })
    }
    if (!takeBudget()) {
      return cached
        ? json({ narrative: cached.narrative, count: cached.count, cached: true })
        : json({ narrative: null, count: events.length, throttled: true })
    }
    lastCallByUser.set(user.id, Date.now())

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

    digestCache.set(key, { narrative, count: events.length, at: Date.now() })
    // Keep the per-isolate cache tiny — this is a quota guard, not a store.
    if (digestCache.size > 100) {
      const oldest = [...digestCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) digestCache.delete(oldest[0])
    }

    return json({ narrative, count: events.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Digest failed' }, 500)
  }
})
