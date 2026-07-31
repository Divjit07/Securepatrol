import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, Pause, Play } from 'lucide-react'
import {
  PHONE_SEQUENCE,
  STATIONS,
  legProgress,
  mediaOf,
  shotSrcSet,
} from './evidence/stations.js'
import { CheckpointLabel, IncidentSheet } from './Artifacts.jsx'
import ReportSheet from './ReportSheet.jsx'

// Fetch the GL chunks the moment this module evaluates — not when the user
// first scrolls into Operations. Shader compile still costs a frame, but the
// JS parse and the network wait are already done by then.
const sceneImport = import('./evidence/EvidenceScene.jsx')
const EvidenceScene = lazy(() => sceneImport)
const paperImport = import('./evidence/PaperStage.jsx')
const PaperStage = lazy(() => paperImport)

gsap.registerPlugin(ScrollTrigger)

/**
 * The Evidence Table — the page's one long take.
 *
 * A tall track scrolls a sticky, viewport-height stage past eight stations, and
 * the whole thing travels vertically: as you scroll down, the station you are
 * leaving rises out of frame and the next one comes up from below, so the
 * motion of the scene agrees with the motion of your hand.
 *
 * Three kinds of thing stand on the table — the 3D checkpoint tag, two
 * documents on a WebGL sheet, and product screenshots in device frames. The
 * screenshots stay as ordinary <img> elements because UI text painted onto a
 * texture turns to mush; the documents are meshes because paper that cannot
 * curl reads as a picture of paper.
 *
 * Three things make the walk readable rather than a slideshow that flips:
 *
 *  - Every station is mounted at once and crossfaded by writing style directly
 *    from a gsap ticker. Nothing mounts, unmounts or re-decodes mid-transition,
 *    which is what used to make the swap stutter.
 *  - ScrollTrigger drives it with `scrub`, so the stage eases toward the scroll
 *    position instead of tracking it frame-for-frame, and `snap` settles on the
 *    nearest station when you stop.
 *  - More than half of every leg is a dead zone where nothing moves (see
 *    HOLD_IN/HOLD_OUT), so a station parks long enough to read its caption.
 *
 * The play control walks the same track on a timer — the hook a narration track
 * would sync to later.
 *
 * Below `lg`, with reduced motion, or with no WebGL, the same stations render
 * as ordinary markup: same screenshots, same documents, same words, no canvas.
 */

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Seconds the autoplay tour takes to walk the whole table, at ~11.5s a leg. */
const TOUR_SECONDS = Math.round((STATIONS.length - 1) * 11.5)

/** Viewport heights of scroll per leg. Long, because the holds live in here. */
const LEG_VH = 148

/** How far a layer travels as it leaves or arrives, in px. */
const MEDIA_RISE = 46
const CAPTION_RISE = 26

/** Which document the shared paper canvas shows before the walk reaches one. */
const FIRST_PAPER = STATIONS.find((s) => s.paper)?.paper || 'report'

