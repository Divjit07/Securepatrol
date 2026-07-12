// DEV-ONLY harness (/dev/scale): 40 guards × 15 sites × 14 days of synthetic
// punches through the REAL payroll/clock pipeline, with the math invariants
// asserted and rendered. No auth, no network — everything is generated
// deterministically in the browser.
import { useMemo, useState } from 'react'
import { CheckCircle2, XCircle, Building2, MapPin, Bell, Clock, Wallet, FlaskConical } from 'lucide-react'
import { generateScaleData, runScalePipeline, runScaleChecks } from './scaleData.js'
import { formatMinutes } from '../../lib/payroll.js'
import { describeOperatingHours } from '../../hooks/useClientShift.js'

const money = (n) => `$${n.toFixed(2)}`

export default function ScalePreview() {
  const [seed, setSeed] = useState(42)

  const { data, pipeline, checks, genMs } = useMemo(() => {
    const t0 = performance.now()
    const data = generateScaleData(seed)
    const genMs = performance.now() - t0
    const pipeline = runScalePipeline(data)
    const checks = runScaleChecks(data, pipeline)
    return { data, pipeline, checks, genMs }
  }, [seed])

  const totalScans = Object.values(data.scansBySite).reduce((s, arr) => s + arr.length, 0)
  const failed = checks.filter((c) => !c.pass)
  const otWeeks = pipeline.allWeekly.filter((w) => w.overtimeMinutes > 0)
  const alertCounts = data.alerts.reduce((acc, a) => ({ ...acc, [a.type]: (acc[a.type] || 0) + 1 }), {})

  return (
    <div className="min-h-dvh bg-canvas px-4 py-8 text-ink sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-accent-cyan-line">
              Dev harness · /dev/scale
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Scale test — 40 guards · 15 sites · 14 days</h1>
            <p className="mt-1 text-sm text-ink-2">
              Synthetic punches run through the real payroll, rounding, OT, paystub and clock-state
              code. Seed {seed} · generated in {genMs.toFixed(0)}ms · hours pipeline{' '}
              {pipeline.computeMs.toFixed(0)}ms · {data.guards.length} paystubs {pipeline.paystubMs.toFixed(0)}ms.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="dk-cta"
          >
            <FlaskConical className="h-4 w-4" /> Re-roll data (seed {seed + 1})
          </button>
        </div>

        {/* Verdict banner */}
        <div
          className={`mt-6 rounded-xl border px-5 py-4 text-sm font-semibold ${
            failed.length
              ? 'border-accent-red/40 bg-accent-red/10 text-accent-red'
              : 'border-accent-green/40 bg-accent-green/10 text-accent-green'
          }`}
        >
          {failed.length
            ? `${failed.length} of ${checks.length} logic checks FAILED — see below.`
            : `All ${checks.length} logic checks passed across ${totalScans.toLocaleString()} scans, ${pipeline.allRows.length} shift rows, ${pipeline.allWeekly.length} guard-weeks and ${pipeline.stubs.length} paystubs.`}
        </div>

        {/* KPI row */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Building2, label: 'Sites', value: data.sites.length, hint: `${data.sites.filter((s) => s.latitude == null).length} missing GPS` },
            { icon: MapPin, label: 'Scans (14 days)', value: totalScans.toLocaleString(), hint: `${Object.values(data.checkpointsBySite).flat().length} checkpoints` },
            { icon: Clock, label: 'Shift rows', value: pipeline.allRows.length, hint: `${data.scenarioCounts.forgot_out} forgot clock-out` },
            { icon: Wallet, label: 'OT guard-weeks', value: otWeeks.length, hint: `${formatMinutes(otWeeks.reduce((s, w) => s + w.overtimeMinutes, 0))} total OT` },
            { icon: Bell, label: 'Alerts', value: data.alerts.length, hint: `${alertCounts.late || 0} late · ${alertCounts.no_show || 0} no-show · ${alertCounts.stale_patrol || 0} stale` },
          ].map(({ icon: Icon, label, value, hint }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-surface p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
                <Icon className="h-3.5 w-3.5" /> {label}
              </p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
              <p className="mt-0.5 text-xs text-ink-3">{hint}</p>
            </div>
          ))}
        </div>

        {/* Logic checks */}
        <h2 className="mt-8 font-display text-lg font-semibold">Math & logic checks</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-surface">
          <div className="divide-y divide-white/5">
            {checks.map((c) => (
              <div key={c.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {c.pass ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-green" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-accent-red" />
                )}
                <span className={c.pass ? 'text-ink' : 'font-semibold text-accent-red'}>{c.name}</span>
                {c.detail && <span className="ml-auto shrink-0 text-xs text-ink-3">{c.detail}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Sites + hours */}
          <div>
            <h2 className="font-display text-lg font-semibold">Sites & hours</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-surface">
              <div className="max-h-[26rem] divide-y divide-white/5 overflow-y-auto">
                {data.sites.map((site) => {
                  const geofenced = site.latitude != null
                  const siteGuards = data.guards.filter((g) => g.site_id === site.id).length
                  return (
                    <div key={site.id} className="flex items-center gap-3 px-4 py-3">
                      <Building2 className="h-4 w-4 shrink-0 text-ink-3" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{site.name}</p>
                        <p className="truncate text-xs text-ink-3">
                          {describeOperatingHours(site.operating_hours)} · patrol every {site.patrol_interval_minutes}m · {siteGuards} guards
                        </p>
                      </div>
                      <span
                        className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          geofenced ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
                        }`}
                      >
                        <MapPin className="h-3 w-3" />
                        {geofenced ? `${site.geofence_radius_m}m` : 'No GPS'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Alerts feed */}
          <div>
            <h2 className="font-display text-lg font-semibold">Alerts generated ({data.alerts.length})</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-surface">
              <div className="max-h-[26rem] divide-y divide-white/5 overflow-y-auto">
                {data.alerts.slice(0, 60).map((a, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        a.type === 'no_show'
                          ? 'bg-accent-red/15 text-accent-red'
                          : a.type === 'late'
                            ? 'bg-[#FACC15]/15 text-[#FACC15]'
                            : 'bg-accent-cyan/15 text-accent-cyan-line'
                      }`}
                    >
                      {a.type.replace('_', ' ')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{a.message}</p>
                      <p className="text-xs text-ink-3">{a.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Payroll totals per guard */}
        <h2 className="mt-8 font-display text-lg font-semibold">Payroll — all {data.guards.length} guards (15-min rounding, 2 weeks)</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-surface">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-white/5 text-left text-ink-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">Guard</th>
                <th className="px-4 py-2.5 font-medium">Site</th>
                <th className="px-4 py-2.5 text-right font-medium">Regular</th>
                <th className="px-4 py-2.5 text-right font-medium">OT</th>
                <th className="px-4 py-2.5 text-right font-medium">Stat</th>
                <th className="px-4 py-2.5 text-right font-medium">Rate</th>
                <th className="px-4 py-2.5 text-right font-medium">Gross</th>
                <th className="px-4 py-2.5 text-right font-medium">EI+CPP</th>
                <th className="px-4 py-2.5 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pipeline.stubs.map(({ guard, totals, stub }) => (
                <tr key={guard.id}>
                  <td className="px-4 py-2 font-medium">{guard.name}</td>
                  <td className="px-4 py-2 text-ink-2">{data.sites.find((s) => s.id === guard.site_id)?.name}</td>
                  <td className="px-4 py-2 text-right">{formatMinutes(totals.regularMinutes)}</td>
                  <td className={`px-4 py-2 text-right ${totals.overtimeMinutes ? 'font-semibold text-accent-orange' : 'text-ink-3'}`}>
                    {totals.overtimeMinutes ? formatMinutes(totals.overtimeMinutes) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-ink-2">{totals.statMinutes ? formatMinutes(totals.statMinutes) : '—'}</td>
                  <td className="px-4 py-2 text-right text-ink-2">{money(guard.hourly_rate)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{money(stub.gross)}</td>
                  <td className="px-4 py-2 text-right text-ink-2">−{money(stub.totalDeductions)}</td>
                  <td className="px-4 py-2 text-right font-bold text-accent-green">{money(stub.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-ink-3">
          Scenario mix: {data.scenarioCounts.normal} normal · {data.scenarioCounts.late} late ·{' '}
          {data.scenarioCounts.forgot_out} forgot clock-out · {data.scenarioCounts.early_out} early-out
          w/ note · {data.scenarioCounts.no_show} no-show · {data.scenarioCounts.stat_holiday} stat
          holiday · {data.scenarioCounts.admin_adjusted} admin-adjusted. Overnight sites included.
          Nothing here touches the database.
        </p>
      </div>
    </div>
  )
}
