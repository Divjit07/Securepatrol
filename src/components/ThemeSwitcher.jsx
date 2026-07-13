import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

export const THEME_GROUPS = [
  {
    label: 'Appearance',
    themes: [
      {
        id: 'night',
        label: 'Night',
        hint: 'Black · primary',
        dot: 'linear-gradient(145deg, #1f1f1f 40%, #000 70%, #4ade80)',
      },
      {
        id: 'day',
        label: 'Day',
        hint: 'White',
        dot: 'linear-gradient(145deg, #ffffff 45%, #ececec 70%, #16a34a)',
      },
    ],
  },
]

const ALL_THEMES = THEME_GROUPS.flatMap((g) => g.themes)
const VALID_IDS = new Set(ALL_THEMES.map((t) => t.id))

/** Every retired theme collapses to the black primary; day is the only light option. */
const THEME_ALIASES = {
  meadow: 'day',
  orchid: 'day',
  rose: 'day',
  ivory: 'day',
  sky: 'day',
  moss: 'night',
  lagoon: 'night',
  forest: 'night',
  matte: 'night',
  graphite: 'night',
  studio: 'night',
}

// Black is the primary theme — default to it regardless of system preference.
function systemDefaultTheme() {
  return 'night'
}

function resolveTheme(raw) {
  if (!raw) return systemDefaultTheme()
  const mapped = THEME_ALIASES[raw] || raw
  return VALID_IDS.has(mapped) ? mapped : systemDefaultTheme()
}

function themeColorFor(id) {
  if (id === 'day') return '#ebe8e1'
  if (id === 'night') return '#1c1f1a'
  return getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim()
}

/** Theme mood dropdown — Night/Day appearance + accent moods.
 *  @param {'up'|'down'} menuPlacement — sidebar opens up; top bar opens down */
export default function ThemeSwitcher({ menuPlacement = 'up' }) {
  const [theme, setTheme] = useState(() => {
    try {
      return resolveTheme(localStorage.getItem('sp-theme'))
    } catch {
      return systemDefaultTheme()
    }
  })
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const opensDown = menuPlacement === 'down'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('sp-theme', theme)
    } catch {
      /* Safari private mode */
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const color = themeColorFor(theme)
      if (color) meta.setAttribute('content', color)
    }
  }, [theme])

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

  const current = ALL_THEMES.find((t) => t.id === theme) || ALL_THEMES.find((t) => t.id === 'night')

  const panelClass = opensDown
    ? 'theme-picker-panel theme-picker-panel--down animate-rise absolute left-0 top-full z-50 mt-2 max-h-[70dvh] w-full min-w-[14rem] origin-top overflow-y-auto'
    : 'theme-picker-panel animate-rise absolute bottom-full left-0 z-50 mb-2 max-h-[70dvh] w-full origin-bottom overflow-y-auto'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 transition hover:bg-[var(--fill-hover)] hover:text-ink"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ background: current.dot, boxShadow: 'inset 0 0 0 1px var(--hairline-strong)' }}
        />
        <span className="flex-1 text-left">{current.label}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-ink-2" />
      </button>

      {open && (
        <div role="listbox" className={panelClass}>
          {THEME_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
                {group.label}
              </p>
              {group.themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={t.id === theme}
                  onClick={() => {
                    setTheme(t.id)
                    setOpen(false)
                  }}
                  className={`theme-picker-option flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    t.id === theme ? 'theme-picker-option-active' : ''
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{ background: t.dot, boxShadow: 'inset 0 0 0 1px var(--hairline-strong)' }}
                  />
                  <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                    <span>{t.label}</span>
                    {t.hint && <span className="text-[10px] font-normal text-ink-2">{t.hint}</span>}
                  </span>
                  {t.id === theme && <Check className="h-3.5 w-3.5 shrink-0 text-accent-orange" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
