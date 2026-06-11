import { MapPin, Clock, CheckCircle2, AlertTriangle, XCircle, CircleDashed } from 'lucide-react'
import { statusColor } from '../lib/scans.js'

const colorClasses = {
  green: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-900 ring-emerald-100',
  yellow: 'border-amber-200/80 bg-amber-50/80 text-amber-900 ring-amber-100',
  red: 'border-red-200/80 bg-red-50/80 text-red-900 ring-red-100',
  gray: 'border-slate-200 bg-white text-slate-600 ring-slate-100',
}

const iconBg = {
  green: 'bg-emerald-100 text-emerald-600',
  yellow: 'bg-amber-100 text-amber-600',
  red: 'bg-red-100 text-red-600',
  gray: 'bg-slate-100 text-slate-400',
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
      className={`w-full rounded-2xl border p-5 text-left shadow-sm ring-1 transition ${colorClasses[color]} ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{checkpoint.name}</h3>
          {checkpoint.floor && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide opacity-60">
              {checkpoint.floor.floor_name}
            </p>
          )}
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg[color]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>

      {lastScan ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-current/10 pt-3 text-xs opacity-75">
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
        <p className="mt-3 text-xs font-medium opacity-60">Awaiting scan today</p>
      ) : null}
    </Wrapper>
  )
}
