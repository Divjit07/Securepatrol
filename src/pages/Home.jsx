/**
 * KRONUS — public homepage (Persuade)
 *
 * THESIS: a security company's real product to its own client is the proof document.
 * So the page IS that document. It refuses the category arrangement — navy hero,
 * gradient pill, borrowed logo wall, /01 feature strip, floating phone mockup.
 *
 * OWN-WORLD: Dark Ops at its deep end (olive-black #0f1209 ground, raised olive
 * surfaces, lime #96ee60 as the only signal) with warm client stock (#f7f6f2) as a
 * real material field, lit in 3D. Archivo for the filed-document voice, DM Sans for
 * body, the mono stack for every measurement. Hairlines, never shadows.
 *
 * STORY: this is what your client sees when you run Kronus → every line on it started
 * as a GPS-validated tap on a wall → the chain from sticker to invoice never breaks →
 * book a demo.
 *
 * FIRST VIEWPORT: headline and primary action low-left in the dark; a real sheet of
 * paper standing at right, three-quarters, catching a warm key light, writing itself
 * one verified scan at a time until the stamp sets.
 *
 * FORM: The Client Report — candidate 6 of the ordered grounded list, staged in the
 * inherited Dark Ops world. Surface seed key d8a7b9a7 (assigned index 6).
 */

import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Nfc,
  QrCode,
  Radio,
  TriangleAlert,
  WifiOff,
} from 'lucide-react'
import ReportSheet from '../components/home/ReportSheet.jsx'
import ChainGlyph from '../components/home/ChainGlyph.jsx'
import { EagleMark } from '../components/home/EagleMark.jsx'
import {
  RosterSheet,
  TimesheetSheet,
  IncidentSheet,
  CheckpointLabel,
} from '../components/home/Artifacts.jsx'
import { CHAIN, REPORT } from '../components/home/reportData.js'

const PaperCanvas = lazy(() => import('../components/home/PaperCanvas.jsx'))
const SiteField = lazy(() => import('../components/home/SiteField.jsx'))

gsap.registerPlugin(ScrollTrigger)

/* TODO(owner): replace with the real demo destination — a scheduling link or a
   monitored inbox. This placeholder address is not wired to anything. */
const DEMO_HREF = 'mailto:hello@prodsec.ca?subject=Kronus%20demo'

