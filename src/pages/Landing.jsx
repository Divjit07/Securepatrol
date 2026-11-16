/**
 * KRONUS — keyword landing page (Persuade), one per search intent.
 *
 * Same world as the homepage (paper + night, ink, lime signal) and the same
 * shared sections, so a visitor landing from Google on /guard-tour-app gets
 * the homepage's quality, not a thin SEO page. Copy lives in
 * src/marketing/pages.js. Rendered to static HTML at build (prerender.mjs)
 * and inside the app for dev; behaviour comes from enhance.js.
 */
import { useEffect, useRef } from 'react'
import { ArrowRight, Check, ChevronRight, FileText, MapPin } from 'lucide-react'
import { RiderMark } from '../components/home/RiderMark.jsx'
import {
  ClientAsks,
  DemoSection,
  FaqSection,
  HowItWorks,
  LiveShift,
  PatrolGame,
  PatrolMap,
  ProductTour,
  SavingsSection,
  Shot,
  SiteFooter,
  SiteHeader,
} from '../marketing/sections.jsx'
import { HERO, PLANS, PRICING } from '../marketing/content.js'
import { PAGE_BY_SLUG } from '../marketing/pages.js'
import { enhance } from '../marketing/enhance.js'
import '../marketing/marketing.css'

/** A filed incident report, drawn as the object the client actually receives. */
function IncidentCard() {
  return (
    <div className="mk-sheet mk-incident">
      <div className="mk-report-head">
        <span className="mk-email-from">
          <RiderMark className="mk-email-mark" /> KRONUS
        </span>
        <span className="mk-report-kind">Incident report</span>
      </div>
      <p className="mk-report-site">Side door found open</p>
      <p className="mk-report-period">Tue 22:58 · 800 Bay Street · Filed by Marcus R.</p>
      <div className="mk-incident-body">
        <img src="/marketing/thumb-incident.webp" width="320" height="236" alt="" loading="lazy" />
        <p>
          Side door on the ground floor found propped open with a wedge. Latch checked, door secured at 23:04 and
          maintenance told. Two photos attached.
        </p>
      </div>
      <ul className="mk-incident-log">
        <li>
          <Check aria-hidden="true" /> Emailed to your office · 22:59
        </li>
        <li>
          <Check aria-hidden="true" /> In the client portal for 800 Bay Street
        </li>
      </ul>
      <span className="mk-report-btn mk-incident-btn">
        <FileText aria-hidden="true" /> Download PDF
      </span>
    </div>
  )
}

function Visual({ kind }) {
  if (kind === 'map') return <PatrolMap />
  if (kind === 'live') return <LiveShift />
  if (kind === 'incident') return <IncidentCard />
  if (kind === 'roster') {
    return (
      <Shot
        frame="browser"
        url="kronus.space/admin/roster"
        image={{
          src: '/marketing/roster.webp',
          w: 1992,
          h: 1062,
          mobile: { src: '/marketing/roster-m.webp', w: 1250, h: 1062 },
          alt: 'Kronus security guard scheduling software: a weekly roster with open shifts and double-booking warnings',
        }}
      />
    )
  }
  return (
    <Shot
      frame="phone"
      className="mk-lp-phone"
      image={{
        src: '/marketing/guard-patrol.webp',
        w: 780,
        h: 1688,
        alt: 'Kronus guard tour app on a phone with Scan checkpoint and Report incident buttons and tonight’s patrol progress',
      }}
    />
  )
}

function Demo({ kind }) {
  if (kind === 'sim') return <HowItWorks />
  if (kind === 'patrol') return <PatrolGame />
  if (kind === 'calc') return <SavingsSection />
  if (kind === 'asks') return <ClientAsks />
  if (kind === 'tour') return <ProductTour />
  return null
}

