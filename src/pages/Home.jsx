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
import { RiderMark } from '../components/home/RiderMark.jsx'
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

const ICONS = { Building2, Car, CircleParking, HardHat, Hospital, House, Store, Warehouse }

const pad = (n) => String(n).padStart(2, '0')
const clock = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`

/** Deterministic fake QR code (21×21 with finder squares) as one SVG path. */
function QrMark({ seed = 1, className = '' }) {
  let s = seed * 9301 + 49297
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
  const finder = (x, y) => x < 7 && y < 7
  let d = ''
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const inF = finder(x, y) || finder(20 - x, y) || finder(x, 20 - y)
      if (inF) continue
      if (rnd() > 0.52) d += `M${x} ${y}h1v1h-1z`
    }
  }
  const sq = (x, y) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`
  return (
    <svg viewBox="0 0 21 21" className={className} aria-hidden="true" shapeRendering="crispEdges">
      <path d={d + sq(0, 0) + sq(14, 0) + sq(0, 14)} fillRule="evenodd" fill="currentColor" />
    </svg>
  )
}

function Brand({ dark = false }) {
  return (
    <a href="/" className={`mk-brand${dark ? ' mk-brand--dark' : ''}`} aria-label="Kronus home">
      <RiderMark className="mk-brand-mark" />
      <span>KRONUS</span>
    </a>
  )
}

function Shot({ image, frame, url, className = '' }) {
  const tag = (
    <img src={image.src} width={image.w} height={image.h} alt={image.alt} loading="lazy" decoding="async" />
  )
  // Dense dashboards get a tighter crop on phones so the screen stays readable.
  const img = image.mobile ? (
    <picture>
      <source
        media="(max-width: 640px)"
        srcSet={image.mobile.src}
        width={image.mobile.w}
        height={image.mobile.h}
      />
      {tag}
    </picture>
  ) : (
    tag
  )
  if (frame === 'phone') {
    return (
      <div className={`mk-phone ${className}`}>
        <div className="mk-phone-screen">{img}</div>
      </div>
    )
  }
  return (
    <div className={`mk-browser ${className}`}>
      <div className="mk-browser-bar" aria-hidden="true">
        <span />
        <span />
        <span />
        {url && <em>{url}</em>}
      </div>
      {img}
    </div>
  )
}

