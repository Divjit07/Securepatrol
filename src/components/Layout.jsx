import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import Logo from './Logo.jsx'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import SyncIndicator from './SyncIndicator.jsx'

export default function Layout({ children, variant = 'admin' }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const adminLinks = [
    { to: '/admin', label: 'Overview' },
    { to: '/admin/checkpoints', label: 'Checkpoints' },
    { to: '/admin/guards', label: 'Guards' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/alerts', label: 'Alerts' },
  ]

  const guardLinks = [
    { to: '/guard', label: 'Dashboard' },
    { to: '/guard/scan', label: 'Scan' },
    { to: '/guard/history', label: 'History' },
  ]

  const links = variant === 'admin' ? adminLinks : guardLinks

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to={variant === 'admin' ? '/admin' : '/guard'} className="flex items-center">
            <Logo className="h-10" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <SyncIndicator />
            <span className="hidden text-sm text-slate-500 sm:inline">{profile?.name}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:inline-flex"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-slate-200 px-4 py-3 md:hidden">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
