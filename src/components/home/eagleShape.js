/**
 * The Kronus eagle — one geometric source of truth.
 *
 * The eagle is the brand ambassador: watchful, fearless, and the thing that signs
 * off a record. Because it has to appear both as DOM/SVG chrome and as ink inside
 * the WebGL document texture, the mark lives here as plain polygon data and each
 * renderer draws the same coordinates.
 *
 * Coordinate space is 0–64 on both axes, symmetric about x = 32. Built as an
 * insignia rather than an illustration: stepped primaries, a heavy brow, and a
 * hooked beak, so it survives down to ~18px in the masthead.
 */

/**
 * Profile raptor head facing left. A head-on eagle reads as an insect at small
 * sizes; the profile carries the two cues nothing else does — the hooked beak and
 * the heavy brow over a hard eye.
 */
const HEAD = [
  [4, 27], // beak tip
  [11, 20], // upper mandible rising to the face
  [21, 15.5], // cere
  [26, 11.5], // brow shelf — the overhang the eye sits under
  [33, 8.5],
  [43, 7], // crown
  [49.5, 9.5],
  // Swept crest feathers. A smooth skull reads as a parrot; the raked points at
  // the back of the head are the cue that says raptor before anything else does.
  [60, 15],
  [50, 19],
  [61, 26],
  [49, 28.5],
  [57, 37],
  [44, 35.5],
  [38, 43], // jaw, back
  [29, 44],
  [24, 37],
  [23, 33], // gape corner
  [14, 32], // lower mandible
  [8, 38], // the hook, barbed well below the tip
]

/** Every filled polygon of the mark, in paint order. */
export const EAGLE_POLYGONS = [HEAD]

/**
 * Negative space. The eye is round and set under the crown's overhang — an eagle's
 * fierceness is the brow, not a slanted slit. The cere line is what stops the beak
 * reading as part of the skull.
 */
export const EAGLE_CUTOUTS = [
  // Eye, tucked under the brow shelf
  [
    [32, 16.6],
    [34.6, 17.7],
    [35.7, 20.3],
    [34.6, 22.9],
    [32, 24],
    [29.4, 22.9],
    [28.3, 20.3],
    [29.4, 17.7],
  ],
  // Cere — beak against face
  [
    [19.4, 16],
    [22.9, 26.3],
    [21.2, 27.1],
    [17.7, 16.8],
  ],
  // Nostril
  [
    [13.2, 23.2],
    [15.4, 24],
    [15, 25.5],
    [12.8, 24.7],
  ],
  // One nape notch — feathering, not stripes
  [
    [40, 26.5],
    [46.5, 29.5],
    [45.7, 31.7],
    [39.2, 28.7],
  ],
]

export const EAGLE_VIEWBOX = 64

/** `d` attribute for an SVG path — all polygons in one fill. */
export function eaglePathData(polygons = EAGLE_POLYGONS) {
  return polygons
    .map((poly) => `M${poly.map(([x, y]) => `${x} ${y}`).join('L')}Z`)
    .join('')
}

/**
 * Draws the mark into a 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x left edge
 * @param {number} y top edge
 * @param {number} size rendered width/height in canvas units
 * @param {string} color fill
 * @param {string} [cutColor] colour painted back into the eye notches
 */
export function paintEagle(ctx, x, y, size, color, cutColor) {
  const s = size / EAGLE_VIEWBOX
  const tx = (px) => x + px * s
  const ty = (py) => y + py * s

  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  EAGLE_POLYGONS.forEach((poly) => {
    poly.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(tx(px), ty(py))
      else ctx.lineTo(tx(px), ty(py))
    })
    ctx.closePath()
  })
  ctx.fill()

  if (cutColor) {
    ctx.fillStyle = cutColor
    ctx.beginPath()
    EAGLE_CUTOUTS.forEach((poly) => {
      poly.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(tx(px), ty(py))
        else ctx.lineTo(tx(px), ty(py))
      })
      ctx.closePath()
    })
    ctx.fill()
  }
  ctx.restore()
}
