import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_DESCRIPTION = 5000
const ADMIN_EMAIL = Deno.env.get('INCIDENT_REPORT_TO') || 'admin@prodsec.ca'
const FROM_EMAIL = Deno.env.get('INCIDENT_REPORT_FROM') || 'SecurePatrol <onboarding@resend.dev>'

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendIncidentEmail(opts: {
  guardName: string
  guardEmail: string
  siteName: string
  description: string
  createdAt: string
  lat?: number | null
  lng?: number | null
  photoBytes?: Uint8Array | null
  photoFilename?: string | null
}) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return { sent: false, error: 'RESEND_API_KEY not configured' }
  }

  const locationLine =
    opts.lat != null && opts.lng != null
      ? `<p><strong>Location:</strong> ${opts.lat.toFixed(6)}, ${opts.lng.toFixed(6)}</p>`
      : ''

  const html = `
    <h2>Guard incident report</h2>
    <p><strong>Site:</strong> ${escapeHtml(opts.siteName)}</p>
    <p><strong>Guard:</strong> ${escapeHtml(opts.guardName)} (${escapeHtml(opts.guardEmail)})</p>
    <p><strong>Submitted:</strong> ${escapeHtml(opts.createdAt)}</p>
    ${locationLine}
    <p><strong>Report:</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit;background:#f8fafc;padding:12px;border-radius:8px;">${escapeHtml(opts.description)}</pre>
  `

  const payload: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: [ADMIN_EMAIL],
    subject: `Incident report — ${opts.siteName}`,
    html,
  }

  if (opts.photoBytes?.length && opts.photoFilename) {
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < opts.photoBytes.length; i += chunk) {
      binary += String.fromCharCode(...opts.photoBytes.subarray(i, i + chunk))
    }
    payload.attachments = [
      {
        filename: opts.photoFilename,
        content: btoa(binary),
      },
    ]
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    return { sent: false, error: body || `Resend error ${response.status}` }
  }

  return { sent: true, error: null }
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
      .select('name, role, site_id, active, sites(name)')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'guard' || !profile.active || !profile.site_id) {
      return new Response(JSON.stringify({ error: 'Only active guards can submit incident reports' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { description, photo_path, guard_lat, guard_lng } = await req.json()

    const trimmed = description?.trim()
    if (!trimmed || trimmed.length < 10) {
      return new Response(JSON.stringify({ error: 'Please write at least 10 characters in your report' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (trimmed.length > MAX_DESCRIPTION) {
      return new Response(JSON.stringify({ error: `Report must be under ${MAX_DESCRIPTION} characters` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (photo_path) {
      const expectedPrefix = `${user.id}/`
      if (!photo_path.startsWith(expectedPrefix)) {
        return new Response(JSON.stringify({ error: 'Invalid photo path' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: report, error: insertError } = await adminClient
      .from('incident_reports')
      .insert({
        guard_id: user.id,
        site_id: profile.site_id,
        description: trimmed,
        guard_lat: guard_lat ?? null,
        guard_lng: guard_lng ?? null,
        photo_path: photo_path || null,
      })
      .select('id, created_at')
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let photoBytes: Uint8Array | null = null
    let photoFilename: string | null = null

    if (photo_path) {
      const { data: fileData, error: downloadError } = await adminClient.storage
        .from('incident-photos')
        .download(photo_path)

      if (!downloadError && fileData) {
        photoBytes = new Uint8Array(await fileData.arrayBuffer())
        photoFilename = photo_path.split('/').pop() || 'incident-photo.jpg'
      }
    }

    const siteName = profile.sites?.name || 'Unknown site'
    const createdAt = new Date(report.created_at).toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const emailResult = await sendIncidentEmail({
      guardName: profile.name || 'Guard',
      guardEmail: user.email || 'unknown',
      siteName,
      description: trimmed,
      createdAt,
      lat: guard_lat,
      lng: guard_lng,
      photoBytes,
      photoFilename,
    })

    if (emailResult.sent) {
      await adminClient
        .from('incident_reports')
        .update({ email_sent_at: new Date().toISOString(), email_error: null })
        .eq('id', report.id)
    } else {
      await adminClient
        .from('incident_reports')
        .update({ email_error: emailResult.error })
        .eq('id', report.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report.id,
        email_sent: emailResult.sent,
        message: emailResult.sent
          ? 'Report sent to admin.'
          : 'Report saved. Email could not be sent — admin has been notified in the system.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
