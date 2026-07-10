import { useEffect } from 'react'

/**
 * Locks page scroll while an overlay (modal / lightbox) is open, so the page
 * behind can't scroll-chain or rubber-band on mobile. Restores the previous
 * value on close, which keeps nested overlays (lightbox inside modal) safe.
 */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}