const NAV = [
  { label: 'The record', href: '#record' },
  { label: 'Operations', href: '#operations' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Questions', href: '#questions' },
]

/** What the admin sees while the client's report writes itself. Synthetic. */
const BOARD = [
  { site: 'Northgate Tower', guard: 'A. Okonkwo', state: 'on-post', detail: 'Round 5 of 6 · L4' },
  { site: 'Bay & King', guard: 'M. Dubois', state: 'on-post', detail: 'Round 2 of 8 · P1' },
  { site: 'Harbour Yards', guard: 'R. Sandhu', state: 'alert', detail: 'No scan for 74 min' },
  { site: 'Civic Centre', guard: 'Open shift', state: 'open', detail: '22:00 — 06:00 · unclaimed' },
  { site: 'Westline Depot', guard: 'J. Baptiste', state: 'on-post', detail: 'Round 4 of 5 · Gate 2' },
]

const LEDGER = [
  {
    ref: 'A',
    title: 'Roster',
    body: 'Drag-drop scheduling with templates, recurrence and conflict detection. Build it as a draft, publish when it is right — publishing emails every guard a calendar invite.',
  },
  {
    ref: 'B',
    title: 'Open shifts',
    body: 'Post a gap and let qualified guards claim it. The claim is race-safe, so two guards tapping at once cannot both take the shift.',
  },
  {
    ref: 'C',
    title: 'Payroll',
    body: '15-minute rounding and the overtime split, derived over immutable punches. Manual adjustments and statutory holidays are recorded as adjustments, never as edits.',
  },
  {
    ref: 'D',
    title: 'Timesheets',
    body: 'Guards sign off their own hours before payroll closes, so a disputed shift is settled against the scan record rather than from memory.',
  },
  {
    ref: 'E',
    title: 'Incidents',
    body: 'A field report with photo attachments, filed from the phone, delivered by email and as a PDF the client can keep.',
  },
  {
    ref: 'F',
    title: 'Client portal',
    body: 'Read-only access for the building owner: who is on duty, scan history, coverage, hours, incidents, PDF export. You stop being the middleman for status requests.',
  },
  {
    ref: 'G',
    title: 'Watch',
    body: 'A ten-minute cycle raises late, no-show and stale-patrol alerts on its own, so a quiet site is not mistaken for a covered one.',
  },
  {
    ref: 'H',
    title: 'Sites',
    body: 'Multi-floor buildings, per-site operating hours, and checkpoints that can be normal patrol points or clock-in points.',
  },
]

/**
 * Three shapes of operation, not three feature gates. Every tier is the whole
 * platform — that is the honest description of the product and it is also the
 * difference from competitors who withhold alerts or client access until you
 * upgrade. No figures appear: none have been set, so none are invented.
 */
const PLANS = [
  {
    id: 'post',
    name: 'Post',
    shape: 'One site, one or two shifts a day',
    who: 'A single contract you cannot afford to lose — a condo board, one building, one guard on nights.',
    scope: ['1 site', 'Up to ~15 guards', 'Checkpoints on one or two floors'],
  },
  {
    id: 'patrol',
    name: 'Patrol',
    shape: 'Several sites, a roster that moves every week',
    who: 'The shape most guard companies actually are: mobile patrol plus static posts, and a schedule that never sits still.',
    scope: ['2–20 sites', 'Up to ~120 guards', 'Multi-floor sites, open-shift claiming'],
    lead: true,
  },
  {
    id: 'command',
    name: 'Command',
    shape: 'Multiple regions and a lot of client reporting',
    who: 'Enough contracts that the office job is now reporting and payroll rather than scheduling.',
    scope: ['20+ sites', '120+ guards', 'Per-region operating hours and exports'],
  },
]

/** Included at every tier — because it is one platform, not a ladder. */
const INCLUDED = [
  'GPS-validated NFC and QR scanning',
  'Offline scan queue',
  'Clock-in on a checkpoint',
  'Roster: templates, recurrence, conflicts',
  'Draft → publish with calendar invites',
  'Open-shift claiming, race-safe',
  'Late, no-show and stale-patrol alerts',
  'Incident reports with photos and PDF',
  'Payroll: 15-min rounding, overtime split',
  'Timesheet sign-off by the guard',
  'Accounting CSV export',
  'Read-only client portal and PDF reports',
]

const QUESTIONS = [
  {
    q: 'How does a scan actually get verified?',
    a: 'Each checkpoint is a physical NFC tag or printed QR label, and its coordinates are recorded when you install it. When a guard taps it, the device position is checked against those coordinates — outside roughly 20 metres the pass does not count, and the guard is told why rather than left guessing.',
  },
  {
    q: 'What happens in a basement with no signal?',
    a: 'Scans queue on the device and sync when the phone gets a connection again. The guard keeps patrolling and the timestamps stay honest, because the time recorded is when the tag was tapped, not when the upload landed.',
  },
  {
    q: 'Can hours be edited after the fact?',
    a: 'Raw punches are immutable. Rounding, the overtime split and any manual adjustment are derived layers on top, so the original record of what happened is always still there to audit — which is the whole reason a client trusts the report.',
  },
  {
    q: 'Is clocking in separate from patrolling?',
    a: 'No, and that is deliberate. Clock-in is a pass scan on a checkpoint marked as a clock-in point, so attendance and patrol are one record. There is no button a guard can press from the parking lot.',
  },
  {
    q: 'Does the report hide problems?',
    a: 'It cannot. A late round or a missed scan stays on the record the client reads — you can see the raised alert in the sample above. Companies win contracts with this because a report that only ever says everything was fine is not evidence of anything.',
  },
  {
    q: 'Does it do facial recognition?',
    a: 'No. Face-based clock-in was designed for Kronus and then removed from the product. Identity is tied to the guard account and the physical tag they have to be standing at. Push notifications and a native iOS app are on the roadmap and are not shipped.',
  },
]

/**
 * Resolved once, synchronously, before first paint: deciding this in an effect made
 * the hero render the fallback and then re-animate, so the headline visibly popped,
 * blanked and faded back in.
 */
function useEnhancements() {
  const [on] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    try {
      const c = document.createElement('canvas')
      return !!(c.getContext('webgl2') || c.getContext('webgl'))
    } catch {
      return false
    }
  })
  return on
}

