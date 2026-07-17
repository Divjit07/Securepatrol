// AI Phase 4 (docs/AI_FEATURES_ROADMAP.md): ops chat assistant with tool
// calling. The model picks tools and phrases results; every tool is a thin
// RLS-scoped query through the CALLER'S client — authorization lives in the
// database, not the prompt, and the model never computes a number.
// Admin/super-admin only. No write actions in v1 (paystub PDFs stay on the
// Payroll page — the assistant reports facts and points there).
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  callGeminiChat,
  GEMINI_FLASH,
  GeminiContent,
  GeminiFunctionDeclaration,
} from '../_shared/gemini.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Quota guards (free tier = $0, protect the request quota).
const USER_COOLDOWN_MS = 4_000
const DAILY_MODEL_CALL_BUDGET = 400
const MAX_TOOL_ITERATIONS = 6
const MAX_HISTORY_MESSAGES = 20
const lastMessageByUser = new Map<string, number>()
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

const CLOCK_ROLES = ['shift_clock_in', 'shift_clock_out']

// ---------------------------------------------------------------------------
// Tool declarations (what the model sees).
// ---------------------------------------------------------------------------
const TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: 'get_on_shift_now',
    description:
      'Who is clocked in RIGHT NOW across all of this admin\'s sites, plus recent clock-outs. Answers "who is on shift/working now" in a single call — always prefer this over stitching schedules and clock events.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'resolve_guard',
    description:
      'Find guards by (partial) name. Returns ALL matches with ids and sites. If more than one matches, ask the user which one — never guess.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Full or partial guard name' } },
      required: ['name'],
    },
  },
  {
    name: 'list_sites',
    description: 'List the sites this admin manages (id + name).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_clock_events',
    description:
      'Raw clock-in/out punches for one guard between two ISO timestamps, newest first. Includes early-clock-out notes and admin-forced punches.',
    parameters: {
      type: 'object',
      properties: {
        guard_id: { type: 'string' },
        start: { type: 'string', description: 'ISO timestamp' },
        end: { type: 'string', description: 'ISO timestamp' },
      },
      required: ['guard_id', 'start', 'end'],
    },
  },
  {
    name: 'get_hours',
    description:
      'Worked hours for one guard between two ISO timestamps: clock-in/out sessions paired per day with minutes, plus the total. Uses raw punches — the source payroll reads.',
    parameters: {
      type: 'object',
      properties: {
        guard_id: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
      },
      required: ['guard_id', 'start', 'end'],
    },
  },
  {
    name: 'get_schedule',
    description: 'Published roster shifts for a site or a guard between two ISO timestamps.',
    parameters: {
      type: 'object',
      properties: {
        site_id: { type: 'string' },
        guard_id: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
      },
      required: ['start', 'end'],
    },
  },
  {
    name: 'get_patrol_activity',
    description:
      'Checkpoint patrol activity for a site between two ISO timestamps: pass-scan counts per checkpoint, GPS-rejected scan count, and recorded checkpoint misses (guard + checkpoint + time).',
    parameters: {
      type: 'object',
      properties: {
        site_id: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
      },
      required: ['site_id', 'start', 'end'],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool implementations — every query runs on the caller's RLS-scoped client.
// ---------------------------------------------------------------------------
async function runTool(db: SupabaseClient, name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'get_on_shift_now': {
      // Same signal as the Live Clock board: a guard is on shift when their
      // most recent clock punch (16h window) is a clock-IN.
      const { data: guards, error: gErr } = await db
        .from('guards')
        .select('id, name, active, sites(name)')
        .eq('active', true)
      if (gErr) return { error: gErr.message }
      if (!guards?.length) return { on_shift: [], recently_clocked_out: [] }
      const since = new Date(Date.now() - 16 * 3600000).toISOString()
      const { data: punches, error: pErr } = await db
        .from('scans')
        .select('guard_id, scanned_at, approval_note, checkpoints!inner(checkpoint_role)')
        .in('guard_id', guards.map((g) => g.id))
        .eq('status', 'pass')
        .in('checkpoints.checkpoint_role', CLOCK_ROLES)
        .gte('scanned_at', since)
        .order('scanned_at', { ascending: false })
      if (pErr) return { error: pErr.message }
      const lastByGuard = new Map<string, { at: string; role?: string; note: string | null }>()
      for (const p of punches || []) {
        if (!lastByGuard.has(p.guard_id)) {
          lastByGuard.set(p.guard_id, {
            at: p.scanned_at,
            role: (p.checkpoints as { checkpoint_role?: string } | null)?.checkpoint_role,
            note: p.approval_note || null,
          })
        }
      }
      const onShift: unknown[] = []
      const recentOut: unknown[] = []
      for (const g of guards) {
        const last = lastByGuard.get(g.id)
        if (!last) continue
        const site = (g.sites as { name?: string } | null)?.name || null
        if (last.role === 'shift_clock_in') {
          onShift.push({ guard: g.name, site, clocked_in_at: last.at })
        } else {
          recentOut.push({ guard: g.name, site, clocked_out_at: last.at, note: last.note })
        }
      }
      return { on_shift: onShift, recently_clocked_out: recentOut }
    }

    case 'resolve_guard': {
      const q = String(args.name || '').trim()
      if (!q) return { error: 'name is required' }
      const { data, error } = await db
        .from('guards')
        .select('id, name, active, site_id, sites(name)')
        .ilike('name', `%${q}%`)
        .limit(10)
      if (error) return { error: error.message }
      return {
        matches: (data || []).map((g) => ({
          guard_id: g.id,
          name: g.name,
          active: g.active,
          site: (g.sites as { name?: string } | null)?.name || null,
        })),
      }
    }

    case 'list_sites': {
      const { data, error } = await db.from('sites').select('id, name').order('name')
      if (error) return { error: error.message }
      return { sites: data || [] }
    }

    case 'get_clock_events': {
      const { data, error } = await db
        .from('scans')
        .select('scanned_at, approval_note, scan_input_method, checkpoints!inner(checkpoint_role)')
        .eq('guard_id', String(args.guard_id))
        .eq('status', 'pass')
        .in('checkpoints.checkpoint_role', CLOCK_ROLES)
        .gte('scanned_at', String(args.start))
        .lte('scanned_at', String(args.end))
        .order('scanned_at', { ascending: false })
        .limit(200)
      if (error) return { error: error.message }
      return {
        events: (data || []).map((s) => ({
          at: s.scanned_at,
          type:
            (s.checkpoints as { checkpoint_role?: string } | null)?.checkpoint_role ===
            'shift_clock_in'
              ? 'clock_in'
              : 'clock_out',
          note: s.approval_note || null,
          by_admin: s.scan_input_method === 'admin',
        })),
      }
    }

    case 'get_hours': {
      const { data, error } = await db
        .from('scans')
        .select('scanned_at, checkpoints!inner(checkpoint_role)')
        .eq('guard_id', String(args.guard_id))
        .eq('status', 'pass')
        .in('checkpoints.checkpoint_role', CLOCK_ROLES)
        .gte('scanned_at', String(args.start))
        .lte('scanned_at', String(args.end))
        .order('scanned_at', { ascending: true })
        .limit(500)
      if (error) return { error: error.message }
      // Pair each clock-in with the next clock-out (same rule as the app).
      const sessions: Array<{ clock_in: string; clock_out: string | null; minutes: number | null }> = []
      let openIn: string | null = null
      for (const s of data || []) {
        const role = (s.checkpoints as { checkpoint_role?: string } | null)?.checkpoint_role
        if (role === 'shift_clock_in') {
          if (!openIn) openIn = s.scanned_at
        } else if (openIn) {
          sessions.push({
            clock_in: openIn,
            clock_out: s.scanned_at,
            minutes: Math.round((new Date(s.scanned_at).getTime() - new Date(openIn).getTime()) / 60000),
          })
          openIn = null
        }
      }
      if (openIn) sessions.push({ clock_in: openIn, clock_out: null, minutes: null })
      const total = sessions.reduce((sum, x) => sum + (x.minutes || 0), 0)
      return {
        sessions,
        total_minutes: total,
        total_hours: Math.round((total / 60) * 100) / 100,
        note: sessions.some((x) => !x.clock_out)
          ? 'One session has no clock-out yet — its time is not included in the total.'
          : undefined,
      }
    }

    case 'get_schedule': {
      let q = db
        .from('shifts')
        .select('starts_at, ends_at, status, guard_id, profiles:guard_id(name), sites(name)')
        .eq('status', 'published')
        .gte('starts_at', String(args.start))
        .lte('starts_at', String(args.end))
        .order('starts_at', { ascending: true })
        .limit(100)
      if (args.site_id) q = q.eq('site_id', String(args.site_id))
      if (args.guard_id) q = q.eq('guard_id', String(args.guard_id))
      const { data, error } = await q
      if (error) return { error: error.message }
      return {
        shifts: (data || []).map((s) => ({
          guard: (s.profiles as { name?: string } | null)?.name || null,
          site: (s.sites as { name?: string } | null)?.name || null,
          starts_at: s.starts_at,
          ends_at: s.ends_at,
        })),
      }
    }

    case 'get_patrol_activity': {
      const siteId = String(args.site_id)
      const { data: floors, error: fErr } = await db.from('floors').select('id').eq('site_id', siteId)
      if (fErr) return { error: fErr.message }
      const floorIds = (floors || []).map((f) => f.id)
      if (!floorIds.length) return { checkpoints: [], gps_rejects: 0, misses: [] }
      const { data: cps, error: cErr } = await db
        .from('checkpoints')
        .select('id, name, checkpoint_role')
        .in('floor_id', floorIds)
        .eq('active', true)
      if (cErr) return { error: cErr.message }
      const patrolCps = (cps || []).filter((c) => !CLOCK_ROLES.includes(c.checkpoint_role || ''))
      const cpIds = (cps || []).map((c) => c.id)
      const [{ data: scans, error: sErr }, missRes] = await Promise.all([
        db
          .from('scans')
          .select('checkpoint_id, status')
          .in('checkpoint_id', cpIds)
          .gte('scanned_at', String(args.start))
          .lte('scanned_at', String(args.end))
          .limit(2000),
        db
          .from('checkpoint_misses')
          .select('guard_id, checkpoint_id, window_start, profiles:guard_id(name)')
          .eq('site_id', siteId)
          .gte('window_start', String(args.start))
          .lte('window_start', String(args.end))
          .limit(100),
      ])
      if (sErr) return { error: sErr.message }
      const passCount = new Map<string, number>()
      let gpsRejects = 0
      for (const s of scans || []) {
        if (s.status === 'pass') passCount.set(s.checkpoint_id, (passCount.get(s.checkpoint_id) || 0) + 1)
        else gpsRejects += 1
      }
      const cpName = new Map((cps || []).map((c) => [c.id, c.name]))
      return {
        checkpoints: patrolCps.map((c) => ({ name: c.name, pass_scans: passCount.get(c.id) || 0 })),
        gps_rejects: gpsRejects,
        misses: (missRes.data || []).map((m) => ({
          guard: (m.profiles as { name?: string } | null)?.name || 'Guard',
          checkpoint: cpName.get(m.checkpoint_id) || 'Checkpoint',
          at: m.window_start,
        })),
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

const SYSTEM_PROMPT = [
  'You are the SecurePatrol operations assistant for a security company admin.',
  `Today is ${new Date().toISOString()} (America/Toronto for the user).`,
  'Rules — non-negotiable:',
  '- Answer ONLY from tool results. If you have not called a tool, you do not know the number.',
  '- Never invent, estimate, or extrapolate names, hours, times, or counts.',
  '- Ambiguous guard name (resolve_guard returns 2+ matches): list the matches and ask which one.',
  '- Empty tool result: say so plainly. Do not fill gaps.',
  '- Dates: resolve relative ranges ("this week", "biweekly") to explicit ISO ranges before calling tools.',
  '- "Who is on shift / working right now" → call get_on_shift_now once. Do not stitch schedules and clock events for that.',
  '- Use as FEW tool calls as possible; request independent lookups together in one turn.',
  '- Pay/paystubs: you may report hours from get_hours; for paystub PDFs and pay rates, direct the admin to the Payroll page — you cannot generate documents.',
  '- Keep answers short and factual. Plain text only, no markdown tables.',
].join('\n')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    // RLS-scoped client — every tool query runs as the caller.
    const db = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await db.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return json({ error: 'Admins only' }, 403)
    }

    const last = lastMessageByUser.get(user.id) || 0
    if (Date.now() - last < USER_COOLDOWN_MS) {
      return json({ error: 'Slow down a little — one message every few seconds.' })
    }
    lastMessageByUser.set(user.id, Date.now())

    const { messages } = await req.json().catch(() => ({ messages: null }))
    if (!Array.isArray(messages) || !messages.length) {
      return json({ error: 'messages[] required' }, 400)
    }

    // History: [{role:'user'|'assistant', text}] — cap length, coerce roles.
    const contents: GeminiContent[] = messages
      .slice(-MAX_HISTORY_MESSAGES)
      .filter((m) => m && typeof m.text === 'string' && m.text.trim())
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.text).slice(0, 4000) }],
      }))
    if (!contents.length) return json({ error: 'messages[] required' }, 400)

    const toolsUsed: string[] = []

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i += 1) {
      if (!takeBudget()) {
        return json({ error: 'Daily AI budget reached — try again tomorrow.' })
      }
      // Generous output cap: current Gemini models spend hidden "thinking"
      // tokens from the same budget before any visible text.
      const { parts } = await callGeminiChat({
        model: GEMINI_FLASH,
        systemPrompt: SYSTEM_PROMPT,
        contents,
        tools: TOOLS,
        temperature: 0.2,
        maxOutputTokens: 3072,
      })

      const calls = parts.filter((p) => p.functionCall) as Array<{
        functionCall: { name: string; args?: Record<string, unknown> }
      }>

      if (!calls.length) {
        const text = parts
          .map((p) => (p as { text?: string }).text || '')
          .join('')
          .trim()
        return json({ reply: text || 'I could not produce an answer.', tools_used: toolsUsed })
      }

      // Execute every requested tool, append call + result, loop.
      contents.push({ role: 'model', parts })
      const responseParts: Array<Record<string, unknown>> = []
      for (const call of calls) {
        const { name, args = {} } = call.functionCall
        toolsUsed.push(name)
        const result = await runTool(db, name, args)
        responseParts.push({ functionResponse: { name, response: { result } } })
      }
      contents.push({ role: 'user', parts: responseParts })
    }

    // Lookup cap reached: force a final answer from whatever the tools already
    // returned instead of giving up — no new tools allowed on this turn.
    contents.push({
      role: 'user',
      parts: [{
        text: 'Lookup limit reached. Answer the original question NOW using only the tool results above. If they are insufficient, say exactly what is missing. Do not request more tools.',
      }],
    })
    if (takeBudget()) {
      const { parts } = await callGeminiChat({
        model: GEMINI_FLASH,
        systemPrompt: SYSTEM_PROMPT,
        contents,
        temperature: 0.2,
        maxOutputTokens: 3072,
      })
      const text = parts.map((p) => (p as { text?: string }).text || '').join('').trim()
      if (text) return json({ reply: text, tools_used: toolsUsed })
    }
    return json({
      reply: 'That took too many lookup steps — try narrowing the question.',
      tools_used: toolsUsed,
    })
  } catch (err) {
    // 200 on purpose: supabase-js invoke() swallows non-2xx bodies into a
    // generic "non-2xx status code" — returning the message in a 200 lets the
    // UI show the actual cause. Auth failures above still use real 401/403.
    return json({ error: err instanceof Error ? err.message : 'Chat failed' })
  }
})
