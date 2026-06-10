import { MapPin, Clock, CheckCircle2, AlertTriangle, XCircle, CircleDashed } from 'lucide-react'
import { statusColor } from '../lib/scans.js'

const colorClasses = {
  green: 'border-green-200 bg-green-50 text-green-800',
  yellow: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  red: 'border-red-200 bg-red-50 text-red-800',
  gray: 'border-slate-200 bg-white text-slate-600',
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
      className={`w-full rounded-xl border p-4 text-left transition-shadow ${colorClasses[color]} ${onClick ? 'hover:shadow-md cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{checkpoint.name}</h3>
          {checkpoint.floor && (
            <p className="mt-0.5 text-sm opacity-75">{checkpoint.floor.floor_name}</p>
          )}
        </div>
        <Icon className="h-6 w-6 shrink-0" />
      </div>

      {lastScan && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs opacity-80">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {new Date(lastScan.scanned_at).toLocaleString()}
          </span>
          {lastScan.guards?.name && <span>{lastScan.guards.name}</span>}
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {lastScan.distance_metres?.toFixed(0)}m
          </span>
        </div>
      )}

      {!lastScan && status === 'pending' && (
        <p className="mt-2 text-xs opacity-70">Not scanned today</p>
      )}
    </Wrapper>
  )
}
