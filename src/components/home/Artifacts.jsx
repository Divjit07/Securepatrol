import { Camera, Check, Nfc, TriangleAlert } from 'lucide-react'
import { EagleMark } from './EagleMark.jsx'
import {
  ROSTER,
  TIMESHEET,
  INCIDENT,
  LABEL,
  SCAN_EXPORT,
  labelModules,
} from './artifactData.js'

/**
 * The paper family. Everything the record produces, as the actual artifact rather
 * than a claim about it: a published roster, a payroll stub, an incident report,
 * the scan history the other three are derived from, and the physical label that
 * starts the whole chain.
 *
 * All four share the same stock, masthead and rules as the patrol report, so the
 * page reads as one filing system rather than four unrelated cards.
 */

/** Shared sheet: warm stock, eagle masthead, document reference. */
function Sheet({ title, docRef, children, className = '', tint }) {
  return (
    <article
      className={`kr-paper relative overflow-hidden rounded-[3px] ${className}`}
      aria-label={`Sample ${title.toLowerCase()}`}
    >
      <div className="p-5 sm:p-6">
        <header className="flex items-baseline justify-between gap-4 border-b-2 border-[color-mix(in_srgb,#171a12_45%,transparent)] pb-2.5">
          <p className="flex items-center gap-2">
            <EagleMark className="h-4 w-4 text-[var(--kr-paper-ink)]" withEye={false} />
            <span
              className="kr-display text-[0.95rem]"
              style={{ fontVariationSettings: '"wdth" 108' }}
            >
              KRONUS
            </span>
          </p>
          <div className="text-right">
            <p
              className="kr-doc-label text-[9.5px]"
              style={{ color: tint || 'var(--kr-paper-ink-2)' }}
            >
              {title}
            </p>
            <p className="kr-meas text-[10px] text-[var(--kr-paper-ink-2)]">{docRef}</p>
          </div>
        </header>
        {children}
      </div>
    </article>
  )
}

function Label({ children }) {
  return (
    <p className="kr-doc-label text-[9.5px] text-[var(--kr-paper-ink-2)]">{children}</p>
  )
}

function Foot({ left, right }) {
  return (
    <footer className="kr-meas mt-5 flex justify-between gap-3 border-t border-[color-mix(in_srgb,#171a12_18%,transparent)] pt-3 text-[9.5px] text-[var(--kr-paper-ink-2)]">
      <span>{left}</span>
      <span>SYNTHETIC SAMPLE</span>
    </footer>
  )
}

/* ── Published roster ──────────────────────────────────────────────────────── */

