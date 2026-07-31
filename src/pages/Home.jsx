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
 * as a tap on a tag bolted to a wall → the chain from sticker to invoice never breaks →
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
  Building2,
  FileDown,
  FileText,
  Lock,
  RefreshCw,
  Siren,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Layers,
  Nfc,
  QrCode,
  Radio,
  RadioTower,
  TriangleAlert,
  UserPlus,
  WifiOff,
} from 'lucide-react'
import ReportSheet from '../components/home/ReportSheet.jsx'
import EvidenceTable from '../components/home/EvidenceTable.jsx'
import ChainGlyph from '../components/home/ChainGlyph.jsx'
import { EagleMark } from '../components/home/EagleMark.jsx'
import {
  RosterSheet,
  TimesheetSheet,
  IncidentSheet,
  ScanReportSheet,
} from '../components/home/Artifacts.jsx'
import { CHAIN } from '../components/home/reportData.js'

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

const LEDGER = [
  {
    ref: 'A',
    chips: ['Templates', 'Recurrence', 'Conflict detection', 'Draft → publish', 'Calendar invites'],
    icon: CalendarDays,
    span: 'lg:col-span-2',
    title: 'Roster',
    body: 'Build the week as a draft and publish it when it is right. Publishing is the commit — every guard gets a calendar invite, and a double-booking is caught before anyone has been told to show up.',
  },
  {
    ref: 'B',
    icon: UserPlus,
    span: '',
    title: 'Open shifts',
    body: 'Post a gap and let qualified guards claim it. The claim is race-safe, so two guards tapping at once cannot both take the shift.',
  },
  {
    ref: 'C',
    icon: Calculator,
    span: '',
    title: 'Payroll',
    body: '15-minute rounding and the overtime split, derived over immutable punches. Manual adjustments and statutory holidays are recorded as adjustments, never as edits.',
  },
  {
    ref: 'D',
    icon: ClipboardCheck,
    span: '',
    title: 'Timesheets',
    body: 'Guards sign off their own hours before payroll closes, so a disputed shift is settled against the scan record rather than from memory.',
  },
  {
    ref: 'E',
    icon: TriangleAlert,
    span: '',
    title: 'Incidents',
    body: 'A field report with photo attachments, filed from the phone, delivered by email and as a PDF the client can keep.',
  },
  {
    ref: 'F',
    chips: ['Who is on duty', 'Scan history', 'Coverage', 'Hours', 'Incidents', 'PDF export'],
    icon: Building2,
    span: 'lg:col-span-2',
    title: 'Client portal',
    body: 'Read-only access for the building owner, scoped to their own site and nothing else. They stop phoning you for a status update, and you stop being the middleman between the night and the morning.',
  },
  {
    ref: 'G',
    icon: RadioTower,
    span: '',
    title: 'Watch',
    body: 'A ten-minute cycle raises late, no-show and stale-patrol alerts on its own, so a quiet site is not mistaken for a covered one.',
  },
  {
    ref: 'H',
    chips: ['Multi-floor buildings', 'Per-site operating hours', 'Patrol checkpoints', 'Clock-in checkpoints'],
    icon: Layers,
    span: 'lg:col-span-3',
    title: 'Sites',
    body: 'A site is more than a name on an invoice. Floors, hours and checkpoint behaviour are set per building, so a downtown tower and a fenced lock-up yard do not have to pretend to be the same shape.',
  },
]

/**
 * The rate card. Annual is the same product billed a year at a time at 20% off,
 * so the headline figure stays a monthly one on both tabs and the annual total
 * is stated underneath — a reader comparing plans should never have to divide.
 *
 * Every annual figure is exactly 12 × monthly less 20%, and each saving is that
 * difference. If a price changes, all four numbers on that plan change together.
 */
