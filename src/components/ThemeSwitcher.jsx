import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

const DAY = {
  id: 'day',
  label: 'Day',
  hint: 'White',
  primaryHint: 'White · primary',
  dot: 'linear-gradient(145deg, #ffffff 45%, #ececec 70%, #16a34a)',
}

const NIGHT = {
  id: 'night',
  label: 'Night',
  hint: 'Black',
  primaryHint: 'Black · primary',
  dot: 'linear-gradient(145deg, #1f1f1f 40%, #000 70%, #4ade80)',
}

export const THEME_GROUPS = [
  {
    label: 'Appearance',
    themes: [
      { ...DAY, hint: DAY.primaryHint },
      NIGHT,
    ],
  },
]

const ALL_THEMES = [DAY, NIGHT]
const VALID_IDS = new Set(ALL_THEMES.map((t) => t.id))

/** Retired light themes collapse to Day, retired dark ones to Night. */
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

/**
 * Portal-scoped theme storage so Admin/Client can default to Day while Guard
 * defaults to Night without fighting over one shared key.
 *  - office → admin + client (+ login)
 *  - guard  → guard portal
 */
function scopeFor(primary) {
  return primary === 'night' ? 'guard' : 'office'
}

function themeKey(scope) {
  return scope === 'guard' ? 'sp-theme-guard' : 'sp-theme'
}

function choiceKey(scope) {
  return scope === 'guard' ? 'sp-theme-choice-guard' : 'sp-theme-choice'
}

function resolveStartupTheme(primary) {
  const scope = scopeFor(primary)
  try {
    // Office still honours the legacy global choice key from the Day-primary flip.
    const chosen =
      localStorage.getItem(choiceKey(scope)) === '1' ||
      (scope === 'office' && localStorage.getItem('sp-theme-choice') === '1')
    if (!chosen) return primary
    const raw = localStorage.getItem(themeKey(scope)) || (scope === 'office' ? localStorage.getItem('sp-theme') : null)
    const mapped = THEME_ALIASES[raw] || raw
    return VALID_IDS.has(mapped) ? mapped : primary
  } catch {
    return primary
  }
}

function themeColorFor(id) {
  if (id === 'day') return '#f4f4f4'
  if (id === 'night') return '#000000'
  return getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim()
}

function themesForPrimary(primary) {
  if (primary === 'night') {
    return [
      { ...NIGHT, hint: NIGHT.primaryHint },
      DAY,
    ]
  }
  return [
    { ...DAY, hint: DAY.primaryHint },
    NIGHT,
  ]
}

/**
 * Theme mood dropdown — Night/Day appearance.
 * @param {'up'|'down'} menuPlacement — sidebar opens up; top bar opens down
 * @param {'day'|'night'} primary — portal default (day for admin/client, night for guard)
 */
export default function ThemeSwitcher({ menuPlacement = 'up', primary = 'day' }) {
  const [theme, setTheme] = useState(() => resolveStartupTheme(primary))
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const opensDown = menuPlacement === 'down'
  const scope = scopeFor(primary)
  const options = themesForPrimary(primary)

  // Re-apply portal primary when switching shells without an explicit pick.
  useEffect(() => {
    setTheme(resolveStartupTheme(primary))
  }, [primary])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(themeKey(scope), theme)
      if (scope === 'office') localStorage.setItem('sp-theme', theme)
    } catch {
      /* Safari private mode */
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const color = themeColorFor(theme)
      if (color) meta.setAttribute('content', color)
    }
    const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (status) status.setAttribute('content', theme === 'night' ? 'black-translucent' : 'default')
  }, [theme, scope])

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

  const pickTheme = (id) => {
    setTheme(id)
    setOpen(false)
    try {
      localStorage.setItem(choiceKey(scope), '1')
      if (scope === 'office') localStorage.setItem('sp-theme-choice', '1')
    } catch {
      /* Safari private mode */
    }
  }

  const current = options.find((t) => t.id === theme) || options[0]

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
          <div>
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
              Appearance
            </p>
            {options.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={t.id === theme}
                onClick={() => pickTheme(t.id)}
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
        </div>
      )}
    </div>
  )
}
