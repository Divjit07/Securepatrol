import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SHEET_H, SHEET_W } from './paperInk.js'
import { onRiderReady } from './riderStamp.js'

/**
 * A Kronus document as an actual sheet of paper.
 *
 * The page is drawn to a 2D canvas and used as the colour map on a plane that
 * is displaced on the CPU, so the stock holds a curl, the key light rakes
 * across it, and the type bends with the paper instead of sitting on a flat
 * card. `paint` decides which document it is; everything here is about how the
 * sheet behaves, not what it says.
 *
 * Every caller is decorative — the readable copy of each document is DOM text
 * elsewhere (ReportSheet.jsx, Artifacts.jsx).
 */

export const SHEET_H_UNITS = 4.6
export const SHEET_W_UNITS = SHEET_H_UNITS * (SHEET_W / SHEET_H)

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Backing-store density for the document texture, over its 1000x1414 grid. */
const TEXTURE_SCALE = 1.7

/** One desk lamp in a dark room, with the operator's screens off to the right. */
export function PaperLights() {
  return (
    <>
      <ambientLight intensity={0.55} color="#cfd8c4" />
      {/* Key light, upper left, slightly warm — the lamp. */}
      <directionalLight position={[-3.4, 4.2, 5.2]} intensity={2.3} color="#fffaf0" />
      {/* Lime rim from the screens. */}
      <pointLight position={[4.6, -1.4, 2.6]} intensity={9} distance={14} color="#96ee60" />
      {/* Cool bounce so the shaded side never goes muddy. */}
      <pointLight position={[-2.2, -3.2, 3.4]} intensity={3.2} distance={12} color="#8fb0d8" />
    </>
  )
}

export function PaperMesh({
  paint,
  progressRef,
  pointerRef,
  /** Bump to drop the sheet in again — used when a station re-enters frame. */
  settleKey = 0,
  /** Bump to force a repaint when something the page draws has changed. */
  paintKey = 0,
  /** Resting yaw. Negative turns the right edge away from the reader. */
  yaw = -0.14,
  parallax = 0.16,
  /**
   * Radians the sheet arrives turned by, easing back to rest as it settles. The
   * hero spins each new document in; the evidence table's sheets do not, so this
   * defaults to no spin at all.
   */
  spin = 0,
  /** Height of the settle's decaying overshoot. 0 is the original glide-in. */
  bounce = 0,
  /** How fast a settle decays. Higher lands the sheet sooner. */
  settleRate = 0.55,
  /** 0..1 material opacity, for callers that cross-fade between documents. */
  opacityRef = null,
  /**
   * How many distinct states the document is painted in between empty and
   * complete. Each step is a full 2D redraw plus a 1000×1414 texture upload,
   * so this is the sheet's whole cost: the hero writes itself once over three
   * seconds and can afford 64, a station that writes on scrub cannot.
   */
  steps = 64,
}) {
  const meshRef = useRef(null)
  const groupRef = useRef(null)
  const matRef = useRef(null)
  const restYaw = useRef(yaw)
  const { invalidate } = useThree()

  const { texture, ctx } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = SHEET_W * TEXTURE_SCALE
    c.height = SHEET_H * TEXTURE_SCALE
    const context = c.getContext('2d')
    // Set once, never reset: the painters all use balanced save/restore, so
    // they go on addressing a 1000x1414 page while the pixels underneath are
    // 1.7x denser. Small print is where a document either looks real or looks
    // like a picture of one.
    context.scale(TEXTURE_SCALE, TEXTURE_SCALE)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 16
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    return { texture: t, ctx: context }
  }, [])

  const paintedAt = useRef(-1)

  // Repaint once webfonts land, otherwise the first paint uses fallback metrics.
  // The masthead mark is a raster stamp and arrives on its own schedule, so it
  // gets the same treatment — without this the first documents paint headerless.
  useEffect(() => {
    let alive = true
    const repaint = () => {
      if (!alive) return
      paintedAt.current = -1
      invalidate()
    }
    if (document.fonts?.ready) document.fonts.ready.then(repaint)
    const offRider = onRiderReady(repaint)
    return () => {
      alive = false
      offRider()
    }
  }, [invalidate])

  // A different document, or new material for the same one.
  useEffect(() => {
    paintedAt.current = -1
    invalidate()
  }, [paint, paintKey, invalidate])

  useEffect(() => () => texture.dispose(), [texture])

  // Flat plane, displaced on the CPU so the sheet can hold a curl and settle.
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(SHEET_W_UNITS, SHEET_H_UNITS, 56, 78),
    [],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  const base = useMemo(() => geometry.attributes.position.array.slice(), [geometry])
  const settle = useRef(1)

  useEffect(() => {
    settle.current = 1
    invalidate()
  }, [settleKey, invalidate])

  useFrame((state, delta) => {
    const p = progressRef.current

    // Repaint the document only when the record actually advances a row.
    const step = Math.round(p * steps) / steps
    if (step !== paintedAt.current) {
      paint(ctx, p)
      texture.needsUpdate = true
      paintedAt.current = step
    }

    // The sheet drops into place once, then breathes.
    settle.current = Math.max(0, settle.current - delta * settleRate)
    const s = settle.current * settle.current
    const t = state.clock.elapsedTime

    // Settle progress, 0 at arrival → 1 at rest, and a decaying oscillation over
    // it. Damped rather than a single ease, so the stock overshoots and comes
    // back the way a dropped sheet does instead of gliding into position.
    const u = 1 - settle.current
    const osc = Math.sin(u * Math.PI * 3.4) * Math.exp(-4.5 * u)

    const pos = geometry.attributes.position
    const arr = pos.array
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i]
      const y = base[i + 1]
      const nx = x / (SHEET_W_UNITS / 2)
      const ny = y / (SHEET_H_UNITS / 2)
      // A page held at its left edge bows away from the viewer on the right.
      const curl = 0.34 * nx * nx * (nx > 0 ? 1 : 0.45)
      // Faint slack across the stock, plus a bigger sway while it settles.
      const slack = Math.sin(ny * 2.1 + t * 0.5) * 0.045 * (1 - Math.abs(nx) * 0.4)
      const drop = s * (Math.sin(ny * 3.0 + t * 2.2) * 0.28 + nx * 0.35)
      arr[i + 2] = base[i + 2] - curl + slack + drop
    }
    pos.needsUpdate = true
    geometry.computeVertexNormals()

    if (groupRef.current) {
      const g = groupRef.current
      const { x: px, y: py } = pointerRef.current
      const k = Math.min(1, delta * 3)

      // Pointer parallax is chased; the arrival spin is not. A lerp chasing a
      // target that jumps by `spin` the instant a document swaps produces a
      // snap — it races out and drifts back. Driving the spin along its own
      // eased curve and only chasing the pointer keeps the arrival smooth.
      restYaw.current += (px * parallax + yaw - restYaw.current) * k
      g.rotation.y = restYaw.current + s * spin
      g.rotation.x += (-py * 0.1 + 0.02 - g.rotation.x) * k
      g.position.y = Math.sin(t * 0.42) * 0.055 - s * 0.9 + osc * bounce
      g.rotation.z = -0.012 + Math.sin(t * 0.31) * 0.006 + s * 0.05 + osc * bounce * 0.09
    }

    if (matRef.current && opacityRef) {
      matRef.current.opacity = clamp01(opacityRef.current)
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={geometry} castShadow>
        <meshStandardMaterial
          ref={matRef}
          map={texture}
          roughness={0.82}
          metalness={0}
          side={THREE.DoubleSide}
          transparent={opacityRef != null}
        />
      </mesh>
    </group>
  )
}