function Notes({ station, activeNote }) {
  return (
    <div className="mt-5 border-t border-[var(--kr-edge)] pt-4">
      <p className="kr-meas mb-3 text-[10px] tracking-wide text-[var(--kr-ink-3)]">
        {station.screen}
      </p>
      <ul className="space-y-2">
        {station.notes.map((note, i) => {
          const tracked = activeNote != null
          const on = !tracked || i === activeNote
          return (
            <li
              key={note}
              className="kr-meas flex gap-2.5 text-[11.5px] leading-relaxed transition-colors duration-500"
              style={{
                color: on ? (tracked ? 'var(--kr-ink)' : 'var(--kr-ink-2)') : 'var(--kr-ink-3)',
              }}
            >
              <span
                aria-hidden="true"
                className="mt-[0.44rem] h-1 w-1 shrink-0 rounded-full transition-colors duration-500"
                style={{ background: on ? 'var(--kr-lime)' : 'var(--kr-edge-strong)' }}
              />
              {note}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** A product screen, kept as an <img> so the UI text stays sharp. */
function Shot({ src, alt = '', className = 'h-auto w-full' }) {
  return (
    <img
      src={src}
      srcSet={shotSrcSet(src)}
      alt={alt}
      loading="eager"
      decoding="async"
      draggable={false}
      className={`block select-none ${className}`}
    />
  )
}

function PhoneFrame({ children, className = '' }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#0a0c08] p-[0.38rem] shadow-[0_30px_80px_-28px_rgba(0,0,0,0.85)] ${className}`}
    >
      <div className="h-full overflow-hidden rounded-[1.3rem] bg-black">{children}</div>
    </div>
  )
}

function LaptopFrame({ children, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="overflow-hidden rounded-[0.7rem] border border-white/10 bg-[#0a0c08] p-[0.45rem] shadow-[0_40px_100px_-36px_rgba(0,0,0,0.9)]">
        <div className="overflow-hidden rounded-[0.4rem] bg-black">{children}</div>
      </div>
      <div
        aria-hidden="true"
        className="mx-auto mt-1 h-[0.55rem] w-[92%] rounded-b-[0.55rem]"
        style={{
          background: 'linear-gradient(180deg, #141710 0%, #0a0c08 70%)',
          boxShadow: '0 14px 28px -18px rgba(0,0,0,0.8)',
        }}
      />
    </div>
  )
}

function SheetFrame({ children, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[3px] border border-[var(--kr-edge)] bg-[#e8e6dd] p-[0.55rem] shadow-[0_28px_70px_-30px_rgba(0,0,0,0.75)] ${className}`}
    >
      <div className="overflow-hidden rounded-[2px] bg-white">{children}</div>
    </div>
  )
}

/** Phone screens are all ~540×1172; hold the frame to that and size by height. */
const PHONE_ASPECT = 'aspect-[540/1172]'

/**
 * The guard's four screens crossfade inside one frame while the phone itself
 * holds still. All four stay mounted so the next is already decoded.
 */
function PhoneSequence({ srcs, index, alt, className = '' }) {
  return (
    <PhoneFrame className={`${PHONE_ASPECT} ${className}`}>
      <div className="relative h-full w-full">
        {srcs.map((src, i) => (
          <img
            key={src}
            src={src}
            srcSet={shotSrcSet(src)}
            alt={i === 0 ? alt : ''}
            loading="eager"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-[450ms] ease-out"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ))}
      </div>
    </PhoneFrame>
  )
}

/**
 * What stands in the right-hand column at each station.
 *
 * Everything here is sized against the column it sits in — `flex-1` for the
 * wide shots, `h-full` for the phones — never against `vw`. The column is only
 * about a third of the viewport once the caption and the page gutters are
 * taken out, so viewport-relative caps left every screenshot far smaller than
 * the space it had. The `max-*` values are only there to stop a single shot
 * ballooning on a very wide display.
 */
function StationMedia({ station, phoneNote }) {
  // The paper stations are drawn by the shared WebGL sheet layered over this
  // column, so their own layer stays empty.
  if (station.paper) return null

  if (station.id === 'guard') {
    return (
      <PhoneSequence
        srcs={station.shots.phone}
        index={phoneNote}
        alt={station.alt}
        className="h-full max-h-[44rem]"
      />
    )
  }

  if (station.id === 'incident') {
    return (
      <>
        <PhoneFrame className={`${PHONE_ASPECT} h-full max-h-[38rem] translate-y-3`}>
          <Shot
            src={station.shots.phone[0]}
            alt={station.alt}
            className="h-full w-full object-cover object-top"
          />
        </PhoneFrame>
        <LaptopFrame className="hidden max-w-[38rem] min-w-0 flex-1 xl:block">
          <Shot src={station.shots.wide[0]} alt="" />
        </LaptopFrame>
      </>
    )
  }

  if (station.id === 'console') {
    return (
      <LaptopFrame className="w-full max-w-[56rem]">
        <Shot src={station.shots.wide[0]} alt={station.alt} />
      </LaptopFrame>
    )
  }

  if (station.id === 'report') {
    return (
      <>
        <SheetFrame className="max-w-[38rem] min-w-0 flex-1 -translate-y-3">
          <Shot src={station.shots.sheets[0]} alt={station.alt} />
        </SheetFrame>
        <SheetFrame className="hidden max-w-[30rem] min-w-0 flex-1 translate-y-6 xl:block">
          <Shot src={station.shots.sheets[1]} alt="" />
        </SheetFrame>
      </>
    )
  }

  if (station.id === 'client') {
    return (
      <>
        <LaptopFrame className="max-w-[48rem] min-w-0 flex-1">
          <Shot src={station.shots.wide[0]} alt={station.alt} />
        </LaptopFrame>
        <PhoneFrame className={`${PHONE_ASPECT} hidden h-full max-h-[28rem] translate-y-6 xl:block`}>
          <Shot
            src={station.shots.phone[0]}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        </PhoneFrame>
      </>
    )
  }

  return null
}

export default function EvidenceTable({ enhanced = false }) {
  const trackRef = useRef(null)
  const mediaRefs = useRef([])
  const capRefs = useRef([])
  const barRef = useRef(null)
  const pointerRef = useRef({ x: 0, y: 0 })

  const paperRef = useRef(null)
  const paperProgressRef = useRef(0)

  const scrubRef = useRef({ p: 0 })
  const liveRef = useRef(false)
  const activeRef = useRef(0)
  const noteRef = useRef(0)
  const tagRef = useRef(true)
  const paperOnRef = useRef(false)
  const variantRef = useRef(FIRST_PAPER)
  const tourRef = useRef(null)
  const snapRef = useRef(null)

  const [active, setActive] = useState(0)
  const [activeNote, setActiveNote] = useState(0)
  const [tagOn, setTagOn] = useState(true)
  const [paperOn, setPaperOn] = useState(false)
  const [paperVariant, setPaperVariant] = useState(FIRST_PAPER)
  const [playing, setPlaying] = useState(false)
  // Keep the canvas mounted once the table is on screen; only the first visit
  // pays for WebGL setup. `warmed` flips after a short always-on burst so the
  // EffectComposer shaders compile before the user arrives at station 0.
  const [glMounted, setGlMounted] = useState(false)
  const [warmed, setWarmed] = useState(false)

  /* ------------------------------------------------------------------ walk */

  useLayoutEffect(() => {
    if (!enhanced) return undefined
    const track = trackRef.current
    if (!track) return undefined

    const N = STATIONS.length
    const scrub = scrubRef.current

    // Nudge a layer without touching React: opacity + a short slide, and
    // visibility off once it is invisible so it stops costing a composite.
    const place = (el, o, x, y, sc) => {
      if (!el) return
      const vis = o > 0.004
      if (el.__vis !== vis) {
        el.style.visibility = vis ? 'visible' : 'hidden'
        el.__vis = vis
      }
      if (!vis) {
        // Zero it too, or a layer that vanished mid-fade keeps a stale opacity
        // and anything reading the DOM sees several stations at once.
        if (el.style.opacity !== '0') el.style.opacity = '0'
        return
      }
      el.style.opacity = o.toFixed(3)
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${sc.toFixed(4)})`
    }

    const draw = () => {
      const p = clamp01(scrub.p)
      const s = p * (N - 1)
      const i = Math.min(Math.floor(s), N - 2)
      const t = legProgress(s - i)

      // The paper stations share one canvas, so the loop notes which of them is
      // on screen and hands that layer the same motion the others just took.
      let paperO = 0
      let paperK = -1
      let paperD = 1
      let paperDir = 1

      for (let k = 0; k < N; k += 1) {
        const leaving = k === i
        const arriving = k === i + 1
        const o = leaving ? 1 - t : arriving ? t : 0
        // d counts distance from settled: 0 parked, 1 fully out of frame.
        const d = leaving ? t : 1 - t
        // Down the page: what you are leaving rises out, what is next comes up
        // from below. dir is -1 leaving, +1 arriving, so one expression does both.
        const dir = leaving ? -1 : 1
        place(mediaRefs.current[k], o, 0, dir * d * MEDIA_RISE, 1 - d * 0.03)
        place(capRefs.current[k], o, 0, dir * d * CAPTION_RISE, 1)

        if (STATIONS[k].paper && o > paperO) {
          paperO = o
          paperK = k
          paperD = d
          paperDir = dir
        }
      }

      place(paperRef.current, paperO, 0, paperDir * paperD * MEDIA_RISE, 1 - paperD * 0.03)

      if (paperK >= 0) {
        // The document writes itself on the way in. A station parks at k-0.22,
        // so about 70% of the page is already down when it settles and you
        // watch the last of it land — then it holds finished, seal and all,
        // for the rest of the hold. Finishing any later strands the reader on
        // a half-written page; any earlier and there is nothing to watch.
        paperProgressRef.current = clamp01((s - (paperK - 0.62)) / 0.57)
        const variant = STATIONS[paperK].paper
        if (variant !== variantRef.current) {
          variantRef.current = variant
          setPaperVariant(variant)
        }
      }

      const paperLive = paperO > 0.004
      if (paperLive !== paperOnRef.current) {
        paperOnRef.current = paperLive
        setPaperOn(paperLive)
      }

      if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(4)})`
      if (import.meta.env.DEV) {
        track.dataset.p = p.toFixed(3)
        track.dataset.pp = paperProgressRef.current.toFixed(3)
      }

      const idx = t < 0.5 ? i : i + 1
      if (idx !== activeRef.current) {
        activeRef.current = idx
        setActive(idx)
      }

      const wantTag = i === 0 && t < 0.995
      if (wantTag !== tagRef.current) {
        tagRef.current = wantTag
        setTagOn(wantTag)
      }

      // The guard's four screens advance across station 1's hold, in raw
      // scroll units, so they step at an even pace while the phone is parked.
      const seq = clamp01((s - PHONE_SEQUENCE.start) / (PHONE_SEQUENCE.end - PHONE_SEQUENCE.start))
      const last = STATIONS[1].shots.phone.length - 1
      const n = Math.min(last, Math.round(seq * last))
      if (n !== noteRef.current) {
        noteRef.current = n
        setActiveNote(n)
      }
    }

    const tick = () => {
      if (liveRef.current) draw()
    }

    // This component's layout effect runs before Home's, and ScrollTrigger
    // measures in creation order — measure last, so anything Home does to the
    // height of the sections above has already settled.
    const bounds = {
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      refreshPriority: -1,
    }

    const ctx = gsap.context(() => {
      gsap.to(scrub, { p: 1, ease: 'none', scrollTrigger: { ...bounds, scrub: 0.85 } })

      // Separate trigger so autoplay can switch the settling off without
      // disturbing the scrub above.
      snapRef.current = ScrollTrigger.create({
        ...bounds,
        snap: {
          snapTo: 1 / (N - 1),
          duration: { min: 0.25, max: 0.75 },
          delay: 0.12,
          ease: 'power2.inOut',
        },
      })
    }, track)

    draw()
    gsap.ticker.add(tick)

    // Webfonts land after this effect measures, and they move the sections
    // above by enough that every station would otherwise arrive early.
    let alive = true
    const settle = () => {
      if (alive) ScrollTrigger.refresh()
    }
    const frame = requestAnimationFrame(settle)
    document.fonts?.ready.then(settle)

    return () => {
      alive = false
      cancelAnimationFrame(frame)
      gsap.ticker.remove(tick)
      snapRef.current = null
      ctx.revert()
    }
  }, [enhanced])

  /* -------------------------------------------------------- gl lifecycle */

  useEffect(() => {
    const track = trackRef.current
    if (!track || !enhanced) return undefined

    // Mount the canvas two viewports early and never tear it down — remounting
    // is what made the tag hitch every time you scrolled back to it.
    const mount = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setGlMounted(true)
      },
      { rootMargin: '200% 0px' },
    )
    const live = new IntersectionObserver(([e]) => {
      liveRef.current = e.isIntersecting
    })
    mount.observe(track)
    live.observe(track)
    return () => {
      mount.disconnect()
      live.disconnect()
    }
  }, [enhanced])

  useEffect(() => {
    if (!tagOn && !paperOn) return undefined
    const onMove = (e) => {
      pointerRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [tagOn, paperOn])

  /* ----------------------------------------------------------- autoplay */

  const stopTour = useCallback(() => {
    if (tourRef.current) {
      cancelAnimationFrame(tourRef.current.raf)
      tourRef.current = null
    }
    snapRef.current?.enable(false)
    setPlaying(false)
  }, [])

  const startTour = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const top = track.getBoundingClientRect().top + window.scrollY
    const end = top + track.offsetHeight - window.innerHeight
    if (end <= top) return

    // Finished? A second press walks it again from the top.
    const from = window.scrollY >= end - 4 ? top : Math.min(Math.max(window.scrollY, top), end)
    window.scrollTo(0, from)

    // Snapping and a driven scroll both write scrollTop — let the tour own it.
    snapRef.current?.disable(false)

    // Own clock, not gsap's ticker: Three.js on station 0 can starve the
    // shared ticker under a soft GPU, and a narration track later needs a
    // clock that keeps time regardless of frame budget.
    const span = end - top
    const remaining = ((end - from) / span) * TOUR_SECONDS * 1000
    const t0 = performance.now()
    const y0 = from

    const step = (now) => {
      const u = Math.min(1, (now - t0) / remaining)
      window.scrollTo(0, y0 + (end - y0) * u)
      if (u < 1) {
        tourRef.current = { raf: requestAnimationFrame(step) }
      } else {
        tourRef.current = null
        snapRef.current?.enable(false)
        setPlaying(false)
      }
    }
    tourRef.current = { raf: requestAnimationFrame(step) }
    setPlaying(true)
  }, [])

  // Any deliberate scroll input hands control back. Plain 'scroll' is no good
  // here — the tour fires it every frame.
  useEffect(() => {
    if (!playing) return undefined
    const keys = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'])
    const bail = () => stopTour()
    const onKey = (e) => {
      if (keys.has(e.key)) stopTour()
    }
    window.addEventListener('wheel', bail, { passive: true, capture: true })
    window.addEventListener('touchstart', bail, { passive: true, capture: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', bail, { capture: true })
      window.removeEventListener('touchstart', bail, { capture: true })
      window.removeEventListener('keydown', onKey)
    }
  }, [playing, stopTour])

  useEffect(
    () => () => {
      if (tourRef.current) cancelAnimationFrame(tourRef.current.raf)
    },
    [],
  )

  return (
    <section id="operations" className="border-b border-[var(--kr-edge)]">
      <div className="mx-auto grid max-w-[84rem] gap-y-12 px-5 pt-20 pb-14 sm:px-8 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:gap-x-16">
        <div className="kr-rise">
          <p className="kr-doc-label mb-6 flex items-center gap-3 text-[11px] text-[var(--kr-lime)]">
            The evidence table
            <span
              aria-hidden="true"
              className="h-px flex-1 bg-[linear-gradient(90deg,var(--kr-edge-strong),transparent)]"
            />
          </p>
          {/* Leads on what the software does and closes on what the owner is
              left holding — the trade the whole page is selling. The proof
              claim moves to the first line of the body so it still lands. */}
          <h2 className="kr-display text-[2.6rem] leading-[0.98] sm:text-[4rem] lg:text-[4.6rem]">
            AI watches over every shift.{' '}
            <span className="text-[var(--kr-lime)]">You just read the record.</span>
          </h2>
          <p className="mt-8 max-w-[38rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)]">
            Eight real product screens, one shift, no mockups. The tag on the wall, the
            phone that tapped it, the incident written in front of it, the report that left
            for the client that night, the console that caught what was missing, and the
            portal your client opens in the morning. Scroll the table, or press play and
            let it walk itself.
          </p>
        </div>

        {/* The empty column earns its place by closing: a reader convinced by
            the walkthrough should not have to scroll back up to act on it. */}
        <aside className="kr-rise lg:pt-2">
          <div className="rounded-[5px] border border-[var(--kr-edge)] bg-[var(--kr-ground)] p-6 shadow-[var(--kr-lift)]">
            <p className="kr-doc-label text-[10px] text-[var(--kr-ink-3)]">
              What you are looking at
            </p>
            <ul className="mt-4 space-y-3 border-b border-[var(--kr-edge)] pb-5">
              {[
                ['Real product screens', 'the same pages your team signs into'],
                ['AI watches and writes', 'alerts, reports and the morning digest'],
                ['Synthetic data throughout', 'never a customer’s record'],
              ].map(([t, d]) => (
                <li key={t}>
                  <p className="text-[0.875rem] leading-snug font-medium text-[var(--kr-ink)]">
                    {t}
                  </p>
                  <p className="kr-meas mt-1 text-[11px] leading-relaxed text-[var(--kr-ink-3)]">
                    {d}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[0.875rem] leading-relaxed text-[var(--kr-ink-2)]">
              Want it walked through against your own sites?
            </p>
            <a
              href="mailto:hello@prodsec.ca?subject=Kronus%20demo"
              className="group mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[3px] bg-[var(--kr-lime)] px-5 py-3 text-[0.9375rem] font-semibold text-[#0f1209] transition-all duration-200 hover:bg-[color-mix(in_srgb,#96ee60_80%,white)]"
            >
              Book a demo
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </a>
          </div>
        </aside>
      </div>

      {enhanced && (
        <div
          ref={trackRef}
          data-evidence-track=""
          className="relative hidden lg:block"
          style={{ height: `${(STATIONS.length - 1) * LEG_VH + 100}vh` }}
        >
          <div className="sticky top-0 h-screen overflow-hidden bg-[var(--kr-void)]">
            {/* Room. Sits under everything, including the tag's canvas. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 70% 55% at 64% 46%, rgba(150,238,96,0.07), transparent 70%), linear-gradient(180deg, #0b0e07 0%, #0f1209 55%, #0b0e07 100%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(60,92,42,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(60,92,42,0.12) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
                maskImage: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
                transform: 'perspective(900px) rotateX(58deg)',
                transformOrigin: '50% 100%',
              }}
            />

            {/* Station 0 — the only 3D object on the table. Canvas is alpha so
                the page room shows through; no solid WebGL clear-colour box. */}
            {glMounted && (
              <div
                aria-hidden="true"
                className="absolute inset-0 transition-opacity duration-300"
                style={{ opacity: tagOn ? 1 : 0, pointerEvents: tagOn ? 'auto' : 'none' }}
              >
                <Suspense fallback={null}>
                  <Canvas
                    className="!absolute inset-0"
                    style={{ background: 'transparent' }}
                    dpr={[1, 1.75]}
                    frameloop={tagOn || !warmed ? 'always' : 'never'}
                    camera={{ position: STATIONS[0].cam, fov: 38, near: 0.1, far: 40 }}
                    gl={{
                      antialias: true,
                      alpha: true,
                      premultipliedAlpha: false,
                      powerPreference: 'high-performance',
                    }}
                    onCreated={({ gl }) => {
                      gl.setClearColor(0x000000, 0)
                      // A short always-on burst compiles Bloom before the
                      // walk reaches the tag; after that we sleep until needed.
                      window.setTimeout(() => setWarmed(true), 700)
                    }}
                  >
                    <EvidenceScene pointerRef={pointerRef} />
                  </Canvas>
                </Suspense>
              </div>
            )}

            {/* Caption left, screen right — both columns crossfade together. */}
            <div
              aria-hidden="true"
              className="pointer-events-none relative mx-auto grid h-full max-w-[88rem] grid-cols-[26rem_minmax(0,1fr)] items-center gap-10 px-8 pt-32 pb-28 xl:grid-cols-[28rem_minmax(0,1fr)] xl:gap-14"
            >
              <div className="relative h-full">
                {STATIONS.map((s, i) => (
                  <div
                    key={s.id}
                    ref={(el) => {
                      capRefs.current[i] = el
                    }}
                    className="absolute inset-0 flex items-center will-change-[transform,opacity]"
                    style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? 'visible' : 'hidden' }}
                  >
                    <div className="kr-caption w-full rounded-[4px] border border-[var(--kr-edge-strong)] bg-[color-mix(in_srgb,#0f1209_88%,transparent)] p-6 backdrop-blur-md">
                      <p className="kr-doc-label text-[10px] text-[var(--kr-lime)]">{s.where}</p>
                      <h3 data-cap-title className="kr-display mt-3 text-[1.6rem] leading-[1.1]">
                        {s.title}
                      </h3>
                      <p
                        data-cap-body
                        className="mt-3.5 text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]"
                      >
                        {s.body}
                      </p>
                      <Notes station={s} activeNote={i === 1 ? activeNote : null} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative h-full">
                {/* Both documents, on one sheet. Sized by this column rather
                    than by a hand-tuned camera, so the paper is framed the
                    same way the screenshots beside it are. */}
                {glMounted && (
                  <div
                    ref={paperRef}
                    className="absolute inset-0 will-change-[transform,opacity]"
                    style={{ opacity: 0, visibility: 'hidden' }}
                  >
                    <Suspense fallback={null}>
                      <PaperStage
                        variant={paperVariant}
                        progressRef={paperProgressRef}
                        pointerRef={pointerRef}
                        active={paperOn}
                      />
                    </Suspense>
                  </div>
                )}

                {STATIONS.map((s, i) => (
                  <div
                    key={s.id}
                    ref={(el) => {
                      mediaRefs.current[i] = el
                    }}
                    className="absolute inset-0 flex items-center justify-center gap-5 will-change-[transform,opacity]"
                    style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? 'visible' : 'hidden' }}
                  >
                    <StationMedia station={s} phoneNote={activeNote} />
                  </div>
                ))}
              </div>
            </div>

            {/* Chrome */}
            <div className="pointer-events-none absolute inset-x-0 top-16 z-10">
              <div className="mx-auto flex max-w-[88rem] items-center justify-between gap-8 px-8 pt-6">
                <p className="kr-doc-label text-[10px] text-[var(--kr-ink-3)]">
                  One record · {STATIONS.length} stations
                </p>
                <ol aria-hidden="true" className="flex items-center gap-1">
                  {STATIONS.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-1">
                      {i > 0 && (
                        <span
                          className="block h-px w-8 transition-colors duration-500"
                          style={{
                            background: i <= active ? 'var(--kr-lime)' : 'var(--kr-edge-strong)',
                          }}
                        />
                      )}
                      <span
                        className="kr-meas rounded-[2px] px-2 py-1 text-[10.5px] tracking-wide transition-colors duration-500"
                        style={{
                          color: i === active ? 'var(--kr-lime)' : 'var(--kr-ink-3)',
                          background:
                            i === active
                              ? 'color-mix(in srgb, #96ee60 12%, transparent)'
                              : 'transparent',
                        }}
                      >
                        {s.rail}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-10">
              <div className="mx-auto flex max-w-[88rem] items-end justify-between gap-8 px-8 pb-8">
                <div>
                  <button
                    type="button"
                    onClick={playing ? stopTour : startTour}
                    className="kr-meas inline-flex items-center gap-2.5 rounded-full border border-[var(--kr-edge-strong)] bg-[color-mix(in_srgb,#0f1209_90%,transparent)] py-2 pr-4 pl-2.5 text-[11px] tracking-wide text-[var(--kr-ink)] backdrop-blur-md transition-colors duration-200 hover:border-[var(--kr-lime)] hover:text-[var(--kr-lime)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kr-lime)]"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,#96ee60_16%,transparent)] text-[var(--kr-lime)]"
                    >
                      {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </span>
                    {playing ? 'Pause the walk' : 'Play the walk'}
                    <span className="text-[var(--kr-ink-3)]">{TOUR_SECONDS}s</span>
                  </button>

                  <div
                    aria-hidden="true"
                    className="mt-3 h-px w-[14rem] overflow-hidden bg-[var(--kr-edge-strong)]"
                  >
                    <span
                      ref={barRef}
                      className="block h-full w-full origin-left bg-[var(--kr-lime)]"
                      style={{ transform: 'scaleX(0)' }}
                    />
                  </div>
                </div>

                <p
                  aria-hidden="true"
                  className="kr-meas pb-1 text-[10px] tracking-wide text-[var(--kr-ink-3)]"
                >
                  ACTUAL PRODUCT SCREENS · DEMONSTRATION DATA
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={enhanced ? 'lg:sr-only' : undefined}>
        <div className="mx-auto max-w-[84rem] px-5 pb-20 sm:px-8">
          <ol className="space-y-16">
            {STATIONS.map((s) => {
              const media = mediaOf(s)
              return (
                <li
                  key={s.id}
                  className="kr-rise grid gap-7 md:grid-cols-2 md:items-center md:gap-12"
                >
                  <div className="flex items-end justify-center gap-4 rounded-[4px] border border-[var(--kr-edge)] bg-[var(--kr-ground)] p-4 sm:p-6">
                    {s.id === 'tag' ? (
                      <CheckpointLabel />
                    ) : s.paper === 'incident' ? (
                      <IncidentSheet className="w-full max-w-[34rem]" />
                    ) : s.paper === 'report' ? (
                      <ReportSheet className="w-full max-w-[34rem]" />
                    ) : (
                      media.map((m, i) => (
                        <img
                          key={m.src}
                          src={m.src}
                          srcSet={shotSrcSet(m.src)}
                          alt={i === 0 ? s.alt : ''}
                          loading="lazy"
                          decoding="async"
                          className={
                            i === 0
                              ? `rounded-[3px] border border-[var(--kr-edge)] ${
                                  m.kind === 'phone'
                                    ? 'max-h-[30rem] w-auto'
                                    : 'w-full max-w-[30rem]'
                                }`
                              : `hidden rounded-[3px] border border-[var(--kr-edge)] sm:block ${
                                  m.kind === 'phone' ? 'w-[7rem]' : 'w-[11rem]'
                                }`
                          }
                        />
                      ))
                    )}
                  </div>

                  <div>
                    <p className="kr-doc-label text-[10px] text-[var(--kr-lime)]">{s.where}</p>
                    <h3 className="kr-display mt-2.5 text-[1.5rem] leading-[1.1]">{s.title}</h3>
                    <p className="mt-3.5 max-w-[34rem] text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
                      {s.body}
                    </p>
                    <Notes station={s} activeNote={null} />
                  </div>
                </li>
              )
            })}
          </ol>

          <p className="kr-meas mt-10 text-[10px] tracking-wide text-[var(--kr-ink-3)]">
            ACTUAL PRODUCT SCREENS · DEMONSTRATION DATA
          </p>
        </div>
      </div>
    </section>
  )
}
