import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, MessageSquare, Pin, Send, Trash2, AlertTriangle } from 'lucide-react'
import {
  PRIORITIES,
  acknowledgeMessage,
  deleteMessage,
  fetchAcks,
  fetchBoard,
  postMessage,
} from '../lib/messageBoard.js'

const TONE = {
  normal: { chip: 'bg-accent-cyan/15 text-accent-cyan-line', label: 'Normal' },
  important: { chip: 'bg-accent-orange/15 text-accent-orange', label: 'Important' },
  urgent: { chip: 'bg-accent-red/15 text-accent-red', label: 'Urgent' },
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * The site message board, shared by all three portals.
 *
 * `mode` decides the affordances, not the data — RLS already decides what the
 * caller can see:
 *   post  — admin / client: compose, pin, set priority, delete own
 *   read  — guard: read and acknowledge
 *
 * Acknowledgement is one-way by design (migration 049 grants no UPDATE/DELETE
 * on reads): a guard cannot un-see a standing order.
 */
export default function MessageBoard({
  siteId,
  mode = 'read',
  currentUserId,
  currentUserRole,
  className = '',
  title = 'Message board',
}) {
  const [messages, setMessages] = useState([])
  const [acks, setAcks] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const [body, setBody] = useState('')
  const [priority, setPriority] = useState('normal')
  const [pinned, setPinned] = useState(false)
  const [posting, setPosting] = useState(false)

  const canPost = mode === 'post'

  const load = useCallback(async () => {
    if (!siteId) {
      setMessages([])
      setLoading(false)
      return
    }
    try {
      const rows = await fetchBoard(siteId)
      setMessages(rows)
      setAcks(await fetchAcks(rows.map((r) => r.id)))
      setError(null)
    } catch (err) {
      setError(err.message || 'Could not load the board')
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const myAcked = useMemo(() => {
    const set = new Set()
    for (const [msgId, rows] of Object.entries(acks)) {
      if (rows.some((r) => r.guard_id === currentUserId)) set.add(msgId)
    }
    return set
  }, [acks, currentUserId])

  const handlePost = async (e) => {
    e.preventDefault()
    if (!body.trim() || !siteId) return
    setPosting(true)
    try {
      await postMessage({
        siteId,
        authorId: currentUserId,
        authorRole: currentUserRole,
        body,
        priority,
        pinned,
      })
      setBody('')
      setPriority('normal')
      setPinned(false)
      await load()
    } catch (err) {
      setError(err.message || 'Could not post')
    } finally {
      setPosting(false)
    }
  }

  const handleAck = async (messageId) => {
    setBusyId(messageId)
    try {
      await acknowledgeMessage(messageId, currentUserId)
      await load()
    } catch (err) {
      setError(err.message || 'Could not acknowledge')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (messageId) => {
    setBusyId(messageId)
    try {
      await deleteMessage(messageId)
      await load()
    } catch (err) {
      setError(err.message || 'Could not remove')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className={`dk-card p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-accent-orange" />
        <h2 className="font-display text-base font-bold text-ink">{title}</h2>
        {messages.length > 0 && (
          <span className="text-xs font-semibold text-ink-3">{messages.length}</span>
        )}
      </div>

      {canPost && (
        <form onSubmit={handlePost} className="mb-5 space-y-3">
          <textarea
            className="sp-input w-full"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Loading dock door is faulty — check it every round until Friday."
            maxLength={2000}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="sp-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-label="Priority"
            >
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPinned((v) => !v)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${
                pinned
                  ? 'bg-accent-orange/15 text-accent-orange ring-1 ring-accent-orange/30'
                  : 'text-ink-2 ring-1 ring-[color:var(--hairline-strong)] hover:text-ink'
              }`}
            >
              <Pin className="h-4 w-4" /> {pinned ? 'Pinned' : 'Pin'}
            </button>
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="mb-3 flex items-center gap-1.5 text-sm text-accent-red">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : messages.length === 0 ? (
        <div className="hatch-empty rounded-2xl border border-[color:var(--hairline)] py-10 text-center">
          <p className="px-6 text-sm text-ink-3">
            {canPost ? 'Nothing posted yet — the board is clear.' : 'No messages for this site.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {messages.map((m) => {
            const tone = TONE[m.priority] || TONE.normal
            const rows = acks[m.id] || []
            const acked = myAcked.has(m.id)
            const mine = m.author_id === currentUserId
            return (
              <li
                key={m.id}
                className="rounded-2xl p-3.5 ring-1 ring-[color:var(--hairline)]"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {m.pinned && <Pin className="h-3.5 w-3.5 text-accent-orange" />}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${tone.chip}`}>
                    {tone.label}
                  </span>
                  <span className="text-xs text-ink-3">
                    {m.author?.name || 'Office'} · {timeAgo(m.created_at)}
                  </span>
                  {canPost && mine && (
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      disabled={busyId === m.id}
                      className="ml-auto rounded-lg p-1.5 text-ink-3 transition hover:text-accent-red"
                      aria-label="Remove message"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{m.body}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {mode === 'read' && m.requires_ack && (
                    acked ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-green">
                        <Check className="h-3.5 w-3.5" /> Acknowledged
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAck(m.id)}
                        disabled={busyId === m.id}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent-orange px-4 text-sm font-bold text-[#12290d] transition disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {busyId === m.id ? 'Saving…' : 'Acknowledge'}
                      </button>
                    )
                  )}

                  {/* The office and the client care who has actually seen it. */}
                  {canPost && m.requires_ack && (
                    <span className="text-xs text-ink-2">
                      {rows.length === 0
                        ? 'No acknowledgements yet'
                        : `Acknowledged by ${rows.map((r) => r.guard?.name || 'guard').join(', ')}`}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
