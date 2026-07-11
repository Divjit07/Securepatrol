// Passkey ("Face ID") enrollment + verification for guard clock-in.
// Challenges are minted and assertions verified HERE (service role) so a client
// can't fake a Face ID check. Four actions:
//   register-options → challenge for navigator.credentials.create()
//   register-verify  → verifies attestation, stores the credential
//   auth-options     → challenge for navigator.credentials.get()
//   auth-verify      → verifies the assertion signature, bumps the counter
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from 'https://esm.sh/@simplewebauthn/server@13.1.1'
import { isoBase64URL } from 'https://esm.sh/@simplewebauthn/server@13.1.1/helpers'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RP_NAME = 'SecurePatrol'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, response, origin: bodyOrigin } = await req.json()

    // Who is calling? (guard's own JWT)
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not signed in' }, 401)

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // RP ID = the web origin the passkey is bound to.
    const origin = bodyOrigin || req.headers.get('origin') || ''
    const rpID = new URL(origin).hostname
    const expectedOrigin = origin

    const { data: profile } = await db
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()
    const userName = profile?.email || user.email || 'guard'
    const userDisplayName = profile?.name || userName

    if (action === 'register-options') {
      const { data: existing } = await db
        .from('webauthn_credentials')
        .select('credential_id, transports')
        .eq('guard_id', user.id)

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userName,
        userDisplayName,
        attestationType: 'none',
        excludeCredentials: (existing || []).map((c) => ({
          id: c.credential_id,
          transports: c.transports || undefined,
        })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Face ID / Touch ID, not USB keys
          residentKey: 'preferred',
          userVerification: 'required', // biometric or device passcode MUST run
        },
      })

      await db.from('webauthn_challenges').upsert({
        user_id: user.id,
        challenge: options.challenge,
        kind: 'registration',
        created_at: new Date().toISOString(),
      })

      return json({ options })
    }

    if (action === 'register-verify') {
      const { data: challengeRow } = await db
        .from('webauthn_challenges')
        .select('challenge, kind, created_at')
        .eq('user_id', user.id)
        .single()
      if (!challengeRow || challengeRow.kind !== 'registration') {
        return json({ error: 'No pending enrollment — start again' }, 400)
      }

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: true,
      })

      if (!verification.verified || !verification.registrationInfo) {
        return json({ error: 'Could not verify this device' }, 400)
      }

      const { credential } = verification.registrationInfo
      const { error: insertErr } = await db.from('webauthn_credentials').insert({
        guard_id: user.id,
        credential_id: credential.id,
        public_key: isoBase64URL.fromBuffer(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports || null,
        device_label: req.headers.get('user-agent')?.slice(0, 120) || null,
      })
      if (insertErr) throw insertErr

      await db.from('webauthn_challenges').delete().eq('user_id', user.id)
      return json({ verified: true })
    }

    if (action === 'auth-options') {
      const { data: creds } = await db
        .from('webauthn_credentials')
        .select('credential_id, transports')
        .eq('guard_id', user.id)
      if (!creds?.length) return json({ error: 'no_credentials' }, 404)

      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'required',
        // Platform authenticator only — never offer the hybrid QR "use another device" path.
        allowCredentials: creds.map((c) => ({
          id: c.credential_id,
          transports: ['internal'],
        })),
      })

      await db.from('webauthn_challenges').upsert({
        user_id: user.id,
        challenge: options.challenge,
        kind: 'authentication',
        created_at: new Date().toISOString(),
      })

      return json({ options })
    }

    if (action === 'auth-verify') {
      const { data: challengeRow } = await db
        .from('webauthn_challenges')
        .select('challenge, kind, created_at')
        .eq('user_id', user.id)
        .single()
      if (!challengeRow || challengeRow.kind !== 'authentication') {
        return json({ error: 'No pending Face ID check — start again' }, 400)
      }
      // Challenges are single-use and short-lived.
      if (Date.now() - new Date(challengeRow.created_at).getTime() > 5 * 60_000) {
        await db.from('webauthn_challenges').delete().eq('user_id', user.id)
        return json({ error: 'Face ID check expired — try again' }, 400)
      }

      const { data: cred } = await db
        .from('webauthn_credentials')
        .select('id, credential_id, public_key, counter')
        .eq('guard_id', user.id)
        .eq('credential_id', response?.id || '')
        .single()
      if (!cred) return json({ error: 'This device is not enrolled' }, 400)

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: cred.credential_id,
          publicKey: isoBase64URL.toBuffer(cred.public_key),
          counter: Number(cred.counter) || 0,
        },
      })

      if (!verification.verified) return json({ error: 'Face ID check failed' }, 400)

      await db
        .from('webauthn_credentials')
        .update({
          counter: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', cred.id)
      await db.from('webauthn_challenges').delete().eq('user_id', user.id)

      return json({ verified: true })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    console.error('passkey error', err)
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
