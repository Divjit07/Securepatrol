import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { PALETTE } from '../lib/brandPalette.js'

export const THEME_GROUPS = [
  {
    label: 'Surface',
    themes: [
      {
        id: 'studio',
        label: 'Studio Glass',
        dot: `linear-gradient(135deg, ${PALETTE.gray}, ${PALETTE.graphite})`,
      },
    ],
  },
  {
    label: 'Dark',
    themes: [
      { id: 'forest', label: 'Forest', dot: PALETTE.lime },
      { id: 'matte', label: 'Matte Black', dot: '#171717' },
      { id: 'graphite', label: 'Graphite', dot: PALETTE.graphite },
    ],
  },
  {
    label: 'Light',
    themes: [
      { id: 'sky', label: 'Sky', dot: PALETTE.sky },
      { id: 'ivory', label: 'Ivory', dot: 'linear-gradient(135deg, #fbf9f4, #e6ddcc)' },
    ],
  },
]

const ALL_THEMES = THEME_GROUPS.flatMap((g) => g.themes)

/** Theme mood dropdown — accent-led palettes + optional Studio Glass surface.
 *  @param {'up'|'down'} menuPlacement — sidebar opens up; top bar opens down */
export default function ThemeSwitcher({ menuPlacement = 'up' }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('sp-theme')
      // Retired moods (moss, lagoon, meadow, …) fall back to the default.
      return ALL_THEMES.some((t) => t.id === saved) ? saved : 'forest'
    } catch {
      return 'forest'
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
      const color = theme === 'studio'
        ? '#CBCDCE'
        : getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim()
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

  const current = ALL_THEMES.find((t) => t.id === theme) || ALL_THEMES.find((t) => t.id === 'forest')

  const panelClass = opensDown
    ? 'theme-picker-panel theme-picker-panel--down animate-rise absolute left-0 top-full z-50 mt-2 max-h-[70dvh] w-full min-w-[14rem] origin-top overflow-y-auto'
    : 'theme-picker-panel animate-rise absolute bottom-full left-0 z-50 mb-2 max-h-[70dvh] w-full origin-bottom overflow-y-auto'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 transition hover:bg-white/5 hover:text-ink"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
          style={{ background: current.dot }}
        />
        <span className="flex-1 text-left">{current.label}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-ink-3" />
      </button>

      {open && (
        <div role="listbox" className={panelClass}>
          {THEME_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
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
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
                    style={{ background: t.dot }}
                  />
                  <span className="flex-1 text-left">{t.label}</span>
                  {t.id === theme && <Check className="h-3.5 w-3.5 text-accent-orange" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
