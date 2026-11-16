/**
 * KRONUS — public homepage (Persuade).
 *
 * THESIS: show a real night shift working — scan, proof on the client's screen,
 * alert, payroll — in words a non-technical guard-company owner gets in five
 * seconds. Refuses the vague "AI platform" pitch and the static feature grid.
 * OWN-WORLD: warm paper ground and white sheets; olive-black ink for type and
 * device frames; lime as the live signal and as a highlighter on the promise;
 * one dark olive band to close. Archivo display, DM Sans body, hairline rules,
 * soft offset shadows on devices only.
 * STORY: see proof happen live → recognise the old way → tap through how it
 * works → tour each role → replay a GPS patrol → price the saving → book.
 * FIRST VIEWPORT: left, the promise + "Book a free demo"; right, the live
 * shift — guard phone scanning, client portal filling, a late alert resolving.
 * FORM: category canon at full fidelity (owner-pinned bar: guardowlco.com).
 *
 * Rendered twice, identically: to static HTML at build (scripts/prerender.mjs)
 * and inside the React app. No browser APIs in render, no React state, plain
 * <a> links. All behaviour lives in src/marketing/enhance.js.
 */
import { useEffect, useRef } from 'react'
import {
  ArrowRight,
  BellRing,
  Building2,
  Car,
  Check,
  ChevronDown,
  CircleCheck,
  CircleParking,
  FileText,
  Flashlight,
  HardHat,
  Hospital,
  House,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Nfc,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  ScanLine,
  Store,
  TriangleAlert,
  Warehouse,
  X,
} from 'lucide-react'
import {
  ClientAsks,
  clock,
  DemoSection,
  FaqSection,
  HowItWorks,
  ICONS,
  LiveShift,
  NightStory,
  PatrolGame,
  PatrolMap,
  ProductTour,
  SavingsSection,
  Shot,
  SiteFooter,
  SiteHeader,
} from '../marketing/sections.jsx'
import {
  ASKS,
  BEFORE_AFTER,
  CALC,
  DEMO,
  DEMO_SITE,
  FAQS,
  FOOTER,
  GPS,
  HERO,
  INDUSTRIES,
  MODULES,
  NAV,
  NIGHT,
  PATROL,
  PLANS,
  PRICING,
  SITE,
  STEPS,
  TOUR,
} from '../marketing/content.js'
import { enhance } from '../marketing/enhance.js'
import '../marketing/marketing.css'

