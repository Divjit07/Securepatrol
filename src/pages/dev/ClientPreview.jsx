// Dev-only harness (/dev/client) — renders the client dashboard surfaces with
// mock data so the Apple-Bento client view can be previewed/screenshotted
// without auth.
import { useState } from 'react'
import { Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import Layout from '../../components/Layout.jsx'
import ClientShiftBar from '../../components/ClientShiftBar.jsx'

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
        stats={{ rounds: 3, patrolScanCount: 30, patrolCheckpointCount: 10, scannedCount: 10, totalCheckpoints: 11 }}
      />

      <div className="dk-card mb-6 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock className="h-4 w-4 text-accent-orange" /> Guard clock-ins
        </h2>
        <div className="mt-3 space-y-2">
          {GUARD_SHIFTS.map((gs) => (
            <div key={gs.guardId} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
              <span className={gs.onShift ? 'live-dot' : 'h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-500'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{gs.guardName}</span>
                <span className="block text-xs text-ink-2">
                  Clocked in {new Date(gs.signedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  {gs.onShift ? ' · on shift now' : ` · until ${new Date(gs.clockOutAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="dk-card mb-6 flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-2"><span className="live-dot" /> On duty:</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-ink">Divjit Singh</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Scan history */}
        <div className="lg:col-span-2">
          <div className="dk-card overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div>
                <h2 className="font-display text-base font-bold text-ink">Scan history</h2>
                <p className="mt-0.5 text-xs text-ink-3">Successful check-ins for 2026-07-28 · 11:00–20:00</p>
              </div>
              <span className="rounded-full bg-accent-green/15 px-2.5 py-1 text-[11px] font-bold tabular-nums text-accent-green">30 passes</span>
            </div>
            <div className="space-y-1 px-2 pb-2">
              {SCANS.map((s) => (
                <div key={s.id} className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 hover:bg-white/[0.05]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green transition group-hover:scale-105">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{s.cp}</p>
                    <p className="truncate text-xs text-ink-3">{s.floor} · {s.guard}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-ink-3">{s.time}</span>
                  <span className="shrink-0 rounded-full bg-accent-green/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-accent-green">PASS</span>
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
