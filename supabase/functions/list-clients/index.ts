import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Only admins can list clients' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let query = userClient
      .from('profiles')
      .select('id, name, role, site_id, active, sites(id, name, address)')
      .eq('role', 'client')
      .order('name')

    const { data: clientProfiles, error: profileError } = await query
    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let filtered = clientProfiles || []
    if (profile.role === 'admin') {
      const { data: ownedSites } = await userClient
        .from('sites')
        .select('id')
        .eq('admin_id', user.id)

      const ownedIds = new Set((ownedSites || []).map((s) => s.id))
      filtered = filtered.filter((c) => c.site_id && ownedIds.has(c.site_id))
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const clients = await Promise.all(
      filtered.map(async (c) => {
        const { data: authUser } = await adminClient.auth.admin.getUserById(c.id)
        const site = c.sites as { id: string; name: string; address: string | null } | null
        return {
          id: c.id,
          name: c.name,
          email: authUser?.user?.email || '—',
          site_id: c.site_id,
          site_name: site?.name || null,
          site_address: site?.address || null,
          active: c.active ?? true,
          unassigned: !c.site_id,
        }
      }),
    )

    return new Response(JSON.stringify({ clients }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
