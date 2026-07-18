// Shared Gemini client for ALL AI edge functions. No feature talks to the
// Gemini REST API directly — this is the single place that reads the key,
// handles errors, and caps output. See docs/AI_FEATURES_ROADMAP.md §4.
//
// Guardrail (roadmap §0): the model NEVER computes a number. Callers pass
// already-correct facts (from SQL / src/lib) and prompts that only reword them.
//
// TODO: paid tier before real data — the free Gemini tier may train on
// submitted content. Test data only until the key is switched to a paid
// project; cost is pennies at this volume.

// The "-latest" aliases track Google's current model — pinned versions get
// retired for new accounts (gemini-2.5-flash already 404s on this project).
export const GEMINI_FLASH = 'gemini-flash-latest'
export const GEMINI_FLASH_LITE = 'gemini-flash-lite-latest'

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string } // base64 image/audio (Phase 5b/5c)
}

export interface CallGeminiOptions {
  model?: string
  systemPrompt: string
  userParts: Array<GeminiPart | string>
  temperature?: number
  maxOutputTokens?: number
}

export const QUOTA_MESSAGE =
  'AI daily quota is used up (free tier) — it resets overnight. Everything else keeps working.'

/** POST one generateContent request; falls back to flash-lite when the primary
 *  model's free-tier quota is exhausted (each model has its own daily quota). */
async function geminiRequest(model: string, payload: Record<string, unknown>): Promise<Response> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (Supabase → Edge Functions → Secrets)')

  const post = (m: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

  let res = await post(model)
  if (res.status === 429 && model !== GEMINI_FLASH_LITE) {
    res = await post(GEMINI_FLASH_LITE)
  }
  if (res.status === 429) throw new Error(QUOTA_MESSAGE)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini ${model} returned ${res.status}: ${body.slice(0, 200)}`)
  }
  return res
}

/** One-shot generateContent call. Returns the model's text or throws. */
export async function callGemini({
  model = GEMINI_FLASH,
  systemPrompt,
  userParts,
  temperature = 0.4,
  maxOutputTokens = 1024,
}: CallGeminiOptions): Promise<string> {
  const parts = userParts.map((p) => (typeof p === 'string' ? { text: p } : p))

  const res = await geminiRequest(model, {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature, maxOutputTokens },
  })

  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text || '')
    .join('')
    .trim()
  if (!text) {
    const reason = json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || 'empty response'
    throw new Error(`Gemini returned no text (${reason})`)
  }
  return text
}

// ---------------------------------------------------------------------------
// Function-calling turn (Phase 4 chat). Returns the raw candidate content so
// the caller can loop on functionCall parts. The tool RESULTS come from
// RLS-scoped queries — the model still never computes a number.
// ---------------------------------------------------------------------------

export interface GeminiContent {
  role: 'user' | 'model'
  parts: Array<Record<string, unknown>>
}

export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON schema
}

export async function callGeminiChat({
  model = GEMINI_FLASH,
  systemPrompt,
  contents,
  tools,
  temperature = 0.2,
  maxOutputTokens = 1024,
}: {
  model?: string
  systemPrompt: string
  contents: GeminiContent[]
  tools?: GeminiFunctionDeclaration[]
  temperature?: number
  maxOutputTokens?: number
}): Promise<{ parts: Array<Record<string, unknown>>; finishReason: string }> {
  const res = await geminiRequest(model, {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    ...(tools?.length ? { tools: [{ functionDeclarations: tools }] } : {}),
    generationConfig: { temperature, maxOutputTokens },
  })

  const json = await res.json()
  const candidate = json?.candidates?.[0]
  if (!candidate?.content?.parts?.length) {
    const reason = candidate?.finishReason || json?.promptFeedback?.blockReason || 'empty response'
    throw new Error(`Gemini returned no content (${reason})`)
  }
  return { parts: candidate.content.parts, finishReason: candidate.finishReason || 'STOP' }
}
