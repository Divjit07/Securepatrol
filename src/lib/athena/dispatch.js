import { supabase } from '../supabase.js'

/**
 * Athena's dispatch layer — triggering the edge functions that already own
 * sending, rather than sending from the browser.
 *
 * The functions hold the Resend key and the recipient env vars; the browser
 * holds neither, and should not. Athena asks them to run now instead of waiting
 * for the 10-minute cron.
 */

const FUNCTIONS = {
  alerts: 'roster-alerts',
  digest: 'ai-daily-digest',
}

/**
 * Run a dispatch now. Returns whatever the function reports so the console can
 * show a real result ("4 alerts sent") rather than an optimistic tick.
 */
export async function runDispatch(kind, payload = {}) {
  const fn = FUNCTIONS[kind]
  if (!fn) throw new Error(`Unknown dispatch: ${kind}`)

  const { data, error } = await supabase.functions.invoke(fn, {
    body: { source: 'athena', ...payload },
  })

  if (error) {
    // Edge functions surface failures in the body as often as in `error`.
    throw new Error(error.message || `${fn} failed`)
  }
  return data
}

export const DISPATCHES = [
  {
    id: 'alerts',
    label: 'Run alert sweep',
    description:
      'Checks every published shift for late clock-ins, no-shows and stale patrols, and emails whatever is new. Same job the 10-minute cron runs.',
  },
  {
    id: 'digest',
    label: 'Send daily digest',
    description:
      'Builds the ops digest from today’s patrol records and emails it to the admin address, plus coverage updates to clients.',
  },
]
