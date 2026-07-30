import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * The eagle's view: a dark site field seen from above, checkpoint nodes pulsing as
 * passes land, drifting slowly under the whole page.
 *
 * This is background, not decoration for its own sake — it is the building the
 * record is written in. Kept cheap on purpose: one context, capped DPR, a single
 * merged line geometry and one points cloud, no post-processing, no shadows.
 */

const GRID = 26 // half-extent of the plan, in world units

function Plan() {
  const groupRef = useRef(null)

  // Site plan: a slab grid plus a few building footprints.
  const lines = useMemo(() => {
    const pts = []
    const step = 4
    for (let i = -GRID; i <= GRID; i += step) {
      pts.push(-GRID, 0, i, GRID, 0, i)
      pts.push(i, 0, -GRID, i, 0, GRID)
    }
    // Footprints — the buildings on the beat.
    const boxes = [
      [-14, -10, 9, 7],
      [4, -14, 11, 8],
      [10, 4, 8, 10],
      [-18, 6, 7, 9],
      [-3, 2, 6, 6],
    ]
    boxes.forEach(([x, z, w, d]) => {
      const h = 2.4 + ((w * d) % 5)
      const x2 = x + w
      const z2 = z + d
      // footprint
      pts.push(x, 0, z, x2, 0, z, x2, 0, z, x2, 0, z2)
      pts.push(x2, 0, z2, x, 0, z2, x, 0, z2, x, 0, z)
      // roof
      pts.push(x, h, z, x2, h, z, x2, h, z, x2, h, z2)
      pts.push(x2, h, z2, x, h, z2, x, h, z2, x, h, z)
      // uprights
      pts.push(x, 0, z, x, h, z)
      pts.push(x2, 0, z, x2, h, z)
      pts.push(x2, 0, z2, x2, h, z2)
      pts.push(x, 0, z2, x, h, z2)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])

  // Checkpoint nodes scattered across the plan.
  const nodes = useMemo(() => {
    const pts = []
    let s = 20260724
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
    for (let i = 0; i < 46; i++) {
      pts.push((rnd() - 0.5) * GRID * 1.9, rnd() * 2.6, (rnd() - 0.5) * GRID * 1.9)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])

  useEffect(
    () => () => {
      lines.dispose()
      nodes.dispose()
    },
    [lines, nodes],
  )

  useFrame((state, delta) => {
    if (!groupRef.current) return
    // A slow sweep, like a plan being walked rather than a spinning logo.
    groupRef.current.rotation.y += delta * 0.016
  })

  return (
    <group ref={groupRef} rotation={[0, 0.3, 0]}>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#96ee60" transparent opacity={0.17} />
      </lineSegments>
      <points geometry={nodes}>
        <pointsMaterial
          color="#c7f79a"
          size={0.34}
          transparent
          opacity={0.75}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

/** Slow dust in the room's light, so the depth reads as air not emptiness. */
function Motes() {
  const ref = useRef(null)
  const geometry = useMemo(() => {
    const pts = []
    let s = 77003
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
    for (let i = 0; i < 180; i++) {
      pts.push((rnd() - 0.5) * 46, (rnd() - 0.5) * 26, (rnd() - 0.5) * 30)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.012
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.09) * 0.6
    }
  })

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#ecfab5" size={0.12} transparent opacity={0.32} />
    </points>
  )
}

/** Ties the plan's drift to scroll, so the page and the field move as one. */
function ScrollTilt() {
  const { camera } = useThree()
  const target = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight
      target.current = max > 0 ? window.scrollY / max : 0
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useFrame((state, delta) => {
    // Descend from a high, flat plan view toward the deck as the page advances.
    const y = 17 - target.current * 9
    const z = 25 - target.current * 6
    camera.position.y += (y - camera.position.y) * Math.min(1, delta * 1.6)
    camera.position.z += (z - camera.position.z) * Math.min(1, delta * 1.6)
    camera.lookAt(0, 0, 0)
  })
  return null
}

export default function SiteField() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        dpr={[1, 1.3]}
        camera={{ position: [0, 17, 25], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      >
        <ScrollTilt />
        <Plan />
        <Motes />
        <fog attach="fog" args={['#0f1209', 22, 62]} />
      </Canvas>
    </div>
  )
}
