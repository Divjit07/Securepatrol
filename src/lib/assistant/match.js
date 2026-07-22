// Intent matcher — no LLM. Scores the user's message against each intent's
// example phrases by token overlap (a lightweight retrieval, not generation),
// after normalising synonyms so "on duty" / "working now" / "clocked in" all
// collapse to the same tokens. Deterministic and free. Below the confidence
// threshold it returns null so the caller can fall back to a menu instead of
// guessing — the bot never gives a wrong answer, only "I didn't catch that".

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'has',
  'have', 'had', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'me', 'my',
  'i', 'we', 'you', 'it', 'that', 'this', 'there', 'here', 'please', 'can',
  'could', 'would', 'show', 'tell', 'give', 'get', 'list', 'what', 'whats',
  'right', 'now', 'currently', 'today', 'about', 'any',
])

// Map many surface forms to one canonical token so examples and questions align.
// NB: never map "out" here — "clock out" must not read as "on shift".
const SYNONYMS = {
  working: 'onshift', work: 'onshift', duty: 'onshift', 'on-duty': 'onshift',
  clockedin: 'onshift',
  clocked: 'clock', punch: 'clock', punches: 'clock', 'clock-in': 'clock',
  'clock-out': 'clock', clockin: 'clock', clockout: 'clock', outs: 'out', ins: 'in',
  hrs: 'hours', hour: 'hours', time: 'hours', timesheet: 'hours',
  roster: 'schedule', scheduled: 'schedule', shifts: 'shift', rota: 'schedule',
  ends: 'end', ended: 'end', finish: 'end', finishes: 'end', finishing: 'end', over: 'end',
  checkpoints: 'checkpoint', patrols: 'patrol', patrolled: 'patrol',
  miss: 'missed', misses: 'missed', missing: 'missed',
  rejects: 'reject', rejected: 'reject', rejection: 'reject',
  locations: 'sites', location: 'sites', site: 'sites', properties: 'sites',
  guards: 'guard', officer: 'guard', officers: 'guard', staff: 'guard',
  whos: 'who', "who's": 'who',
}

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => SYNONYMS[w] || w)
    .filter((w) => !STOPWORDS.has(w))
}

// Weighted Jaccard-ish overlap: shared tokens / query tokens, so extra words in
// the user's message ("... and when were they clocked in") don't dilute a match.
function overlapScore(queryTokens, exampleTokens) {
  if (!queryTokens.length || !exampleTokens.length) return 0
  const ex = new Set(exampleTokens)
  let shared = 0
  for (const q of new Set(queryTokens)) if (ex.has(q)) shared += 1
  const denom = Math.max(exampleTokens.length, 1)
  return shared / denom
}

const THRESHOLD = 0.34

/**
 * @param {string} text
 * @param {Array<{id, examples:string[], keywords?:string[]}>} intents
 * @returns {{ intent, score } | null}
 */
export function matchIntent(text, intents) {
  const qTokens = tokenize(text)
  if (!qTokens.length) return null
  const qSet = new Set(qTokens)

  let best = null
  for (const intent of intents) {
    let score = 0
    for (const ex of intent.examples) {
      score = Math.max(score, overlapScore(qTokens, tokenize(ex)))
    }
    // Strong keyword hits (e.g. "hours", "schedule") nudge the score — helps
    // terse questions that share few generic words with the examples.
    let kwHits = 0
    for (const kw of intent.keywords || []) if (qSet.has(kw)) kwHits += 1
    if (kwHits) score += 0.18 * kwHits

    if (!best || score > best.score) best = { intent, score }
  }
  return best && best.score >= THRESHOLD ? best : null
}

export { THRESHOLD }
