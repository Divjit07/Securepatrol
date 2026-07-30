import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { paintReport, SHEET_W, SHEET_H } from './paintReport.js'

/**
 * The client's report as a real sheet of paper standing in the operator's dark room.
 *
 * This is the page's one authored moment: the record assembling itself. Rows land on
 * the stock as scans come in, the VERIFIED stamp sets only once the record is
 * complete, and the sheet holds a genuine curl so the key light rakes across it.
 *
 * The document's accessible text lives in ReportSheet.jsx. This canvas is
 * decorative (aria-hidden) and is never the only way to read the record.
 */

const SHEET_H_UNITS = 4.6
const SHEET_W_UNITS = SHEET_H_UNITS * (SHEET_W / SHEET_H)

function Sheet({ progressRef, pointerRef }) {
  const meshRef = useRef(null)
  const groupRef = useRef(null)
  const { invalidate } = useThree()

  // The document is drawn to a 2D canvas and used as the sheet's colour map.
  const { texture, ctx, canvas } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = SHEET_W
    c.height = SHEET_H
    const context = c.getContext('2d')
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return { texture: t, ctx: context, canvas: c }
  }, [])

  const paintedAt = useRef(-1)

  // Repaint once webfonts land, otherwise the first paint uses fallback metrics.
  useEffect(() => {
    let alive = true
    const repaint = () => {
      if (!alive) return
      paintedAt.current = -1
      invalidate()
    }
    if (document.fonts?.ready) document.fonts.ready.then(repaint)
    return () => {
      alive = false
    }
  }, [invalidate])

  useEffect(() => () => texture.dispose(), [texture])

  // Flat plane, displaced on the CPU so the sheet can hold a curl and settle.
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(SHEET_W_UNITS, SHEET_H_UNITS, 40, 56),
    [],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  const base = useMemo(() => geometry.attributes.position.array.slice(), [geometry])
  const settle = useRef(1)

  useFrame((state, delta) => {
    const p = progressRef.current

    // Repaint the document only when the record actually advances a row.
    const step = Math.round(p * 64) / 64
    if (step !== paintedAt.current) {
      paintReport(ctx, p)
      texture.needsUpdate = true
      paintedAt.current = step
    }

    // The sheet drops into place once, then breathes.
    settle.current = Math.max(0, settle.current - delta * 0.55)
    const s = settle.current * settle.current
    const t = state.clock.elapsedTime

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
      // Light pointer parallax — the sheet turns toward the reader, never spins.
      g.rotation.y += (px * 0.16 - 0.14 - g.rotation.y) * Math.min(1, delta * 3)
      g.rotation.x += (-py * 0.1 + 0.02 - g.rotation.x) * Math.min(1, delta * 3)
      g.position.y = Math.sin(t * 0.42) * 0.055 - s * 0.9
      g.rotation.z = -0.012 + Math.sin(t * 0.31) * 0.006 + s * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={geometry} castShadow>
        <meshStandardMaterial
          map={texture}
          roughness={0.82}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function Lights() {
  return (
    <>
      {/* Ambient sits low: this is a dark room with one desk lamp on the page. */}
      <ambientLight intensity={0.55} color="#cfd8c4" />
      {/* Key light, upper left, slightly warm — the lamp. */}
      <directionalLight position={[-3.4, 4.2, 5.2]} intensity={2.3} color="#fffaf0" />
      {/* Lime rim from the operator's screens, off to the right. */}
      <pointLight position={[4.6, -1.4, 2.6]} intensity={9} distance={14} color="#96ee60" />
      {/* Cool bounce so the shaded side never goes muddy. */}
      <pointLight position={[-2.2, -3.2, 3.4]} intensity={3.2} distance={12} color="#8fb0d8" />
    </>
  )
}

export default function PaperCanvas({ progressRef }) {
  const pointerRef = useRef({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const onMove = (e) => {
      pointerRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 transition-opacity duration-1000 ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6.4], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={() => setReady(true)}
      >
        <Lights />
        <Sheet progressRef={progressRef} pointerRef={pointerRef} />
      </Canvas>
    </div>
  )
}
