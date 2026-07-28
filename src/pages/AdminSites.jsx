import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ArrowUpRight, MapPin, Plus, Search, ShieldCheck, X } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useReveal } from '../lib/motion.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { fetchSitesForAdmin } from '../lib/scans.js'
import { fetchGuardsWithSites } from '../lib/guards.js'
import { supabase } from '../lib/supabase.js'

/** Site directory — search across all sites, GPS/geofence status at a glance.
 *  Click a site → Live Map geofence panel for that site (type address, no visit).
 *  Chevron → site dashboard. */
export default function AdminSites() {
  const { user, isSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showNewSite, setShowNewSite] = useState(false)
  const [newSite, setNewSite] = useState({ name: '', address: '' })
  const [creating, setCreating] = useState(false)

  const loadSites = async () => {
    if (!user) return
    const [siteList, guardList] = await Promise.all([
      fetchSitesForAdmin(user.id, isSuperAdmin ? 'super_admin' : 'admin'),
      fetchGuardsWithSites().catch(() => []),
    ])
    setSites(siteList)
    setGuards(guardList)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    loadSites()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, isSuperAdmin])

  const createSite = async (e) => {
    e.preventDefault()
    if (!user) return
    const name = newSite.name.trim()
    const address = newSite.address.trim()
    if (!name) return
    setCreating(true)
    try {
      const dup = sites.some(
        (s) =>
          s.name.trim().toLowerCase() === name.toLowerCase() &&
          (s.address || '').trim().toLowerCase() === address.toLowerCase(),
      )
      if (dup) {
        alert('A site with this name and address already exists.')
        return
      }
      const { error } = await supabase.from('sites').insert({
        name,
        address,
        admin_id: user.id,
      })
      if (error) {
        const msg =
          error.code === '23505' || /unique|duplicate/i.test(error.message)
            ? 'A site with this name and address already exists.'
            : error.message
        alert(`Could not create site: ${msg}`)
        return
      }
      setNewSite({ name: '', address: '' })
      setShowNewSite(false)
      await loadSites()
    } finally {
      setCreating(false)
    }
  }

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
  const missingGpsSites = sites.filter((s) => s.latitude == null || s.longitude == null)
  const missingGps = missingGpsSites.length

  const gridRef = useReveal({ deps: [loading, matches.length] })

  return (
    <Layout variant="admin">
      <PageHeader
        title="Sites"
        description={`${sites.length} site${sites.length === 1 ? '' : 's'} under management. Click a site to set its address geofence on Live Map.`}
        action={
          <>
            <button type="button" onClick={() => setShowNewSite(true)} className="dk-cta">
              <Plus className="h-4 w-4" /> New Site
            </button>
            <Link to="/admin/map" className="dk-btn-2">
              <MapPin className="h-4 w-4" /> Live Map
            </Link>
          </>
        }
      />

      {showNewSite && (
        <form onSubmit={createSite} className="dk-card mb-6 p-6">
          <h3 className="font-display text-lg font-semibold text-ink">Create Site</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="sp-label">Site name</label>
              <input
                placeholder="e.g. 800 Bathurst St"
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                required
                className="sp-input"
              />
            </div>
            <div>
              <label className="sp-label">Address</label>
              <input
                placeholder="Full street address"
                value={newSite.address}
                onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                className="sp-input"
              />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={creating} className="dk-cta">
              {creating ? 'Creating…' : 'Create site'}
            </button>
            <button
              type="button"
              onClick={() => setShowNewSite(false)}
              className="dk-btn-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

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
          {missingGps} site{missingGps === 1 ? '' : 's'} without GPS —{' '}
          <Link
            to={`/admin/map?geofence=${missingGpsSites[0].id}`}
            className="font-semibold underline underline-offset-2"
          >
            open Live Map and type the address
          </Link>{' '}
          to geofence (no site visit needed).
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-surface p-10 text-center text-sm text-ink-2">
          {sites.length === 0 ? (
            <>
              No sites yet —{' '}
              <button
                type="button"
                onClick={() => setShowNewSite(true)}
                className="font-semibold text-accent-cyan-line underline underline-offset-2"
              >
                add your first site
              </button>
              .
            </>
          ) : (
            <>No sites match “{query}”.</>
          )}
        </div>
      ) : (
        <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {matches.map((site) => {
            const geofenced = site.latitude != null && site.longitude != null
            const guardCount = guardCountBySite[site.id] || 0
            return (
              <div key={site.id} data-reveal className="group relative bento bento-interactive">
                {/* Full-card primary action → geofence on Live Map. */}
                <Link
                  to={`/admin/map?geofence=${site.id}`}
                  className="absolute inset-0 rounded-[28px]"
                  title="Set or update geofence on Live Map"
                  aria-label={`Set geofence for ${site.name}`}
                />
                <div className="pointer-events-none flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
                      <Building2 className="h-5 w-5 text-ink-2" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-ink">{site.name}</p>
                      <p className="truncate text-xs text-ink-3">{site.address || 'No address — tap to geofence'}</p>
                    </div>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      geofenced ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
                    }`}
                  >
                    <MapPin className="h-3 w-3" />
                    {geofenced ? <span className="tabular-nums">{site.geofence_radius_m ?? 120}m</span> : 'Set GPS'}
                  </span>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="pointer-events-none flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-xs font-medium text-ink-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-ink-3" />
                    <span className="tabular-nums">{guardCount}</span> guard{guardCount === 1 ? '' : 's'}
                  </span>
                  <Link
                    to={`/admin/site/${site.id}`}
                    className="relative z-10 flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-ink-2 transition hover:bg-white/10 hover:text-ink"
                    title="Open site dashboard"
                    aria-label={`Open ${site.name} dashboard`}
                  >
                    Dashboard <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
