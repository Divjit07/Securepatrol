import { MapPin, Clock, CheckCircle2, AlertTriangle, XCircle, CircleDashed } from 'lucide-react'
import { statusColor } from '../lib/scans.js'

const colorClasses = {
  green: 'checkpoint-card checkpoint-card--green border-accent-green/30 bg-accent-green/15 text-ink ring-accent-green/20',
  yellow: 'checkpoint-card checkpoint-card--yellow border-accent-orange/30 bg-accent-orange/10 text-ink ring-accent-orange/20',
  red: 'checkpoint-card checkpoint-card--red border-accent-red/30 bg-accent-red/15 text-ink ring-accent-red/20',
  gray: 'checkpoint-card checkpoint-card--gray border-white/10 bg-surface text-ink-2 ring-white/5',
}

const iconBg = {
  green: 'bg-accent-green/15 text-accent-green',
  yellow: 'bg-accent-orange/15 text-accent-orange',
  red: 'bg-accent-red/15 text-accent-red',
  gray: 'bg-white/10 text-ink-3',
}

const icons = {
  green: CheckCircle2,
  yellow: AlertTriangle,
  red: XCircle,
  gray: CircleDashed,
}

export default function CheckpointCard({ checkpoint, status, lastScan, onClick }) {
  const color = statusColor(status)
  const Icon = icons[color] || CircleDashed
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full rounded-2xl border p-5 text-left ring-1 transition ${colorClasses[color]} ${onClick ? 'cursor-pointer hover:-translate-y-px hover:border-white/15 active:scale-[0.99]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug text-ink">{checkpoint.name}</h3>
          {checkpoint.floor && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-3">
              {checkpoint.floor.floor_name}
            </p>
          )}
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg[color]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>

      {lastScan ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {new Date(lastScan.scanned_at).toLocaleString()}
          </span>
          {lastScan.profiles?.name && <span>{lastScan.profiles.name}</span>}
          {!lastScan.profiles?.name && lastScan.guards?.name && <span>{lastScan.guards.name}</span>}
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {lastScan.distance_metres?.toFixed(0)}m from tag
          </span>
        </div>
      ) : status === 'pending' ? (
        <p className="mt-3 text-xs font-medium text-ink-3">Awaiting scan today</p>
      ) : null}
    </Wrapper>
  )
}
