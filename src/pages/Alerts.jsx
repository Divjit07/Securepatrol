import { useEffect, useMemo, useState } from 'react'
import { Check, Bell, Sparkles } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import RosterSitePicker, { ALL_SITES } from '../components/roster/RosterSitePicker.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchSitesForAdmin } from '../lib/scans.js'
import {
  fetchAlertEvents,
  fetchAlertNarrative,
  acknowledgeAlertEvent,
  ALERT_TYPE_LABELS,
  ALERT_TYPE_TONE,
} from '../lib/alertEvents.js'

const STATUS_FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'acked', label: 'Acknowledged' },
  { id: 'all', label: 'All' },
]

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'late', label: 'Late' },
  { id: 'no_show', label: 'No-show' },
  { id: 'stale_patrol', label: 'Stale patrol' },
]

const PILL_TONE = {
  amber: 'bg-[#E8A33D]/15 text-[#E8A33D]',
  red: 'bg-accent-red/15 text-accent-red',
  cyan: 'bg-accent-cyan/15 text-accent-cyan-line',
  muted: 'bg-white/10 text-ink-2',
}

const NUM_TONE = {
  amber: 'text-[#E8A33D]',
  red: 'text-accent-red',
  cyan: 'text-accent-cyan-line',
  muted: 'text-ink',
}

