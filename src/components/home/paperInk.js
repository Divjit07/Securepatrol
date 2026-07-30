/**
 * The house stock. Every Kronus document painted onto a canvas — the patrol
 * verification report, the incident report — is set on this paper, in these
 * inks, at this margin, so the family reads as one filing system rather than
 * as unrelated drawings that happen to be beige.
 *
 * DOM equivalents of these values live in `src/index.css` as the `--kr-paper-*`
 * tokens. If one moves, move the other.
 */

export const SHEET_W = 1000
export const SHEET_H = 1414 // √2, so the sheet is a real A-series page

export const PAPER = '#f7f6f2'
export const INK = '#171a12'
export const INK_2 = '#585f4c'
export const INK_3 = '#8c9179'
export const RULE = 'rgba(23, 26, 18, 0.14)'
export const VERIFIED = '#2f7d34'
export const ALERT = '#b3261e'

export const MONO = '"SF Mono", "JetBrains Mono", Menlo, monospace'
export const DISPLAY = 'Archivo, "Instrument Sans", sans-serif'
export const BODY = '"DM Sans", sans-serif'

export const M = 76 // page margin

export function label(ctx, text, x, y, size = 17, spacing = 2.4) {
  ctx.font = `600 ${size}px ${DISPLAY}`
  ctx.fillStyle = INK_3
  ctx.letterSpacing = `${spacing}px`
  ctx.fillText(text.toUpperCase(), x, y)
  ctx.letterSpacing = '0px'
}

export function rule(ctx, y, x1 = M, x2 = SHEET_W - M, color = RULE, width = 1) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y + 0.5)
  ctx.lineTo(x2, y + 0.5)
  ctx.stroke()
}

/** Paper fibre. Subtle enough to read as stock, not as noise. */
export function grain(ctx) {
  const n = 2600
  for (let i = 0; i < n; i++) {
    const x = Math.random() * SHEET_W
    const y = Math.random() * SHEET_H
    const a = Math.random() * 0.035
    ctx.fillStyle = `rgba(23, 26, 18, ${a})`
    ctx.fillRect(x, y, 1.5, 1.5)
  }
}

/**
 * Lays `text` out inside `width` and returns the y the next block starts at.
 * `reveal` (0..1) types the paragraph on by character, so a document can write
 * itself without the layout reflowing as it goes.
 */
export function paragraph(ctx, text, x, y, width, lineH, reveal = 1) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  words.forEach((w) => {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > width && line) {
      lines.push(line)
      line = w
    } else {
      line = next
    }
  })
  if (line) lines.push(line)

  const budget = Math.round(text.length * Math.max(0, Math.min(1, reveal)))
  let used = 0
  lines.forEach((l, i) => {
    const left = budget - used
    if (left <= 0) return
    ctx.fillText(left >= l.length ? l : l.slice(0, left), x, y + lineH * i)
    used += l.length + 1
  })

  return y + lineH * lines.length
}
