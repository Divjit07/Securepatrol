import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import {
  PaperLights,
  PaperMesh,
  SHEET_H_UNITS,
  SHEET_W_UNITS,
} from '../PaperMesh.jsx'
import { paintReport } from '../paintReport.js'
import { loadIncidentPhotos, paintIncident } from '../paintIncident.js'

/**
 * The two paper stations of the evidence table, on one canvas.
 *
 * Both documents stand in the same place on the table and they are never on
 * screen at the same time — the console sits between them — so one canvas and
 * one mesh serve both, and swapping `variant` just repaints the stock. That is
 * a WebGL context the page does not have to spend, and it means the sheet is
 * already compiled by the time the second document comes around.
 *
 * The canvas fills the storyboard's media column rather than the whole stage,
 * so the sheet is framed by the layout instead of by a hand-tuned camera.
 */

const PAINTERS = {
  report: paintReport,
  incident: paintIncident,
}

/** Scales the sheet to the column it was given, whatever shape that is. */
function Fit({ children, margin = 0.98 }) {
  const { viewport } = useThree()
  const scale = Math.min(
    (viewport.height * margin) / SHEET_H_UNITS,
    (viewport.width * margin) / SHEET_W_UNITS,
  )
  return <group scale={scale}>{children}</group>
}

export default function PaperStage({ variant, progressRef, pointerRef, active }) {
  // The incident sheet prints two photographs; repaint once they decode.
  const [photoKey, setPhotoKey] = useState(0)

  useEffect(() => {
    if (variant !== 'incident') return undefined
    let alive = true
    loadIncidentPhotos().then(() => {
      if (alive) setPhotoKey((k) => k + 1)
    })
    return () => {
      alive = false
    }
  }, [variant])

  return (
    <Canvas
      className="!absolute inset-0"
      style={{ background: 'transparent' }}
      dpr={[1, 1.75]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 7], fov: 40, near: 0.1, far: 30 }}
      gl={{
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <PaperLights />
      <Fit>
        <PaperMesh
          paint={PAINTERS[variant] || paintReport}
          progressRef={progressRef}
          pointerRef={pointerRef}
          settleKey={variant}
          paintKey={photoKey}
          steps={26}
        />
      </Fit>
    </Canvas>
  )
}
