import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { getPendingScanCount, flushOfflineQueue } from '../lib/offlineQueue.js'

export default function SyncIndicator({ dark = false }) {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refresh = () => setPending(getPendingScanCount())

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    window.addEventListener('online', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', refresh)
    }
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    await flushOfflineQueue()
    refresh()
    setSyncing(false)
  }

  if (pending === 0 && navigator.onLine) return null

  const baseClass = dark
    ? 'bg-amber-500/15 text-amber-300 ring-amber-500/20'
    : 'bg-amber-100 text-amber-800'

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing || !navigator.onLine}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${baseClass}`}
      title="Pending offline scans"
    >
      {!navigator.onLine ? (
        <CloudOff className="h-3.5 w-3.5" />
      ) : (
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
      )}
      {pending > 0 ? `${pending} pending` : 'Offline'}
    </button>
  )
}
