import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_DESCRIPTION = 5000
const MAX_ATTACHMENTS = 5
const ADMIN_EMAIL = Deno.env.get('INCIDENT_REPORT_TO') || 'admin@kronus.space'
const FROM_EMAIL = Deno.env.get('INCIDENT_REPORT_FROM') || 'Kronus <onboarding@resend.dev>'

type AttachmentMeta = {
  path: string
  name: string
  kind: 'image' | 'document'
  mime_type?: string | null
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function normalizeAttachments(
  attachmentPaths: AttachmentMeta[] | null | undefined,
  legacyPhotoPath: string | null | undefined,
): AttachmentMeta[] {
  const fromBody = Array.isArray(attachmentPaths)
    ? attachmentPaths.filter((item) => item?.path)
    : []

  if (fromBody.length) return fromBody.slice(0, MAX_ATTACHMENTS)

  if (legacyPhotoPath) {
    return [
      {
        path: legacyPhotoPath,
        name: legacyPhotoPath.split('/').pop() || 'photo.jpg',
        kind: 'image',
        mime_type: 'image/jpeg',
      },
    ]
  }

  return []
}

async function sendIncidentEmail(opts: {
  guardName: string
  guardEmail: string
  siteName: string
  description: string
  createdAt: string
  lat?: number | null
  lng?: number | null
  files: { filename: string; content: string }[]
}) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return { sent: false, error: 'RESEND_API_KEY not configured' }
  }

  const locationLine =
    opts.lat != null && opts.lng != null
      ? `<p><strong>Location:</strong> ${opts.lat.toFixed(6)}, ${opts.lng.toFixed(6)}</p>`
      : ''

  const attachmentLine = opts.files.length
    ? `<p><strong>Attachments:</strong> ${opts.files.length} file(s) included with this email.</p>`
    : ''

  const html = `
    <h2>Guard incident report</h2>
    <p><strong>Site:</strong> ${escapeHtml(opts.siteName)}</p>
    <p><strong>Guard:</strong> ${escapeHtml(opts.guardName)} (${escapeHtml(opts.guardEmail)})</p>
    <p><strong>Submitted:</strong> ${escapeHtml(opts.createdAt)}</p>
    ${locationLine}
    ${attachmentLine}
    <p><strong>Report:</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit;background:#f8fafc;padding:12px;border-radius:8px;">${escapeHtml(opts.description)}</pre>
  `

  const payload: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: [ADMIN_EMAIL],
    subject: `Incident report — ${opts.siteName}`,
    html,
  }

  if (opts.files.length) {
    payload.attachments = opts.files
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

    const { description, photo_path, attachment_paths, guard_lat, guard_lng } = await req.json()

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

    const attachments = normalizeAttachments(attachment_paths, photo_path)
    if (attachments.length > MAX_ATTACHMENTS) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_ATTACHMENTS} attachments allowed` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const expectedPrefix = `${user.id}/`
    for (const att of attachments) {
      if (!att.path?.startsWith(expectedPrefix)) {
        return new Response(JSON.stringify({ error: 'Invalid attachment path' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const firstImage = attachments.find((a) => a.kind === 'image')
    const legacyPhotoPath = firstImage?.path || photo_path || null

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
        photo_path: legacyPhotoPath,
        attachments,
      })
      .select('id, created_at')
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const emailFiles: { filename: string; content: string }[] = []

    for (const att of attachments) {
      const { data: fileData, error: downloadError } = await adminClient.storage
        .from('incident-photos')
        .download(att.path)

      if (!downloadError && fileData) {
        const bytes = new Uint8Array(await fileData.arrayBuffer())
        emailFiles.push({
          filename: att.name || att.path.split('/').pop() || 'attachment',
          content: bytesToBase64(bytes),
        })
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
      files: emailFiles,
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
        attachment_count: attachments.length,
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
