// Open-alerts summary for the Alerts page — fully templated, no LLM. Groups the
// unacknowledged alert_events into a short plain-English line, most urgent first.
// Every name, count, and time comes straight from the rows; nothing is invented.
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

// Most urgent first.
const SEVERITY = ['no_show', 'late', 'stale_patrol', 'missed_checkpoint']
const LABEL: Record<string, string> = {
  no_show: 'no-show',
  late: 'late clock-in',
  stale_patrol: 'stale patrol',
  missed_checkpoint: 'missed checkpoint',
}

// deno-lint-ignore no-explicit-any
function buildNarrative(rows: any[]): string {
  const byType = new Map<string, any[]>()
  for (const r of rows) {
    if (!byType.has(r.type)) byType.set(r.type, [])
    byType.get(r.type)!.push(r)
  }
  const order = [...byType.keys()].sort((a, b) => {
    const ia = SEVERITY.indexOf(a); const ib = SEVERITY.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  const parts: string[] = []
  for (const type of order) {
    const group = byType.get(type)!
    const label = LABEL[type] || String(type).replace(/_/g, ' ')
    const who = [...new Set(group.map((g) => `${g.guard} (${g.site})`))].slice(0, 4).join(', ')
    const more = group.length > 4 ? `, +${group.length - 4} more` : ''
    parts.push(`${group.length} ${label}${group.length === 1 ? '' : 's'}: ${who}${more}`)
  }
  return parts.join('. ') + '.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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

    const { data: profile } = await userClient.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return json({ error: 'Admins only' }, 403)
    }

    const { data: events, error: evError } = await userClient
      .from('alert_events')
      .select('event_type, message, acknowledged, created_at, sites(name), profiles:guard_id(name)')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(50)
    if (evError) return json({ error: evError.message }, 500)

    if (!events?.length) return json({ narrative: null, count: 0 })

    const rows = events.map((e) => ({
      type: e.event_type,
      guard: e.profiles?.name || 'Unknown guard',
      site: e.sites?.name || 'Unknown site',
      at: e.created_at,
      message: e.message,
    }))

    return json({ narrative: buildNarrative(rows), count: events.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Digest failed' }, 500)
  }
})