export function RosterSheet({ className = '' }) {
  return (
    <Sheet title="Published roster" docRef={ROSTER.docRef} className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3 pt-4">
        <div>
          <Label>Week</Label>
          <p className="mt-1 text-[13px] font-semibold">{ROSTER.week}</p>
          <p className="kr-meas mt-0.5 text-[10.5px] text-[var(--kr-paper-ink-2)]">
            {ROSTER.site}
          </p>
        </div>
        <p className="kr-stamp -rotate-[4deg] rounded-[2px] px-2.5 py-1 text-[10px]">
          PUBLISHED
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Published shift roster for the week</caption>
          <thead>
            <tr className="border-y border-[color-mix(in_srgb,#171a12_20%,transparent)]">
              <th scope="col" className="kr-doc-label py-1.5 pr-3 text-[9px]">
                Guard
              </th>
              {ROSTER.days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="kr-doc-label py-1.5 text-center text-[9px]"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROSTER.guards.map((g) => (
              <tr
                key={g.name}
                className="border-b border-[color-mix(in_srgb,#171a12_9%,transparent)]"
              >
                <th
                  scope="row"
                  className={`py-1.5 pr-3 text-left text-[11.5px] whitespace-nowrap ${
                    g.open ? 'font-semibold text-[#8a6a00]' : 'font-medium'
                  }`}
                >
                  {g.name}
                </th>
                {g.shifts.map((s, i) => (
                  <td key={i} className="py-1.5 text-center">
                    {s === '—' ? (
                      <span className="text-[11px] text-[color-mix(in_srgb,#171a12_28%,transparent)]">
                        ·
                      </span>
                    ) : (
                      <span
                        className={`kr-meas inline-block rounded-[2px] px-1.5 py-0.5 text-[9.5px] ${
                          g.open
                            ? 'bg-[#f2e3a8] text-[#5c4700]'
                            : 'bg-[color-mix(in_srgb,#2f7d34_14%,transparent)] text-[#1f5c23]'
                        }`}
                      >
                        {s}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3.5 text-[11.5px] leading-relaxed text-[var(--kr-paper-ink-2)]">
        Published {ROSTER.published} · calendar invites sent to {ROSTER.invites} guards ·
        one open shift left for claiming.
      </p>

      <Foot left={ROSTER.docRef} />
    </Sheet>
  )
}

/* ── Payroll stub ─────────────────────────────────────────────────────────── */

export function TimesheetSheet({ className = '' }) {
  return (
    <Sheet title="Payroll stub" docRef={TIMESHEET.docRef} className={className}>
      <div className="grid grid-cols-2 gap-4 pt-4">
        <div>
          <Label>Guard</Label>
          <p className="mt-1 text-[13px] font-semibold">{TIMESHEET.guard}</p>
          <p className="kr-meas mt-0.5 text-[10.5px] text-[var(--kr-paper-ink-2)]">
            #{TIMESHEET.guardId} · ${TIMESHEET.rate}/h
          </p>
        </div>
        <div>
          <Label>Period</Label>
          <p className="mt-1 text-[13px] font-semibold">{TIMESHEET.period}</p>
        </div>
      </div>

      <table className="mt-4 w-full border-collapse text-left">
        <caption className="sr-only">Derived payroll lines for the pay period</caption>
        <thead>
          <tr className="border-y border-[color-mix(in_srgb,#171a12_20%,transparent)]">
            <th scope="col" className="kr-doc-label py-1.5 text-[9px]">
              Line
            </th>
            <th scope="col" className="kr-doc-label py-1.5 text-right text-[9px]">
              Hours
            </th>
            <th scope="col" className="kr-doc-label py-1.5 text-right text-[9px]">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {TIMESHEET.lines.map((l) => (
            <tr
              key={l.label}
              className="border-b border-[color-mix(in_srgb,#171a12_9%,transparent)]"
            >
              <td className="py-2 pr-3">
                <span className="block text-[12px] font-medium">{l.label}</span>
                <span className="kr-meas block text-[10px] text-[var(--kr-paper-ink-2)]">
                  {l.detail}
                </span>
              </td>
              <td className="kr-meas py-2 text-right text-[12px] whitespace-nowrap">
                {l.hours}
              </td>
              <td className="kr-meas py-2 text-right text-[12px] whitespace-nowrap">
                {l.amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t-2 border-[color-mix(in_srgb,#171a12_45%,transparent)] pt-3">
        <dl className="flex gap-6">
          <div>
            <dt className="kr-doc-label text-[9px] text-[var(--kr-paper-ink-2)]">
              Raw punches
            </dt>
            <dd className="kr-meas mt-0.5 text-[13px]">{TIMESHEET.raw} h</dd>
          </div>
          <div>
            <dt className="kr-doc-label text-[9px] text-[var(--kr-paper-ink-2)]">
              After rounding
            </dt>
            <dd className="kr-meas mt-0.5 text-[13px]">{TIMESHEET.billable} h</dd>
          </div>
        </dl>
        <div className="text-right">
          <p className="kr-doc-label text-[9px] text-[var(--kr-paper-ink-2)]">Gross</p>
          <p className="kr-meas mt-0.5 text-xl font-semibold">${TIMESHEET.gross}</p>
        </div>
      </div>

      <p className="kr-meas mt-3 flex items-center gap-1.5 text-[10.5px] text-[#1f5c23]">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
        {TIMESHEET.signed}
      </p>

      <Foot left={TIMESHEET.docRef} />
    </Sheet>
  )
}

/* ── Incident report ──────────────────────────────────────────────────────── */

export function IncidentSheet({ className = '' }) {
  return (
    <Sheet
      title="Incident report"
      docRef={INCIDENT.docRef}
      className={className}
      tint="#b3261e"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 pt-4">
        <div>
          <Label>Where</Label>
          <p className="mt-1 text-[13px] font-semibold">{INCIDENT.where}</p>
          <p className="kr-meas mt-0.5 text-[10.5px] text-[var(--kr-paper-ink-2)]">
            {INCIDENT.site} · {INCIDENT.at}
          </p>
        </div>
        <p className="kr-doc-label flex items-center gap-1.5 rounded-[2px] bg-[color-mix(in_srgb,#b3261e_12%,transparent)] px-2 py-1 text-[9px] text-[#b3261e]">
          <TriangleAlert className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
          {INCIDENT.type} · {INCIDENT.severity}
        </p>
      </div>

      <div className="mt-4 border-t border-[color-mix(in_srgb,#171a12_18%,transparent)] pt-3">
        <Label>Filed by</Label>
        <p className="kr-meas mt-1 text-[11.5px]">{INCIDENT.by}</p>
      </div>

      <div className="mt-3.5">
        <Label>Narrative</Label>
        <p className="mt-1.5 text-[12.5px] leading-relaxed">{INCIDENT.narrative}</p>
      </div>

      {/* The photographs as they print: keyed by reference, on the stock. */}
      <div className="mt-4">
        <Label>Attachments · {INCIDENT.photos.length} photos</Label>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {INCIDENT.photos.map((photo) => (
            <figure
              key={photo.ref}
              className="overflow-hidden rounded-[2px] border border-[color-mix(in_srgb,#171a12_22%,transparent)] bg-[color-mix(in_srgb,#171a12_6%,transparent)]"
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
                className="block aspect-[4/3] w-full object-cover"
              />
              <figcaption className="kr-meas flex items-center gap-1.5 px-1.5 py-1 text-[9px] text-[var(--kr-paper-ink-2)]">
                <Camera className="h-2.5 w-2.5" strokeWidth={1.8} aria-hidden="true" />
                {photo.ref}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {INCIDENT.actions.map((a) => (
          <li key={a} className="flex items-start gap-2 text-[12px]">
            <Check
              className="mt-0.5 h-3 w-3 shrink-0 text-[#1f5c23]"
              strokeWidth={3}
              aria-hidden="true"
            />
            {a}
          </li>
        ))}
      </ul>

      <p className="kr-meas mt-4 text-[10.5px] text-[var(--kr-paper-ink-2)]">
        {INCIDENT.delivered}
      </p>

      <Foot left={INCIDENT.docRef} />
    </Sheet>
  )
}

/* ── Scan export ──────────────────────────────────────────────────────────── */

export function ScanReportSheet({ className = '' }) {
  return (
    <Sheet title="Scan history" docRef={SCAN_EXPORT.docRef} className={className}>
      <div className="grid grid-cols-2 gap-4 pt-4">
        <div>
          <Label>Site</Label>
          <p className="mt-1 text-[13px] font-semibold">{SCAN_EXPORT.site}</p>
          <p className="kr-meas mt-0.5 text-[10.5px] text-[var(--kr-paper-ink-2)]">
            {SCAN_EXPORT.guard} #{SCAN_EXPORT.guardId}
          </p>
        </div>
        <div>
          <Label>Period</Label>
          <p className="mt-1 text-[13px] font-semibold">{SCAN_EXPORT.period}</p>
        </div>
      </div>

      <table className="mt-4 w-full border-collapse text-left">
        <caption className="sr-only">
          Checkpoint passes logged for the shift, and how each one was proven
        </caption>
        <thead>
          <tr className="border-y border-[color-mix(in_srgb,#171a12_20%,transparent)]">
            <th scope="col" className="kr-doc-label py-1.5 text-[9px]">
              Time
            </th>
            <th scope="col" className="kr-doc-label py-1.5 text-[9px]">
              Checkpoint
            </th>
            <th scope="col" className="kr-doc-label py-1.5 text-right text-[9px]">
              Method
            </th>
          </tr>
        </thead>
        <tbody>
          {SCAN_EXPORT.rows.map((r) => (
            <tr
              key={`${r.time}-${r.point}`}
              className="border-b border-[color-mix(in_srgb,#171a12_9%,transparent)]"
            >
              <td className="kr-meas py-2 pr-3 text-[12px] whitespace-nowrap">{r.time}</td>
              <td className="py-2 pr-3">
                <span className="block text-[12px] font-medium">{r.point}</span>
                <span className="kr-meas block text-[10px] text-[var(--kr-paper-ink-2)]">
                  {r.floor}
                </span>
              </td>
              <td className="kr-meas py-2 text-right text-[12px] whitespace-nowrap">
                {r.via}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t-2 border-[color-mix(in_srgb,#171a12_45%,transparent)] pt-3">
        <dl className="flex gap-6">
          <div>
            <dt className="kr-doc-label text-[9px] text-[var(--kr-paper-ink-2)]">Passes</dt>
            <dd className="kr-meas mt-0.5 text-[13px]">{SCAN_EXPORT.passes}</dd>
          </div>
          <div>
            <dt className="kr-doc-label text-[9px] text-[var(--kr-paper-ink-2)]">
              Checkpoints
            </dt>
            <dd className="kr-meas mt-0.5 text-[13px]">{SCAN_EXPORT.checkpoints}</dd>
          </div>
        </dl>
        <div className="text-right">
          <p className="kr-doc-label text-[9px] text-[var(--kr-paper-ink-2)]">Missed</p>
          <p className="kr-meas mt-0.5 text-xl font-semibold">{SCAN_EXPORT.missed}</p>
        </div>
      </div>

      <p className="kr-meas mt-3 flex items-center gap-1.5 text-[10.5px] text-[#1f5c23]">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
        {SCAN_EXPORT.exported}
      </p>

      <Foot left={SCAN_EXPORT.docRef} />
    </Sheet>
  )
}

/* ── The physical checkpoint label ────────────────────────────────────────── */

export function CheckpointLabel({ className = '' }) {
  const grid = labelModules(21)
  return (
    <article
      className={`kr-paper relative overflow-hidden rounded-[3px] ${className}`}
      aria-label="Sample printed checkpoint label"
      style={{ backgroundImage: 'none' }}
    >
      <div className="p-5">
        <header className="flex items-center justify-between gap-3 border-b-2 border-[var(--kr-paper-ink)] pb-2">
          <p className="flex items-center gap-2">
            <EagleMark className="h-5 w-5 text-[var(--kr-paper-ink)]" withEye={false} />
            <span
              className="kr-display text-[1.05rem]"
              style={{ fontVariationSettings: '"wdth" 108' }}
            >
              KRONUS
            </span>
          </p>
          <Nfc
            className="h-5 w-5 text-[var(--kr-paper-ink)]"
            strokeWidth={2}
            aria-hidden="true"
          />
        </header>

        <div className="flex items-start gap-4 pt-4">
          {/* Sample code block — a module pattern, not a working code. */}
          <div
            className="grid shrink-0 gap-0 bg-white p-1.5"
            style={{
              gridTemplateColumns: `repeat(21, 1fr)`,
              width: '104px',
              height: '104px',
            }}
            aria-hidden="true"
          >
            {grid.flatMap((row, y) =>
              row.map((m, x) => (
                <span
                  key={`${x}-${y}`}
                  style={{ background: m ? '#171a12' : 'transparent' }}
                />
              )),
            )}
          </div>

          <div className="min-w-0">
            <p className="kr-doc-label text-[9px] text-[var(--kr-paper-ink-2)]">
              {LABEL.kind}
            </p>
            <p className="kr-display mt-1 text-[1.15rem] leading-tight">{LABEL.point}</p>
            <p className="kr-meas mt-1 text-[11px] text-[var(--kr-paper-ink-2)]">
              {LABEL.site}
            </p>

            <dl className="mt-3 space-y-1.5">
              <div className="flex gap-2">
                <dt className="kr-doc-label w-16 shrink-0 text-[9px] text-[var(--kr-paper-ink-2)]">
                  Ref
                </dt>
                <dd className="kr-meas text-[11px]">{LABEL.docRef}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="kr-doc-label w-16 shrink-0 text-[9px] text-[var(--kr-paper-ink-2)]">
                  Fix
                </dt>
                <dd className="kr-meas text-[11px]">{LABEL.coords}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="kr-doc-label w-16 shrink-0 text-[9px] text-[var(--kr-paper-ink-2)]">
                  Radius
                </dt>
                <dd className="kr-meas text-[11px]">{LABEL.radius}</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="kr-meas mt-4 flex justify-between border-t border-dashed border-[color-mix(in_srgb,#171a12_28%,transparent)] pt-2.5 text-[9px] text-[var(--kr-paper-ink-2)]">
          <span>TAP OR SCAN TO LOG THE PASS</span>
          <span>SYNTHETIC SAMPLE</span>
        </p>
      </div>
    </article>
  )
}
