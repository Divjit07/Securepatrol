import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

/** Site picker — filters dashboard metrics to matching site(s). */
export default function SiteSearchInput({ sites, value, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const q = value.trim().toLowerCase()

  const matches = q
    ? sites.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.address || '').toLowerCase().includes(q),
      )
    : sites

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (site) => {
    onChange(site.name)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/10 px-1 pb-1">
        <Search className="h-3.5 w-3.5 shrink-0 text-ink-3" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search site…"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          aria-label="Search sites"
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            className="rounded p-0.5 text-ink-3 hover:bg-white/10 hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul
          role="listbox"
          className="animate-rise absolute right-0 top-full z-50 mt-2 max-h-56 w-64 overflow-y-auto rounded-xl border border-white/10 bg-surface p-1 shadow-2xl shadow-black/40"
        >
          {matches.map((site) => (
            <li key={site.id} role="option">
              <button
                type="button"
                onClick={() => pick(site)}
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
              >
                <span className="text-sm font-medium text-ink">{site.name}</span>
                {site.address && (
                  <span className="truncate text-xs text-ink-3">{site.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && q && matches.length === 0 && (
        <p className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-ink-3 shadow-2xl shadow-black/40">
          No sites match &ldquo;{value}&rdquo;
        </p>
      )}
    </div>
  )
}
