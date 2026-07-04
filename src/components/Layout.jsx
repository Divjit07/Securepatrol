import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import Logo from './Logo.jsx'
import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import SyncIndicator from './SyncIndicator.jsx'

function buildAdminNavGroups({ canApproveScans, canManageShiftClock, isSuperAdmin }) {
  const operations = [
    ...(canManageShiftClock ? [{ to: '/admin/shift-clock', label: 'Shift Clock' }] : []),
    ...((canApproveScans || canManageShiftClock || isSuperAdmin)
      ? [{ to: '/admin/incidents', label: 'Incidents' }]
      : []),
    ...(canApproveScans ? [{ to: '/admin/approve-scan', label: 'Approve' }] : []),
  ]

  return [
    {
      label: null,
      items: [{ to: '/admin', label: 'Overview', end: true }],
    },
    {
      label: 'Site',
      items: [
        { to: '/admin/checkpoints', label: 'Checkpoints' },
        { to: '/admin/guards', label: 'Guards' },
        { to: '/admin/clients', label: 'Clients' },
      ],
    },
    {
      label: 'Insights',
      items: [
        { to: '/admin/reports', label: 'Reports' },
        { to: '/admin/alerts', label: 'Alerts' },
      ],
    },
    ...(operations.length
      ? [{ label: 'Operations', items: operations }]
      : []),
  ]
}

const guardLinks = [
  { to: '/guard', label: 'Dashboard', end: true },
  { to: '/guard/scan', label: 'Scan' },
  { to: '/guard/incident', label: 'Report' },
  { to: '/guard/history', label: 'History' },
]

const clientLinks = [
  { to: '/client', label: 'Scan History', end: true },
  { to: '/client/checkpoints', label: 'Shift Clock' },
  { to: '/client/incidents', label: 'Incidents' },
  { to: '/client/reports', label: 'Reports' },
]

export default function Layout({ children, variant = 'admin' }) {
  const { profile, signOut, canApproveScans, canManageShiftClock, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const adminNavGroups = useMemo(
    () => buildAdminNavGroups({ canApproveScans, canManageShiftClock, isSuperAdmin }),
    [canApproveScans, canManageShiftClock, isSuperAdmin],
  )

  const flatLinks =
    variant === 'admin'
      ? adminNavGroups.flatMap((group) => group.items)
      : variant === 'client'
        ? clientLinks
        : guardLinks

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navClass = ({ isActive }) =>
    `sp-nav-link ${isActive ? 'sp-nav-link-active' : ''}`

  const homeTo = variant === 'admin' ? '/admin' : variant === 'client' ? '/client' : '/guard'
  const roleLabel =
    variant === 'admin' ? 'Administrator' : variant === 'client' ? 'Client' : 'Field Guard'

  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-navy-800 bg-navy-900 shadow-lg shadow-navy-950/30">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
          <Link to={homeTo} className="shrink-0">
            <Logo size="lg" showText variant="light" framed />
          </Link>

          {variant === 'admin' ? (
            <nav className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
              {adminNavGroups.map((group, groupIndex) => (
                <div key={group.label || 'home'} className="flex items-center">
                  {groupIndex > 0 && <div className="sp-nav-divider" aria-hidden />}
                  <div className="flex items-center gap-0.5">
                    {group.items.map((link) => (
                      <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
                        {link.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          ) : (
            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex">
              {flatLinks.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <SyncIndicator dark />
            <div className="hidden h-8 w-px bg-white/10 sm:block" />
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium text-white">{profile?.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden rounded-lg p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white xl:inline-flex"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2.5 text-slate-300 xl:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-white/5 px-4 py-3 xl:hidden">
            {variant === 'admin'
              ? adminNavGroups.map((group) => (
                  <div key={group.label || 'home'} className="mb-3 last:mb-0">
                    {group.label && (
                      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {group.label}
                      </p>
                    )}
                    {group.items.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) =>
                          `block rounded-lg px-3 py-2.5 text-sm font-medium ${
                            isActive ? 'bg-white/10 text-white' : 'text-slate-400'
                          }`
                        }
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </div>
                ))
              : flatLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2.5 text-sm font-medium ${
                        isActive ? 'bg-white/10 text-white' : 'text-slate-400'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
