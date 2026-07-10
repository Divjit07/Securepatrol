import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'

export default function Alerts() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState('')
  const [checkpoints, setCheckpoints] = useState([])
  const [configs, setConfigs] = useState({})
  const [recentAlerts, setRecentAlerts] = useState([])

  useEffect(() => {
    if (!user) return
    fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin').then((s) => {
      setSites(s)
      if (s.length) setSelectedSite(s[0].id)
    })
  }, [user?.id])

  useEffect(() => {
    if (!selectedSite) return

    const load = async () => {
      const { data: floors } = await supabase.from('floors').select('id').eq('site_id', selectedSite)
      if (!floors?.length) return

      const { data: cps } = await supabase
        .from('checkpoints')
        .select('id, name, floors(floor_name)')
        .in('floor_id', floors.map((f) => f.id))

      setCheckpoints(cps || [])

      if (cps?.length) {
        const { data: alertConfigs } = await supabase
          .from('alert_configs')
          .select('*')
          .in('checkpoint_id', cps.map((c) => c.id))

        const configMap = {}
        for (const cfg of alertConfigs || []) {
          configMap[cfg.checkpoint_id] = cfg
        }
        setConfigs(configMap)
      }

      const { data: alerts } = await supabase
        .from('alerts')
        .select('*, checkpoints(name)')
        .eq('site_id', selectedSite)
        .order('triggered_at', { ascending: false })
        .limit(20)

      setRecentAlerts(alerts || [])
    }

    load()
  }, [selectedSite])

  const updateConfig = async (checkpointId, minutes, enabled) => {
    const existing = configs[checkpointId]

    if (existing) {
      await supabase
        .from('alert_configs')
        .update({ minutes_until_alert: minutes, enabled })
        .eq('id', existing.id)
    } else {
      await supabase.from('alert_configs').insert({
        checkpoint_id: checkpointId,
        minutes_until_alert: minutes,
        enabled,
      })
    }

    const { data } = await supabase
      .from('alert_configs')
      .select('*')
      .eq('checkpoint_id', checkpointId)
      .single()

    if (data) {
      setConfigs((prev) => ({ ...prev, [checkpointId]: data }))
    }
  }

  const acknowledgeAlert = async (alertId) => {
    await supabase.from('alerts').update({ acknowledged: true }).eq('id', alertId)
    setRecentAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)),
    )
  }

  return (
    <Layout variant="admin">
      <h1 className="mb-6 text-2xl font-bold">Alert Configuration</h1>

      {sites.length > 1 && (
        <select
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
          className="mb-4 rounded-lg border border-white/10 px-3 py-2"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Checkpoint Alert Windows</h2>
        <p className="mb-4 text-sm text-ink-2">
          Set how many minutes after shift start before a checkpoint is considered missed.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-ink-2">
              <tr>
                <th className="px-4 py-3 font-medium">Checkpoint</th>
                <th className="px-4 py-3 font-medium">Floor</th>
                <th className="px-4 py-3 font-medium">Alert After (min)</th>
                <th className="px-4 py-3 font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {checkpoints.map((cp) => {
                const cfg = configs[cp.id] || { minutes_until_alert: 60, enabled: true }
                return (
                  <tr key={cp.id}>
                    <td className="px-4 py-3 font-medium">{cp.name}</td>
                    <td className="px-4 py-3">{cp.floors?.floor_name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={5}
                        max={480}
                        value={cfg.minutes_until_alert}
                        onChange={(e) =>
                          updateConfig(cp.id, parseInt(e.target.value, 10) || 60, cfg.enabled)
                        }
                        className="w-20 rounded border border-white/10 px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig(cp.id, cfg.minutes_until_alert, !cfg.enabled)
                        }
                        className={cfg.enabled ? 'text-accent-green' : 'text-ink-3'}
                      >
                        {cfg.enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {checkpoints.length === 0 && (
            <p className="p-8 text-center text-ink-2">No checkpoints for this site.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Alerts</h2>
        <div className="space-y-2">
          {recentAlerts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-ink-2">
              No alerts triggered yet.
            </p>
          ) : (
            recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between rounded-xl border p-4 ${
                  alert.acknowledged ? 'border-white/10 bg-white/5' : 'border-red-200 bg-accent-red/15'
                }`}
              >
                <div>
                  <p className="font-medium">{alert.checkpoints?.name || 'Checkpoint'}</p>
                  <p className="text-sm text-ink-2">{alert.message}</p>
                  <p className="text-xs text-ink-3">
                    {new Date(alert.triggered_at).toLocaleString()}
                  </p>
                </div>
                {!alert.acknowledged && (
                  <button
                    type="button"
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="rounded-lg bg-surface px-3 py-1.5 text-sm font-medium ring-1 ring-slate-200 hover:bg-white/5"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}
