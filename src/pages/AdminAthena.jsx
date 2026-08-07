import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, PenLine, Send, Sparkles, Radio, AlertTriangle, Check } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import RosterSitePicker from '../components/roster/RosterSitePicker.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { postMessage, PRIORITIES } from '../lib/messageBoard.js'
import {
  SAMPLE_VALUES,
  TEMPLATE_TOKENS,
  fetchTemplates,
  renderTemplate,
  saveTemplate,
  unknownTokens,
} from '../lib/athena/templates.js'
import { DISPATCHES, runDispatch } from '../lib/athena/dispatch.js'

const TABS = [
  { id: 'broadcast', label: 'Broadcast', icon: MessageSquare },
  { id: 'wording', label: 'Alert wording', icon: PenLine },
  { id: 'dispatch', label: 'Dispatch', icon: Radio },
]

/**
 * Athena — the ops console.
 *
 * Deliberately not a chatbot and deliberately not a model. Athena writes to the
 * message board, owns the wording of every automated alert, and can run the
 * dispatch jobs on demand. Everything it emits is either copy an admin typed or
 * a number computed from a patrol record.
 */
export default function AdminAthena() {
  const { user, profile, isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('broadcast')
  const [sites, setSites] = useState([])
  const [siteId, setSiteId] = useState('')
  const [flash, setFlash] = useState(null)

  // Broadcast
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState('normal')
  const [pinned, setPinned] = useState(false)
  const [posting, setPosting] = useState(false)

  // Wording
  const [templates, setTemplates] = useState([])
  const [drafts, setDrafts] = useState({})
  const [savingKey, setSavingKey] = useState(null)
  const [templateError, setTemplateError] = useState(null)

  // Dispatch
  const [runningId, setRunningId] = useState(null)
  const [results, setResults] = useState({})

  useEffect(() => {
    if (!user) return
    fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin').then((list) => {
      setSites(list)
      if (list.length) setSiteId(list[0].id)
    })
  }, [user?.id, isSuperAdmin])

  useEffect(() => {
    if (tab !== 'wording' || templates.length) return
    fetchTemplates()
      .then((rows) => {
        setTemplates(rows)
        setDrafts(Object.fromEntries(rows.map((r) => [r.key, { subject: r.subject || '', body: r.body }])))
        setTemplateError(null)
      })
      .catch((err) =>
        setTemplateError(
          err.message?.includes('does not exist')
            ? 'Migration 050 has not been run yet — apply it in the Supabase SQL editor.'
            : err.message,
        ),
      )
  }, [tab, templates.length])

  const handleBroadcast = async (e) => {
    e.preventDefault()
    if (!body.trim() || !siteId) return
    setPosting(true)
    try {
      await postMessage({
        siteId,
        authorId: profile?.id,
        authorRole: isSuperAdmin ? 'super_admin' : 'admin',
        body,
        priority,
        pinned,
      })
      setBody('')
      setPriority('normal')
      setPinned(false)
      setFlash({ type: 'ok', text: 'Posted to the site board — guards will see it and can acknowledge.' })
    } catch (err) {
      setFlash({ type: 'err', text: err.message || 'Could not post' })
    } finally {
      setPosting(false)
    }
  }

  const handleSaveTemplate = async (key) => {
    setSavingKey(key)
    try {
      await saveTemplate(key, { ...drafts[key], updatedBy: profile?.id })
      setFlash({ type: 'ok', text: 'Wording saved — the next alert uses it.' })
    } catch (err) {
      setFlash({ type: 'err', text: err.message || 'Could not save' })
    } finally {
      setSavingKey(null)
    }
  }

  const handleDispatch = async (id) => {
    setRunningId(id)
    try {
      const result = await runDispatch(id)
      setResults((prev) => ({ ...prev, [id]: { ok: true, result } }))
      setFlash({ type: 'ok', text: `${id === 'alerts' ? 'Alert sweep' : 'Digest'} finished.` })
    } catch (err) {
      setResults((prev) => ({ ...prev, [id]: { ok: false, error: err.message } }))
      setFlash({ type: 'err', text: err.message || 'Dispatch failed' })
    } finally {
      setRunningId(null)
    }
  }

  const siteName = useMemo(
    () => sites.find((s) => s.id === siteId)?.name || 'this site',
    [sites, siteId],
  )

  return (
    <Layout variant="admin">
      <PageHeader
        title="Athena"
        description="Post standing orders, own the wording of every automated alert, and run the dispatch jobs on demand."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-orange/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-orange">
            <Sparkles className="h-3.5 w-3.5" /> No model · deterministic
          </span>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1 rounded-full p-1 ring-1 ring-[color:var(--hairline-strong)] sm:w-fit">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                active ? 'bg-accent-orange text-[#12290d]' : 'text-ink-2 hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {flash && (
        <p
          className={`mb-4 flex items-center gap-2 text-sm ${
            flash.type === 'ok' ? 'text-accent-green' : 'text-accent-red'
          }`}
        >
          {flash.type === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {flash.text}
        </p>
      )}

      {tab === 'broadcast' && (
        <form onSubmit={handleBroadcast} className="dk-card max-w-2xl space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-2">Site</label>
            {sites.length > 0 && (
              <RosterSitePicker sites={sites} value={siteId} onChange={setSiteId} allowAll={false} />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-2">Message</label>
            <textarea
              className="sp-input w-full"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder={`e.g. Fire panel testing Thursday 09:00 at ${siteName} — log the alarm, do not call it in.`}
            />
            <p className="mt-1 text-xs text-ink-3">
              Appears on the guard board for {siteName}. Guards acknowledge it, and the
              acknowledgement is a record they cannot take back.
            </p>
          </div>

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
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium text-ink-2">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Pin to top
            </label>
            <button
              type="submit"
              disabled={posting || !body.trim() || !siteId}
              className="ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {posting ? 'Posting…' : 'Post to board'}
            </button>
          </div>
        </form>
      )}

      {tab === 'wording' && (
        <div className="space-y-4">
          {templateError && (
            <p className="flex items-center gap-2 text-sm text-accent-orange">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {templateError}
            </p>
          )}
          {templates.map((t) => {
            const draft = drafts[t.key] || { subject: '', body: '' }
            const tokens = TEMPLATE_TOKENS[t.key] || []
            const bad = unknownTokens(draft.body, t.key)
            return (
              <section key={t.key} className="dk-card p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-ink">{t.label}</h2>
                  <div className="flex flex-wrap gap-1">
                    {tokens.map((tok) => (
                      <code
                        key={tok}
                        className="rounded-md bg-accent-orange/10 px-1.5 py-0.5 font-mono text-[11px] text-accent-orange"
                      >
                        {`{${tok}}`}
                      </code>
                    ))}
                  </div>
                </div>

                {t.subject !== null && (
                  <input
                    className="sp-input mb-2 w-full"
                    value={draft.subject}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [t.key]: { ...draft, subject: e.target.value } }))
                    }
                    placeholder="Email subject"
                  />
                )}

                <textarea
                  className="sp-input w-full"
                  rows={2}
                  value={draft.body}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.key]: { ...draft, body: e.target.value } }))}
                />

                <div className="mt-3 rounded-xl bg-[color:var(--fill-subtle)] p-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-3">Preview</p>
                  <p className="text-sm text-ink">{renderTemplate(draft.body, SAMPLE_VALUES)}</p>
                </div>

                {bad.length > 0 && (
                  <p className="mt-2 text-xs text-accent-orange">
                    Unknown token{bad.length > 1 ? 's' : ''}: {bad.map((b) => `{${b}}`).join(', ')} — these
                    stay literal in the sent message.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveTemplate(t.key)}
                  disabled={savingKey === t.key}
                  className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink ring-1 ring-[color:var(--hairline-strong)] transition hover:bg-[color:var(--fill-hover)] disabled:opacity-50"
                >
                  {savingKey === t.key ? 'Saving…' : 'Save wording'}
                </button>
              </section>
            )
          })}
          {!templateError && templates.length === 0 && (
            <div className="dk-card p-8 text-center text-sm text-ink-3">Loading wording…</div>
          )}
        </div>
      )}

      {tab === 'dispatch' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {DISPATCHES.map((d) => {
            const res = results[d.id]
            return (
              <section key={d.id} className="dk-card flex flex-col p-5">
                <h2 className="font-display text-base font-bold text-ink">{d.label}</h2>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-2">{d.description}</p>
                {res && (
                  <p className={`mt-3 text-xs ${res.ok ? 'text-accent-green' : 'text-accent-red'}`}>
                    {res.ok ? JSON.stringify(res.result)?.slice(0, 160) : res.error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => handleDispatch(d.id)}
                  disabled={runningId === d.id}
                  className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  <Radio className="h-4 w-4" />
                  {runningId === d.id ? 'Running…' : 'Run now'}
                </button>
              </section>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