/* ---------- Hero: the live shift ---------------------------------------- */
function LiveShift() {
  const cps = DEMO_SITE.checkpoints
  const shown = 4
  // Newest first; times step forward from the start of the shift.
  const rows = cps
    .slice(0, shown)
    .map((c, i) => ({ ...c, t: clock(DEMO_SITE.startMinutes + i * 9) }))
    .reverse()
  const last = rows[0]
  return (
    <div className="mk-live" data-mk-live>
      <div
        className="mk-live-stage"
        role="img"
        aria-label="Live demo with sample data: a guard scans checkpoints on their phone and each scan appears on the client's portal; a late guard alert is raised and then cleared."
      >
        <div className="mk-portal">
          <div className="mk-portal-head">
            <div>
              <p className="mk-portal-site">{DEMO_SITE.name}</p>
              <p className="mk-portal-sub">Client portal · tonight</p>
            </div>
            <span className="mk-badge-live">
              <i />
              Live
            </span>
          </div>
          <div className="mk-portal-stats">
            <div>
              <span>On duty</span>
              <strong>{DEMO_SITE.guard}</strong>
            </div>
            <div>
              <span>Checkpoints</span>
              <strong>
                <b data-live-count>{shown}</b>/{cps.length}
              </strong>
            </div>
            <div>
              <span>Round</span>
              <strong data-live-round>1</strong>
            </div>
          </div>
          <div className="mk-portal-bar">
            <i data-live-bar style={{ transform: `scaleX(${shown / cps.length})` }} />
          </div>
          <ol className="mk-feed" data-live-feed>
            {rows.map((r) => (
              <li key={r.name}>
                <time>{r.t}</time>
                <span className="mk-feed-cp">
                  {r.name}
                  <small>{r.floor}</small>
                </span>
                <span className="mk-chip">{r.method}</span>
                <CircleCheck className="mk-feed-ok" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </div>

        <div className="mk-phone mk-live-phone">
          <div className="mk-phone-screen mk-app">
            <div className="mk-app-top">
              <span>Kronus</span>
              <span className="mk-app-duty">On duty</span>
            </div>
            <p className="mk-app-hello">Night shift · {DEMO_SITE.name}</p>
            <div className="mk-app-scan" data-live-phone data-state="done">
              <div className="mk-app-ring">
                <Nfc aria-hidden="true" />
              </div>
              <p className="mk-app-state" data-live-state>
                Scanned
              </p>
              <p className="mk-app-cp" data-live-cp>
                {last.name}
              </p>
              <p className="mk-app-meta" data-live-meta>
                {last.t} · {last.method} tap ✓
              </p>
            </div>
            <div className="mk-app-btn">
              <ScanLine aria-hidden="true" />
              Scan checkpoint
            </div>
            <div className="mk-app-btn mk-app-btn--ghost">
              <TriangleAlert aria-hidden="true" />
              Report incident
            </div>
          </div>
        </div>

        <div className="mk-alert" data-live-alert data-kind="late" hidden>
          <span className="mk-alert-icon">
            <BellRing className="mk-alert-late" aria-hidden="true" />
            <Check className="mk-alert-fixed" aria-hidden="true" />
          </span>
          <span>
            <strong data-live-alert-title>{DEMO_SITE.alert.lateTitle}</strong>
            <span data-live-alert-text>{DEMO_SITE.alert.late}</span>
          </span>
        </div>
      </div>
      <div className="mk-live-foot">
        <button type="button" className="mk-live-toggle" data-live-toggle aria-pressed="false">
          <Pause className="mk-ico-pause" aria-hidden="true" />
          <Play className="mk-ico-play" aria-hidden="true" />
          <span data-live-toggle-label>Pause demo</span>
        </button>
        <span>Sample data</span>
      </div>
    </div>
  )
}

/* ---------- How it works: the hands-on guard tour simulator --------------- */
/**
 * A building cutaway in ink on paper. Checkpoint spots and the guard are HTML
 * laid over it (percent positions), so they stay real, focusable buttons.
 */
function BuildingCutaway() {
  const windows = []
  for (const [y0, rows] of [
    [76, 2],
    [164, 2],
  ]) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 5; c++) {
        windows.push(<rect key={`${y0}-${r}-${c}`} x={118 + c * 32} y={y0 + r * 32} width="18" height="20" rx="2" />)
      }
    }
  }
  return (
    <svg viewBox="0 0 420 440" className="mk-sim-svg" aria-hidden="true">
      {/* ground, basement and the lot */}
      <rect x="0" y="320" width="420" height="120" className="mk-sim-earth" />
      <rect x="100" y="320" width="250" height="100" className="mk-sim-basement" />
      <line x1="0" y1="320" x2="420" y2="320" className="mk-sim-ground" />
      {/* the building */}
      <rect x="100" y="60" width="250" height="260" className="mk-sim-walls" />
      <rect x="280" y="18" width="60" height="42" className="mk-sim-walls" />
      <rect x="300" y="34" width="18" height="26" className="mk-sim-door" />
      <line x1="100" y1="150" x2="350" y2="150" className="mk-sim-floor" />
      <line x1="100" y1="235" x2="350" y2="235" className="mk-sim-floor" />
      <g className="mk-sim-windows">{windows}</g>
      {/* stairwell: a zig-zag down the east side */}
      <rect x="300" y="60" width="50" height="360" className="mk-sim-stairwell" />
      <path
        d="M304 70 L346 110 M346 110 L304 150 M304 150 L346 192 M346 192 L304 235 M304 235 L346 278 M346 278 L304 320 M304 320 L346 370 M346 370 L304 415"
        className="mk-sim-stairs"
      />
      {/* lobby: entrance + desk */}
      <rect x="100" y="270" width="22" height="50" className="mk-sim-door" />
      <rect x="146" y="298" width="52" height="22" rx="3" className="mk-sim-desk" />
      {/* parkade pillars + a parked car */}
      <rect x="176" y="330" width="12" height="90" className="mk-sim-pillar" />
      <rect x="254" y="330" width="12" height="90" className="mk-sim-pillar" />
      <rect x="196" y="392" width="46" height="18" rx="6" className="mk-sim-car" />
      {/* floor names */}
      <g className="mk-sim-names">
        <text x="92" y="44" textAnchor="end">Roof</text>
        <text x="92" y="110" textAnchor="end">8th floor</text>
        <text x="92" y="196" textAnchor="end">4th floor</text>
        <text x="92" y="282" textAnchor="end">Lobby</text>
        <text x="92" y="376" textAnchor="end">Parkade P2</text>
      </g>
    </svg>
  )
}

