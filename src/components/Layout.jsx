import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import Logo from './Logo.jsx'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import SyncIndicator from './SyncIndicator.jsx'

export default function Layout({ children, variant = 'admin' }) {
  const { profile, signOut, canApproveScans } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const adminLinks = [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/checkpoints', label: 'Checkpoints' },
    { to: '/admin/guards', label: 'Guards' },
    { to: '/admin/clients', label: 'Clients' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/alerts', label: 'Alerts' },
    ...(canApproveScans
      ? [
          { to: '/admin/approve-scan', label: 'Approve Scan' },
          { to: '/admin/shift-clock', label: 'Shift Clock' },
        ]
      : []),
  ]

  const guardLinks = [
    { to: '/guard', label: 'Dashboard', end: true },
    { to: '/guard/scan', label: 'Scan' },
    { to: '/guard/history', label: 'History' },
  ]

  const clientLinks = [
    { to: '/client', label: 'Scan History', end: true },
    { to: '/client/checkpoints', label: 'Shift Clock' },
    { to: '/client/reports', label: 'Reports' },
  ]

  const links = variant === 'admin' ? adminLinks : variant === 'client' ? clientLinks : guardLinks

  const navClass = ({ isActive }) =>
    `sp-nav-link ${isActive ? 'sp-nav-link-active' : ''}`

  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-navy-800 bg-navy-900 shadow-lg shadow-navy-950/30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to={variant === 'admin' ? '/admin' : variant === 'client' ? '/client' : '/guard'} className="shrink-0">
            <Logo size="lg" showText variant="light" framed />
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <SyncIndicator dark />
            <div className="hidden h-8 w-px bg-white/10 sm:block" />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{profile?.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {variant === 'admin' ? 'Administrator' : variant === 'client' ? 'Client' : 'Field Guard'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden rounded-lg p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white md:inline-flex"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2.5 text-slate-300 md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-white/5 px-4 py-3 md:hidden">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-slate-400'}`
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
