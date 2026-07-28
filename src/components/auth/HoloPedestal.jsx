import { Suspense, useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

function HexRing({ radius = 1.35, y = -0.95 }) {
  const ref = useRef(null)
  const geo = useMemo(() => {
    const shape = new THREE.Shape()
    const sides = 6
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(a) * radius
      const z = Math.sin(a) * radius
      if (i === 0) shape.moveTo(x, z)
      else shape.lineTo(x, z)
    }
    shape.closePath()
    const hole = new THREE.Path()
    const inner = radius * 0.72
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(a) * inner
      const z = Math.sin(a) * inner
      if (i === 0) hole.moveTo(x, z)
      else hole.lineTo(x, z)
    }
    hole.closePath()
    shape.holes.push(hole)
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    })
  }, [radius])

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.22
  })

  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={geo}>
      <meshStandardMaterial
        color="#152015"
        emissive="#96ee60"
        emissiveIntensity={1.15}
        metalness={0.65}
        roughness={0.28}
      />
    </mesh>
  )
}

function OuterHalo({ radius = 1.7, y = -0.98 }) {
  const ref = useRef(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z -= dt * 0.12
  })
  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.92, radius, 64]} />
      <meshBasicMaterial color="#96ee60" transparent opacity={0.22} side={THREE.DoubleSide} />
    </mesh>
  )
}

function OrbitSparks({ count = 36 }) {
  const ref = useRef(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2
      const r = 1.0 + (i % 4) * 0.16
      arr[i * 3] = Math.cos(a) * r
      arr[i * 3 + 1] = -0.55 + (i % 5) * 0.1
      arr[i * 3 + 2] = Math.sin(a) * r
    }
    return arr
  }, [count])

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.4
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#96ee60" size={0.045} sizeAttenuation transparent opacity={0.85} />
    </points>
  )
}

function Beam() {
  return (
    <mesh position={[0, 0.15, 0]}>
      <cylinderGeometry args={[0.08, 0.55, 2.2, 24, 1, true]} />
      <meshBasicMaterial color="#96ee60" transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Scene({ reduced }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[2.2, 2.8, 2]} intensity={1.4} color="#96ee60" />
      <pointLight position={[-2, 1.2, -1]} intensity={0.55} color="#7fd09f" />
      <Beam />
      {!reduced ? (
        <Float speed={1.15} rotationIntensity={0.12} floatIntensity={0.3}>
          <HexRing />
        </Float>
      ) : (
        <HexRing />
      )}
      <OuterHalo />
      {!reduced && <OrbitSparks />}
      <mesh position={[0, -1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.15, 48]} />
        <meshBasicMaterial color="#96ee60" transparent opacity={0.16} />
      </mesh>
    </>
  )
}

/**
 * Three.js holographic pedestal under the guard mascot.
 */
export default function HoloPedestal({ className = '' }) {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  return (
    <div className={`kratos-holo-pedestal ${className}`} aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.55, 3.4], fov: 36 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Scene reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  )
}
