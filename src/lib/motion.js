// Shared motion primitives for the 2026 remaster (Apple Bento × Command Deck).
// "Balanced" tier: a single stagger reveal on mount, plus honest reduced-motion
// fallbacks. Uses useLayoutEffect so tiles never flash at full opacity first.
import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Stagger-reveal every [data-reveal] descendant of the returned ref on mount.
 * Attach the ref to a container and add `data-reveal` to each child tile.
 * Respects prefers-reduced-motion (snaps visible, no animation).
 */
export function useReveal({ y = 16, stagger = 0.06, duration = 0.5, deps = [] } = {}) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return undefined
    const targets = root.querySelectorAll('[data-reveal]')
    if (!targets.length) return undefined
    if (prefersReduced()) {
      gsap.set(targets, { opacity: 1, y: 0 })
      return undefined
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration,
          ease: 'back.out(1.4)',
          stagger: { each: stagger, from: 'start' },
          clearProps: 'transform',
        },
      )
    }, root)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}