function formatWhen(iso) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return time
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-white text-black'
          : 'border border-white/10 bg-transparent text-ink-2 hover:bg-white/5 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export default function Alerts() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(ALL_SITES)
  const [statusFilter, setStatusFilter] = useState('open')
  const [typeFilter, setTypeFilter] = useState('all')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [ackBusy, setAckBusy] = useState(null)
  const [error, setError] = useState(null)
  const [narrative, setNarrative] = useState(null)
  const [narrativeLoading, setNarrativeLoading] = useState(true)

  // AI digest of open alerts — purely additive: if the function is down or the
  // key is missing, the card just doesn't render and the list works as always.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setNarrativeLoading(true)
    fetchAlertNarrative()
      .then((d) => {
        if (!cancelled) setNarrative(d?.narrative || null)
      })
      .catch(() => {
        if (!cancelled) setNarrative(null)
      })
      .finally(() => {
        if (!cancelled) setNarrativeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    const role = isSuperAdmin ? 'super_admin' : 'admin'
    fetchSitesForAdmin(user.id, role).then(setSites)
  }, [user?.id, isSuperAdmin])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const acknowledged =
        statusFilter === 'open' ? false : statusFilter === 'acked' ? true : null
      const rows = await fetchAlertEvents({
        acknowledged,
        siteId: selectedSite === ALL_SITES ? undefined : selectedSite,
        eventType: typeFilter === 'all' ? undefined : typeFilter,
        limit: 150,
      })
      setEvents(rows)
    } catch (err) {
      setError(err.message || 'Failed to load alerts')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    load()
  }, [user?.id, selectedSite, statusFilter, typeFilter])

  // New alerts land live — the roster cron fires every 10 min, and without
  // this the page only refreshed when a filter changed. Silent reload (no
  // spinner) so the list doesn't flash while the admin is reading it.
  useEffect(() => {
    if (!user) return undefined
    const reloadQuietly = async () => {
      try {
        const acknowledged =
          statusFilter === 'open' ? false : statusFilter === 'acked' ? true : null
        const rows = await fetchAlertEvents({
          acknowledged,
          siteId: selectedSite === ALL_SITES ? undefined : selectedSite,
          eventType: typeFilter === 'all' ? undefined : typeFilter,
          limit: 150,
        })
        setEvents(rows)
      } catch {
        /* keep showing the last good list */
      }
    }
    const channel = supabase
      .channel('alerts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_events' }, reloadQuietly)
      .subscribe()
    const onFocus = () => reloadQuietly()
    window.addEventListener('focus', onFocus)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [user?.id, selectedSite, statusFilter, typeFilter])

  const counts = useMemo(() => {
    const base = { late: 0, no_show: 0, stale_patrol: 0, open: 0 }
    for (const e of events) {
      if (!e.acknowledged) base.open += 1
      if (base[e.event_type] !== undefined) base[e.event_type] += 1
    }
    return base
  }, [events])

  const summary = [
    { label: 'Open alerts', value: counts.open, tone: counts.open ? 'red' : 'muted', pill: 'Open' },
    { label: 'Running late', value: counts.late, tone: counts.late ? 'amber' : 'muted', pill: 'Late' },
    { label: 'No-show', value: counts.no_show, tone: counts.no_show ? 'red' : 'muted', pill: 'No-show' },
    {
      label: 'Stale patrol',
      value: counts.stale_patrol,
      tone: counts.stale_patrol ? 'cyan' : 'muted',
      pill: 'Stale',
    },
  ]

  const onAcknowledge = async (id) => {
    setAckBusy(id)
    try {
      await acknowledgeAlertEvent(id)
      if (statusFilter === 'open') {
        setEvents((prev) => prev.filter((e) => e.id !== id))
      } else {
        setEvents((prev) =>
          prev.map((e) => (e.id === id ? { ...e, acknowledged: true } : e)),
        )
      }
    } catch (err) {
      setError(err.message || 'Failed to acknowledge')
    } finally {
      setAckBusy(null)
    }
  }

  return (
    <Layout variant="admin">
      <PageHeader
        title="Alerts"
        description="Late clock-ins, no-shows, and stale patrols across your sites."
      />

      {(narrativeLoading || narrative) && (
        <div className="dk-card mb-5 p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
            <Sparkles className="h-3.5 w-3.5 text-accent-orange" /> AI digest — open alerts
          </p>
          {narrativeLoading ? (
            <div className="mt-3 space-y-2">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-white/10" />
            </div>
          ) : (
            <p className="mt-2.5 text-sm leading-relaxed text-ink">{narrative}</p>
          )}
          <p className="mt-3 border-t border-white/5 pt-2 text-[10px] text-ink-3">
            Rephrased from the alert rows below — every name and count comes from the data, not the model.
          </p>
        </div>
      )}

      {sites.length > 0 && (
        <div className="mb-5">
          <RosterSitePicker
            sites={sites}
            value={selectedSite}
            onChange={setSelectedSite}
            allowAll
          />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s) => (
          <div
            key={s.label}
            className="rounded-[26px] border border-white/8 bg-surface p-5 shadow-[var(--card-shine)]"
          >
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${PILL_TONE[s.tone]}`}
            >
              {s.pill}
            </span>
            <p className={`mt-4 text-4xl font-bold tabular-nums ${NUM_TONE[s.tone]}`}>{s.value}</p>
            <p className="mt-1 text-xs text-ink-3">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={statusFilter === f.id}
            onClick={() => setStatusFilter(f.id)}
          >
            {f.label}
          </FilterChip>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-white/10 sm:inline-block" aria-hidden />
        {TYPE_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={typeFilter === f.id}
            onClick={() => setTypeFilter(f.id)}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-[26px] border border-white/8 bg-surface">
        {loading ? (
          <p className="p-10 text-center text-sm text-ink-3">Loading alerts…</p>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
              <Bell className="h-5 w-5 text-ink-3" />
            </div>
            <p className="text-sm font-medium text-ink">No alerts here</p>
            <p className="max-w-sm text-sm text-ink-3">
              Late (≥10 min), no-show (≥30 min), and stale-patrol events from the roster cron show up on
              this page.
            </p>
          </div>
        ) : (
          events.map((e) => {
            const tone = ALERT_TYPE_TONE[e.event_type] || 'muted'
            const guardName = e.profiles?.name
            return (
              <div
                key={e.id}
                className={`flex items-start gap-3 border-t border-white/5 px-4 py-4 first:border-t-0 ${
                  e.acknowledged ? 'opacity-60' : ''
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PILL_TONE[tone]}`}
                >
                  {ALERT_TYPE_LABELS[e.event_type] || e.event_type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-ink">{e.message}</p>
                  <p className="mt-1 text-[11px] text-ink-3">
                    {e.sites?.name || 'Site'}
                    {guardName ? ` · ${guardName}` : ''}
                    {' · '}
                    {formatWhen(e.created_at)}
                    {e.acknowledged ? ' · Acknowledged' : ''}
                  </p>
                </div>
                {!e.acknowledged && (
                  <button
                    type="button"
                    onClick={() => onAcknowledge(e.id)}
                    disabled={ackBusy === e.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-ink-2 transition hover:bg-white/10 hover:text-ink disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Ack
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </Layout>
  )
}
