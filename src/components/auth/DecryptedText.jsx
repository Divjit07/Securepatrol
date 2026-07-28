import { useEffect, useState } from 'react'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789░▒▓#@$%&*'

/**
 * React Bits–style decrypt reveal for headlines.
 */
export default function DecryptedText({
  text,
  className = '',
  as: Tag = 'h1',
  speed = 28,
  revealDelay = 40,
}) {
  const [out, setOut] = useState(text)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setOut(text)
      return undefined
    }

    let frame = 0
    let revealed = 0
    let raf = 0
    let last = 0

    const tick = (t) => {
      if (t - last < speed) {
        raf = requestAnimationFrame(tick)
        return
      }
      last = t
      frame += 1

      if (frame % 2 === 0) revealed = Math.min(text.length, revealed + 1)

      let next = ''
      for (let i = 0; i < text.length; i += 1) {
        if (text[i] === ' ') {
          next += ' '
        } else if (i < revealed) {
          next += text[i]
        } else {
          next += GLYPHS[(Math.random() * GLYPHS.length) | 0]
        }
      }
      setOut(next)

      if (revealed < text.length) {
        raf = requestAnimationFrame(tick)
      } else {
        setOut(text)
      }
    }

    const start = window.setTimeout(() => {
      raf = requestAnimationFrame(tick)
    }, revealDelay)

    return () => {
      window.clearTimeout(start)
      cancelAnimationFrame(raf)
    }
  }, [text, speed, revealDelay])

  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </Tag>
  )
}
