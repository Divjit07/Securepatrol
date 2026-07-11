import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

const ALL_SITES = 'all'

/**
 * Black-pill site picker with search + optional "All sites".
 * value = site uuid | 'all'
 */
export default function RosterSitePicker({ sites, value, onChange, allowAll = true }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const selected =
    value === ALL_SITES
      ? { id: ALL_SITES, name: 'All sites', address: `${sites.length} sites` }
      : sites.find((s) => s.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sites
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q),
    )
  }, [sites, query])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const pick = (id) => {
    onChange(id)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[16rem] items-center gap-2 rounded-full bg-black py-3 pl-5 pr-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.name || 'Select site'}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="animate-rise absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-2xl shadow-black/40"
        >
          <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-2" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sites…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-2"
              aria-label="Search sites"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {allowAll && !query.trim() && (
              <button
                type="button"
                role="option"
                aria-selected={value === ALL_SITES}
                onClick={() => pick(ALL_SITES)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                  value === ALL_SITES ? 'bg-black text-white' : 'text-ink hover:bg-ink/5'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">All sites</span>
                  <span className={`block text-[11px] ${value === ALL_SITES ? 'text-white/70' : 'text-ink-2'}`}>
                    View every site at once
                  </span>
                </span>
                {value === ALL_SITES && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-ink-2">No sites match.</p>
            ) : (
              filtered.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  role="option"
                  aria-selected={value === site.id}
                  onClick={() => pick(site.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                    value === site.id ? 'bg-black text-white' : 'text-ink hover:bg-ink/5'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{site.name}</span>
                    {site.address && (
                      <span
                        className={`block truncate text-[11px] ${
                          value === site.id ? 'text-white/70' : 'text-ink-2'
                        }`}
                      >
                        {site.address}
                      </span>
                    )}
                  </span>
                  {value === site.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { ALL_SITES }
