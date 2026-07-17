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

/** One-shot generateContent call. Returns the model's text or throws. */
export async function callGemini({
  model = GEMINI_FLASH,
  systemPrompt,
  userParts,
  temperature = 0.4,
  maxOutputTokens = 1024,
}: CallGeminiOptions): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (Supabase → Edge Functions → Secrets)')

  const parts = userParts.map((p) => (typeof p === 'string' ? { text: p } : p))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature, maxOutputTokens },
      }),
    },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini ${model} returned ${res.status}: ${body.slice(0, 300)}`)
  }

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