export default function Home() {
  const rootRef = useRef(null)
  const progressRef = useRef(0)
  const enhanced = useEnhancements()

  useEffect(() => {
    document.title = 'Kronus — proof your client can audit'
  }, [])

  useEffect(() => {
    if (!enhanced) {
      progressRef.current = 1
      return
    }
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      // The authored moment: the record writes itself as you arrive.
      gsap.to(progressRef, {
        current: 1,
        duration: 3.4,
        delay: 0.35,
        ease: 'power2.out',
      })

      gsap.from('[data-hero-line]', {
        opacity: 0,
        y: 26,
        filter: 'blur(6px)',
        duration: 1.1,
        stagger: 0.09,
        ease: 'expo.out',
        delay: 0.1,
      })

      // Section reveals — a fade with a small lift, never a slide. The offset is
      // set before any trigger is created, or anything already in view fires
      // `once` and then gets pushed down 18px permanently.
      gsap.set('.kr-rise', { y: 18 })
      gsap.utils.toArray('.kr-rise').forEach((el) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.62,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        })
      })

      // The chain: one pinned, scrubbed pass through the six links.
      const track = root.querySelector('[data-chain-track]')
      const pin = root.querySelector('[data-chain-pin]')
      if (track && pin && window.matchMedia('(min-width: 1024px)').matches) {
        const distance = () => track.scrollWidth - pin.clientWidth + 120
        gsap
          .timeline({
            scrollTrigger: {
              trigger: pin,
              start: 'top top',
              end: () => `+=${Math.max(600, distance() * 1.15)}`,
              scrub: 1,
              pin: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          })
          .to(track, { x: () => -distance(), ease: 'none' })
          .to('[data-chain-progress]', { scaleX: 1, ease: 'none' }, 0)
      }

      // One record, two sides — the client's half is uncovered, not faded in.
      gsap.from('[data-uncover]', {
        clipPath: 'inset(0% 0% 0% 100%)',
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: { trigger: '[data-uncover]', start: 'top 78%', once: true },
      })
    }, root)

    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [enhanced])

  return (
    <div ref={rootRef} className={`kr min-h-screen ${enhanced ? 'kr-js' : ''}`}>
      {/* The eagle's view of the beat, drifting under the whole page. */}
      {enhanced && (
        <Suspense fallback={null}>
          <SiteField />
        </Suspense>
      )}
      {/* Scrim: the field is atmosphere, and text legibility outranks it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(ellipse at 55% 35%, transparent 0%, color-mix(in srgb, #0f1209 78%, transparent) 68%)',
        }}
      />

      <div className="relative z-10">
      <a
        href="#record"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-[var(--kr-lime)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#0f1209]"
      >
        Skip to the record
      </a>

      {/* ---- Masthead: the document's own header, not a SaaS navbar ---------- */}
      <header className="sticky top-0 z-40 border-b border-[var(--kr-edge)] bg-[color-mix(in_srgb,#0f1209_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[84rem] items-center justify-between gap-6 px-5 sm:px-8">
          <p className="flex items-center gap-2.5">
            <EagleMark className="h-[1.35rem] w-[1.35rem] text-[var(--kr-lime)]" />
            <span
              className="kr-display text-lg"
              style={{ fontVariationSettings: '"wdth" 110' }}
            >
              KRONUS
            </span>
          </p>

          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded px-3 py-2 text-sm text-[var(--kr-ink-2)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,#96ee60_9%,transparent)] hover:text-[var(--kr-ink)]"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded px-3 py-2 text-sm text-[var(--kr-ink-2)] transition-colors duration-200 hover:text-[var(--kr-ink)]"
            >
              Sign in
            </Link>
            <a
              href={DEMO_HREF}
              className="rounded-[3px] bg-[var(--kr-lime)] px-4 py-2 text-sm font-semibold text-[#0f1209] transition-all duration-200 hover:bg-[color-mix(in_srgb,#96ee60_82%,white)]"
            >
              Book a demo
            </a>

            {/* Section index on small screens, where the inline nav cannot fit. */}
            <details className="group relative md:hidden">
              <summary
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[3px] border border-[var(--kr-edge-strong)] text-[var(--kr-ink-2)] [&::-webkit-details-marker]:hidden"
                aria-label="Open section index"
              >
                <ChevronDown
                  className="h-4 w-4 transition-transform duration-300 group-open:rotate-180"
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
              </summary>
              <nav
                aria-label="Sections"
                className="absolute right-0 z-50 mt-2 w-56 rounded-[4px] border border-[var(--kr-edge-strong)] bg-[var(--kr-raise)] p-2"
              >
                <ul>
                  {NAV.map((n) => (
                    <li key={n.href}>
                      <a
                        href={n.href}
                        className="block rounded-[2px] px-3 py-2.5 text-sm text-[var(--kr-ink-2)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,#96ee60_10%,transparent)] hover:text-[var(--kr-ink)]"
                      >
                        {n.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          </div>
        </div>
      </header>

      {/* ================= HERO ============================================= */}
      <section className="relative overflow-hidden border-b border-[var(--kr-edge)]">
        {/* One warm pool of light on the ground, as if the sheet were lit on a desk. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-10%] right-[-6%] h-[62rem] w-[62rem] rounded-full opacity-[0.5]"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, #ecfab5 16%, transparent) 0%, transparent 62%)',
          }}
        />

        <div className="relative mx-auto grid max-w-[84rem] items-center gap-y-14 px-5 pt-16 pb-20 sm:px-8 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-x-12 lg:pt-28 lg:pb-28">
          <div className="max-w-[34rem]">
            <p
              data-hero-line
              className="kr-meas mb-7 flex items-center gap-2.5 text-[11px] tracking-wide text-[var(--kr-ink-3)]"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--kr-lime)]" />
              PVR-2026-0724-NGT · filed 06:04
            </p>

            <h1
              data-hero-line
              className="kr-display text-[2.75rem] leading-[0.95] sm:text-[3.9rem] lg:text-[4.4rem]"
            >
              Hand your client the record, not a summary.
            </h1>

            <p
              data-hero-line
              className="mt-7 max-w-[33rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)] sm:text-lg"
            >
              Kronus runs scheduling, patrol verification and payroll for security
              companies. Every line your client reads began as a guard tapping a tag on a
              wall, inside a verified GPS radius — and nothing downstream can be typed over
              it.
            </p>

            <div data-hero-line className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href={DEMO_HREF}
                className="group inline-flex items-center gap-2 rounded-[3px] bg-[var(--kr-lime)] px-6 py-3.5 font-semibold text-[#0f1209] transition-all duration-200 hover:bg-[color-mix(in_srgb,#96ee60_80%,white)]"
              >
                Book a demo
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </a>
              <a
                href="#record"
                className="inline-flex items-center gap-2 rounded-[3px] border border-[var(--kr-edge-strong)] px-6 py-3.5 font-semibold text-[var(--kr-ink)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,#96ee60_8%,transparent)]"
              >
                Follow one scan
                <ChevronDown className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </a>
            </div>

            <dl
              data-hero-line
              className="mt-11 flex flex-wrap gap-x-9 gap-y-5 border-t border-[var(--kr-edge)] pt-7"
            >
              {[
                { l: 'Verified by', v: 'NFC · QR · GPS', icon: Nfc },
                { l: 'Radius', v: `${REPORT.radius} of the tag`, icon: QrCode },
                { l: 'Watch cycle', v: 'every 10 min', icon: Radio },
              ].map((s) => (
                <div key={s.l} className="flex items-start gap-2.5">
                  <s.icon
                    className="mt-1 h-4 w-4 shrink-0 text-[var(--kr-lime)]"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <div>
                    <dt className="kr-doc-label text-[10px] text-[var(--kr-ink-3)]">{s.l}</dt>
                    <dd className="kr-meas mt-1 text-sm text-[var(--kr-ink)]">{s.v}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* The sheet. WebGL where it can run, the real document where it cannot. */}
          <div className="relative">
            <div className="relative min-h-[26rem] sm:min-h-[32rem] lg:min-h-[40rem]">
              {enhanced ? (
                <Suspense fallback={null}>
                  <PaperCanvas progressRef={progressRef} />
                </Suspense>
              ) : (
                <ReportSheet compact className="mx-auto max-w-[34rem]" />
              )}
            </div>

            {/* The accessible copy of the sheet is always present. */}
            {enhanced && (
              <div className="sr-only">
                <ReportSheet />
              </div>
            )}

            <p className="kr-meas mt-4 text-center text-[10.5px] tracking-wide text-[var(--kr-ink-3)]">
              SAMPLE REPORT · SYNTHETIC DATA, NOT A CUSTOMER RECORD
            </p>
          </div>
        </div>
      </section>

      {/* ================= THE CHAIN ======================================== */}
      <section id="record" className="border-b border-[var(--kr-edge)]">
        <div className="mx-auto max-w-[84rem] px-5 pt-20 pb-12 sm:px-8 sm:pt-28">
          <div className="kr-rise max-w-[46rem]">
            <p className="kr-doc-label mb-5 text-[11px] text-[var(--kr-lime)]">
              Chain of custody
            </p>
            <h2 className="kr-display text-[2.25rem] sm:text-[3.1rem]">
              Every number starts on a wall.
            </h2>
            <p className="mt-6 max-w-[38rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)]">
              Most guard software starts with a form. Kronus starts with a physical object
              in a building, and follows it all the way to the invoice line. Six links, no
              gap where a number could be entered by hand.
            </p>
          </div>
        </div>

        {/* Pinned and scrubbed on desktop; an honest vertical rail on smaller screens. */}
        <div
          data-chain-pin
          className="overflow-hidden pb-20 lg:flex lg:h-screen lg:max-h-[54rem] lg:min-h-[34rem] lg:flex-col lg:pb-0"
        >
          {/* Stays put through the pin, and clears the sticky masthead. */}
          <div className="mx-auto hidden w-full max-w-[84rem] items-end justify-between gap-6 border-b border-[var(--kr-edge)] px-5 pt-20 pb-5 sm:px-8 lg:flex">
            <p className="kr-doc-label text-[10px] text-[var(--kr-ink-3)]">
              Chain of custody
            </p>
            <p className="kr-meas shrink-0 text-[11px] text-[var(--kr-ink-3)]">
              PVR-2026-0724-NGT · 6 links
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-[84rem] flex-1 flex-col justify-center px-5 sm:px-8 lg:py-10">
            <ol
              data-chain-track
              className="relative flex flex-col gap-10 lg:w-max lg:flex-row lg:gap-0 lg:will-change-transform"
            >
              {/* The chain itself — continuous, because the point is that it never
                  breaks. Scrub position is reported by the rail at the foot instead. */}
              <span
                aria-hidden="true"
                className="absolute top-[2.6rem] left-0 hidden h-px w-full bg-[var(--kr-edge-strong)] lg:block"
              />

              {CHAIN.map((link, i) => (
                <li
                  key={link.id}
                  className="kr-rise relative flex gap-5 lg:w-[25rem] lg:shrink-0 lg:flex-col lg:gap-0 lg:pr-14"
                >
                  {/* Mobile rail */}
                  <div
                    aria-hidden="true"
                    className="relative flex w-6 shrink-0 justify-center lg:hidden"
                  >
                    <span className="absolute top-8 bottom-[-2.5rem] w-px bg-[var(--kr-edge)]" />
                    <span className="relative z-10 mt-1.5 h-3 w-3 rounded-full border border-[var(--kr-lime)] bg-[var(--kr-void)]" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 lg:h-8">
                      <span className="kr-meas text-sm text-[var(--kr-lime)]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="kr-doc-label text-[11px] text-[var(--kr-ink-3)]">
                        {link.step}
                      </span>
                    </div>

                    {/* Node on the chain — aligned to the rail on desktop. */}
                    <span
                      aria-hidden="true"
                      className="mt-[0.6rem] hidden h-3 w-3 rounded-full border border-[var(--kr-lime)] bg-[var(--kr-void)] lg:block"
                    />

                    <ChainGlyph
                      id={link.id}
                      className="mt-8 h-10 w-10 text-[var(--kr-lime)] lg:mt-9"
                    />

                    <h3 className="kr-display mt-6 text-[1.4rem] leading-[1.12] sm:text-[1.55rem]">
                      {link.title}
                    </h3>
                    <p className="mt-3.5 max-w-[21rem] text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
                      {link.body}
                    </p>
                    <p className="kr-meas mt-5 inline-block rounded-[2px] border border-[var(--kr-edge)] bg-[var(--kr-ground)] px-2.5 py-1.5 text-xs text-[var(--kr-lime)]">
                      {link.meas}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Scrub position, so a pinned section still tells you where you are. */}
          <div className="mx-auto hidden w-full max-w-[84rem] px-5 pb-8 sm:px-8 lg:block">
            <span className="block h-px w-full bg-[var(--kr-edge)]">
              <span
                aria-hidden="true"
                data-chain-progress
                className="block h-px w-full origin-left scale-x-0 bg-[var(--kr-lime)]"
              />
            </span>
          </div>
        </div>
      </section>

      {/* ================= ONE RECORD, TWO SIDES ============================ */}
      <section
        id="operations"
        className="border-b border-[var(--kr-edge)] bg-[var(--kr-ground)]"
      >
        <div className="mx-auto max-w-[84rem] px-5 py-20 sm:px-8 sm:py-28">
          <div className="kr-rise max-w-[46rem]">
            <p className="kr-doc-label mb-5 text-[11px] text-[var(--kr-lime)]">
              One record, two sides
            </p>
            <h2 className="kr-display text-[2.25rem] sm:text-[3.1rem]">
              You watch the night. They read the morning.
            </h2>
            <p className="mt-6 max-w-[38rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)]">
              The same events, rendered for two different people. Nobody retypes anything
              between these two panels — the left is the live state of the record, the right
              is that record printed for the building owner.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8">
            {/* Operator side */}
            <div className="kr-rise min-w-0 rounded-[4px] border border-[var(--kr-edge)] bg-[var(--kr-void)]">
              <div className="flex items-center justify-between border-b border-[var(--kr-edge)] px-5 py-3.5">
                <p className="kr-doc-label text-[10px] text-[var(--kr-ink-3)]">
                  Your console · 02:14
                </p>
                <p className="kr-meas flex items-center gap-2 text-[11px] text-[var(--kr-lime)]">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--kr-lime)]" />
                  LIVE
                </p>
              </div>

              <ul className="divide-y divide-[var(--kr-edge)]">
                {BOARD.map((b) => (
                  <li
                    key={b.site}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--kr-ink)]">
                        {b.site}
                      </p>
                      <p className="kr-meas mt-1 truncate text-[11.5px] text-[var(--kr-ink-3)]">
                        {b.guard} · {b.detail}
                      </p>
                    </div>
                    <span
                      className={`kr-doc-label shrink-0 rounded-[2px] px-2 py-1 text-[9.5px] ${
                        b.state === 'alert'
                          ? 'bg-[color-mix(in_srgb,#ef4444_18%,transparent)] text-[#ff9a95]'
                          : b.state === 'open'
                            ? 'bg-[color-mix(in_srgb,#ecfab5_14%,transparent)] text-[var(--kr-meadow)]'
                            : 'bg-[color-mix(in_srgb,#96ee60_14%,transparent)] text-[var(--kr-lime)]'
                      }`}
                    >
                      {b.state === 'alert'
                        ? 'Stale patrol'
                        : b.state === 'open'
                          ? 'Unclaimed'
                          : 'On post'}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-start gap-3 border-t border-[var(--kr-edge)] bg-[color-mix(in_srgb,#ef4444_9%,transparent)] px-5 py-4">
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9a95]"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                <p className="text-[13px] leading-relaxed text-[var(--kr-ink-2)]">
                  <span className="font-semibold text-[var(--kr-ink)]">
                    Harbour Yards raised itself.
                  </span>{' '}
                  Nobody was watching that site at 01:36. The ten-minute cycle noticed the
                  gap and told you before the client could.
                </p>
              </div>
            </div>

            {/* Client side — uncovered rather than faded in. */}
            <div data-uncover className="kr-rise min-w-0">
              <ReportSheet compact />
              <p className="kr-meas mt-3 text-[10.5px] tracking-wide text-[var(--kr-ink-3)]">
                SYNTHETIC SAMPLE DATA · NOT A CUSTOMER RECORD
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ================= WHAT THE RECORD PRODUCES ========================= */}
      <section id="artifacts" className="border-b border-[var(--kr-edge)]">
        <div className="mx-auto max-w-[84rem] px-5 py-20 sm:px-8 sm:py-28">
          <div className="kr-rise max-w-[46rem]">
            <p className="kr-doc-label mb-5 text-[11px] text-[var(--kr-lime)]">Output</p>
            <h2 className="kr-display text-[2.25rem] sm:text-[3.1rem]">
              Everything downstream is paper you can hand someone.
            </h2>
            <p className="mt-6 max-w-[38rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)]">
              A roster your guards can act on, a payroll line your bookkeeper can post, an
              incident your client reads the same night, and the label on the wall that
              started it. Four documents, one record underneath — these are real samples on
              synthetic data.
            </p>
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-14">
            {[
              {
                key: 'roster',
                node: <RosterSheet />,
                tilt: '-0.5deg',
                title: 'The week, published',
                body:
                  'Build it as a draft and nothing moves. Publish, and every guard gets a calendar invite for their own shifts — while the one gap you could not fill stays claimable instead of quietly forgotten.',
              },
              {
                key: 'pay',
                node: <TimesheetSheet />,
                tilt: '0.6deg',
                title: 'Hours nobody retyped',
                body:
                  'Raw punches at the top, then rounding and the overtime split calculated on top of them. The guard signs it before payroll closes, so a disputed shift is argued against the scan record instead of memory.',
              },
              {
                key: 'incident',
                node: <IncidentSheet />,
                tilt: '-0.7deg',
                title: 'Filed at 22:58, read by 23:11',
                body:
                  'The guard files it from the phone with photos attached while standing there. Your client gets the email and the PDF the same night — before they hear about it from a tenant.',
              },
              {
                key: 'label',
                node: <CheckpointLabel />,
                tilt: '0.8deg',
                title: 'Where the chain starts',
                body:
                  'An NFC tag or printed label, mounted at a real spot, carrying its own reference, coordinates and radius. Every number on every document above traces back to something like this on a wall.',
              },
            ].map((a) => (
              <div key={a.key} className="kr-rise min-w-0">
                <div
                  className="transition-transform duration-500 hover:rotate-0"
                  style={{ transform: `rotate(${a.tilt})` }}
                >
                  {a.node}
                </div>
                <div className="mt-6 border-t border-[var(--kr-edge)] pt-5">
                  <h3 className="kr-display text-[1.3rem]">{a.title}</h3>
                  <p className="mt-3 max-w-[34rem] text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
                    {a.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THE REST OF THE RECORD =========================== */}
      <section className="border-b border-[var(--kr-edge)]">
        <div className="mx-auto max-w-[84rem] px-5 py-20 sm:px-8 sm:py-28">
          <div className="kr-rise max-w-[46rem]">
            <p className="kr-doc-label mb-5 text-[11px] text-[var(--kr-lime)]">Contents</p>
            <h2 className="kr-display text-[2.25rem] sm:text-[3.1rem]">
              What else runs off the same record.
            </h2>
          </div>

          <dl className="mt-12 border-t border-[var(--kr-edge)]">
            {LEDGER.map((item) => (
              <div
                key={item.ref}
                className="kr-rise grid gap-2 border-b border-[var(--kr-edge)] py-6 transition-colors duration-200 hover:bg-[color-mix(in_srgb,#96ee60_5%,transparent)] sm:grid-cols-[3rem_minmax(0,14rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6"
              >
                <dt className="kr-meas text-sm text-[var(--kr-lime)]">{item.ref}</dt>
                <dt className="kr-display text-[1.3rem] leading-tight">{item.title}</dt>
                <dd className="max-w-[42rem] text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ================= THE QUIET PASSAGE: THE NIGHT SHIFT =============== */}
      <section className="border-b border-[var(--kr-edge)] bg-[var(--kr-ground)]">
        <div className="mx-auto max-w-[52rem] px-5 py-24 text-center sm:px-8 sm:py-36">
          <WifiOff
            className="kr-rise mx-auto h-7 w-7 text-[var(--kr-ink-3)]"
            strokeWidth={1.6}
            aria-hidden="true"
          />
          <p className="kr-rise kr-display mt-9 text-[1.9rem] leading-[1.18] sm:text-[2.6rem]">
            A parkade at 03:00 has no signal, and your guard is alone down there.
          </p>
          <p className="kr-rise mx-auto mt-7 max-w-[38rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)]">
            Scans queue on the device and sync when the phone comes back up. The recorded
            time is when the tag was tapped, not when the upload finally landed — so the
            record survives the basement, and so does the payroll that comes off it.
          </p>
        </div>
      </section>

      {/* ================= PRICING ========================================= */}
      <section id="pricing" className="border-b border-[var(--kr-edge)]">
        <div className="mx-auto max-w-[84rem] px-5 py-20 sm:px-8 sm:py-28">
          <div className="kr-rise max-w-[48rem]">
            <p className="kr-doc-label mb-5 text-[11px] text-[var(--kr-lime)]">
              Scope of work
            </p>
            <h2 className="kr-display text-[2.25rem] sm:text-[3.1rem]">
              Priced against your posts, not per seat.
            </h2>
            <p className="mt-6 max-w-[38rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)]">
              A twelve-guard company with one building and a forty-guard company with thirty
              are not the same job to run, and a per-user price pretends they are. Pick the
              shape that sounds like your operation; we quote against that.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3 lg:gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`kr-rise flex min-w-0 flex-col rounded-[4px] p-7 sm:p-8 ${
                  plan.lead
                    ? 'border border-[var(--kr-lime)] bg-[var(--kr-raise)]'
                    : 'border border-[var(--kr-edge)] bg-[var(--kr-ground)]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="kr-display text-[1.75rem]">{plan.name}</h3>
                  {plan.lead && (
                    <span className="kr-doc-label rounded-[2px] bg-[var(--kr-lime)] px-2 py-1 text-[9px] text-[#0f1209]">
                      Most operations
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[0.9375rem] leading-snug font-medium text-[var(--kr-ink)]">
                  {plan.shape}
                </p>
                <p className="mt-3.5 text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
                  {plan.who}
                </p>

                {/* The price field is left open, the way a quote form leaves it open.
                    No rate card exists yet, so inventing a number here would be a lie
                    on the one page whose whole argument is that records do not lie. */}
                <div className="mt-7 border-t border-[var(--kr-edge)] pt-5">
                  <p className="kr-doc-label text-[9.5px] text-[var(--kr-ink-3)]">
                    Monthly
                  </p>
                  <p className="mt-2 flex items-end gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mb-1.5 block h-px w-20 bg-[var(--kr-edge-strong)]"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(to right, currentColor 0 6px, transparent 6px 11px)',
                        color: 'var(--kr-ink-3)',
                        background: 'none',
                        height: '1px',
                      }}
                    />
                    <span className="kr-meas text-sm text-[var(--kr-ink-3)]">
                      to be quoted
                    </span>
                  </p>
                </div>

                <ul className="mt-6 space-y-2.5">
                  {plan.scope.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--kr-lime)]"
                        strokeWidth={2.8}
                        aria-hidden="true"
                      />
                      <span className="kr-meas text-[0.8125rem] text-[var(--kr-ink-2)]">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={DEMO_HREF}
                  className={`group mt-auto inline-flex items-center justify-center gap-2 rounded-[3px] px-5 py-3.5 pt-3.5 font-semibold transition-all duration-200 ${
                    plan.lead
                      ? 'bg-[var(--kr-lime)] text-[#0f1209] hover:bg-[color-mix(in_srgb,#96ee60_80%,white)]'
                      : 'border border-[var(--kr-edge-strong)] text-[var(--kr-ink)] hover:bg-[color-mix(in_srgb,#96ee60_8%,transparent)]'
                  }`}
                  style={{ marginTop: '2rem' }}
                >
                  Scope {plan.name}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </a>
              </div>
            ))}
          </div>

          {/* The differentiator worth saying out loud. */}
          <div className="kr-rise mt-6 rounded-[4px] border border-[var(--kr-edge)] bg-[var(--kr-ground)] p-7 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h3 className="kr-display text-[1.5rem]">
                Every tier is the whole platform.
              </h3>
              <p className="kr-meas text-[11px] text-[var(--kr-ink-3)]">
                no feature gates · no per-seat licence
              </p>
            </div>
            <p className="mt-4 max-w-[52rem] text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
              Tiers describe the size of your operation, not how much of the product you are
              allowed to use. Alerts, client access and payroll are not upsells — a company
              with one building needs a late-shift alert exactly as much as one with thirty.
            </p>

            <ul className="mt-7 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--kr-lime)]"
                    strokeWidth={2.8}
                    aria-hidden="true"
                  />
                  <span className="text-[0.875rem] leading-snug text-[var(--kr-ink-2)]">
                    {f}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-7 border-t border-[var(--kr-edge)] pt-5 text-[0.875rem] leading-relaxed text-[var(--kr-ink-3)]">
              Scoping looks at sites and floors, guards on the roster and how often it
              changes, checkpoints to install, whether your clients get portal access or
              PDFs, your payroll rules, and what has to come out as an accounting export.
            </p>
          </div>
        </div>
      </section>

      {/* ================= QUESTIONS ======================================= */}
      <section id="questions" className="border-b border-[var(--kr-edge)]">
        <div className="mx-auto grid max-w-[84rem] gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          <div className="kr-rise">
            <p className="kr-doc-label mb-5 text-[11px] text-[var(--kr-lime)]">Notes</p>
            <h2 className="kr-display text-[2.25rem] sm:text-[2.9rem]">
              The questions operators actually ask.
            </h2>
          </div>

          <div className="border-t border-[var(--kr-edge)]">
            {QUESTIONS.map((item) => (
              <details
                key={item.q}
                className="kr-rise group border-b border-[var(--kr-edge)]"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-6 py-5 text-left font-semibold text-[var(--kr-ink)] transition-colors duration-200 hover:text-[var(--kr-lime)] [&::-webkit-details-marker]:hidden">
                  <span className="text-[1.0625rem]">{item.q}</span>
                  <ChevronDown
                    className="mt-1 h-4 w-4 shrink-0 text-[var(--kr-ink-3)] transition-transform duration-300 group-open:rotate-180"
                    strokeWidth={2.4}
                    aria-hidden="true"
                  />
                </summary>
                <p className="max-w-[46rem] pb-6 text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CLOSE =========================================== */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-40%] left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full opacity-40"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, #96ee60 14%, transparent) 0%, transparent 65%)',
          }}
        />
        <div className="relative mx-auto max-w-[52rem] px-5 py-24 text-center sm:px-8 sm:py-32">
          <h2 className="kr-rise kr-display text-[2.4rem] leading-[1.02] sm:text-[3.4rem]">
            Show them the record.
          </h2>
          <p className="kr-rise mx-auto mt-7 max-w-[34rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)]">
            Bring a site, a roster and one difficult client. We will walk the chain from a
            tag on the wall to the report that lands in their inbox.
          </p>
          <div className="kr-rise mt-10 flex flex-wrap justify-center gap-3">
            <a
              href={DEMO_HREF}
              className="group inline-flex items-center gap-2 rounded-[3px] bg-[var(--kr-lime)] px-7 py-4 font-semibold text-[#0f1209] transition-all duration-200 hover:bg-[color-mix(in_srgb,#96ee60_80%,white)]"
            >
              Book a demo
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-[3px] border border-[var(--kr-edge-strong)] px-7 py-4 font-semibold text-[var(--kr-ink)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,#96ee60_8%,transparent)]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Colophon ------------------------------------------------------ */}
      <footer className="border-t border-[var(--kr-edge)] bg-[var(--kr-ground)]">
        <div className="mx-auto max-w-[84rem] px-5 py-12 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div>
              <p className="flex items-center gap-2.5">
                <EagleMark className="h-[1.35rem] w-[1.35rem] text-[var(--kr-lime)]" />
                <span
                  className="kr-display text-lg"
                  style={{ fontVariationSettings: '"wdth" 110' }}
                >
                  KRONUS
                </span>
              </p>
              <p className="mt-4 max-w-[22rem] text-sm leading-relaxed text-[var(--kr-ink-3)]">
                Security workforce operations — schedule, patrol, prove, pay. Built and run
                by Productive Security Inc.
              </p>
            </div>

            <nav aria-label="Portals" className="min-w-[10rem]">
              <p className="kr-doc-label text-[10px] text-[var(--kr-ink-3)]">Portals</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  { to: '/admin', label: 'Operations' },
                  { to: '/client', label: 'Client portal' },
                  { to: '/guard', label: 'Guard app' },
                ].map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="text-[var(--kr-ink-2)] transition-colors duration-200 hover:text-[var(--kr-lime)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="This page" className="min-w-[10rem]">
              <p className="kr-doc-label text-[10px] text-[var(--kr-ink-3)]">This page</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <a
                      href={n.href}
                      className="text-[var(--kr-ink-2)] transition-colors duration-200 hover:text-[var(--kr-lime)]"
                    >
                      {n.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="kr-meas mt-12 flex flex-wrap justify-between gap-4 border-t border-[var(--kr-edge)] pt-6 text-[11px] text-[var(--kr-ink-3)]">
            <span>© {new Date().getFullYear()} Productive Security Inc.</span>
            <span>All sample records on this page are synthetic.</span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  )
}
