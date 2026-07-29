// WebGL half of the client-portal backdrop: an infinite ops-floor grid that
// recedes to a horizon and drifts toward the viewer. Custom shader (no drei) so
// the line fade, thickness and travelling highlight stay derivative-accurate at
// any distance instead of turning into moiré.
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const FRAGMENT = /* glsl */ `
  precision highp float;

  varying vec3 vWorld;

  uniform float uTime;
  uniform vec3 uCellColor;
  uniform vec3 uSectionColor;
  uniform vec3 uDepthColor;
  uniform float uOpacity;
  uniform float uNear;
  uniform float uFar;
  uniform vec2 uOrigin;
  uniform float uSpeed;
  uniform float uGlow;

  // Screen-space derivative line: constant apparent thickness at any depth.
  float lineMask(vec2 coord, float thickness) {
    vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
    return 1.0 - min(min(grid.x, grid.y) / thickness, 1.0);
  }

  void main() {
    vec2 p = vWorld.xz;
    p.y -= uTime * uSpeed;

    float cells = lineMask(p, 1.1);
    float sections = lineMask(p / 5.0, 1.7);
    // Wide, faint pass over the same majors — the halo that reads as light
    // rather than wireframe.
    float bloom = lineMask(p / 5.0, 8.0);

    float d = length(vWorld.xz - uOrigin);
    // Lit band: eases in past the foreground, dissolves before the horizon, so
    // the field floats instead of dying on a hard line.
    float band = smoothstep(1.5, 7.0, d) * (1.0 - smoothstep(uNear, uFar, d));
    band *= band;

    // One authored moment: a slow swell rolling out along the section lines.
    float sweep = sin((vWorld.z + uTime * 2.6) * 0.12) * 0.5 + 0.5;
    sweep = pow(sweep, 6.0);

    float alpha = cells * 0.4 + sections * 0.9 + bloom * 0.14;
    alpha *= band * uOpacity;
    alpha += bloom * sweep * band * uOpacity * uGlow;
    if (alpha < 0.002) discard;

    vec3 color = mix(uCellColor, uSectionColor, clamp(sections + sweep * 0.45, 0.0, 1.0));
    // Chromatic depth: the far field cools off a touch.
    color = mix(color, uDepthColor, smoothstep(8.0, 30.0, d) * 0.5);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`

function Floor({ cellColor, sectionColor, depthColor, opacity, speed, glow }) {
  const group = useRef(null)
  const { camera } = useThree()
  const pointer = useRef({ x: 0, y: 0 })
  const target = useRef({ x: 0, y: 0 })

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCellColor: { value: new THREE.Color(cellColor) },
      uSectionColor: { value: new THREE.Color(sectionColor) },
      uDepthColor: { value: new THREE.Color(depthColor) },
      uOpacity: { value: opacity },
      uNear: { value: 20 },
      uFar: { value: 46 },
      uOrigin: { value: new THREE.Vector2(camera.position.x, camera.position.z) },
      uSpeed: { value: speed },
      uGlow: { value: glow },
    }),
    // Colours/opacity are pushed below so a theme swap never rebuilds the shader.
    [],
  )

  useEffect(() => {
    uniforms.uCellColor.value.set(cellColor)
    uniforms.uSectionColor.value.set(sectionColor)
    uniforms.uDepthColor.value.set(depthColor)
    uniforms.uOpacity.value = opacity
    uniforms.uSpeed.value = speed
    uniforms.uGlow.value = glow
  }, [cellColor, sectionColor, depthColor, opacity, speed, glow, uniforms])

  // The canvas is inert (pointer-events: none), so read the pointer off window.
  useEffect(() => {
    const onMove = (event) => {
      target.current.x = (event.clientX / window.innerWidth - 0.5) * 1.2
      target.current.y = (0.5 - event.clientY / window.innerHeight) * 0.36
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((_, delta) => {
    uniforms.uTime.value += Math.min(delta, 0.05)
    if (!group.current) return
    // Damped parallax — a depth cue, never a toy.
    pointer.current.x += (target.current.x - pointer.current.x) * 0.03
    pointer.current.y += (target.current.y - pointer.current.y) * 0.03
    group.current.position.x = -pointer.current.x
    group.current.rotation.z = pointer.current.x * 0.004
    camera.position.y = 1.15 + pointer.current.y
    camera.lookAt(0, 0, 0)
  })

  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position-y={-1.15}>
        <planeGeometry args={[420, 420]} />
        <shaderMaterial
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

export default function CommandGrid({
  cellColor = '#2f7f4f',
  sectionColor = '#5ee88a',
  depthColor = '#93e6b8',
  opacity = 0.9,
  speed = 0.9,
  glow = 0.7,
  onReady,
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.15, 6], fov: 48, near: 0.1, far: 120 }}
      gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
      style={{ width: '100%', height: '100%' }}
      onCreated={() => onReady?.()}
    >
      <Floor
        cellColor={cellColor}
        sectionColor={sectionColor}
        depthColor={depthColor}
        opacity={opacity}
        speed={speed}
        glow={glow}
      />
    </Canvas>
  )
}
