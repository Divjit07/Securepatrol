import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ClipboardCheck,
  Clock,
  FileText,
  MapPin,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import KpiCard from '../components/KpiCard.jsx'
import RosterSitePicker, { ALL_SITES } from '../components/roster/RosterSitePicker.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { SUMMARY_PERIODS, fetchOpsSummary, buildNarrative } from '../lib/opsSummary.js'

function TrendChip({ label, value, invert = false, unit = '%' }) {
  if (value == null || value === 0) return null
  const up = value > 0
  const good = invert ? !up : up
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        good ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
      }`}
    >
      <Icon className="h-3 w-3" />
      {label} {up ? '+' : ''}
      {value}
      {unit}
    </span>
  )
}

/** Ops digest computed 100% from Supabase queries — the AI layer, when it
 *  arrives, will only rephrase this data (never compute it). */
export default function AdminSummary() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(ALL_SITES)
  const [period, setPeriod] = useState('week')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin').then(setSites)
  }, [user?.id, isSuperAdmin])

  const siteIds = useMemo(
    () => (selectedSite === ALL_SITES ? sites.map((s) => s.id) : [selectedSite]),
    [selectedSite, sites],
  )
  const siteLabel =
    selectedSite === ALL_SITES
      ? sites.length === 1
        ? sites[0].name
        : `All sites (${sites.length})`
      : sites.find((s) => s.id === selectedSite)?.name || 'Site'
  const periodLabel = SUMMARY_PERIODS.find((p) => p.id === period)?.label || ''

  const load = async () => {
    if (!siteIds.length) return
    setLoading(true)
    setError(null)
    try {
      setSummary(await fetchOpsSummary(siteIds, period))
    } catch (err) {
      setError(err.message || 'Failed to build the summary')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [siteIds.join(','), period])

  const narrative = useMemo(
    () => buildNarrative(summary, { siteLabel, periodLabel }),
    [summary, siteLabel, periodLabel],
  )

  const copyDigest = async () => {
    const text = [`${siteLabel} — Ops digest (${periodLabel})`, '', ...narrative.map((l) => `• ${l}`)].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const maxHour = summary ? Math.max(1, ...summary.activityByHour) : 1

  return (
    <Layout variant="admin">
      <PageHeader
        title="Ops Summary"
        description="Coverage, checkpoint completion, misses and anomalies — every number computed straight from the database."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {sites.length > 0 && (
          <RosterSitePicker sites={sites} value={selectedSite} onChange={setSelectedSite} />
        )}
        <div className="flex flex-wrap gap-1.5">
          {SUMMARY_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                period === p.id ? 'bg-white text-black' : 'bg-white/5 text-ink-2 hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : !summary ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-ink-2">
          Pick a site to build the summary.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={ShieldCheck}
              label="Shift coverage"
              value={summary.shiftStats.coveragePct != null ? `${summary.shiftStats.coveragePct}%` : '—'}
              tone="lime"
            />
            <KpiCard
              icon={MapPin}
              label={`Checkpoints (${summary.checkpointStats.completedVisits}/${summary.checkpointStats.expectedVisits})`}
              value={summary.checkpointStats.completionPct != null ? `${summary.checkpointStats.completionPct}%` : '—'}
              tone="sky"
            />
            <KpiCard icon={AlertTriangle} label="Missed checkpoints" value={summary.missRows.length} tone="blossom" />
            <KpiCard icon={FileText} label="Incidents pending review" value={summary.incidentStats.pendingReview} tone="lavender" />
          </div>

          {/* Trend chips */}
          <div className="mb-6 flex flex-wrap gap-2">
            <TrendChip label="Scans" value={summary.trends.scans} />
            <TrendChip label="Completion" value={summary.trends.completionPct} unit=" pts" />
            <TrendChip label="Misses" value={summary.trends.misses} invert />
            <TrendChip label="Alerts" value={summary.trends.alerts} invert />
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            {/* Narrative digest */}
            <div className="dk-card p-6 xl:col-span-3">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Activity className="h-4 w-4 text-accent-orange" /> Digest — {periodLabel}
                </p>
                <button
                  type="button"
                  onClick={copyDigest}
                  className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-white/10"
                >
                  {copied ? <ClipboardCheck className="h-3.5 w-3.5 text-accent-green" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy digest'}
                </button>
              </div>
              <ul className="mt-4 space-y-3">
                {narrative.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${line.startsWith('⚠') ? 'bg-accent-red' : 'bg-accent-cyan-line'}`} />
                    <span className={line.startsWith('⚠') ? 'font-medium text-ink' : ''}>{line.replace(/^⚠ /, '')}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-white/5 pt-3 text-[11px] text-ink-3">
                Rule-based narrative over live queries — no AI involved. When the assistant layer ships, it rephrases these
                exact numbers; it never computes them.
              </p>
            </div>

            <div className="space-y-4 xl:col-span-2">
              {/* Repeat offenders */}
              <div className="dk-card p-6">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <AlertTriangle className="h-4 w-4 text-accent-red" /> Repeat misses
                </p>
                {summary.repeatOffenders.length === 0 ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-ink-2">
                    <CheckCircle2 className="h-4 w-4 text-accent-green" /> Nobody has more than one miss this period.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {summary.repeatOffenders.map((r) => (
                      <li key={r.guardId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-ink">{r.guardName}</span>
                        <span className="rounded-full bg-accent-red/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-red">
                          {r.count} misses
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Punctuality board */}
              <div className="dk-card p-6">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Clock className="h-4 w-4 text-accent-cyan-line" /> Punctuality
                </p>
                {summary.punctuality.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-2">No clock-ins in this window.</p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {summary.punctuality.slice(0, 6).map((g) => (
                      <li key={g.guardId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-ink-2">{g.guardName}</span>
                        <span className={`text-xs font-semibold tabular-nums ${g.avgLate >= 10 ? 'text-accent-red' : g.avgLate > 0 ? 'text-accent-orange' : 'text-accent-green'}`}>
                          {g.avgLate === 0 ? 'on time' : `+${g.avgLate} min avg`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Activity by hour */}
          <div className="dk-card mt-4 p-6">
            <p className="text-sm font-semibold text-ink">Scan activity by hour</p>
            <div className="mt-4 flex h-24 items-end gap-1">
              {summary.activityByHour.map((n, h) => (
                <div key={h} className="group relative flex-1">
                  <div
                    className={`w-full rounded-t ${n ? 'bg-accent-cyan-line/70' : 'bg-white/5'}`}
                    style={{ height: `${Math.max(4, (n / maxHour) * 96)}px` }}
                    title={`${String(h).padStart(2, '0')}:00 — ${n} scans`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-ink-3">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          </div>

          {/* Guard table */}
          <div className="dk-card mt-4 overflow-hidden">
            <p className="px-6 pt-6 text-sm font-semibold text-ink">Guard scoreboard</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-white/5 text-ink-2">
                  <tr>
                    <th className="px-6 py-2.5 font-medium">Guard</th>
                    <th className="px-6 py-2.5 font-medium">Shifts</th>
                    <th className="px-6 py-2.5 font-medium">Scans</th>
                    <th className="px-6 py-2.5 font-medium">Misses</th>
                    <th className="px-6 py-2.5 font-medium">Avg clock-in</th>
                    <th className="px-6 py-2.5 font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summary.guardTable.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-ink-3">
                        No guard activity in this window.
                      </td>
                    </tr>
                  ) : (
                    summary.guardTable.map((g) => (
                      <tr key={g.guardId}>
                        <td className="px-6 py-3 font-medium text-ink">{g.guardName}</td>
                        <td className="px-6 py-3 tabular-nums text-ink-2">{g.shifts}</td>
                        <td className="px-6 py-3 tabular-nums text-ink-2">{g.scans}</td>
                        <td className={`px-6 py-3 tabular-nums ${g.misses ? 'font-semibold text-accent-red' : 'text-ink-2'}`}>{g.misses}</td>
                        <td className="px-6 py-3 tabular-nums text-ink-2">
                          {g.avgLate == null ? '—' : g.avgLate === 0 ? 'on time' : `+${g.avgLate} min`}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {g.noShows > 0 && (
                              <span className="rounded-full bg-accent-red/15 px-2 py-0.5 text-[10px] font-semibold text-accent-red">
                                {g.noShows} no-show{g.noShows > 1 ? 's' : ''}
                              </span>
                            )}
                            {g.missingClockOuts > 0 && (
                              <span className="rounded-full bg-accent-orange/15 px-2 py-0.5 text-[10px] font-semibold text-accent-orange">
                                {g.missingClockOuts} no clock-out
                              </span>
                            )}
                            {g.noShows === 0 && g.missingClockOuts === 0 && g.misses === 0 && (
                              <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[10px] font-semibold text-accent-green">
                                clean
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
