import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'

const HISTORY_KEY = 'sp-assistant-history'

const SUGGESTIONS = [
  'Who worked yesterday and what were their hours?',
  "What's on the schedule for this week?",
  'Any missed checkpoints or GPS rejects in the last 7 days?',
  'Show clock events for a guard today',
]

/** Admin ops assistant — the model picks RLS-scoped tools server-side and
 *  phrases the results. It cannot compute or write anything. */
export default function AdminAssistant() {
  const { user } = useAuth()
  const [messages, setMessages] = useState(() => {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40)))
    } catch {
      /* best effort */
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const trimmed = (text || '').trim()
    if (!trimmed || busy) return
    setError(null)
    const next = [...messages, { role: 'user', text: trimmed }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-chat', {
        body: { messages: next.map(({ role, text: t }) => ({ role, text: t })) },
      })
      if (fnError) {
        // invoke() hides non-2xx bodies behind a generic message — dig the
        // real cause out of the response when there is one.
        let detail = fnError.message
        try {
          const body = await fnError.context?.json()
          if (body?.error) detail = body.error
        } catch {
          /* keep generic message */
        }
        throw new Error(detail || 'Assistant unavailable')
      }
      if (data?.error) throw new Error(data.error)
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply, tools: data.tools_used }])
    } catch (err) {
      setError(err.message || 'Assistant unavailable')
      // Keep the user's message in the thread so they can retry.
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    setMessages([])
    setError(null)
    try {
      sessionStorage.removeItem(HISTORY_KEY)
    } catch {
      /* ignore */
    }
  }

  if (!user) return null

  return (
    <Layout variant="admin">
      <PageHeader
        title="Assistant"
        description="Ask about hours, schedules, patrols, and clock events — answers come straight from your data."
      />

      <div className="dk-card flex h-[calc(100vh-16rem)] min-h-[24rem] flex-col overflow-hidden">
        {/* Thread */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-orange/15">
                <Sparkles className="h-6 w-6 text-accent-orange" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Ask about your operation</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-3">
                  Every answer is looked up live from your sites, shifts, and punches — the
                  assistant never invents numbers. Pay rates and paystub PDFs stay on the Payroll page.
                </p>
              </div>
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-ink-2 transition hover:bg-white/5 hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.role === 'assistant' && m.tools?.length > 0 && (
                    <p className="mt-1.5 text-[10px] text-ink-3">
                      looked up: {[...new Set(m.tools)].join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl bg-white/5 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3 [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="border-t border-white/5 px-5 py-2 text-xs text-accent-red">{error}</p>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="flex items-center gap-2 border-t border-white/10 p-4"
        >
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clear}
              title="Clear conversation"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-ink-3 transition hover:bg-white/10 hover:text-ink"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about hours, schedules, patrols…"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-xl border-0 bg-white/5 px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>

      <p className="mt-3 text-[11px] text-ink-3">
        Answers are phrased by AI from live database lookups scoped to your sites — the model never
        computes or stores your data. Free-tier quota applies; heavy use may pause until tomorrow.
      </p>
    </Layout>
  )
}
