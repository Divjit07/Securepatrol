import { CheckCircle2, Clock, ShieldCheck, RotateCw, Radio } from 'lucide-react'
import { formatShiftTime, getPatrolCheckpoints } from '../lib/clientStats.js'

// Rotating brand palette so guards aren't all one colour (sky / lavender /
// blossom / moss / meadow). Pastel bg + dark ink stays readable in both themes.
const TONES = [
  { bg: '#D9F0FF', ink: '#12293b', sub: 'rgba(23,51,71,0.72)', av: '#12293b', avInk: '#D9F0FF' },
  { bg: '#ECEEFE', ink: '#20244d', sub: 'rgba(44,48,87,0.72)', av: '#20244d', avInk: '#ECEEFE' },
  { bg: '#FBE4E3', ink: '#42201c', sub: 'rgba(74,39,35,0.72)', av: '#42201c', avInk: '#FBE4E3' },
  { bg: '#7FD09F', ink: '#0e2c1b', sub: 'rgba(18,53,36,0.75)', av: '#0e2c1b', avInk: '#DFF4E8' },
  { bg: '#ECFAB5', ink: '#34400f', sub: 'rgba(52,64,15,0.72)', av: '#34400f', avInk: '#ECFAB5' },
]
const initials = (name) =>
  (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
import Layout from '../components/Layout.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import LiveFeed from '../components/LiveFeed.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift } from '../hooks/useClientShift.js'
import { useSiteHours } from '../hooks/useSiteHours.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'

