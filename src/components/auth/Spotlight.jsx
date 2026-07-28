import { useEffect, useRef, useState } from 'react'

/**
 * React Bits–style cursor spotlight. Soft lime wash that follows the pointer.
 * Listens on the parent stage so the overlay can stay pointer-events: none.
 */
export default function Spotlight({
  className = '',
  size = 520,
  color = 'rgba(150, 238, 96, 0.14)',
}) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x: 50, y: 40 })
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const stage = el.parentElement
    if (!stage) return undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined

    const move = (e) => {
      const r = stage.getBoundingClientRect()
      setPos({
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      })
      setOn(true)
    }
    const leave = () => setOn(false)

    stage.addEventListener('pointermove', move)
    stage.addEventListener('pointerleave', leave)
    return () => {
      stage.removeEventListener('pointermove', move)
      stage.removeEventListener('pointerleave', leave)
    }
  }, [])

  return (
    <div ref={ref} className={`pointer-events-none absolute inset-0 z-[1] ${className}`} aria-hidden>
      <div
        className="kratos-auth-spotlight"
        style={{
          width: size,
          height: size,
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
          opacity: on ? 1 : 0.35,
        }}
      />
    </div>
  )
}
