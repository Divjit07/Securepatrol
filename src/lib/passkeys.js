// Passkey ("Face ID") client — talks to the passkey edge function, which mints
// challenges and verifies signatures server-side. On iPhone this triggers the
// real Face ID sheet; on Android, fingerprint/face unlock.
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { supabase } from './supabase.js'

async function invoke(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('passkey', {
    body: { action, origin: window.location.origin, ...extra },
  })
  if (error) {
    let message = error.message || 'Face ID service unavailable'
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch {
      /* keep generic message */
    }
    const err = new Error(message)
    err.code = message === 'no_credentials' ? 'no_credentials' : undefined
    throw err
  }
  if (data?.error) throw new Error(data.error)
  return data
}

/** Platform authenticator (Face ID / fingerprint) available on this device? */
export function passkeySupported() {
  return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential)
}

/** Prefer a real on-device biometric when the browser can report it. */
export async function platformAuthenticatorAvailable() {
  if (!passkeySupported()) return false
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    }
  } catch {
    /* fall through */
  }
  return true
}

/** Has this guard enrolled at least one passkey (any device)? */
export async function hasEnrolledPasskey(guardId) {
  const { data, error } = await supabase
    .from('webauthn_credentials')
    .select('id')
    .eq('guard_id', guardId)
    .limit(1)
  if (error) return false
  return Boolean(data?.length)
}

/** One-time enrollment: registers this device's Face ID as the guard's passkey. */
export async function enrollPasskey() {
  const { options } = await invoke('register-options')
  const response = await startRegistration({ optionsJSON: options })
  const result = await invoke('register-verify', { response })
  return result?.verified === true
}

/** The Face ID moment: prompts biometrics and verifies the signature server-side.
 *  Restricted to this device's platform authenticator (Face ID / fingerprint) —
 *  never the cross-device "scan a QR on another phone" Apple/Google hybrid flow. */
export async function verifyWithPasskey() {
  const { options } = await invoke('auth-options')
  // Force internal (on-device) only — ignore any hybrid/cable transports that
  // would make Safari/Chrome show a QR code for another device.
  if (Array.isArray(options?.allowCredentials)) {
    options.allowCredentials = options.allowCredentials.map((c) => ({
      ...c,
      transports: ['internal'],
    }))
  }
  try {
    const response = await startAuthentication({
      optionsJSON: options,
      useBrowserAutofill: false,
    })
    const result = await invoke('auth-verify', { response })
    return result?.verified === true
  } catch (err) {
    const name = err?.name || ''
    const msg = err?.message || ''
    if (name === 'NotAllowedError' || /not allowed|cancel|abort/i.test(msg)) {
      throw new Error('Face ID was cancelled. Try again on this phone.')
    }
    if (/no authenticator|not supported|securityerror/i.test(msg + name)) {
      throw new Error(
        'Face ID isn’t available in this browser. Open Kratos on the iPhone that enrolled Face ID (not a Mac), or re-enroll here.',
      )
    }
    throw err
  }
}
