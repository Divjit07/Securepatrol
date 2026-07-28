import { useEffect, useRef } from 'react'

/**
 * Magic UI–style particle field (canvas). Lime sparks on Dark Ops canvas.
 * Pauses when off-screen or prefers-reduced-motion.
 */
export default function Particles({
  className = '',
  quantity = 48,
  color = '#96ee60',
  speed = 0.35,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0
    let h = 0
    let raf = 0
    let running = true
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const particles = Array.from({ length: quantity }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 0,
      a: 0,
    }))

    const resize = () => {
      const parent = canvas.parentElement
      w = parent?.clientWidth || window.innerWidth
      h = parent?.clientHeight || window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      for (const p of particles) {
        p.x = Math.random() * w
        p.y = Math.random() * h
        p.vx = (Math.random() - 0.5) * speed
        p.vy = (Math.random() - 0.5) * speed - 0.05
        p.r = Math.random() * 1.6 + 0.4
        p.a = Math.random() * 0.45 + 0.08
      }
    }

    const drawStatic = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        ctx.beginPath()
        ctx.fillStyle = color
        ctx.globalAlpha = p.a * 0.7
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const tick = () => {
      if (!running) return
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -4) p.x = w + 4
        if (p.x > w + 4) p.x = -4
        if (p.y < -4) p.y = h + 4
        if (p.y > h + 4) p.y = -4
        ctx.beginPath()
        ctx.fillStyle = color
        ctx.globalAlpha = p.a
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(tick)
    }

    const onVis = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!reduced) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }

    resize()
    if (reduced) {
      drawStatic()
    } else {
      raf = requestAnimationFrame(tick)
    }

    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [quantity, color, speed])

  return <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden />
}
