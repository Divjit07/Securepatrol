// Creates an office-staff account (role='office'). Mirrors create-guard, but
// the worker clocks in/out by GPS geofence at an office location instead of
// patrolling a site. Admin-only. The profile carries office_location_id; there
// is no row in the `guards` table.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

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
      return json({ error: 'Only admins can create office employees' }, 403)
    }

    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = body.password
    const office_location_id = body.office_location_id || null

    if (!name || !email || !password) {
      return json({ error: 'Missing required fields' }, 400)
    }
    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const duplicateMsg = 'An account with this email already exists'

    const { data: existing } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'office')
      .ilike('name', name)
      .limit(1)
      .maybeSingle()
    // (name check is a soft guard only; email uniqueness is enforced by auth.)
    void existing

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'office' },
    })

    if (createError) {
      const raw = createError.message || ''
      const error = /already|registered|exists|duplicate/i.test(raw) ? duplicateMsg : raw
      return json({ error }, 400)
    }

    // handle_new_user clamps client-supplied roles to guard/client, so it will
    // have inserted a placeholder profile. Overwrite it with the real office
    // profile using the trusted service role.
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: newUser.user.id,
      name,
      role: 'office',
      office_location_id,
      site_id: null,
      active: true,
    })
    if (profileError) return json({ error: profileError.message }, 400)

    return json({ success: true, user_id: newUser.user.id })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
