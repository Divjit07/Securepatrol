// Ops-assistant orchestrator. ask(text) matches an intent, fills its slots
// (date range + guard/site resolved from the text), runs the deterministic
// query, and returns a templated reply. When a required slot is missing or
// ambiguous it returns { needs, pending } so the chat UI can ask a follow-up —
// that's the whole "conversation" without any LLM.
import intents from './intents.js'
import { matchIntent } from './match.js'
import { parseRange } from './dates.js'
import { findGuardsInText, findSitesInText, resolveGuardByName } from './entities.js'

export const SUGGESTIONS = [
  "Who's on shift right now?",
  'Hours for a guard this week',
  'Schedule this week',
  'List my sites',
]

const CAPABILITIES = [
  'I answer straight from your live data — no guessing. Try:',
  '• Who’s on shift right now (with clock-in times)',
  '• Hours for a guard — e.g. “hours for Raj this week”',
  '• Clock punches for a guard — e.g. “when did Amit clock in today”',
  '• Schedule — e.g. “schedule this week”',
  '• Patrol activity — e.g. “missed checkpoints at Downtown last 7 days”',
  '• Your sites — “list my sites”',
].join('\n')

const byId = (id) => intents.find((i) => i.id === id)

function needResponse(intent, slots, need) {
  return {
    reply: need.prompt,
    needs: need,
    options: need.options || [],
    pending: { intentId: intent.id, slots, need },
  }
}

async function resolveGuardSlot(text, slots) {
  if (slots.guard) return { guard: slots.guard }
  const matches = await findGuardsInText(text)
  if (matches.length === 1) return { guard: matches[0] }
  if (matches.length === 0) return { need: { slot: 'guard', prompt: 'Which guard? Type their name.' } }
  return { need: { slot: 'guard', prompt: 'I found a few guards — which one?', options: matches.map((m) => m.name) } }
}

async function resolveSiteSlot(text, slots) {
  if (slots.site) return { site: slots.site }
  const matches = await findSitesInText(text)
  if (matches.length === 1) return { site: matches[0] }
  if (matches.length === 0) return { need: { slot: 'site', prompt: 'Which site? Type its name.' } }
  return { need: { slot: 'site', prompt: 'Which site?', options: matches.map((m) => m.name) } }
}

async function fulfil(intent, text, prefill) {
  const slots = { ...prefill }

  // Date range: keep an already-resolved one (from a follow-up), else parse the
  // text, else fall back to the intent's default.
  if (!slots.range) {
    slots.range = parseRange(text) || (intent.defaultRange ? parseRange(intent.defaultRange) : null)
  }

  const wants = new Set([...(intent.needs || []), ...(intent.optional || [])])

  if (wants.has('guard') && !slots.guard) {
    const g = await resolveGuardSlot(text, slots)
    if (g.guard) slots.guard = g.guard
    else if (g.need && (intent.needs || []).includes('guard')) return needResponse(intent, slots, g.need)
  }

  if (wants.has('site') && !slots.site) {
    const s = await resolveSiteSlot(text, slots)
    if (s.site) slots.site = s.site
    else if (s.need && (intent.needs || []).includes('site')) return needResponse(intent, slots, s.need)
  }

  const result = await intent.run(slots)
  return { reply: intent.render(result, slots), intent: intent.id }
}

async function completePending(pending, text) {
  const intent = byId(pending.intentId)
  if (!intent) return { reply: CAPABILITIES }
  const slots = { ...pending.slots }

  if (pending.need.slot === 'guard') {
    const matches = await resolveGuardByName(text)
    if (matches.length === 1) slots.guard = matches[0]
    else if (matches.length === 0) {
      return needResponse(intent, slots, { slot: 'guard', prompt: `No guard named “${text}”. Type the name again.` })
    } else {
      return needResponse(intent, slots, { slot: 'guard', prompt: 'Still a few matches — which one?', options: matches.map((m) => m.name) })
    }
  } else if (pending.need.slot === 'site') {
    const matches = await findSitesInText(text)
    if (matches.length === 1) slots.site = matches[0]
    else if (matches.length === 0) {
      return needResponse(intent, slots, { slot: 'site', prompt: `No site named “${text}”. Type the name again.` })
    } else {
      return needResponse(intent, slots, { slot: 'site', prompt: 'Which site?', options: matches.map((m) => m.name) })
    }
  }

  return fulfil(intent, text, slots)
}

/**
 * @param {string} text  the user's message
 * @param {object|null} pending  a prior { intentId, slots, need } when answering a follow-up
 * @returns {{ reply, intent?, needs?, options?, pending?, fallback? }}
 */
export async function ask(text, pending = null) {
  const trimmed = (text || '').trim()
  if (!trimmed) return { reply: CAPABILITIES }
  try {
    if (pending) return await completePending(pending, trimmed)
    if (/^(help|hi|hello|hey|menu|what can you do\??)$/i.test(trimmed)) {
      return { reply: CAPABILITIES }
    }
    const m = matchIntent(trimmed, intents)
    if (!m) return { reply: `I didn’t quite catch that.\n\n${CAPABILITIES}`, fallback: true }
    return await fulfil(m.intent, trimmed, {})
  } catch (err) {
    return { reply: `Something went wrong reading your data: ${err.message}` }
  }
}
