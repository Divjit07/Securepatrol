import L from 'leaflet'

/**
 * Coverage heat layer — where the building actually gets walked.
 *
 * Written rather than pulled from leaflet.heat for two reasons: the stock
 * plugin ships a rainbow ramp that fights everything in the Dark Ops palette,
 * and it has no notion of a point's *weight*. Here a checkpoint hit ten times
 * burns brighter than one hit once, which is the entire question an operator is
 * asking — not "where are there dots" but "where does the patrol actually go".
 *
 * Technique is the standard two-pass one: stamp a radial alpha gradient per
 * point into an offscreen canvas so overlapping points accumulate, then map the
 * accumulated alpha through a colour ramp. Cheap enough to repaint on every pan.
 */

// Cold (rarely walked) → hot (well covered). Sampled from the brand ramp so the
// map reads as part of the product, not a data-viz bolt-on.
const RAMP = [
  [0.0, [12, 26, 20, 0]],       // transparent
  [0.25, [45, 92, 120, 90]],    // deep sky — thin coverage
  [0.45, [127, 208, 159, 150]], // moss
  [0.65, [150, 238, 96, 200]],  // lime
  [0.85, [236, 250, 181, 230]], // meadow
  [1.0, [255, 255, 255, 245]],  // saturated core
]

function buildRampLut() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 1
  const ctx = c.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 256, 0)
  for (const [stop, [r, g, b, a]] of RAMP) {
    grad.addColorStop(stop, `rgba(${r},${g},${b},${a / 255})`)
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 1)
  return ctx.getImageData(0, 0, 256, 1).data
}

/** One reusable radial stamp; scaling it per-point is far cheaper than redrawing gradients. */
function buildStamp(radius, blur) {
  const c = document.createElement('canvas')
  const r = radius + blur
  c.width = c.height = r * 2
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, r * 2, r * 2)
  return c
}

export const HeatLayer = L.Layer.extend({
  options: {
    radius: 26,
    blur: 18,
    minOpacity: 0.15,
    maxZoom: 19,
  },

  initialize(points, options) {
    // points: [{ lat, lng, weight }]
    this._points = points || []
    L.setOptions(this, options)
  },

  setPoints(points) {
    this._points = points || []
    this._redraw()
    return this
  },

  onAdd(map) {
    this._map = map
    if (!this._canvas) {
      const canvas = L.DomUtil.create('canvas', 'kr-heat-layer')
      canvas.style.position = 'absolute'
      canvas.style.pointerEvents = 'none'
      // Screen blend keeps the tiles readable underneath instead of caking over them.
      canvas.style.mixBlendMode = 'screen'
      this._canvas = canvas
      this._ctx = canvas.getContext('2d')
      this._lut = buildRampLut()
      this._stamp = buildStamp(this.options.radius, this.options.blur)
    }
    map.getPanes().overlayPane.appendChild(this._canvas)
    map.on('moveend zoomend resize', this._redraw, this)
    this._reset()
  },

  onRemove(map) {
    if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas)
    map.off('moveend zoomend resize', this._redraw, this)
    this._map = null
  },

  _reset() {
    const map = this._map
    if (!map || !this._canvas) return
    const size = map.getSize()
    const topLeft = map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this._canvas, topLeft)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this._canvas.width = size.x * dpr
    this._canvas.height = size.y * dpr
    this._canvas.style.width = `${size.x}px`
    this._canvas.style.height = `${size.y}px`
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this._redraw()
  },

  _redraw() {
    const map = this._map
    if (!map || !this._ctx) return

    const size = map.getSize()
    const ctx = this._ctx
    ctx.clearRect(0, 0, size.x, size.y)
    if (!this._points.length) return

    // Pass 1 — accumulate alpha. Zooming in spreads the same evidence over more
    // pixels, so scale the stamp with zoom or the heat collapses to pinpricks.
    const zoomScale = Math.max(0.55, Math.min(2.2, map.getZoom() / 16))
    const maxWeight = Math.max(...this._points.map((p) => p.weight || 1), 1)

    for (const p of this._points) {
      const pt = map.latLngToContainerPoint([p.lat, p.lng])
      if (pt.x < -80 || pt.y < -80 || pt.x > size.x + 80 || pt.y > size.y + 80) continue
      const intensity = Math.max(this.options.minOpacity, (p.weight || 1) / maxWeight)
      const r = (this.options.radius + this.options.blur) * zoomScale
      ctx.globalAlpha = intensity
      ctx.drawImage(this._stamp, pt.x - r, pt.y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1

    // Pass 2 — map accumulated alpha through the ramp.
    const img = ctx.getImageData(0, 0, this._canvas.width, this._canvas.height)
    const data = img.data
    const lut = this._lut
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]
      if (alpha === 0) continue
      const j = alpha * 4
      data[i] = lut[j]
      data[i + 1] = lut[j + 1]
      data[i + 2] = lut[j + 2]
      data[i + 3] = lut[j + 3]
    }
    ctx.putImageData(img, 0, 0)
  },
})

export function heatLayer(points, options) {
  return new HeatLayer(points, options)
}

/**
 * Collapse raw scans into weighted heat points. Coordinates repeat almost
 * exactly at a fixed checkpoint, so binning by rounded position turns "200 dots
 * stacked on one door" into one hot point with weight 200.
 */
export function scansToHeatPoints(scans, precision = 5) {
  const bins = new Map()
  for (const s of scans) {
    if (s.guard_lat == null || s.guard_lng == null) continue
    const key = `${s.guard_lat.toFixed(precision)},${s.guard_lng.toFixed(precision)}`
    const hit = bins.get(key)
    if (hit) hit.weight += 1
    else bins.set(key, { lat: s.guard_lat, lng: s.guard_lng, weight: 1 })
  }
  return [...bins.values()]
}