export default function ClientDashboard() {
  const { profile } = useAuth()
  const siteId = profile?.site_id
  const operatingHours = useSiteHours(siteId)
  const { date, setDate, shift, scheduled } = useClientShift(operatingHours)
  const { site, guards, scans, checkpoints, loading, rounds, patrolScanCount, patrolCheckpointCount, scannedCount, guardShifts } =
    useClientSiteData(siteId, date, shift)

  // On-site activity timeline (Live Summary): clock-ins + completed patrol tours,
  // derived from existing data — newest first.
  const activity = (() => {
    const evs = []
    for (const gs of guardShifts || []) {
      evs.push({
        id: `in-${gs.guardId}`,
        type: 'clock_in',
        guard: gs.guardName,
        onShift: gs.onShift,
        time: new Date(gs.isAdjusted ? gs.clockInAt : gs.signedInAt || gs.clockInAt),
      })
    }
    const patrolIds = new Set(getPatrolCheckpoints(checkpoints).map((c) => c.id))
    const perRound = getPatrolCheckpoints(checkpoints).length
    if (perRound > 0) {
      const asc = scans
        .filter((s) => patrolIds.has(s.checkpoint_id))
        .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))
      let round = 0
      asc.forEach((s, idx) => {
        if ((idx + 1) % perRound === 0) {
          round += 1
          evs.push({ id: `tour-${s.id}`, type: 'tour', guard: s.profiles?.name, round, time: new Date(s.scanned_at) })
        }
      })
    }
    return evs.filter((e) => !Number.isNaN(e.time?.getTime?.())).sort((a, b) => b.time - a.time).slice(0, 8)
  })()

  // On-duty guard (or first clocked-in) → surfaced on the Coverage card + header.
  const onDutyRow = guardShifts?.find((g) => g.onShift) || guardShifts?.[0]
  const onDutyGuard = onDutyRow
    ? {
        name: onDutyRow.guardName,
        time: formatShiftTime(onDutyRow.isAdjusted ? onDutyRow.clockInAt : onDutyRow.signedInAt || onDutyRow.clockInAt),
      }
    : null

  if (!siteId) {
    return (
      <Layout variant="client">
        <div className="rounded-xl border border-accent-orange/30 bg-accent-orange/10 p-8 text-center">
          <h1 className="text-lg font-semibold text-accent-orange">No site assigned</h1>
          <p className="mt-2 text-sm text-accent-orange">
            Contact your administrator to link your account to a patrol site.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="client">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#ECFAB5] to-[#96EE60] text-[#12290d] shadow-[0_10px_24px_-8px_rgba(150,238,96,0.7)]">
            <ShieldCheck className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="deck-eyebrow text-accent-green">Client Portal · Patrol Overview</p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight sm:text-[2rem]">{site?.name || 'Patrol Overview'}</h1>
            <p className="mt-1 text-sm text-ink-2">{site?.address || 'Live scan activity for your site'}</p>
          </div>
        </div>
        {onDutyGuard && (
          <span className="hidden shrink-0 items-center gap-2 rounded-full bg-accent-green/15 px-3.5 py-2 text-sm font-bold text-accent-green sm:flex">
            <span className="live-dot" /> {onDutyGuard.name} on duty
          </span>
        )}
      </div>

      <ClientShiftBar
        date={date}
        setDate={setDate}
        scheduled={scheduled}
        onDutyGuard={onDutyGuard}
        stats={{
          rounds,
          patrolScanCount,
          patrolCheckpointCount,
          scannedCount,
          totalCheckpoints: patrolCheckpointCount,
        }}
      />

      {/* When each guard clocked in on the selected date */}
      <div className="dk-card mb-6 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock className="h-4 w-4 text-accent-orange" /> Guard clock-ins
        </h2>
        {guardShifts?.length ? (
          <div className="mt-3 space-y-2">
            {guardShifts.map((gs, i) => {
              const tone = TONES[i % TONES.length]
              return (
                <div key={gs.guardId} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:brightness-[0.98]" style={{ background: tone.bg }}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold" style={{ background: tone.av, color: tone.avInk }}>
                    {initials(gs.guardName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold" style={{ color: tone.ink }}>{gs.guardName}</span>
                    {/* Admin shift-clock edits win over the raw punch; clients see the official time only. */}
                    <span className="block text-xs font-medium" style={{ color: tone.sub }}>
                      Clocked in {formatShiftTime(new Date(gs.isAdjusted ? gs.clockInAt : gs.signedInAt || gs.clockInAt))}
                      {gs.onShift ? '' : gs.clockOutAt ? ` · until ${formatShiftTime(new Date(gs.clockOutAt))}` : ''}
                    </span>
                  </span>
                  {gs.onShift && (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: 'rgba(0,0,0,0.09)', color: tone.ink }}>
                      <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ background: tone.ink }} /> On shift
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-3">No guard has clocked in for this date yet.</p>
        )}
      </div>

      {guards.length > 0 && (
        <div className="dk-card mb-6 flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-2"><span className="live-dot" /> On duty:</span>
          {guards.map((g, i) => {
            const tone = TONES[i % TONES.length]
            return (
              <span key={g.id} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-sm font-bold" style={{ background: tone.bg, color: tone.ink }}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: tone.av, color: tone.avInk }}>
                  {initials(g.name)}
                </span>
                {g.name}
              </span>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="slant-grid relative overflow-hidden rounded-[24px] border border-white/10 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-white">
                    <ShieldCheck className="h-4 w-4 text-[#96ee60]" /> On-site activity
                  </h2>
                  <p className="mt-0.5 text-xs text-white/45">Clock-ins & completed patrol tours · {date}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-[#96ee60]/15 px-2.5 py-1 text-[11px] font-semibold text-[#96ee60]">
                  <span className="live-dot" /> Live
                </span>
              </div>

              {activity.length === 0 ? (
                <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-14 text-center">
                  <p className="px-6 text-sm text-white/45">No on-site activity yet today. Clock-ins and completed tours appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activity.map((ev) => {
                    const isTour = ev.type === 'tour'
                    const first = (ev.guard || 'Guard').split(/\s+/)[0]
                    return (
                      <div key={ev.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.05] px-3 py-3 backdrop-blur-sm transition hover:bg-white/[0.08]">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isTour ? 'bg-[#d9f0ff]/15 text-[#a9dcff]' : 'bg-[#96ee60]/15 text-[#96ee60]'}`}>
                          {isTour ? <RotateCw className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {isTour ? `Patrol round ${ev.round} completed` : `${first} (${initials(ev.guard)}) on site`}
                          </p>
                          <p className="truncate text-xs text-white/45">
                            {isTour ? `by ${ev.guard || 'Guard'}` : ev.onShift ? 'Clocked in · on shift now' : 'Clocked in'}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-white/45">
                          {ev.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <LiveFeed siteId={siteId} limit={20} passesOnly />
          </div>
        </div>
      )}
    </Layout>
  )
}
