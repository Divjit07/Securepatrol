import { Check, TriangleAlert } from 'lucide-react'
import { EagleMark, EagleSeal } from './EagleMark.jsx'
import { REPORT } from './reportData.js'

/**
 * The patrol verification report as real DOM text on warm stock.
 *
 * Three jobs: it is the accessible copy of the hero's WebGL sheet, it is the
 * fallback wherever WebGL is unavailable or motion is reduced, and it is the
 * client's half of the "one record, two sides" section further down the page.
 */
export default function ReportSheet({ className = '', compact = false }) {
  return (
    <article
      className={`kr-paper relative overflow-hidden rounded-[3px] ${className}`}
      aria-label="Sample patrol verification report"
    >
      <div className={compact ? 'p-5 sm:p-6' : 'p-6 sm:p-9'}>
        {/* Masthead */}
        <header className="flex items-baseline justify-between gap-4 border-b-2 border-[color-mix(in_srgb,#171a12_45%,transparent)] pb-3">
          <p className="flex items-center gap-2.5">
            <EagleMark className="h-5 w-5 text-[var(--kr-paper-ink)]" withEye={false} />
            <span className="kr-display text-xl" style={{ fontVariationSettings: '"wdth" 108' }}>
              KRONUS
            </span>
          </p>
          <div className="text-right">
            <p className="kr-doc-label text-[10px] text-[var(--kr-paper-ink-2)] sm:text-[11px]">
              Patrol verification report
            </p>
            <p className="kr-meas text-[11px] text-[var(--kr-paper-ink-2)]">{REPORT.docRef}</p>
          </div>
        </header>

        {/* Meta */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pt-5 sm:grid-cols-4">
          {[
            { l: 'Site', v: REPORT.site, s: REPORT.address },
            { l: 'Period', v: REPORT.period, s: `Clock-in radius ${REPORT.clockRadius}` },
            { l: 'Guard', v: REPORT.guard, s: `#${REPORT.guardId}` },
            { l: 'Prepared', v: '06:04', s: 'automatic' },
          ].map((m) => (
            <div key={m.l}>
              <dt className="kr-doc-label text-[10px] text-[var(--kr-paper-ink-2)]">{m.l}</dt>
              <dd className="mt-1.5 text-[15px] leading-tight font-semibold">{m.v}</dd>
              <dd className="kr-meas mt-0.5 text-[11px] text-[var(--kr-paper-ink-2)]">{m.s}</dd>
            </div>
          ))}
        </dl>

        {/* Ledger */}
        <p className="kr-doc-label mt-6 mb-2 text-[9.5px] text-[var(--kr-paper-ink-2)]">
          {REPORT.excerpt}
        </p>
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">
            Checkpoint passes for the shift — selected entries
          </caption>
          <thead>
            <tr className="border-y border-[color-mix(in_srgb,#171a12_20%,transparent)]">
              {[
                { h: 'Time', w: 'w-[3.6rem]' },
                { h: 'Checkpoint', w: 'w-auto' },
                { h: 'Method', w: 'hidden w-[5rem] sm:table-cell' },
                { h: 'Status', w: 'w-[5.5rem] text-right sm:w-[7rem]' },
              ].map((c) => (
                <th
                  key={c.h}
                  scope="col"
                  className={`kr-doc-label py-2 text-[10px] font-semibold text-[var(--kr-paper-ink-2)] ${c.w}`}
                >
                  {c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REPORT.rows.map((r) => {
              const alert = r.status === 'alert'
              return (
                <tr
                  key={r.time + r.point}
                  className="border-b border-[color-mix(in_srgb,#171a12_9%,transparent)]"
                >
                  <td
                    className={`kr-meas py-2 pr-3 text-[13px] font-medium whitespace-nowrap ${
                      alert ? 'text-[#b3261e]' : ''
                    }`}
                  >
                    {r.time}
                  </td>
                  <td
                    className={`py-2 pr-3 text-[13px] ${alert ? 'text-[#b3261e]' : ''} ${
                      r.kind ? 'font-semibold' : ''
                    }`}
                  >
                    {r.kind ? `${r.kind} · ${r.point}` : r.point}
                  </td>
                  <td
                    className={`kr-meas hidden py-2 pr-3 text-[12px] sm:table-cell ${
                      alert ? 'text-[#b3261e]' : 'text-[var(--kr-paper-ink-2)]'
                    }`}
                  >
                    {r.via}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={`kr-doc-label inline-flex items-center gap-1 text-[9.5px] ${
                        alert ? 'text-[#b3261e]' : 'text-[#2f7d34]'
                      }`}
                    >
                      {alert ? (
                        <TriangleAlert className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                      ) : (
                        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                      )}
                      {alert ? 'Alert raised' : 'Verified'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Summary + stamp */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6 border-t-2 border-[color-mix(in_srgb,#171a12_45%,transparent)] pt-5">
          <dl className="flex flex-wrap gap-x-8 gap-y-4">
            {REPORT.summary.map((s) => (
              <div key={s.label}>
                <dt className="kr-doc-label text-[10px] text-[var(--kr-paper-ink-2)]">
                  {s.label}
                </dt>
                <dd
                  className={`kr-meas mt-1 text-xl font-semibold ${
                    s.label === 'Alerts raised' ? 'text-[#b3261e]' : ''
                  }`}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          {/* The eagle signs off a finished record — nothing else on the sheet does. */}
          <EagleSeal
            className="h-24 w-24 shrink-0 -rotate-[7deg] text-[#2f7d34] opacity-90"
            label="Verified record"
            docRef={REPORT.docRef}
          />
        </div>

        <footer className="kr-meas mt-6 flex justify-between text-[10px] text-[var(--kr-paper-ink-2)]">
          <span>
            {REPORT.docRef} · {REPORT.pages}
          </span>
          <span>SYNTHETIC SAMPLE DATA</span>
        </footer>
      </div>
    </article>
  )
}
