import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { ask, SUGGESTIONS } from '../lib/assistant/index.js'

const HISTORY_KEY = 'sp-assistant-history'

/** Admin ops assistant — a deterministic intent bot. It matches the question to
 *  one of a fixed set of live-data lookups and templates the answer. No LLM: it
 *  cannot invent a number, and it never leaves your browser except for the same
 *  RLS-scoped queries the app already makes. */
export default function AdminAssistant() {
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
  const [pending, setPending] = useState(null) // a { intentId, slots, need } follow-up
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
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setInput('')
    setBusy(true)
    const activePending = pending
    try {
      const result = await ask(trimmed, activePending)
      setPending(result.needs ? result.pending : null)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: result.reply, options: result.options || [] },
      ])
    } catch (err) {
      setPending(null)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Something went wrong: ${err.message}` },
      ])
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    setMessages([])
    setPending(null)
    try {
      sessionStorage.removeItem(HISTORY_KEY)
    } catch {
      /* ignore */
    }
  }

  return (
    <Layout variant="admin">
      <PageHeader
        title="Assistant"
        description="Ask about hours, schedules, patrols, and clock events — answers come straight from your data."
      />

      <div className="dk-card flex h-[calc(100vh-16rem)] min-h-[24rem] flex-col overflow-hidden">
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
                    m.role === 'user' ? 'bg-white text-black' : 'bg-white/5 text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.role === 'assistant' && m.options?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => send(opt)}
                          className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-ink-2 transition hover:bg-white/10 hover:text-ink"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
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
            placeholder={pending ? 'Type your answer…' : 'Ask about hours, schedules, patrols…'}
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
        Answers are looked up live from your data and scoped to your sites. Fully deterministic —
        no AI, no guessing, and nothing leaves your browser beyond the usual queries.
      </p>
    </Layout>
  )
}
