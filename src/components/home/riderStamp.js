/**
 * The rider mark as a canvas stamp — the painted-document counterpart to
 * <RiderMark>. Replaces paintEagle from eagleShape.js.
 *
 * The mark is a raster silhouette rather than polygons, so it cannot be filled
 * with ctx.fill(). Instead the mask is composited into an offscreen canvas and
 * tinted with `source-in`, which yields the same "takes the ink of the page"
 * behaviour. Tinted copies are cached — the documents repaint on every scroll
 * step and re-tinting each frame would show up in the frame budget.
 */
const SRC = '/brand/kronus-rider-mask-tight.png'

let image = null
let ready = false
const waiting = new Set()
const cache = new Map()

function load() {
  if (image || typeof window === 'undefined') return
  image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    ready = true
    waiting.forEach((cb) => cb())
    waiting.clear()
  }
  image.onerror = () => {
    // A missing mark must not stop the document from painting.
    image = null
  }
  image.src = SRC
}
load()

/** Register a repaint callback for when the mark lands. Returns an unsubscribe. */
export function onRiderReady(cb) {
  if (ready) {
    cb()
    return () => {}
  }
  waiting.add(cb)
  return () => waiting.delete(cb)
}

export function riderReady() {
  return ready
}

function tinted(size, color) {
  const key = `${size}|${color}`
  const hit = cache.get(key)
  if (hit) return hit

  const c = document.createElement('canvas')
  const px = Math.max(1, Math.ceil(size))
  c.width = px
  c.height = px
  const cx = c.getContext('2d')

  // Contain, so the silhouette keeps the artwork's proportions.
  const scale = Math.min(px / image.width, px / image.height)
  const w = image.width * scale
  const h = image.height * scale
  cx.drawImage(image, (px - w) / 2, (px - h) / 2, w, h)
  cx.globalCompositeOperation = 'source-in'
  cx.fillStyle = color
  cx.fillRect(0, 0, px, px)

  cache.set(key, c)
  return c
}

/**
 * Draw the mark into a 2D context. Signature matches the paintEagle it replaces.
 * No-ops until the mask has loaded; callers repaint via onRiderReady.
 */
export function paintRider(ctx, x, y, size, color) {
  if (!ready || !image) return
  // Cache at device resolution so the stamp stays crisp on the paper texture.
  const stamp = tinted(size * 3, color)
  ctx.drawImage(stamp, x, y, size, size)
}
