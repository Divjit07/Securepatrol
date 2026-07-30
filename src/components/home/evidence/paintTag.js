/**
 * Draws the face of a checkpoint tag onto a canvas, used as the sticker texture
 * in the Evidence Table. It carries the same fields the real printed label
 * carries — reference, floor, coordinates, radius — so the object on the table
 * is the object described in the caption beside it.
 *
 * No QR pattern is drawn: a decorative grid of squares that no scanner could
 * read would be the one dishonest pixel on a page arguing that records do not lie.
 */

/**
 * Everything below is laid out on a 512pt grid but painted into a 1024px
 * texture, because the tag is the one 3D object left on the table and its
 * small print has to survive being read at an angle.
 */
const DESIGN = 512
const SIZE = 1024

const MARK_X = 118
const MARK_Y = 268

/** Outermost printed arc, in design points — where a read pulse should start. */
const MARK_REACH = 100

/**
 * The NFC mark as UV on the face, so the animated read pulse in the 3D scene
 * can be centred on the arcs that are actually printed there. Exported from
 * this file because these numbers only mean anything next to the drawing code.
 */
export const TAG_MARK = {
  u: MARK_X / DESIGN,
  v: MARK_Y / DESIGN,
  reach: MARK_REACH / DESIGN,
}

export function paintTag(ctx) {
  const s = DESIGN
  ctx.setTransform(SIZE / DESIGN, 0, 0, SIZE / DESIGN, 0, 0)
  ctx.clearRect(0, 0, s, s)

  // Stock
  ctx.fillStyle = '#e4e3dc'
  ctx.fillRect(0, 0, s, s)

  // Lime header band
  ctx.fillStyle = '#7cc94e'
  ctx.fillRect(0, 0, s, 74)

  ctx.fillStyle = '#0f1209'
  ctx.font = '700 34px Archivo, "Helvetica Neue", sans-serif'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = '4px'
  ctx.fillText('KRONUS', 26, 39)

  ctx.font = '600 20px "SF Mono", ui-monospace, monospace'
  ctx.letterSpacing = '1px'
  ctx.textAlign = 'right'
  ctx.fillText('CHECKPOINT', s - 26, 40)
  ctx.textAlign = 'left'
  ctx.letterSpacing = '0px'

  // The NFC mark — concentric arcs radiating from the lower left, the way the
  // symbol is drawn on a real tag.
  const cx = MARK_X
  const cy = MARK_Y
  ctx.strokeStyle = '#12150e'
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath()
    ctx.lineWidth = 13 - i * 1.2
    ctx.arc(cx, cy, 22 + i * 26, -Math.PI * 0.34, Math.PI * 0.34)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.fillStyle = '#12150e'
  ctx.arc(cx - 6, cy, 10, 0, Math.PI * 2)
  ctx.fill()

  // Reference block
  ctx.fillStyle = '#171a12'
  ctx.font = '700 60px Archivo, "Helvetica Neue", sans-serif'
  ctx.fillText('CP-04', 250, 214)

  ctx.fillStyle = '#4a5040'
  ctx.font = '500 25px "SF Mono", ui-monospace, monospace'
  ctx.fillText('LEVEL 4', 252, 264)
  ctx.fillText('EAST STAIR', 252, 300)

  // Hairline
  ctx.strokeStyle = 'rgba(23,26,18,0.22)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(26, 366)
  ctx.lineTo(s - 26, 366)
  ctx.stroke()

  // Coordinates and radius — the fields that make a scan verifiable
  ctx.fillStyle = '#4a5040'
  ctx.font = '500 23px "SF Mono", ui-monospace, monospace'
  ctx.fillText('43.6629 N  79.4103 W', 26, 404)
  ctx.fillText('RADIUS', 26, 446)
  ctx.fillStyle = '#171a12'
  ctx.font = '700 23px "SF Mono", ui-monospace, monospace'
  ctx.fillText('20 m', 134, 446)

  ctx.fillStyle = '#4a5040'
  ctx.font = '500 23px "SF Mono", ui-monospace, monospace'
  ctx.textAlign = 'right'
  ctx.fillText('NTAG 213', s - 26, 404)
  ctx.fillText('DO NOT REMOVE', s - 26, 446)
  ctx.textAlign = 'left'

  // Edge
  ctx.strokeStyle = 'rgba(23,26,18,0.3)'
  ctx.lineWidth = 3
  ctx.strokeRect(1.5, 1.5, s - 3, s - 3)
}

export const TAG_SIZE = SIZE
