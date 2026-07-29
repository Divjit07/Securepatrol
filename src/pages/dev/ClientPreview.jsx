// Dev-only harness (/dev/client) — renders the client dashboard surfaces with
// mock data so the Apple-Bento client view can be previewed/screenshotted
// without auth.
import { useState } from 'react'
import { Clock, CheckCircle2, ChevronRight, ShieldCheck, RotateCw } from 'lucide-react'

const ACTIVITY = [
  { id: 1, title: 'Patrol round 3 completed', sub: 'by Divjit Singh', time: '5:26 PM', tour: true },
  { id: 2, title: 'Divjit (DS) on site', sub: 'Clocked in · on shift now', time: '11:04 AM' },
  { id: 3, title: 'Patrol round 2 completed', sub: 'by Sukhi Kaur', time: '2:10 PM', tour: true },
  { id: 4, title: 'Sukhi (SK) on site', sub: 'Clocked in', time: '7:02 AM' },
]
import Layout from '../../components/Layout.jsx'
import ClientShiftBar from '../../components/ClientShiftBar.jsx'
import ClientShiftClock from '../../components/ClientShiftClock.jsx'

const TONES = [
  { bg: '#D9F0FF', ink: '#12293b', sub: 'rgba(23,51,71,0.72)', av: '#12293b', avInk: '#D9F0FF' },
  { bg: '#ECEEFE', ink: '#20244d', sub: 'rgba(44,48,87,0.72)', av: '#20244d', avInk: '#ECEEFE' },
]
const inits = (n) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

const CLOCK_ROWS = [
  { guardId: '1', guardName: 'Divjit Singh', clockInAt: new Date(new Date().setHours(11, 4)), clockOutAt: new Date(new Date().setHours(20, 0)), onShift: true, clockInCheckpoint: 'Clock In', hoursLabel: '8h 56 mins' },
  { guardId: '2', guardName: 'Sukhi Kaur', clockInAt: new Date(new Date().setHours(7, 2)), clockOutAt: new Date(new Date().setHours(15, 0)), onShift: false, clockInCheckpoint: 'Clock In', hoursLabel: '7h 58 mins' },
]

const SCANS = [
  { id: 1, cp: 'Main Entrance', floor: 'Ground Floor', guard: 'Divjit Singh', time: '5:26 PM' },
  { id: 2, cp: 'Parking Level B', floor: 'Basement', guard: 'Divjit Singh', time: '5:12 PM' },
  { id: 3, cp: 'Rooftop Access', floor: '12th Floor', guard: 'Sukhi', time: '4:55 PM' },
  { id: 4, cp: 'Lobby Desk', floor: 'Ground Floor', guard: 'Divjit Singh', time: '4:40 PM' },
  { id: 5, cp: 'East Stairwell', floor: '6th Floor', guard: 'Sukhi', time: '4:18 PM' },
]

const GUARD_SHIFTS = [
  { guardId: '1', guardName: 'Divjit Singh', onShift: true, signedInAt: new Date().setHours(11, 13) },
  { guardId: '2', guardName: 'Sukhi', onShift: false, signedInAt: new Date().setHours(7, 2), clockOutAt: new Date().setHours(15, 0) },
]

export default function ClientPreview() {
  const [date, setDate] = useState('2026-07-28')
  return (
    <Layout variant="client">
      <div className="mb-6">
        <p className="deck-eyebrow text-accent-cyan-line">Client Portal</p>
        <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">800 Bathurst-DJ</h1>
        <p className="mt-1 text-ink-2">800 Bathurst Street, Toronto, Ontario, M5S 1Y6, Canada</p>
      </div>

      <ClientShiftBar
        date={date}
        setDate={setDate}
        scheduled={{ scheduleLabel: 'Tuesday · 11:00 AM – 8:00 PM' }}
        onDutyGuard={{ name: 'Divjit Singh', time: '11:04 AM' }}
        stats={{ rounds: 3, patrolScanCount: 30, patrolCheckpointCount: 9, scannedCount: 9, totalCheckpoints: 9 }}
      />

      <div className="dk-card mb-6 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock className="h-4 w-4 text-accent-orange" /> Guard clock-ins
        </h2>
        <div className="mt-3 space-y-2">
          {GUARD_SHIFTS.map((gs, i) => {
            const tone = TONES[i % TONES.length]
            return (
              <div key={gs.guardId} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: tone.bg }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold" style={{ background: tone.av, color: tone.avInk }}>{inits(gs.guardName)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold" style={{ color: tone.ink }}>{gs.guardName}</span>
                  <span className="block text-xs font-medium" style={{ color: tone.sub }}>
                    Clocked in {new Date(gs.signedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {gs.onShift ? '' : ` · until ${new Date(gs.clockOutAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
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
      </div>

      <div className="dk-card mb-6 flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-2"><span className="live-dot" /> On duty:</span>
        <span className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-sm font-bold" style={{ background: TONES[0].bg, color: TONES[0].ink }}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: TONES[0].av, color: TONES[0].avInk }}>DS</span>
          Divjit Singh
        </span>
      </div>

      <div className="mb-6">
        <ClientShiftClock guardShifts={CLOCK_ROWS} scheduled={{ endLabel: '8:00 PM' }} loading={false} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* On-site activity (Live Summary) */}
        <div className="lg:col-span-2">
          <div className="slant-grid relative overflow-hidden rounded-[24px] border border-white/10 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-white">
                  <ShieldCheck className="h-4 w-4 text-[#96ee60]" /> On-site activity
                </h2>
                <p className="mt-0.5 text-xs text-white/45">Clock-ins & completed patrol tours · 2026-07-28</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-[#96ee60]/15 px-2.5 py-1 text-[11px] font-semibold text-[#96ee60]"><span className="live-dot" /> Live</span>
            </div>
            <div className="space-y-2">
              {ACTIVITY.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.05] px-3 py-3 backdrop-blur-sm transition hover:bg-white/[0.08]">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ev.tour ? 'bg-[#d9f0ff]/15 text-[#a9dcff]' : 'bg-[#96ee60]/15 text-[#96ee60]'}`}>
                    {ev.tour ? <RotateCw className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{ev.title}</p>
                    <p className="truncate text-xs text-white/45">{ev.sub}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-white/45">{ev.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Feed (mock of the LiveFeed component look) */}
        <div>
          <div className="dk-card overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h3 className="font-display text-base font-bold text-ink">Live Feed</h3>
              <span className="flex items-center gap-1.5 rounded-full bg-accent-green/15 px-2.5 py-1 text-[11px] font-semibold text-accent-green"><span className="live-dot" /> Live</span>
            </div>
            <div className="space-y-1 px-2 pb-2">
              {SCANS.slice(0, 4).map((s, i) => (
                <button key={s.id} type="button" className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-200 hover:bg-white/[0.06] ${i === 0 ? 'bg-accent-green/[0.06] ring-1 ring-accent-green/20' : ''}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{s.cp}</p>
                    <p className="truncate text-xs text-ink-3">{s.guard} · {i === 0 ? 'just now' : `${i * 6}m ago`}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent-green/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-accent-green">PASS</span>
                  <ChevronRight className="h-4 w-4 shrink-0 -translate-x-1 text-ink-3 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