export default function Landing({ slug }) {
  const page = PAGE_BY_SLUG[slug]
  const rootRef = useRef(null)

  useEffect(() => {
    document.title = page.title
    return enhance(rootRef.current)
  }, [page])

  return (
    <div ref={rootRef} className="mk" id="top">
      <a href="#main" className="mk-skip">
        Skip to content
      </a>
      <SiteHeader base="/" />

      <main id="main">
        {/* ================= HERO ======================================== */}
        <section className="mk-hero mk-lp-hero" aria-labelledby="hero-title">
          <div className="mk-wrap">
            <nav className="mk-crumbs" aria-label="Breadcrumb">
              <ol>
                <li>
                  <a href="/">Kronus</a>
                  <ChevronRight aria-hidden="true" />
                </li>
                <li aria-current="page">{page.crumb}</li>
              </ol>
            </nav>
          </div>
          <div className={`mk-wrap mk-hero-grid mk-lp-grid mk-lp-grid--${page.visual}`}>
            <div className="mk-hero-copy">
              <h1 id="hero-title" className="mk-h1">
                <span className="mk-h1-kicker">{page.kicker}</span>
                {page.h1}
              </h1>
              <p className="mk-lede">{page.lede}</p>
              <div className="mk-cta-row">
                <a href="#demo" className="mk-btn mk-btn--ink mk-btn--lg">
                  {HERO.primary}
                  <ArrowRight aria-hidden="true" />
                </a>
                <a href="#what" className="mk-btn mk-btn--line mk-btn--lg">
                  How it works
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
            <div className="mk-lp-visual">
              <Visual kind={page.visual} />
            </div>
          </div>
        </section>

        {/* ================= WHAT IT IS (snippet answer) ================== */}
        <section id="what" className="mk-section mk-band" aria-labelledby="what-title">
          <div className="mk-wrap mk-what-grid">
            <div>
              <h2 id="what-title" className="mk-h2">
                {page.what.title}
              </h2>
              {page.what.body.map((p) => (
                <p key={p.slice(0, 24)} className="mk-what-p">
                  {p}
                </p>
              ))}
            </div>
            <aside className="mk-what-short" aria-label="In short">
              <p className="mk-what-label">In short</p>
              <ul className="mk-checks">
                {page.what.points.map((pt) => (
                  <li key={pt}>
                    <Check aria-hidden="true" />
                    {pt}
                  </li>
                ))}
              </ul>
              <a href="#demo" className="mk-link">
                See it on a free demo <ArrowRight aria-hidden="true" />
              </a>
            </aside>
          </div>
        </section>

        {/* ================= WHAT YOU GET ================================ */}
        <section className="mk-section" aria-labelledby="get-title">
          <div className="mk-wrap">
            <div className="mk-head">
              <h2 id="get-title" className="mk-h2">
                What you get with Kronus
              </h2>
            </div>
            <dl className="mk-lp-features">
              {page.features.map((f) => (
                <div key={f.title}>
                  <dt>{f.title}</dt>
                  <dd>{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {page.cities && (
          <section className="mk-section mk-band mk-section--tight" aria-labelledby="cities-title">
            <div className="mk-wrap">
              <h2 id="cities-title" className="mk-h2 mk-h2--sm">
                For guard companies across the GTA and Ontario
              </h2>
              <ul className="mk-cities">
                {page.cities.map((c) => (
                  <li key={c}>
                    <MapPin aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <Demo kind={page.demo} />

        {/* ================= PRICE TEASER =============================== */}
        <section className="mk-section mk-section--tight" aria-labelledby="price-title">
          <div className="mk-wrap">
            <div className="mk-price-teaser">
              <div>
                <h2 id="price-title" className="mk-h2 mk-h2--sm">
                  From ${PLANS[0].monthly} a month, per company
                </h2>
                <p>{PRICING.note}. Prices in Canadian dollars — hire more guards and your bill stays the same.</p>
              </div>
              <div className="mk-price-teaser-cta">
                <a href="#demo" className="mk-btn mk-btn--ink">
                  Book a free demo <ArrowRight aria-hidden="true" />
                </a>
                <a href="/#pricing" className="mk-btn mk-btn--line">
                  See all plans
                </a>
              </div>
            </div>
          </div>
        </section>

        <FaqSection faqs={page.faqs} title="Questions owners ask us" />

        {/* ================= RELATED (internal links) ===================== */}
        <section className="mk-section mk-band mk-section--tight" aria-labelledby="related-title">
          <div className="mk-wrap">
            <h2 id="related-title" className="mk-h2 mk-h2--sm">
              More of what Kronus does
            </h2>
            <ul className="mk-related">
              {page.related.map((s) => {
                const r = PAGE_BY_SLUG[s]
                return (
                  <li key={s}>
                    <a href={`/${s}`}>
                      <strong>{r.h1}</strong>
                      <span>{r.lede.split('. ')[0].replace(/\.$/, '')}.</span>
                      <ArrowRight aria-hidden="true" />
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <DemoSection />
      </main>

      <SiteFooter base="/" />
    </div>
  )
}
