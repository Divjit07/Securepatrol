import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import RosterSitePicker from '../components/roster/RosterSitePicker.jsx'
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
      if (s.length) setSelectedSite((prev) => prev || s[0].id)
    })
  }, [user?.id, isSuperAdmin])

  useEffect(() => {
    if (!selectedSite) return

    const load = async () => {
      const { data: floors } = await supabase.from('floors').select('id').eq('site_id', selectedSite)
      if (!floors?.length) {
        setCheckpoints([])
        setRecentAlerts([])
        return
      }

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
      } else {
        setConfigs({})
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
      <PageHeader
        title="Alert Configuration"
        description="Per-checkpoint missed-window settings and recent alerts for each site."
      />

      {sites.length > 0 && (
        <div className="mb-6">
          <RosterSitePicker
            sites={sites}
            value={selectedSite}
            onChange={setSelectedSite}
            allowAll={false}
          />
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">Checkpoint Alert Windows</h2>
        <p className="mb-4 text-sm text-ink-2">
          Set how many minutes after shift start before a checkpoint is considered missed.
        </p>
        <div className="overflow-hidden rounded-xl border border-ink/10 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-left text-ink-2">
              <tr>
                <th className="px-4 py-3 font-medium">Checkpoint</th>
                <th className="px-4 py-3 font-medium">Floor</th>
                <th className="px-4 py-3 font-medium">Alert After (min)</th>
                <th className="px-4 py-3 font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {checkpoints.map((cp) => {
                const cfg = configs[cp.id] || { minutes_until_alert: 60, enabled: true }
                return (
                  <tr key={cp.id}>
                    <td className="px-4 py-3 font-medium text-ink">{cp.name}</td>
                    <td className="px-4 py-3 text-ink-2">{cp.floors?.floor_name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={5}
                        max={480}
                        value={cfg.minutes_until_alert}
                        onChange={(e) =>
                          updateConfig(cp.id, parseInt(e.target.value, 10) || 60, cfg.enabled)
                        }
                        className="w-20 rounded-full border-0 bg-black px-3 py-1.5 text-center text-xs font-semibold text-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig(cp.id, cfg.minutes_until_alert, !cfg.enabled)
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          cfg.enabled
                            ? 'bg-black text-white'
                            : 'bg-[#FFFFFF] text-black ring-1 ring-black/10'
                        }`}
                      >
                        {cfg.enabled ? (
                          <>
                            <Bell className="h-3.5 w-3.5" /> On
                          </>
                        ) : (
                          <>
                            <BellOff className="h-3.5 w-3.5" /> Off
                          </>
                        )}
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
        <h2 className="mb-3 text-lg font-semibold text-ink">Recent Alerts</h2>
        <div className="space-y-2">
          {recentAlerts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/10 p-6 text-center text-ink-2">
              No alerts triggered yet.
            </p>
          ) : (
            recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between rounded-xl border p-4 ${
                  alert.acknowledged
                    ? 'border-ink/10 bg-ink/5'
                    : 'border-accent-red/30 bg-accent-red/10'
                }`}
              >
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{alert.checkpoints?.name || 'Checkpoint'}</p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        alert.acknowledged
                          ? 'bg-[#FFFFFF] text-black ring-1 ring-black/10'
                          : 'bg-black text-white'
                      }`}
                    >
                      {alert.acknowledged ? 'Acknowledged' : 'Open'}
                    </span>
                  </div>
                  <p className="text-sm text-ink-2">{alert.message}</p>
                  <p className="text-xs text-ink-2">
                    {new Date(alert.triggered_at).toLocaleString()}
                  </p>
                </div>
                {!alert.acknowledged && (
                  <button
                    type="button"
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
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
