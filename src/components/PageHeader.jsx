import { useLocation } from 'react-router-dom'

/**
 * Where you are, in the sidebar's own words. The kicker names the nav GROUP the
 * route belongs to rather than repeating the title underneath it — "Admin ·
 * Payroll" over "Payroll" would just be an echo.
 *
 * Derived only for /admin/* on purpose: the client pages already render their
 * own bespoke eyebrows ("Client Portal · Coverage"), and auto-adding one here
 * would print it twice. Anything else can pass `eyebrow` explicitly.
 */
const ADMIN_SECTIONS = [
  { section: 'Site', paths: ['/admin/sites', '/admin/map', '/admin/checkpoints', '/admin/guards', '/admin/clients'] },
  { section: 'Payroll', paths: ['/admin/payroll'] },
  { section: 'Insights', paths: ['/admin/summary', '/admin/reports', '/admin/alerts'] },
  { section: 'Operations', paths: ['/admin/live-clock', '/admin/shift-clock', '/admin/incidents', '/admin/approve-scan'] },
]

export function kickerFor(pathname) {
  if (!pathname.startsWith('/admin')) return null
  const hit = ADMIN_SECTIONS.find((g) => g.paths.some((p) => pathname.startsWith(p)))
  return hit ? `Admin · ${hit.section}` : 'Admin console'
}

export default function PageHeader({ title, description, action, eyebrow }) {
  const { pathname } = useLocation()
  const kicker = eyebrow ?? kickerFor(pathname)

  return (
    <div className="mb-7 border-b border-[color:var(--hairline)] pb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {kicker && <p className="deck-eyebrow mb-1.5 text-accent-orange">{kicker}</p>}
          <h1 className="font-display text-[1.9rem] font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[2.4rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink-2">{description}</p>
          )}
        </div>
        {action && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pb-1">{action}</div>
        )}
      </div>
    </div>
  )
}
