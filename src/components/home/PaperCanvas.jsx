import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PaperLights, PaperMesh } from './PaperMesh.jsx'
import { paintReport } from './paintReport.js'
import { loadIncidentPhotos, paintIncident } from './paintIncident.js'
import { paintTimesheet } from './paintTimesheet.js'

/**
 * The client's record as a real sheet of paper standing in the operator's dark room.
 *
 * This is the page's one authored moment: the record assembling itself. Rows land on
 * the stock as scans come in, the VERIFIED stamp sets only once the record is
 * complete, and the sheet holds a genuine curl so the key light rakes across it.
 *
 * Then it changes. The three artifacts a night actually produces — the patrol
 * verification report, the incident report, the pay stub — come around in the order
 * the work produces them, each one dropping in with a spin and bouncing to rest.
 * One mesh, one canvas, three documents: the reader is being shown that these are
 * the same record printed for three different people, so they had better be the
 * same piece of paper.
 *
 * The documents' accessible text lives in ReportSheet.jsx and Artifacts.jsx. This
 * canvas is decorative (aria-hidden) and is never the only way to read a record.
 */

/** The night's output, in the order the night produces it. */
const DOCUMENTS = [
  { id: 'report', paint: paintReport },
  { id: 'incident', paint: paintIncident },
  { id: 'timesheet', paint: paintTimesheet },
]

/**
 * One 3-second cycle: hold, fade out, swap, fade back in.
 *
 * The swap is deliberately hidden inside the dark part of the fade. Changing
 * document forces a full redraw of a 1000×1414 canvas and a texture upload —
 * roughly a frame's work, and the incident sheet also has two photographs to
 * composite. Doing that while the sheet is visible is what made the change read
 * as a stutter; doing it at zero opacity means the hitch has nothing to land on.
 */
const HOLD = 2
const FADE_OUT = 0.42
const FADE_IN = 0.58

/**
 * Runs the cycle on the render loop rather than a timer, so it stays in step with
 * the frame clock and stops dead whenever the canvas is not rendering.
 */
function Cycler({ fadeRef, onSwap, paused }) {
  const elapsed = useRef(0)
  const phase = useRef('hold')

  useFrame((_state, delta) => {
    if (paused) return
    // A long delta means the tab was hidden; do not fast-forward the queue.
    elapsed.current += Math.min(delta, 1 / 20)

    if (phase.current === 'hold') {
      if (elapsed.current >= HOLD) {
        phase.current = 'out'
        elapsed.current = 0
      }
      return
    }

    if (phase.current === 'out') {
      const k = Math.min(1, elapsed.current / FADE_OUT)
      fadeRef.current = 1 - k * k // ease in — lingers, then goes
      if (k >= 1) {
        fadeRef.current = 0
        onSwap()
        phase.current = 'in'
        elapsed.current = 0
      }
      return
    }

    const k = Math.min(1, elapsed.current / FADE_IN)
    fadeRef.current = k * (2 - k) // ease out — arrives quickly, then eases
    if (k >= 1) {
      fadeRef.current = 1
      phase.current = 'hold'
      elapsed.current = 0
    }
  })

  return null
}

export default function PaperCanvas({ progressRef }) {
  const rootRef = useRef(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const fadeRef = useRef(1)
  const [ready, setReady] = useState(false)
  const [index, setIndex] = useState(0)
  const [photoKey, setPhotoKey] = useState(0)
  const [paused, setPaused] = useState(false)

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

  // The incident sheet prints two photographs; repaint once they decode.
  useEffect(() => {
    let alive = true
    loadIncidentPhotos().then(() => {
      if (alive) setPhotoKey((k) => k + 1)
    })
    return () => {
      alive = false
    }
  }, [])

  // Nothing turns while the hero is off screen — an unwatched page turn is
  // wasted work, and it would also mean the reader misses the first document.
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      ([e]) => setPaused(!e.isIntersecting),
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Respect a reader who has asked for less motion: they get the report, still.
  const still =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const doc = DOCUMENTS[index]

  return (
    <div
      ref={rootRef}
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
        <PaperLights />
        {/* settleKey is the index, so every swap re-drops the sheet: it arrives
            turned by `spin`, overshoots, and rocks to rest — all of it under the
            fade, so the reader sees the motion and never the repaint. */}
        <PaperMesh
          paint={doc.paint}
          paintKey={photoKey}
          settleKey={index}
          progressRef={progressRef}
          pointerRef={pointerRef}
          spin={0.5}
          bounce={0.22}
          settleRate={0.72}
          opacityRef={still ? null : fadeRef}
        />
        {!still && (
          <Cycler
            fadeRef={fadeRef}
            paused={paused}
            onSwap={() => setIndex((i) => (i + 1) % DOCUMENTS.length)}
          />
        )}
      </Canvas>
    </div>
  )
}