const PLANS = [
  {
    id: 'standard',
    name: 'Standard',
    line: 'Proof the round was walked',
    who: 'One site or a handful, and a client who wants to see that the patrol happened.',
    monthly: '99.99',
    annualMonthly: '79.99',
    annualTotal: '959.90',
    saving: '240',
    features: [
      'Guard check-in at every patrol point — the app logs the tap and the time',
      'Patrol history on your phone or desktop, any time',
      'Monthly patrol report as a PDF, every checkpoint hit',
      'Incident reports filed from the phone with photos attached',
      'Email alerts when a guard misses a patrol or runs late',
      'Email support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    line: 'See everything, in real time',
    who: 'The shape most guard companies actually are: several sites, a roster that moves, and mornings that start with questions.',
    monthly: '149.99',
    annualMonthly: '119.99',
    annualTotal: '1,439.90',
    saving: '360',
    lead: true,
    inherits: 'Everything in Standard, plus',
    features: [
      'Live clock in and out, timestamped to the minute',
      'Live view — watch patrols happen as they happen',
      'Guard hours log, so you can see exactly when each guard worked',
      'Schedule management: set who should be on duty when',
      'Daily operations email before 9 AM',
      'Ten incident categories, each with timestamp, location, photos and notes',
      'Weekly summary email',
      'Phone and email support',
    ],
    detail: {
      label: 'The morning email covers',
      items: [
        'Guards on duty yesterday and hours worked',
        'Patrols completed and checkpoints hit',
        'Incidents filed, with summaries',
        'Coverage gaps',
        'Total patrols and compliance %',
      ],
    },
  },
  {
    id: 'max',
    name: 'Max',
    line: 'Payroll and accounting, automatic',
    who: 'Enough contracts that the office job is now payroll and reporting rather than scheduling.',
    monthly: '199.99',
    annualMonthly: '159.99',
    annualTotal: '1,919.90',
    saving: '480',
    inherits: 'Everything in Premium, plus',
    features: [
      'Automatic paystubs — hours come from the app, no manual timesheets',
      'Canadian deductions built in: tax, EI and CPP',
      'QuickBooks sync, so payroll lands in your accounting without re-entry',
      'Also syncs with ADP, Dayforce, Wagepoint, Xero and Sage',
      'Service invoicing for extra coverage and call-outs',
      'Accounting CSV for your bookkeeper',
      'Priority support, phone and email, same-day response',
    ],
  },
]

/** Included at every tier — because it is one platform, not a ladder. */
const INCLUDED = [
  'NFC and QR checkpoint scanning',
  'Offline scan queue',
  'GPS-checked clock-in and clock-out',
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
    a: 'Each checkpoint is a physical NFC tag or printed QR label bolted to a real spot in the building. The tap is the proof: to log a pass the guard has to be standing there with a phone against the tag, and there is no button anywhere that says "I was here". Location does not come into it — GPS is used at clock-in and clock-out to confirm the guard is on site for the shift, which is a separate check from the round.',
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
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [billing, setBilling] = useState('monthly')

  useEffect(() => {
    document.title = 'Kronus — proof your client can audit'
  }, [])

  // The masthead condenses once you leave the top, so the document's header
  // takes less of the page the further into the record you are.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Which section you are actually reading, so the nav marks your place rather
  // than sitting inert. The margins keep the band at roughly mid-viewport.
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.href.slice(1))).filter(Boolean)
    if (!els.length) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id)
        })
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
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

      // Fail-safe. `.kr-js .kr-rise` starts at opacity 0, so anything that never
      // gets its trigger — a refresh landing at the wrong scroll position, an
      // image resizing the page under it, a hot reload swapping these nodes out
      // from under the context — would stay invisible for good. Copy going
      // permanently blank is a far worse outcome than a reveal that does not
      // animate, so sweep once on the next frame and again after load, and just
      // show anything still hidden that the reader can already reach.
      const reveal = () => {
        gsap.utils.toArray('.kr-rise').forEach((el) => {
          if (el.getBoundingClientRect().top > window.innerHeight) return
          if (Number(gsap.getProperty(el, 'opacity')) > 0.01) return
          gsap.set(el, { opacity: 1, y: 0 })
        })
      }
      requestAnimationFrame(reveal)
      window.addEventListener('load', reveal, { once: true })

      // The chain: the lime line draws down the run as you read it, and each
      // node sets as it reaches reading height and stays set — a link that has
      // been forged does not come apart again behind you.
      const track = root.querySelector('[data-chain-track]')
      if (track) {
        gsap.to('[data-chain-progress]', {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: track,
            start: 'top 62%',
            end: 'bottom 76%',
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        })

        gsap.utils.toArray('[data-chain-link]').forEach((link) => {
          ScrollTrigger.create({
            trigger: link,
            start: 'top 74%',
            once: true,
            onEnter: () => link.classList.add('is-on'),
          })
        })
      }
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

      {/* ---- Masthead: the document's own header, not a SaaS navbar ----------
           It condenses on scroll and marks the section you are reading, so it
           behaves like a document header rather than a fixed chrome bar. */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl transition-[background-color,box-shadow] duration-500"
        style={{
          background: scrolled
            ? 'color-mix(in srgb, #0f1209 94%, transparent)'
            : 'color-mix(in srgb, #0f1209 72%, transparent)',
          boxShadow: scrolled ? '0 18px 40px -32px rgba(0,0,0,0.9)' : 'none',
        }}
      >
        {/* The rule under the head is lit in the middle and fades at both ends,
            so the header sits on the page instead of being boxed off from it. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px transition-opacity duration-500"
          style={{
            opacity: scrolled ? 1 : 0.55,
            background:
              'linear-gradient(90deg, transparent 0%, var(--kr-edge) 12%, color-mix(in srgb, #96ee60 34%, transparent) 50%, var(--kr-edge) 88%, transparent 100%)',
          }}
        />

        <div
          className={`mx-auto flex max-w-[84rem] items-center justify-between gap-6 px-5 transition-[height] duration-500 sm:px-8 ${
            scrolled ? 'h-[3.4rem]' : 'h-[4.25rem]'
          }`}
        >
          <a href="#top" className="group flex items-center gap-2.5">
            <span className="relative flex items-center">
              {/* A faint lime bloom behind the mark — the one warm thing in the bar. */}
              <span
                aria-hidden="true"
                className="absolute -inset-2 rounded-full opacity-60 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    'radial-gradient(circle, color-mix(in srgb, #96ee60 26%, transparent) 0%, transparent 70%)',
                }}
              />
              <EagleMark className="relative h-[1.35rem] w-[1.35rem] text-[var(--kr-lime)]" />
            </span>
            <span
              className="kr-display text-lg"
              style={{ fontVariationSettings: '"wdth" 110' }}
            >
              KRONUS
            </span>
          </a>

          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const on = activeSection === n.href.slice(1)
              return (
                <a
                  key={n.href}
                  href={n.href}
                  aria-current={on ? 'true' : undefined}
                  className="group relative px-3 py-2 text-sm transition-colors duration-300"
                  style={{ color: on ? 'var(--kr-ink)' : 'var(--kr-ink-2)' }}
                >
                  <span className="transition-colors duration-300 group-hover:text-[var(--kr-ink)]">
                    {n.label}
                  </span>
                  {/* Draws from the centre on hover, and stays drawn for the
                      section you are in — the nav reports position, not just links. */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-2.5 bottom-1 h-px origin-center bg-[var(--kr-lime)] transition-transform duration-300 ease-out ${
                      on ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    }`}
                  />
                </a>
              )
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <Link
              to="/login"
              className="hidden rounded px-3 py-2 text-sm whitespace-nowrap text-[var(--kr-ink-2)] transition-colors duration-200 hover:text-[var(--kr-ink)] sm:block"
            >
              Sign in
            </Link>
            <a
              href={DEMO_HREF}
              className="rounded-[3px] bg-[var(--kr-lime)] px-3 py-2 text-[13px] font-semibold whitespace-nowrap text-[#0f1209] transition-all duration-300 hover:bg-[color-mix(in_srgb,#96ee60_82%,white)] hover:shadow-[0_10px_28px_-10px_color-mix(in_srgb,#96ee60_70%,transparent)] sm:px-4 sm:text-sm"
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
                  <li className="mt-1 border-t border-[var(--kr-edge)] pt-1">
                    <Link
                      to="/login"
                      className="block rounded-[2px] px-3 py-2.5 text-sm text-[var(--kr-ink)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,#96ee60_10%,transparent)]"
                    >
                      Sign in
                    </Link>
                  </li>
                </ul>
              </nav>
            </details>
          </div>
        </div>
      </header>

      {/* ================= HERO ============================================= */}
      <section className="relative overflow-hidden">
        {/* One warm pool of light on the ground, as if the sheet were lit on a desk. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-10%] right-[-6%] h-[62rem] w-[62rem] rounded-full opacity-[0.5]"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, #ecfab5 16%, transparent) 0%, transparent 62%)',
          }}
        />

        {/* Top padding is deliberately short: the masthead is a document header,
            and the record should start under it, not float in a band of nothing. */}
        <div className="relative mx-auto grid max-w-[84rem] gap-y-14 px-5 pt-10 pb-20 sm:px-8 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-x-12 lg:pt-14 lg:pb-28">
          <div className="max-w-[37rem] lg:pt-6">
            <p
              data-hero-line
              className="kr-meas mb-7 flex items-center gap-2.5 text-[11px] tracking-wide text-[var(--kr-ink-3)]"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--kr-lime)]" />
              PVR-2026-0724-NGT · filed 06:04
            </p>

            {/* A category statement, not a slogan, so it is set below hero scale:
                at 4.4rem it ran four lines and pushed the proof strip off the
                fold. "AI-Powered" carries the lime so the phrase reads as one
                thing and the eye still lands on what the system actually is. */}
            <h1
              data-hero-line
              className="kr-display text-[2.5rem] leading-[1.0] sm:text-[3.2rem] lg:text-[3.55rem]"
            >
              <span className="text-[var(--kr-lime)]">AI-Powered</span> Workforce
              Management System
            </h1>

            <p
              data-hero-line
              className="mt-7 max-w-[35rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)] sm:text-[1.09375rem]"
            >
              Kronus is AI-powered workforce management for security companies —
              scheduling, patrol verification and payroll, all on immutable records.
              Guards tap NFC checkpoints — the tap is the proof a round was walked. GPS
              confirms every clock-in and clock-out. AI
              monitors each site every ten minutes, so a missed round surfaces immediately.
              Reports build themselves, and billing follows automatically: direct
              QuickBooks, Xero and Sage integration means no manual entry and no
              reconciliation disputes. Your client audits the exact record you billed from.
            </p>
            <p
              data-hero-line
              className="mt-5 max-w-[35rem] text-[1.0625rem] leading-relaxed font-medium text-[var(--kr-ink)]"
            >
              Bill faster. Retain clients longer. Cut accounting overhead. Lower operating
              costs, higher margins, and room to scale.
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

            {/* Nine, in three rows of three. Every label is a third-person verb
                with the system as its subject — Kronus watches, verifies, files —
                so the strip reads as one sentence list rather than nine labels. */}
            <dl
              data-hero-line
              className="mt-11 grid grid-cols-2 gap-x-7 gap-y-6 border-t border-[var(--kr-edge)] pt-7 sm:grid-cols-3"
            >
              {[
                { l: 'Watches', v: 'every 10 min', icon: Radio },
                { l: 'Verifies', v: 'NFC · QR tap', icon: Nfc },
                { l: 'Files', v: 'nobody types it', icon: QrCode },
                { l: 'Reports', v: 'AI-generated', icon: FileText },
                { l: 'Detects', v: 'missed rounds', icon: Siren },
                { l: 'Locks', v: 'raw punches', icon: Lock },
                { l: 'Clocks', v: 'GPS in · out', icon: CalendarDays },
                { l: 'Syncs', v: 'QuickBooks · Xero', icon: RefreshCw },
                { l: 'Exports', v: 'PDF · CSV', icon: FileDown },
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
            {/* Full-bleed on a phone: the camera's field of view is vertical, so the
                sheet is sized by this box. Cancelling the page gutter and giving it
                height is what lets the document actually fill the screen instead of
                sitting in a postage stamp with margins on every side. */}
            <div className="relative -mx-5 min-h-[35.5rem] sm:mx-0 sm:min-h-[36rem] lg:min-h-[42rem]">
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
              SAMPLE RECORDS · SYNTHETIC DATA, NOT A CUSTOMER RECORD
            </p>
          </div>
        </div>
      </section>

      {/* ================= THE CHAIN ======================================== */}
      <section id="record" className="border-b border-[var(--kr-edge)]">
        <div className="mx-auto grid max-w-[84rem] gap-y-12 px-5 pt-20 pb-12 sm:px-8 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:gap-x-16">
          <div className="kr-rise">
            <p className="kr-doc-label mb-6 flex items-center gap-3 text-[11px] text-[var(--kr-lime)]">
              Chain of custody
              <span
                aria-hidden="true"
                className="h-px flex-1 bg-[linear-gradient(90deg,var(--kr-edge-strong),transparent)]"
              />
            </p>
            {/* Set at display scale with the last phrase carried in lime: the
                sentence is the section's whole claim, and at 3.1rem it was
                reading as another paragraph rather than as a heading. */}
            <h2 className="kr-display text-[2.6rem] leading-[0.98] sm:text-[4rem] lg:text-[4.6rem]">
              Every number starts{' '}
              <span className="text-[var(--kr-lime)]">on a wall.</span>
            </h2>
            <p className="mt-8 max-w-[38rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)]">
              Most guard software starts with a form. Kronus starts with a physical object
              in a building, and follows it all the way to the invoice line and the page
              your client audits. Seven links, no gap where a number could be entered by
              hand.
            </p>
          </div>

          {/* The section's own contents page. It fills the right column with
              something load-bearing — the reader can see the whole run before
              committing to the scroll, and it names the document it describes. */}
          <aside className="kr-rise lg:pt-2">
            <div className="rounded-[5px] border border-[var(--kr-edge)] bg-[var(--kr-ground)] p-6 shadow-[var(--kr-lift)]">
              <p className="kr-meas text-[11px] text-[var(--kr-ink-3)]">
                PVR-2026-0724-NGT
              </p>
              <p className="kr-display mt-5 text-[3.4rem] leading-none text-[var(--kr-lime)]">
                {String(CHAIN.length).padStart(2, '0')}
              </p>
              <p className="kr-doc-label mt-1 text-[10px] text-[var(--kr-ink-3)]">
                links · no gap
              </p>

              <ol className="mt-6 border-t border-[var(--kr-edge)] pt-4">
                {CHAIN.map((link, i) => (
                  <li key={link.id}>
                    <a
                      href={`#chain-${link.id}`}
                      className="kr-meas group flex items-baseline gap-3 rounded-[2px] py-[0.4rem] text-[12px] text-[var(--kr-ink-3)] transition-colors duration-200 hover:text-[var(--kr-ink)]"
                    >
                      <span className="text-[var(--kr-lime)] opacity-70 transition-opacity duration-200 group-hover:opacity-100">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {link.step}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>

        {/* One vertical run, and from lg up the links alternate across it: the
            chain hangs down the middle and each step steps out to one side. The
            spine stays unbroken through all six, because that is the claim. */}
        <ol
          data-chain-track
          className="relative mx-auto w-full max-w-[84rem] px-5 pb-24 sm:px-8 sm:pb-32"
        >
          <span
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[calc(1.25rem+6.5px)] w-px bg-[var(--kr-edge-strong)] sm:left-[calc(2rem+6.5px)] lg:left-1/2 lg:-translate-x-1/2"
          />
          <span
            aria-hidden="true"
            data-chain-progress
            className="absolute top-2 bottom-2 left-[calc(1.25rem+6.5px)] w-px origin-top scale-y-0 bg-[var(--kr-lime)] sm:left-[calc(2rem+6.5px)] lg:left-1/2 lg:-translate-x-1/2"
          />

          {CHAIN.map((link, i) => {
            // 01 reads text-left, 02 text-right, and so on down to 06.
            const textRight = i % 2 === 1
            return (
              <li
                key={link.id}
                id={`chain-${link.id}`}
                data-chain-link
                className="kr-chain-link kr-rise relative pb-16 pl-12 last:pb-0 sm:pb-24 sm:pl-16 lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-20 lg:pb-28 lg:pl-0"
              >
                {/* On the rail below lg, centred on the spine from lg up. */}
                <span
                  aria-hidden="true"
                  className="kr-chain-node absolute top-[0.2rem] left-0 h-3.5 w-3.5 rounded-full border lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2"
                />

                {/* Text. Left-aligned in both columns — this page is a document,
                    and documents do not set body copy ragged-left. */}
                <div
                  className={`min-w-0 lg:row-start-1 ${
                    textRight ? 'lg:col-start-2 lg:pl-2' : 'lg:col-start-1 lg:pr-2'
                  }`}
                >
                  <div className="flex items-baseline gap-3">
                    <span className="kr-meas text-sm text-[var(--kr-lime)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      data-chain-step
                      className="kr-doc-label text-[11px] text-[var(--kr-ink-3)] transition-colors duration-500"
                    >
                      {link.step}
                    </span>
                    <ChainGlyph
                      id={link.id}
                      className="ml-auto hidden h-9 w-9 shrink-0 text-[var(--kr-lime)] opacity-60 sm:block"
                    />
                  </div>

                  <h3 className="kr-display mt-4 text-[1.45rem] leading-[1.12] sm:text-[1.75rem]">
                    {link.title}
                  </h3>
                  <p className="mt-4 max-w-[38rem] text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)] sm:text-[1.0625rem]">
                    {link.body}
                  </p>

                  {/* The specifics under the claim. A prose paragraph states the
                      rule; these say what it actually costs you to believe it. */}
                  <ul className="mt-7 space-y-3 border-t border-[var(--kr-edge)] pt-6">
                    {link.detail.map((d) => (
                      <li
                        key={d}
                        className="kr-meas flex gap-3 text-[11.5px] leading-relaxed text-[var(--kr-ink-3)]"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[0.42rem] h-1 w-1 shrink-0 rounded-full bg-[var(--kr-lime)]"
                        />
                        {d}
                      </li>
                    ))}
                  </ul>

                  <p className="kr-meas mt-7 inline-block rounded-[2px] border border-[var(--kr-edge)] bg-[var(--kr-ground)] px-2.5 py-1.5 text-xs text-[var(--kr-lime)]">
                    {link.meas}
                  </p>
                </div>

                {/* The photograph of the step. The frame carries the ground
                    colour, so a link whose image has not landed yet reads as an
                    empty plate rather than a broken page. */}
                <figure
                  className={`mt-8 lg:row-start-1 lg:mt-0 ${
                    textRight ? 'lg:col-start-1' : 'lg:col-start-2'
                  }`}
                >
                  {/* No fixed aspect: each photograph keeps the shape it was shot
                      in. The wide ones are wide because their subject is a
                      distance across a room, and cropping them to a common
                      portrait frame would cut exactly the thing they are of. */}
                  <div className="relative min-h-[16rem] overflow-hidden rounded-[3px] border border-[var(--kr-edge)] bg-[var(--kr-ground)]">
                    {/* Plate marker. The photograph covers it once it lands; until
                        then the frame reads as an unexposed plate. */}
                    <span
                      aria-hidden="true"
                      className="kr-doc-label absolute inset-0 flex items-center justify-center text-[10px] text-[var(--kr-ink-3)]"
                    >
                      {String(i + 1).padStart(2, '0')} · {link.step}
                    </span>
                    {/* text-transparent so a missing image does not dump its alt
                        string across the plate; screen readers still get it. */}
                    <img
                      src={link.image.src}
                      alt={link.image.alt}
                      width={link.image.w}
                      height={link.image.h}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="relative block h-auto w-full text-transparent"
                    />
                  </div>
                </figure>
              </li>
            )
          })}
        </ol>
      </section>

      {/* ================= THE EVIDENCE TABLE =============================== */}
      <EvidenceTable enhanced={enhanced} />

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
              incident your client reads the same night, and the scan history all three are
              derived from. Four documents, one record underneath — these are real samples
              on synthetic data.
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
                key: 'scans',
                node: <ScanReportSheet />,
                tilt: '0.8deg',
                title: 'Every pass, with its distance',
                body:
                  'The scan history your client can pull for themselves, or take as a CSV. Each row carries how far the phone was from the tag when it logged — so "the guard was there" is a measurement rather than a claim, and the three documents above are all derived from these rows.',
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
          <div className="kr-rise flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <div className="max-w-[46rem]">
              <p className="kr-doc-label mb-5 text-[11px] text-[var(--kr-lime)]">Contents</p>
              <h2 className="kr-display text-[2.25rem] sm:text-[3.1rem]">
                What else runs off the same record.
              </h2>
            </div>
            <p className="kr-meas max-w-[24rem] text-[12.5px] leading-relaxed text-[var(--kr-ink-3)]">
              Eight surfaces, one event stream. Nothing here keeps its own copy of
              the hours.
            </p>
          </div>

          {/* A ruled list of eight equal rows said everything was equally
              important and left a corridor of dead space down the middle. As
              plates, the three that carry the operation get the room: the roster
              is where the work starts, the portal is what the client actually
              buys, and sites are the ground the rest of it stands on. */}
          <dl className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LEDGER.map((item) => (
              <div
                key={item.ref}
                className={`kr-plate kr-rise group relative flex flex-col overflow-hidden rounded-[5px] border border-[var(--kr-edge)] bg-[var(--kr-ground)] p-6 sm:p-7 ${item.span}`}
              >
                {/* The index letter, set enormous and nearly invisible — the
                    page's own filing mark, the way the chain sets its count. */}
                <span
                  aria-hidden="true"
                  className="kr-display pointer-events-none absolute -top-3 right-3 text-[5.5rem] leading-none text-[var(--kr-edge)] transition-colors duration-500 group-hover:text-[var(--kr-edge-strong)]"
                >
                  {item.ref}
                </span>

                <div className="relative flex items-center gap-3">
                  <item.icon
                    className="h-[1.15rem] w-[1.15rem] shrink-0 text-[var(--kr-lime)]"
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                  <dt className="kr-display text-[1.3rem] leading-tight">{item.title}</dt>
                </div>

                <dd className="relative mt-3.5 max-w-[40rem] text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
                  {item.body}
                </dd>

                {/* The wide plates pay for their room. Without this they were
                    two lines of copy in a lot of empty space, which reads as a
                    layout accident rather than as emphasis. */}
                {item.chips && (
                  <dd className="relative mt-auto flex flex-wrap gap-2 pt-6">
                    {item.chips.map((chip) => (
                      <span
                        key={chip}
                        className="kr-meas rounded-[2px] border border-[var(--kr-edge)] px-2.5 py-1.5 text-[11px] text-[var(--kr-ink-3)] transition-colors duration-500 group-hover:border-[var(--kr-edge-strong)] group-hover:text-[var(--kr-ink-2)]"
                      >
                        {chip}
                      </span>
                    ))}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ================= THE QUIET PASSAGE: THE NIGHT SHIFT =============== */}
      {/* The one photograph on the page that is not a document: the place the
          record comes from. It sits under the copy, so it is framed and scrimmed
          hard — the lit wall behind the guard measures L 240 raw, and body copy
          at L 190 over that is unreadable. */}
      <section className="relative overflow-hidden border-b border-[var(--kr-edge)] bg-[var(--kr-ground)]">
        <img
          src="/bg/parkade-night.jpg"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.5]"
          style={{ objectPosition: '38% 55%' }}
        />
        {/* Pool of ground colour under the type, thinning toward the edges so the
            column and the deck still read. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 58% 66% at 50% 50%, color-mix(in srgb, #151a10 95%, transparent) 0%, color-mix(in srgb, #151a10 78%, transparent) 46%, transparent 80%)',
          }}
        />
        {/* Fades into the sections above and below, so the photograph does not
            announce itself as a rectangle. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, var(--kr-ground) 0%, transparent 26%, transparent 74%, var(--kr-ground) 100%)',
          }}
        />

        <div className="relative mx-auto max-w-[52rem] px-5 py-24 text-center sm:px-8 sm:py-36">
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
              Three plans. Every one starts free for seven days.
            </h2>
            <p className="mt-6 max-w-[38rem] text-[1.0625rem] leading-relaxed text-[var(--kr-ink-2)]">
              Priced per company, not per guard — hire a fourth guard in March and the bill
              does not move. Full access on the trial, no card, cancel any time.
            </p>
          </div>

          {/* Monthly / annual. Both tabs quote a monthly figure so the plans stay
              comparable at a glance; the annual total sits underneath it. */}
          <div className="kr-rise mt-10 flex justify-center">
            <div
              role="tablist"
              aria-label="Billing period"
              className="inline-flex rounded-full border border-[var(--kr-edge-strong)] bg-[var(--kr-ground)] p-1"
            >
              {[
                { id: 'monthly', label: 'Monthly' },
                { id: 'annual', label: 'Annual · save 20%' },
              ].map((tab) => {
                const on = billing === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setBilling(tab.id)}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-300 ${
                      on
                        ? 'bg-[var(--kr-lime)] text-[#0f1209]'
                        : 'text-[var(--kr-ink-2)] hover:text-[var(--kr-ink)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-10 grid items-start gap-5 lg:grid-cols-3 lg:gap-6">
            {PLANS.map((plan) => {
              const annual = billing === 'annual'
              return (
                <div
                  key={plan.id}
                  className={`kr-rise relative flex min-w-0 flex-col rounded-[5px] p-7 sm:p-8 ${
                    plan.lead
                      ? 'border border-[var(--kr-lime)] bg-[var(--kr-raise)]'
                      : 'border border-[var(--kr-edge)] bg-[var(--kr-ground)]'
                  }`}
                >
                  {plan.lead && (
                    <span className="kr-doc-label absolute -top-2.5 left-7 rounded-[2px] bg-[var(--kr-lime)] px-2.5 py-1 text-[9px] text-[#0f1209] sm:left-8">
                      Most operations
                    </span>
                  )}

                  <h3 className="kr-display text-[1.75rem]">{plan.name}</h3>
                  <p className="mt-2 text-[0.9375rem] leading-snug font-medium text-[var(--kr-ink)]">
                    {plan.line}
                  </p>
                  <p className="mt-3.5 text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
                    {plan.who}
                  </p>

                  <div className="mt-7 border-t border-[var(--kr-edge)] pt-6">
                    <p className="flex items-end gap-1.5">
                      <span className="kr-display text-[2.9rem] leading-none">
                        ${annual ? plan.annualMonthly : plan.monthly}
                      </span>
                      <span className="mb-1 text-[0.9375rem] text-[var(--kr-ink-3)]">
                        /month
                      </span>
                    </p>
                    <p className="kr-meas mt-3 text-[11.5px] leading-relaxed text-[var(--kr-ink-3)]">
                      {annual ? (
                        <>
                          ${plan.annualTotal} billed yearly ·{' '}
                          <span className="text-[var(--kr-lime)]">save ${plan.saving}</span>
                        </>
                      ) : (
                        'billed monthly · CAD'
                      )}
                    </p>
                  </div>

                  <a
                    href={DEMO_HREF}
                    className={`group mt-7 inline-flex items-center justify-center gap-2 rounded-[3px] px-5 py-3.5 font-semibold transition-all duration-200 ${
                      plan.lead
                        ? 'bg-[var(--kr-lime)] text-[#0f1209] hover:bg-[color-mix(in_srgb,#96ee60_80%,white)]'
                        : 'border border-[var(--kr-edge-strong)] text-[var(--kr-ink)] hover:bg-[color-mix(in_srgb,#96ee60_8%,transparent)]'
                    }`}
                  >
                    Start 7 days free
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  </a>

                  {plan.inherits && (
                    <p className="kr-doc-label mt-7 text-[9.5px] text-[var(--kr-lime)]">
                      {plan.inherits}
                    </p>
                  )}

                  <ul className={`space-y-3 ${plan.inherits ? 'mt-4' : 'mt-7'}`}>
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check
                          className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--kr-lime)]"
                          strokeWidth={2.8}
                          aria-hidden="true"
                        />
                        <span className="text-[0.875rem] leading-snug text-[var(--kr-ink-2)]">
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* The one feature worth itemising, because "daily email" sounds
                      like noise until you see what is actually in it. */}
                  {plan.detail && (
                    <div className="mt-6 rounded-[3px] border border-[var(--kr-edge)] bg-[var(--kr-ground)] p-4">
                      <p className="kr-doc-label text-[9px] text-[var(--kr-ink-3)]">
                        {plan.detail.label}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {plan.detail.items.map((d) => (
                          <li
                            key={d}
                            className="kr-meas flex gap-2 text-[11px] leading-relaxed text-[var(--kr-ink-3)]"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-[0.44rem] h-1 w-1 shrink-0 rounded-full bg-[var(--kr-edge-strong)]"
                            />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="kr-rise mt-6 rounded-[4px] border border-[var(--kr-edge)] bg-[var(--kr-ground)] p-7 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h3 className="kr-display text-[1.5rem]">
                Priced per company, not per guard.
              </h3>
              <p className="kr-meas text-[11px] text-[var(--kr-ink-3)]">
                7 days free · no card · cancel any time
              </p>
            </div>
            <p className="mt-4 max-w-[52rem] text-[0.9375rem] leading-relaxed text-[var(--kr-ink-2)]">
              A per-seat licence charges you for growing. These do not: the plan covers your
              company, so taking on a new contract in March costs you the contract, not the
              software. Every plan is the whole record — scanning, clock-in, incidents
              and the client portal are in the base tier, because a company with one building
              needs a late-shift alert exactly as much as one with thirty.
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
