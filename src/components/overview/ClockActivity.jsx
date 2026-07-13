// Recent clock-in / clock-out events. Green pill = clocked in, grey = out.
// Shown on the admin Overview (all sites) and each site dashboard (one site).
import { LogIn, LogOut } from 'lucide-react'

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ClockActivity({ events, title = 'Clock in / out', showSite = true, emptyLabel = 'No clock-ins or clock-outs in the last 24 hours.' }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {events.length > 0 && <span className="text-xs font-medium text-ink-3">last 24h</span>}
      </div>
      <div className="overflow-hidden rounded-[26px] border border-white/8 bg-surface">
        {events.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-3">{emptyLabel}</p>
        ) : (
          <div className="max-h-[22rem] overflow-y-auto">
            {events.map((e) => {
              const isIn = e.type === 'in'
              return (
                <div key={e.id} className="flex items-center gap-3 border-t border-white/5 px-4 py-2.5 first:border-t-0">
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      isIn ? 'bg-accent-green/15 text-accent-green' : 'bg-white/10 text-ink-2'
                    }`}
                  >
                    {isIn ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                    {isIn ? 'In' : 'Out'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {e.guardName} {isIn ? 'clocked in' : 'clocked out'}
                    </p>
                    {showSite && e.siteName ? <p className="truncate text-xs text-ink-3">{e.siteName}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs text-ink-3">{timeAgo(e.at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
