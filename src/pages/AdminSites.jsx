import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight, MapPin, Search, ShieldCheck, X } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'

/** Site directory — search across all sites, GPS/geofence status at a glance,
 *  click through to the site dashboard. Built for fleets with many sites
 *  (the sidebar deliberately holds just this one link). */
export default function AdminSites() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin'),
      fetchGuardsWithSites().catch(() => []),
    ])
      .then(([siteList, guardList]) => {
        if (cancelled) return
        setSites(siteList)
        setGuards(guardList)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, isSuperAdmin])

  const guardCountBySite = useMemo(() => {
    const counts = {}
    for (const g of guards) {
      if (g.site_id && g.active !== false) counts[g.site_id] = (counts[g.site_id] || 0) + 1
    }
    return counts
  }, [guards])

  const q = query.trim().toLowerCase()
  const matches = q
    ? sites.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q),
      )
    : sites
  const missingGps = sites.filter((s) => s.latitude == null || s.longitude == null).length

  return (
    <Layout variant="admin">
      <PageHeader
        title="Sites"
        description={`${sites.length} site${sites.length === 1 ? '' : 's'} under management. Every site is geofenced for clock-in/out — red badges need GPS set.`}
      />

      <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-surface px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by site name or address…"
          aria-label="Search sites"
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="rounded-lg p-1 text-ink-3 hover:bg-white/10 hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <span className="shrink-0 text-xs text-ink-3">
          {matches.length}/{sites.length}
        </span>
      </div>

      {missingGps > 0 && !q && (
        <div className="mb-4 rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          {missingGps} site{missingGps === 1 ? '' : 's'} without GPS — guards can’t Face ID clock in
          there until the location is set (site card → clock icon on Overview).
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-surface p-10 text-center text-sm text-ink-2">
          {sites.length === 0 ? (
            <>No sites yet — create one from <Link to="/admin" className="font-semibold text-accent-cyan-line underline underline-offset-2">Overview</Link>.</>
          ) : (
            <>No sites match “{query}”.</>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-surface">
          <div className="divide-y divide-white/5">
            {matches.map((site) => {
              const geofenced = site.latitude != null && site.longitude != null
              const guardCount = guardCountBySite[site.id] || 0
              return (
                <Link
                  key={site.id}
                  to={`/admin/site/${site.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5">
                    <Building2 className="h-5 w-5 text-ink-2" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{site.name}</p>
                    <p className="truncate text-xs text-ink-2">{site.address || 'No address'}</p>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-2 sm:flex">
                    <ShieldCheck className="h-3.5 w-3.5 text-ink-3" />
                    {guardCount} guard{guardCount === 1 ? '' : 's'}
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      geofenced
                        ? 'bg-accent-green/15 text-accent-green'
                        : 'bg-accent-red/15 text-accent-red'
                    }`}
                    title={
                      geofenced
                        ? `Geofenced — ${site.geofence_radius_m ?? 120}m clock-in zone`
                        : 'No GPS set — clock-in geofence missing'
                    }
                  >
                    <MapPin className="h-3 w-3" />
                    {geofenced ? `${site.geofence_radius_m ?? 120}m` : 'No GPS'}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </Layout>
  )
}