export default function Home() {
  const rootRef = useRef(null)

  useEffect(() => {
    document.title = SITE.title
    return enhance(rootRef.current)
  }, [])

  return (
    <div ref={rootRef} className="mk" id="top">
      <a href="#main" className="mk-skip">
        Skip to content
      </a>

      <SiteHeader />

      <main id="main">
        {/* ================= HERO ======================================== */}
        <section className="mk-hero" aria-labelledby="hero-title">
          <div className="mk-wrap mk-hero-grid">
            <div className="mk-hero-copy">
              <p className="mk-eyebrow">
                <span className="mk-dot" aria-hidden="true" />
                {HERO.eyebrow}
              </p>
              <h1 id="hero-title" className="mk-h1">
                <span className="mk-h1-kicker">{HERO.kicker}</span>
                {HERO.titleA}
                <br />
                <span className="mk-mark">{HERO.titleB}</span>
              </h1>
              <p className="mk-lede">{HERO.lede}</p>
              <div className="mk-cta-row">
                <a href="#demo" className="mk-btn mk-btn--ink mk-btn--lg">
                  {HERO.primary}
                  <ArrowRight aria-hidden="true" />
                </a>
                <a href="#how-it-works" className="mk-btn mk-btn--line mk-btn--lg">
                  {HERO.secondary}
                </a>
              </div>
              <ul className="mk-assure" aria-label="Trial terms">
                {HERO.assurances.map((a) => (
                  <li key={a}>
                    <Check aria-hidden="true" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <LiveShift />
          </div>

          <div className="mk-wrap">
            <nav className="mk-modules" aria-label="What’s included">
              <span className="mk-modules-lead">All in one app</span>
              {MODULES.map((m) => (
                <a key={m.label} href={m.href}>
                  {m.label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <NightStory />

        <HowItWorks />

        {/* ================= OLD WAY vs KRONUS =========================== */}
        <section className="mk-section mk-ba" aria-labelledby="ba-title" data-mk-ba data-ba="old">
          <div className="mk-wrap mk-ba-grid">
            <div className="mk-ba-head">
              <h2 id="ba-title" className="mk-h2">
                {BEFORE_AFTER.title}
              </h2>
              <p className="mk-intro">{BEFORE_AFTER.intro}</p>
              <div className="mk-switch" role="group" aria-label="Compare">
                <button type="button" data-ba-set="old" aria-pressed="true">
                  {BEFORE_AFTER.oldLabel}
                </button>
                <button type="button" data-ba-set="new" aria-pressed="false">
                  {BEFORE_AFTER.newLabel}
                </button>
              </div>
            </div>
            <ul className="mk-ba-list">
              {BEFORE_AFTER.rows.map((r) => (
                <li key={r.topic}>
                  <strong>{r.topic}</strong>
                  <span className="mk-ba-text">
                    <span className="mk-ba-old">
                      <X aria-hidden="true" />
                      {r.old}
                    </span>
                    <span className="mk-ba-new">
                      <Check aria-hidden="true" />
                      {r.next}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <PatrolGame />

        <ProductTour />

        <ClientAsks />

        {/* ================= GPS TRACKING ================================ */}
        <section id="gps" className="mk-section" aria-labelledby="gps-title">
          <div className="mk-wrap mk-gps-grid">
            <div className="mk-gps-copy">
              <h2 id="gps-title" className="mk-h2">
                {GPS.title}
              </h2>
              <p className="mk-intro">{GPS.intro}</p>
              <dl className="mk-gps-points">
                {GPS.points.map((p) => (
                  <div key={p.title}>
                    <dt>{p.title}</dt>
                    <dd>{p.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <PatrolMap />
          </div>
        </section>

        <SavingsSection />

        {/* ================= INDUSTRIES ================================== */}
        <section className="mk-section mk-section--tight" aria-labelledby="ind-title">
          <div className="mk-wrap">
            <h2 id="ind-title" className="mk-h2 mk-h2--sm">
              {INDUSTRIES.title}
            </h2>
            <ul className="mk-industries">
              {INDUSTRIES.items.map((it) => {
                const I = ICONS[it.icon]
                return (
                  <li key={it.title}>
                    {I && <I aria-hidden="true" />}
                    {it.title}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* ================= PRICING ===================================== */}
        <section
          id="pricing"
          className="mk-section mk-band"
          aria-labelledby="pricing-title"
          data-billing="monthly"
          data-mk-pricing
        >
          <div className="mk-wrap">
            <div className="mk-head mk-head--center">
              <h2 id="pricing-title" className="mk-h2">
                {PRICING.title}
              </h2>
              <p className="mk-intro">{PRICING.intro}</p>
            </div>
            <div className="mk-switch mk-switch--center" role="group" aria-label="Billing period">
              <button type="button" data-billing-set="monthly" aria-pressed="true">
                Monthly
              </button>
              <button type="button" data-billing-set="annual" aria-pressed="false">
                Yearly <em>save 20%</em>
              </button>
            </div>
            <div className="mk-plans">
              {PLANS.map((p) => (
                <article
                  key={p.id}
                  className={`mk-plan${p.featured ? ' mk-plan--featured' : ''}`}
                  aria-labelledby={`plan-${p.id}`}
                >
                  {p.featured && <p className="mk-plan-badge">Most popular</p>}
                  <h3 id={`plan-${p.id}`}>{p.name}</h3>
                  <p className="mk-plan-tagline">{p.tagline}</p>
                  <div className="mk-price">
                    <p className="mk-price-amount">
                      <span className="mk-when-monthly">${p.monthly}</span>
                      <span className="mk-when-annual">${p.annualMonthly}</span>
                      <small>/month</small>
                    </p>
                    <p className="mk-price-note">
                      <span className="mk-when-monthly">CAD, billed monthly</span>
                      <span className="mk-when-annual">
                        ${p.annualTotal} billed yearly · <b>save ${p.saving}</b>
                      </span>
                    </p>
                  </div>
                  <a
                    href="#demo"
                    data-plan={p.name}
                    className={`mk-btn mk-btn--block ${p.featured ? 'mk-btn--lime' : 'mk-btn--line'}`}
                  >
                    Start free trial
                  </a>
                  {p.inherits && <p className="mk-plan-inherits">{p.inherits}</p>}
                  <ul className="mk-checks mk-checks--sm">
                    {p.features.map((f) => (
                      <li key={f}>
                        <Check aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className="mk-pricing-note">
              {PRICING.note}. Need NFC tags, checkpoint mounts or guard uniforms?{' '}
              <a href="/shop">Order them from the Kronus shop</a>.
            </p>
          </div>
        </section>

        <FaqSection />

        <DemoSection />
      </main>

      <SiteFooter />
    </div>
  )
}
