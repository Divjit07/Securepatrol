// Search-first home hero (Dark Ops skin): time-aware serif greeting, rotating
// motivation line, chat-style site search card, and site chips. Full mode is
// the landing state (no data yet); compact mode is the board header once a
// site is picked.
import { useMemo, useState } from 'react'
import { Search, Plus, Building2, LayoutGrid, X } from 'lucide-react'
import { daypartOf, GREETING_WORDS, motivationFor } from '../../lib/greeting.js'

/** Claude-style spark, tinted with the active theme accent. */
export function Spark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" style={{ fill: 'var(--color-accent-orange)' }}>
      <path d="M12 1.5c.5 3.9 1 5.9 2.2 7.2 1.3 1.2 3.3 1.8 8.3 2.3v2c-5 .5-7 1.1-8.3 2.3C13 16.6 12.5 18.6 12 22.5h-.1c-.4-3.9-1-5.9-2.2-7.2C8.5 14.1 6.4 13.5 1.5 13v-2c5-.5 7-1.1 8.2-2.3C11 7.4 11.5 5.4 12 1.5Z" />
    </svg>
  )
}

export default function HomeHero({
  name,
  role = 'admin',
  sites = [],
  onPick,
  onNewSite,
  compact = false,
  activeLabel = '',
  onClear,
  action = null,
  daypart: daypartOverride,
}) {
  const [query, setQuery] = useState('')
  const daypart = daypartOverride || daypartOf(new Date().getHours())
  const greeting = `${GREETING_WORDS[daypart]}, ${name}`

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return sites
      .filter((s) => s.name.toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, sites])

  const pick = (target) => {
    onPick(target)
    setQuery('')
  }

  const submit = (e) => {
    e.preventDefault()
    if (matches[0]) pick(matches[0])
    else if (!query.trim() && sites.length) pick('all')
  }

  if (compact) {
    return (
      <div className="ios-rise mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Spark className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-serif text-2xl text-ink">{greeting}</p>
            <p className="truncate text-[13px] text-ink-2">{activeLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onClear} className="dk-btn-2 rounded-full">
            <X className="h-3.5 w-3.5" /> Search again
          </button>
          {action}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center pb-16 pt-[9vh]">
      <div className="ios-rise flex items-center gap-4">
        <Spark />
        <h1 className="font-serif text-5xl tracking-tight text-ink sm:text-6xl">{greeting}</h1>
      </div>
      <p className="ios-rise mt-4 text-center font-serif text-lg italic text-ink-2" style={{ animationDelay: '80ms' }}>
        {motivationFor(role, daypart)}
      </p>

      <form onSubmit={submit} className="ios-rise mt-10 w-full" style={{ animationDelay: '160ms' }}>
        <div className="rounded-[28px] border border-white/10 bg-surface p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a site — its data loads when you do"
            className="w-full bg-transparent text-lg text-ink outline-none placeholder:text-ink-3"
          />
          <div className="mt-6 flex items-center justify-between">
            {onNewSite ? (
              <button
                type="button"
                onClick={onNewSite}
                title="New site"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-ink-2 transition hover:bg-white/10 hover:text-ink"
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-3">
                {sites.length} site{sites.length === 1 ? '' : 's'}
              </span>
              <button type="submit" className="dk-cta">
                <Search className="h-4 w-4" /> Open
              </button>
            </div>
          </div>
        </div>

        {matches.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-surface">
            {matches.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/5"
              >
                <Building2 className="h-4 w-4 shrink-0 text-accent-orange" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.name}</span>
                <span className="hidden truncate text-xs text-ink-3 sm:block">{s.address}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="ios-rise mt-6 flex flex-wrap items-center justify-center gap-2.5" style={{ animationDelay: '240ms' }}>
        <button type="button" onClick={() => pick('all')} className="dk-btn-2 rounded-xl">
          <LayoutGrid className="h-3.5 w-3.5 text-accent-orange" /> All sites
        </button>
        {sites.slice(0, 5).map((s) => (
          <button key={s.id} type="button" onClick={() => pick(s)} className="dk-btn-2 rounded-xl">
            <Building2 className="h-3.5 w-3.5 text-accent-orange" /> {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
