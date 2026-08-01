import { lazy, Suspense, useEffect, useState } from 'react'

// three + its post-processing passes are ~600KB — keep them out of the app shell
// bundle so the admin portal's first paint does not pay for a cursor effect.
const GhostCursor = lazy(() =>
  import('./GhostCursor.jsx').catch(() => ({ default: () => null })),
)

/**
 * The React Bits ghost-cursor trail, scoped to the admin portal.
 *
 * Rendered inside <main> rather than as a fixed overlay: GhostCursor binds its
 * pointer listeners to its parent element, so a pointer-events:none wrapper
 * would silently never receive a pointermove.
 *
 * Skipped entirely on touch (no cursor to trail, and it would burn battery) and
 * under prefers-reduced-motion.
 */
export default function AdminCursorEffect() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const evaluate = () => setEnabled(fine.matches && !still.matches)

    evaluate()
    fine.addEventListener?.('change', evaluate)
    still.addEventListener?.('change', evaluate)
    return () => {
      fine.removeEventListener?.('change', evaluate)
      still.removeEventListener?.('change', evaluate)
    }
  }, [])

  if (!enabled) return null

  return (
    <Suspense fallback={null}>
      <GhostCursor
        // Visuals
        color="#B497CF"
        brightness={2}
        edgeIntensity={0}
        // Trail and motion
        trailLength={50}
        inertia={0.5}
        // Post-processing
        grainIntensity={0.05}
        bloomStrength={0.1}
        bloomRadius={1}
        bloomThreshold={0.025}
        // Fade-out behavior
        fadeDelayMs={1000}
        fadeDurationMs={1500}
      />
    </Suspense>
  )
}
