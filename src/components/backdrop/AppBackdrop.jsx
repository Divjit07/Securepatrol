// Client-portal backdrop. A CSS perspective grid paints instantly (and is the
// only layer on phones, slow links, or prefers-reduced-motion); the WebGL floor
// loads on idle and cross-fades in on top of it.
import { Component, lazy, Suspense, useEffect, useState } from 'react'

const CommandGrid = lazy(() =>
  import('./CommandGrid.jsx').catch(() => ({ default: () => null })),
)

/** A failed shader must cost nothing — drop the layer, keep the page. */
class GridGate extends Component {
  state = { ok: true }
  static getDerivedStateFromError() {
    return { ok: false }
  }
  componentDidCatch() {}
  render() {
    return this.state.ok ? this.props.children : null
  }
}

const TONES = {
  night: {
    cell: '#2f8a55',
    section: '#5ee88a',
    depth: '#9df0c4',
    opacity: 0.95,
    speed: 0.9,
    glow: 0.8,
  },
  day: {
    cell: '#7d8c83',
    section: '#16a34a',
    depth: '#8fa3ae',
    opacity: 0.6,
    speed: 0.75,
    glow: 0.5,
  },
}

function useThemeId() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'night',
  )
  useEffect(() => {
    const el = document.documentElement
    const read = () => setTheme(el.dataset.theme || 'night')
    read()
    const observer = new MutationObserver(read)
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

function supportsWebgl() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Desktop, willing hardware, real motion budget — otherwise CSS only. */
function useWebglLayer() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const wide = window.matchMedia('(min-width: 1024px)')
    const link = navigator.connection
    const thrifty =
      link?.saveData === true || /2g/.test(link?.effectiveType || '')

    const evaluate = () => {
      const allowed =
        wide.matches && !motion.matches && !thrifty && supportsWebgl()
      if (!allowed) {
        setEnabled(false)
        return
      }
      const start = () => setEnabled(true)
      if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 2500 })
      else window.setTimeout(start, 1200)
    }

    evaluate()
    motion.addEventListener?.('change', evaluate)
    wide.addEventListener?.('change', evaluate)
    return () => {
      motion.removeEventListener?.('change', evaluate)
      wide.removeEventListener?.('change', evaluate)
    }
  }, [])

  return enabled
}

export default function AppBackdrop() {
  const theme = useThemeId()
  const webgl = useWebglLayer()
  const [live, setLive] = useState(false)
  const tone = TONES[theme] || TONES.night

  useEffect(() => {
    if (!webgl) setLive(false)
  }, [webgl])

  return (
    <div className="app-backdrop" aria-hidden>
      <div
        className="app-backdrop-css"
        style={{ opacity: live ? 0 : 1 }}
      />
      {webgl && (
        <div className="app-backdrop-gl" style={{ opacity: live ? 1 : 0 }}>
          <GridGate>
            <Suspense fallback={null}>
              <CommandGrid
                cellColor={tone.cell}
                sectionColor={tone.section}
                depthColor={tone.depth}
                opacity={tone.opacity}
                speed={tone.speed}
                glow={tone.glow}
                onReady={() => setLive(true)}
              />
            </Suspense>
          </GridGate>
        </div>
      )}
      <div className="app-backdrop-horizon" />
      <div className="app-backdrop-veil" />
    </div>
  )
}
