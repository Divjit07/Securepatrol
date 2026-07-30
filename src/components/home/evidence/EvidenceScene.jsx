import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { STATIONS } from './stations.js'
import { paintTag, TAG_MARK, TAG_SIZE } from './paintTag.js'

/**
 * Station 0 of the Evidence Table — just the checkpoint sticker, floating.
 * No wall plate, no vignette box, no dust. The canvas is transparent so the
 * page's room shows through; nothing in here is allowed to read as a panel.
 */

const TAG = STATIONS[0]

/** The printed face, in world units, and its centre on the wall. */
const FACE = 0.86
const FACE_Y = 1.06

/** The printed NFC mark, placed on the face so the pulse starts where it does. */
const MARK = {
  x: (TAG_MARK.u - 0.5) * FACE,
  y: FACE_Y + (0.5 - TAG_MARK.v) * FACE,
  reach: TAG_MARK.reach * FACE,
}

/** Three rings leaving the mark, evenly out of phase. */
const PULSES = [0, 1 / 3, 2 / 3]

function CheckpointTag(props) {
  const rings = useRef([])
  const { invalidate } = useThree()

  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = TAG_SIZE
    c.height = TAG_SIZE
    paintTag(c.getContext('2d'))
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 16
    return t
  }, [])

  useEffect(() => {
    let alive = true
    document.fonts?.ready.then(() => {
      if (!alive) return
      paintTag(texture.image.getContext('2d'))
      texture.needsUpdate = true
      invalidate()
    })
    return () => {
      alive = false
    }
  }, [texture, invalidate])

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((state) => {
    const e = state.clock.elapsedTime
    for (let i = 0; i < PULSES.length; i += 1) {
      const m = rings.current[i]
      if (!m) continue
      const c = (((e / 3.4 + PULSES[i]) % 1) + 1) % 1
      const eased = 1 - (1 - c) * (1 - c)
      m.scale.setScalar(MARK.reach * (0.3 + eased * 0.85))
      m.material.opacity = Math.sin(c * Math.PI) ** 1.4 * (1 - c) * 0.9
    }
  })

  return (
    <group {...props}>
      {/* Soft card edge so the sticker still reads as an object, not a flat image. */}
      <mesh position={[0, FACE_Y, 0.09]}>
        <boxGeometry args={[FACE + 0.028, FACE + 0.028, 0.018]} />
        <meshStandardMaterial color="#12150e" roughness={0.85} metalness={0.05} />
      </mesh>

      <mesh position={[0, FACE_Y, 0.1]}>
        <planeGeometry args={[FACE, FACE]} />
        <meshStandardMaterial map={texture} roughness={0.62} metalness={0} />
      </mesh>

      {PULSES.map((phase, i) => (
        <mesh
          key={phase}
          ref={(el) => {
            rings.current[i] = el
          }}
          position={[MARK.x, MARK.y, 0.112]}
        >
          <ringGeometry args={[0.93, 1, 96]} />
          <meshBasicMaterial color="#96ee60" transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}

      <pointLight
        position={[0.25, FACE_Y + 0.1, 0.7]}
        color="#d9f7c0"
        intensity={0.55}
        distance={2}
        decay={2}
      />
    </group>
  )
}

function Rig({ pointerRef }) {
  const { camera } = useThree()
  const v = useMemo(
    () => ({
      cam: new THREE.Vector3(...TAG.cam),
      look: new THREE.Vector3(...TAG.look),
      target: new THREE.Vector3(...TAG.cam),
      lookAt: new THREE.Vector3(...TAG.look),
    }),
    [],
  )

  useFrame((state, delta) => {
    const e = state.clock.elapsedTime
    v.target.fromArray(TAG.cam)
    v.target.x += pointerRef.current.x * 0.14 + Math.sin(e * 0.21) * 0.03
    v.target.y += -pointerRef.current.y * 0.08 + Math.sin(e * 0.29 + 1.4) * 0.018
    v.lookAt.fromArray(TAG.look)

    const k = 3.8
    v.cam.x = THREE.MathUtils.damp(v.cam.x, v.target.x, k, delta)
    v.cam.y = THREE.MathUtils.damp(v.cam.y, v.target.y, k, delta)
    v.cam.z = THREE.MathUtils.damp(v.cam.z, v.target.z, k, delta)
    v.look.x = THREE.MathUtils.damp(v.look.x, v.lookAt.x, k, delta)
    v.look.y = THREE.MathUtils.damp(v.look.y, v.lookAt.y, k, delta)
    v.look.z = THREE.MathUtils.damp(v.look.z, v.lookAt.z, k, delta)

    camera.position.copy(v.cam)
    camera.lookAt(v.look)
  })

  return null
}

export default function EvidenceScene({ pointerRef }) {
  return (
    <>
      {/* No scene background — the canvas is alpha-cleared so the page room shows through. */}
      <fog attach="fog" args={['#0f1209', 8, 22]} />

      <ambientLight intensity={0.32} color="#9db386" />
      <directionalLight position={[-4, 6, 5]} intensity={0.5} color="#e6efd6" />
      <pointLight position={[-1.2, 3.0, 2.6]} intensity={16} distance={13} decay={1.5} color="#fff4dd" />
      <pointLight position={[2.2, 1.4, 2.4]} intensity={5} distance={9} decay={1.7} color="#9db9dc" />

      <Rig pointerRef={pointerRef} />

      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2} position={[-3, 5, 4]} scale={[7, 7, 1]} color="#cfe3b0" />
        <Lightformer intensity={0.7} position={[5, 2, -4]} scale={[8, 4, 1]} color="#38562a" />
      </Environment>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#0e1209" roughness={0.74} metalness={0.22} />
      </mesh>
      <Grid
        position={[0, 0.003, 0]}
        args={[40, 30]}
        cellSize={0.4}
        cellThickness={0.5}
        cellColor="#232c1c"
        sectionSize={2.4}
        sectionThickness={0.9}
        sectionColor="#3c5c2a"
        fadeDistance={16}
        fadeStrength={1.5}
      />

      <group>
        <CheckpointTag rotation={[0, -0.12, 0]} />
        <ContactShadows
          frames={1}
          resolution={256}
          scale={4}
          blur={2.8}
          opacity={0.55}
          far={2.5}
          position={[0, 0.001, 0]}
        />
      </group>

      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom
          intensity={0.22}
          luminanceThreshold={0.82}
          luminanceSmoothing={0.28}
          radius={0.55}
          mipmapBlur
        />
      </EffectComposer>
    </>
  )
}