function GuardTourSim() {
  const spots = STEPS.spots
  const rows = spots.map((s, i) => ({ ...s, t: clock(STEPS.startMinutes + i * 9) }))
  return (
    <div className="mk-sim" id="guard-tour-sim" data-sim data-step="3" role="region" aria-label="Try the guard tour app">
      <div className="mk-sim-building" data-sim-building>
        <BuildingCutaway />
        {spots.map((s) => (
          <button
            key={s.id}
            type="button"
            className="mk-spot"
            data-spot={s.id}
            data-state="scanned"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            aria-label={`Checkpoint: ${s.name}`}
          >
            <span className="mk-spot-tag">
              {s.method === 'QR' ? <QrCode aria-hidden="true" /> : <Nfc aria-hidden="true" />}
            </span>
            <span className="mk-spot-label">{s.name}</span>
          </button>
        ))}
        <span
          className="mk-sim-guard"
          data-sim-guard
          style={{ left: `${spots[3].x}%`, top: `${spots[3].y}%` }}
          aria-hidden="true"
        >
          <span>MR</span>
        </span>
      </div>

      <div className="mk-sim-side" aria-live="polite">
        {/* Step 1 — put up the tags */}
        <div className="mk-sim-card" data-sim-card="1" hidden>
          <p className="mk-sim-label">
            Your checkpoint tags · <b data-sim-placed>0</b>/{spots.length} up
          </p>
          <p className="mk-sim-help">Drag each tag onto its glowing spot — or just tap the spot.</p>
          <div className="mk-tray">
            {spots.map((s, i) => (
              <button key={s.id} type="button" className="mk-tray-tag" data-tray={s.id}>
                <span className="mk-tray-chip" aria-hidden="true">
                  {s.method === 'QR' ? <QrMark seed={i + 3} className="mk-tray-qr" /> : <Nfc />}
                </span>
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {s.method} tag · {s.floor}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <p className="mk-sim-done" data-sim-done="1" hidden>
            <Check aria-hidden="true" /> All tags are up. Now walk the round.
          </p>
        </div>

        {/* Step 2 — walk the round */}
        <div className="mk-sim-card" data-sim-card="2" hidden>
          <div className="mk-phone mk-sim-phone">
            <div className="mk-phone-screen mk-app">
              <div className="mk-app-top">
                <span>Kronus</span>
                <span className="mk-app-duty">On duty</span>
              </div>
              <div className="mk-app-scan" data-sim-phone data-state="idle">
                <div className="mk-app-ring">
                  <Nfc aria-hidden="true" />
                </div>
                <p className="mk-app-state" data-sim-state>
                  Ready
                </p>
                <p className="mk-app-cp" data-sim-cp>
                  Tap a tag on the building
                </p>
                <p className="mk-app-meta" data-sim-meta>
                  <b data-sim-scanned>0</b>/{spots.length} checkpoints
                </p>
              </div>
            </div>
          </div>
          <p className="mk-sim-help">Tap the tags on the building. Marcus walks there and taps in.</p>
          <p className="mk-sim-done" data-sim-done="2" hidden>
            <Check aria-hidden="true" /> Round complete. Here’s what your client gets.
          </p>
        </div>

        {/* Step 3 — the client sees the proof */}
        <div className="mk-sim-card" data-sim-card="3">
          <div className="mk-sheet mk-report mk-sim-report" data-sim-report>
            <div className="mk-report-head">
              <span className="mk-email-from">
                <RiderMark className="mk-email-mark" /> KRONUS
              </span>
              <span className="mk-report-kind">Patrol report</span>
            </div>
            <p className="mk-report-site">{DEMO_SITE.name}</p>
            <p className="mk-report-period">Tonight · Guard: {DEMO_SITE.guard}</p>
            <table className="mk-report-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Checkpoint</th>
                  <th>Method</th>
                  <th aria-label="Verified" />
                </tr>
              </thead>
              <tbody data-sim-rows>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.t}</td>
                    <td>{r.name}</td>
                    <td>{r.method}</td>
                    <td>
                      <Check aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mk-report-foot">Every line is a tag tapped on site</p>
            <span className="mk-sim-stamp" aria-hidden="true">
              In client portal
            </span>
          </div>
          <button type="button" className="mk-btn mk-btn--ink mk-btn--block" data-sim-send>
            <FileText aria-hidden="true" />
            <span data-sim-send-label>Send to the client’s portal</span>
          </button>
          <button type="button" className="mk-sim-restart" data-sim-restart hidden>
            <RotateCcw aria-hidden="true" /> Try it again
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- GPS: the replayable patrol map -------------------------------- */
function PatrolMap() {
  const path = GPS.stops.map((s, i) => `${i ? 'L' : 'M'}${s.x} ${s.y}`).join(' ')
  const siteName = (id) => GPS.sites.find((s) => s.id === id)?.name
  const last = GPS.stops[GPS.stops.length - 1]
  return (
    <div className="mk-map" data-mk-map>
      <div className="mk-map-frame">
        <svg
          viewBox="0 0 640 440"
          className="mk-map-svg"
          role="img"
          aria-label="Patrol trail on a live map, sample data: one mobile patrol guard visits three Toronto sites overnight. Each numbered stop is a checkpoint check-in, joined in order into a trail. Geofence circles mark where clock-in and clock-out are allowed."
        >
          <path className="mk-map-lake" d="M0 380 C 120 360, 220 392, 330 372 S 540 350, 640 372 L640 440 L0 440Z" />
          <g className="mk-map-roads">
            <path d="M0 96 H640" />
            <path d="M0 190 H640" />
            <path d="M0 300 C 160 296, 320 318, 640 300" />
            <path d="M70 0 V380" />
            <path d="M210 0 V376" />
            <path d="M390 0 V366" />
            <path d="M560 0 V362" />
            <path d="M0 338 C 200 330, 420 346, 640 330" className="mk-map-hwy" />
          </g>
          <g className="mk-map-street-labels" aria-hidden="true">
            <text x="8" y="90">Queen St W</text>
            <text x="8" y="184">King St W</text>
            <text x="8" y="294">Front St</text>
            <text x="440" y="326">Gardiner Expy</text>
            <text x="250" y="420">Lake Ontario</text>
          </g>
          {GPS.sites.map((s) => (
            <g key={s.id} className="mk-map-site">
              <circle cx={s.x} cy={s.y} r={s.r} className="mk-map-fence" />
              <text x={s.x} y={s.y - s.r - 8} textAnchor="middle">
                {s.name}
              </text>
            </g>
          ))}
          <path d={path} className="mk-map-trail-base" />
          <path d={path} className="mk-map-trail" data-map-trail />
          {GPS.stops.map((s, i) => (
            <g key={i} className="mk-map-stop" data-map-stop={i} data-kind={s.kind || 'scan'}>
              <circle cx={s.x} cy={s.y} r="8" />
              <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central">
                {i + 1}
              </text>
            </g>
          ))}
          <g className="mk-map-guard" data-map-guard transform={`translate(${last.x} ${last.y})`}>
            <circle r="17" className="mk-map-guard-halo" />
            <circle r="6" className="mk-map-guard-dot" />
          </g>
        </svg>
        <p className="mk-map-tag">Illustrative map · sample data</p>
      </div>

      <div className="mk-map-controls">
        <button type="button" className="mk-map-play" data-map-play aria-pressed="false" aria-label="Play the patrol replay">
          <Play className="mk-ico-play" aria-hidden="true" />
          <Pause className="mk-ico-pause" aria-hidden="true" />
        </button>
        <label className="mk-map-range">
          <span className="mk-sr">Replay tonight’s patrol, stop by stop</span>
          <input
            type="range"
            min="1"
            max={GPS.stops.length}
            defaultValue={GPS.stops.length}
            step="1"
            data-map-range
            aria-valuetext={`${last.t}, ${siteName(last.site)}, ${last.label}`}
          />
          <span className="mk-map-times" aria-hidden="true">
            <span>{GPS.stops[0].t}</span>
            <span>Drag to replay the night</span>
            <span>{last.t}</span>
          </span>
        </label>
      </div>
      <p className="mk-map-now" data-map-now>
        <MapPin aria-hidden="true" />
        <span>
          <strong data-map-time>{last.t}</strong> · <span data-map-site>{siteName(last.site)}</span> ·{' '}
          <span data-map-label>{last.label}</span>
        </span>
        <span className="mk-map-ok">
          <Check aria-hidden="true" />
          <span data-map-proof>Clock-out inside geofence</span>
        </span>
      </p>
    </div>
  )
}

/* ---------- Savings calculator ------------------------------------------- */
function Calculator() {
  // The static render shows the defaults' answer; enhance.js recomputes live.
  const [minG, minS, rate] = CALC.assumptions.map((a) => a.value)
  const hours = Math.round((CALC.guards.value * minG * 4.33 + CALC.sites.value * minS * 30) / 60)
  const dollars = Math.round(hours * rate)
  return (
    <div className="mk-calc" data-mk-calc>
      <div className="mk-calc-inputs">
        {[CALC.guards, CALC.sites].map((f) => {
          const id = f.label.toLowerCase()
          return (
            <label key={id} className="mk-slider">
              <span className="mk-slider-top">
                <span>{f.label}</span>
                <output data-calc-out={id}>{f.value}</output>
              </span>
              <input type="range" min={f.min} max={f.max} defaultValue={f.value} data-calc={id} />
            </label>
          )
        })}
        <details className="mk-calc-more">
          <summary>
            Change our starting guesses <ChevronDown aria-hidden="true" />
          </summary>
          <div className="mk-calc-assume">
            {CALC.assumptions.map((a) => (
              <label key={a.id}>
                <span>{a.label}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={a.min}
                  max={a.max}
                  defaultValue={a.value}
                  data-calc={a.id}
                />
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="mk-calc-result" aria-live="polite">
        <p className="mk-calc-label">Office time you could get back, by your numbers</p>
        <p className="mk-calc-big">
          <span data-calc-hours>{hours}</span> hours
          <small>a month</small>
        </p>
        <p className="mk-calc-money">
          That’s about <strong data-calc-dollars>${dollars.toLocaleString('en-CA')}</strong> of office time
          every month.
        </p>
        <p className="mk-calc-plan">
          Kronus {CALC.planName}, with timesheets and payroll, is ${CALC.planPrice} a month for your whole
          company.
        </p>
        <a href="#demo" className="mk-btn mk-btn--ink">
          Book a demo
          <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}

/* ---------- One night: the scroll story ----------------------------------- */
/**
 * Without JS (or with reduced motion) this is a plain list of moments. With
 * JS it pins: scrolling becomes the clock, photos cross-fade, and at 08:40 the
 * section turns from night to day.
 */
function NightStory() {
  const n = NIGHT.moments.length
  return (
    <section
      id="night"
      className="mk-story"
      aria-labelledby="night-title"
      data-mk-story
      data-phase="night"
      style={{ '--n': n }}
    >
      <div className="mk-story-pin">
        <div className="mk-wrap mk-story-inner">
          <div className="mk-story-head">
            <h2 id="night-title" className="mk-h2">
              {NIGHT.title}
            </h2>
            <p className="mk-intro">{NIGHT.intro}</p>
          </div>
          <ol className="mk-story-moments">
            {NIGHT.moments.map((m, i) => (
              <li
                key={i}
                className={`mk-story-moment${i === 0 ? ' is-active' : ''}`}
                data-story-moment={i}
              >
                <figure className="mk-story-photo">
                  <img src={m.img} alt={m.alt} loading="lazy" decoding="async" draggable={false} />
                  <span className="mk-story-time">{m.t}</span>
                </figure>
                <div className="mk-story-text">
                  <h3>{m.title}</h3>
                  <p>{m.body}</p>
                  <div className="mk-story-proof">
                    <span className="mk-story-who">
                      <span className="mk-dot" aria-hidden="true" />
                      {m.proof.who}
                    </span>
                    <strong>{m.proof.title}</strong>
                    {m.proof.lines.map((l) => (
                      <span key={l}>{l}</span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mk-story-rail" role="group" aria-label="Jump to a moment in the night">
            <span className="mk-story-line" aria-hidden="true">
              <i data-story-fill />
            </span>
            {NIGHT.moments.map((m, i) => (
              <button
                key={i}
                type="button"
                data-story-jump={i}
                aria-label={`${m.t}: ${m.title}`}
                aria-current={i === 0 ? 'true' : undefined}
              >
                <i aria-hidden="true" />
                <span>{m.t}</span>
              </button>
            ))}
          </div>
          <p className="mk-story-note">Photos are illustrative · sample data</p>
        </div>
      </div>
    </section>
  )
}

/* ---------- Walk the round: the flashlight patrol (dark) ------------------ */
function PatrolGame() {
  return (
    <section id="patrol" className="mk-section mk-dark" aria-labelledby="patrol-title" data-mk-patrol>
      <div className="mk-wrap">
        <div className="mk-head">
          <h2 id="patrol-title" className="mk-h2">
            {PATROL.title}
          </h2>
          <p className="mk-intro">{PATROL.intro}</p>
        </div>
        <div className="mk-patrol-grid">
          <div className="mk-patrol-stage" data-patrol-stage>
            <img
              src="/marketing/night-parkade.webp"
              width="1800"
              height="1076"
              alt="An empty underground parkade at night, a guard checking his phone in the far corner"
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            {PATROL.tags.map((t) => (
              <button
                key={t.id}
                type="button"
                className="mk-tag"
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
                data-patrol-tag={t.id}
                data-name={t.name}
                data-edge={t.x > 88 ? 'right' : undefined}
                aria-label={`Tap checkpoint tag: ${t.name}`}
                aria-pressed="false"
              >
                <Nfc aria-hidden="true" />
                <span className="mk-tag-label">{t.name}</span>
              </button>
            ))}
            <div className="mk-patrol-dark" aria-hidden="true" />
            <div className="mk-patrol-beam" aria-hidden="true" />
            <p className="mk-patrol-hint" data-patrol-hint>
              <Flashlight aria-hidden="true" /> Find {PATROL.tags.length} tags
            </p>
            <div className="mk-patrol-done" data-patrol-done hidden>
              <CircleCheck aria-hidden="true" />
              <strong>{PATROL.done}</strong>
              <button type="button" className="mk-btn mk-btn--ink mk-btn--sm" data-patrol-reset>
                <RotateCcw aria-hidden="true" /> Walk it again
              </button>
            </div>
          </div>
          <aside className="mk-patrol-side" aria-label="What your client sees">
            <div className="mk-patrol-side-head">
              <span>
                <strong>Your client’s screen</strong>
                <small>800 Bay Street · Parkade P2</small>
              </span>
              <span className="mk-badge-live">
                <i />
                Live
              </span>
            </div>
            <p className="mk-patrol-count">
              <b data-patrol-count>0</b>/{PATROL.tags.length} checkpoints
            </p>
            <div className="mk-portal-bar">
              <i data-patrol-bar style={{ transform: 'scaleX(0)' }} />
            </div>
            <ol className="mk-feed mk-feed--patrol" data-patrol-feed aria-live="polite" />
            <p className="mk-patrol-empty" data-patrol-empty>
              Waiting for the first tap…
            </p>
            <button type="button" className="mk-patrol-lights" data-patrol-lights>
              Just turn the lights on
            </button>
          </aside>
        </div>
      </div>
    </section>
  )
}

/* ---------- Your client asks… (light) ------------------------------------ */
function Proof({ it }) {
  if (it.kind === 'incident') {
    return (
      <div className="mk-proof mk-proof--incident">
        <img src="/marketing/thumb-incident.webp" width="320" height="236" alt="" loading="lazy" />
        <div>
          <strong>{it.title}</strong>
          <small>{it.meta}</small>
          <p>{it.body}</p>
        </div>
      </div>
    )
  }
  return (
    <table className="mk-proof mk-proof--table">
      <tbody>
        {it.rows.map((r) => (
          <tr key={r[0] + r[1]}>
            <td>{r[0]}</td>
            <td>{r[1]}</td>
            <td>{r[2]}</td>
            {it.kind === 'scans' && (
              <td>
                <Check aria-hidden="true" />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ClientAsks() {
  return (
    <section id="asks" className="mk-section mk-band" aria-labelledby="asks-title" data-mk-asks>
      <div className="mk-wrap mk-asks-grid">
        <div>
          <h2 id="asks-title" className="mk-h2">
            {ASKS.title}
          </h2>
          <p className="mk-intro">{ASKS.intro}</p>
          <div className="mk-asks-qs" role="tablist" aria-label="Questions clients ask" aria-orientation="vertical">
            {ASKS.items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                role="tab"
                id={`ask-tab-${it.id}`}
                aria-controls={`ask-panel-${it.id}`}
                aria-selected={i === 0}
                tabIndex={i === 0 ? 0 : -1}
                className="mk-ask-q"
              >
                <MessageSquare aria-hidden="true" />
                <span>“{it.q}”</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mk-chat">
          <div className="mk-chat-head">
            <span className="mk-chat-avatar" aria-hidden="true">
              PM
            </span>
            <span>
              <strong>{ASKS.who}</strong>
              <small>Messages · sample</small>
            </span>
          </div>
          {ASKS.items.map((it, i) => (
            <div
              key={it.id}
              role="tabpanel"
              id={`ask-panel-${it.id}`}
              aria-labelledby={`ask-tab-${it.id}`}
              className="mk-chat-body"
              hidden={i !== 0}
            >
              <p className="mk-bubble mk-bubble--them">{it.q}</p>
              <span className="mk-typing" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <div className="mk-bubble mk-bubble--you">
                <p>{it.a}</p>
                <Proof it={it} />
                <small>{it.note}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

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

      {/* ================= HEADER ======================================== */}
      <header className="mk-header" data-mk-header>
        <div className="mk-wrap mk-header-row">
          <Brand />
          <nav aria-label="Main" className="mk-nav">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} data-mk-navlink>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="mk-header-actions">
            <a href="/login" className="mk-signin">
              Sign in
            </a>
            <a href="#demo" className="mk-btn mk-btn--ink mk-btn--sm">
              Book a demo
            </a>
            <details className="mk-menu" data-mk-menu>
              <summary aria-label="Menu">
                <Menu className="mk-menu-open" aria-hidden="true" />
                <X className="mk-menu-close" aria-hidden="true" />
              </summary>
              <nav aria-label="Mobile" className="mk-menu-panel">
                {NAV.map((n) => (
                  <a key={n.href} href={n.href}>
                    {n.label}
                  </a>
                ))}
                <a href="/shop">Shop tags and gear</a>
                <a href="/login">Sign in</a>
              </nav>
            </details>
          </div>
        </div>
      </header>

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

        {/* ================= HOW IT WORKS (hands-on simulator) ========== */}
        <section id="how-it-works" className="mk-section mk-band" aria-labelledby="how-title" data-mk-steps>
          <div className="mk-wrap">
            <div className="mk-head">
              <h2 id="how-title" className="mk-h2">
                {STEPS.title}
              </h2>
              <p className="mk-intro">{STEPS.intro}</p>
            </div>
            <div className="mk-steps-grid">
              <ol className="mk-steps" aria-label="Steps">
                {STEPS.items.map((st, i) => (
                  <li key={st.title}>
                    <button
                      type="button"
                      className="mk-step"
                      data-step={i + 1}
                      aria-current={i === 2 ? 'step' : undefined}
                      aria-controls="guard-tour-sim"
                    >
                      <span className="mk-step-n" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="mk-step-text">
                        <span className="mk-step-title">{st.title}</span>
                        <span className="mk-step-body">{st.body}</span>
                      </span>
                      <span className="mk-step-progress" aria-hidden="true">
                        <i data-step-progress={i + 1} />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <GuardTourSim />
            </div>
          </div>
        </section>

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

        {/* ================= PRODUCT TOUR (tabs) ========================= */}
        <section id="tour" className="mk-section" aria-labelledby="tour-title" data-mk-tour>
          <div className="mk-wrap">
            <div className="mk-head mk-head--center">
              <h2 id="tour-title" className="mk-h2">
                {TOUR.title}
              </h2>
              <p className="mk-intro">{TOUR.intro}</p>
            </div>
            <div className="mk-tabs" role="tablist" aria-label="Product tour">
              {TOUR.tabs.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tour-tab-${t.id}`}
                  aria-controls={`tour-panel-${t.id}`}
                  aria-selected={i === 0}
                  tabIndex={i === 0 ? 0 : -1}
                  data-tour={t.id}
                >
                  {t.tab}
                </button>
              ))}
            </div>
            {TOUR.tabs.map((t, i) => (
              <div
                key={t.id}
                role="tabpanel"
                id={`tour-panel-${t.id}`}
                aria-labelledby={`tour-tab-${t.id}`}
                className={`mk-tour-panel${t.frame === 'phone' ? ' mk-tour-panel--phone' : ''}`}
                data-tour-panel={t.id}
                hidden={i !== 0}
              >
                <div className="mk-tour-copy">
                  <h3 className="mk-h3">{t.title}</h3>
                  <ul className="mk-checks">
                    {t.points.map((p) => (
                      <li key={p}>
                        <Check aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <a href="#demo" className="mk-link">
                    See it on a demo <ArrowRight aria-hidden="true" />
                  </a>
                </div>
                <div className="mk-tour-media">
                  <Shot image={t.image} frame={t.frame} url={t.url} />
                </div>
              </div>
            ))}
          </div>
        </section>

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

        {/* ================= SAVINGS CALCULATOR ========================== */}
        <section className="mk-section mk-band" aria-labelledby="calc-title">
          <div className="mk-wrap">
            <div className="mk-head">
              <h2 id="calc-title" className="mk-h2">
                {CALC.title}
              </h2>
              <p className="mk-intro">{CALC.intro}</p>
            </div>
            <Calculator />
          </div>
        </section>

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

        {/* ================= FAQ ========================================= */}
        <section id="faq" className="mk-section" aria-labelledby="faq-title">
          <div className="mk-wrap mk-faq-grid">
            <div>
              <h2 id="faq-title" className="mk-h2">
                Questions owners ask us
              </h2>
              <p className="mk-intro">
                Something else? Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or ask on your demo.
              </p>
            </div>
            <div className="mk-faq">
              {FAQS.map((f) => (
                <details key={f.q}>
                  <summary>
                    <h3>{f.q}</h3>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ================= DEMO (the one dark band) ==================== */}
        <section id="demo" className="mk-section mk-night" aria-labelledby="demo-title">
          <div className="mk-wrap mk-demo-grid">
            <div className="mk-demo-copy">
              <h2 id="demo-title" className="mk-h2">
                {DEMO.title}
              </h2>
              <p className="mk-intro">{DEMO.body}</p>
              <ul className="mk-checks">
                {DEMO.points.map((pt) => (
                  <li key={pt}>
                    <Check aria-hidden="true" />
                    {pt}
                  </li>
                ))}
              </ul>
              <p className="mk-demo-direct">
                <Mail aria-hidden="true" />
                Prefer email? <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              </p>
            </div>

            <div className="mk-form-card">
              <form data-mk-demo-form noValidate>
                <div className="mk-field-row">
                  <label className="mk-field">
                    <span>Your name</span>
                    <input name="name" autoComplete="name" required maxLength={120} />
                  </label>
                  <label className="mk-field">
                    <span>Company</span>
                    <input name="company" autoComplete="organization" required maxLength={160} />
                  </label>
                </div>
                <div className="mk-field-row">
                  <label className="mk-field">
                    <span>Work email</span>
                    <input name="email" type="email" autoComplete="email" required maxLength={254} />
                  </label>
                  <label className="mk-field">
                    <span>
                      Phone <i>(optional)</i>
                    </span>
                    <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
                  </label>
                </div>
                <fieldset className="mk-field">
                  <legend>How many guards do you have?</legend>
                  <div className="mk-chips">
                    {DEMO.guardOptions.map((g, i) => (
                      <label key={g}>
                        <input type="radio" name="guards" value={g} defaultChecked={i === 1} />
                        <span>{g}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="mk-field">
                  <span>
                    Anything we should know? <i>(optional)</i>
                  </span>
                  <textarea
                    name="message"
                    rows={3}
                    maxLength={2000}
                    placeholder="e.g. 8 condo sites in North York, clients asking for patrol reports"
                  />
                </label>
                <input type="hidden" name="plan" value="" />
                <label className="mk-hp" aria-hidden="true">
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
                <p className="mk-form-error" role="alert" data-mk-form-error hidden />
                <button type="submit" className="mk-btn mk-btn--ink mk-btn--lg mk-btn--block">
                  <span data-mk-submit-label>{DEMO.submit}</span>
                  <ArrowRight aria-hidden="true" />
                </button>
                <p className="mk-form-privacy">{DEMO.privacy}</p>
              </form>
              <div className="mk-form-done" data-mk-form-done hidden tabIndex={-1}>
                <span className="mk-form-done-icon" aria-hidden="true">
                  <Check />
                </span>
                <h3>Request received</h3>
                <p>{DEMO.success}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================= FOOTER ========================================= */}
      <footer className="mk-footer">
        <div className="mk-wrap">
          <div className="mk-footer-grid">
            <div>
              <Brand dark />
              <p className="mk-footer-blurb">{FOOTER.blurb}</p>
              <p className="mk-footer-loc">
                <MapPin aria-hidden="true" />
                {SITE.city}, {SITE.region}, Canada
              </p>
            </div>
            <nav aria-label="Product">
              <p>Product</p>
              <ul>
                <li>
                  <a href="#how-it-works">Guard tour app</a>
                </li>
                <li>
                  <a href="#gps">GPS tracking</a>
                </li>
                <li>
                  <a href="#tour">Client portal</a>
                </li>
                <li>
                  <a href="#tour">Scheduling and payroll</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
              </ul>
            </nav>
            <nav aria-label="Company">
              <p>Company</p>
              <ul>
                <li>
                  <a href="#demo">Book a demo</a>
                </li>
                <li>
                  <a href="#faq">FAQ</a>
                </li>
                <li>
                  <a href="/shop">Shop tags and gear</a>
                </li>
                <li>
                  <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                </li>
              </ul>
            </nav>
            <nav aria-label="Sign in">
              <p>Sign in</p>
              <ul>
                <li>
                  <a href="/login">Office and admin</a>
                </li>
                <li>
                  <a href="/login">Client portal</a>
                </li>
                <li>
                  <a href="/login">Guard app</a>
                </li>
              </ul>
            </nav>
          </div>
          <div className="mk-footer-base">
            <span>
              © {new Date().getFullYear()} Kronus. Built by {SITE.owner}. All rights reserved.
            </span>
            <span>Screenshots and demos show sample data.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
