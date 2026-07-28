import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  LogOut,
  Menu,
  X,
  Activity,
  LayoutDashboard,
  CalendarDays,
  MapPin,
  ShieldCheck,
  Building2,
  FileBarChart,
  Bell,
  Clock,
  AlertTriangle,
  CheckSquare,
  History,
  PanelLeft,
  Radar,
  Lock,
  Wallet,
  ScrollText,
} from 'lucide-react'
import { Sparkles } from 'lucide-react'
import Logo from './Logo.jsx'
import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { useGuardClockStatus } from '../hooks/useGuardClockStatus.js'
import SyncIndicator from './SyncIndicator.jsx'
import ThemeSwitcher from './ThemeSwitcher.jsx'
import { BRAND } from '../lib/brand.js'

// Exported for the DEV-only /dev/sidebar visual harness.
export function buildAdminNavGroups({ canApproveScans, canManageShiftClock, isSuperAdmin }) {
  const operations = [
    ...(canManageShiftClock ? [{ to: '/admin/live-clock', label: 'Live Clock', icon: Radar }] : []),
    ...(canManageShiftClock ? [{ to: '/admin/shift-clock', label: 'Shift Clock', icon: Clock }] : []),
    ...((canApproveScans || canManageShiftClock || isSuperAdmin)
      ? [{ to: '/admin/incidents', label: 'Incidents', icon: AlertTriangle }]
      : []),
    ...(canApproveScans ? [{ to: '/admin/approve-scan', label: 'Approve', icon: CheckSquare }] : []),
  ]

  return [
    {
      label: null,
      items: [
        { to: '/admin', label: 'Overview', end: true, icon: LayoutDashboard },
        { to: '/admin/ops', label: 'Ops Board', icon: Activity },
        { to: '/admin/roster', label: 'Roster', icon: CalendarDays },
        { to: '/admin/assistant', label: 'Assistant', icon: Sparkles },
      ],
    },
    {
      label: 'Site',
      items: [
        { to: '/admin/sites', label: 'Sites', icon: Building2 },
        { to: '/admin/map', label: 'Live Map', icon: Radar },
        { to: '/admin/checkpoints', label: 'Checkpoints', icon: MapPin },
        { to: '/admin/guards', label: 'Guards', icon: ShieldCheck },
        { to: '/admin/clients', label: 'Clients', icon: Building2 },
      ],
    },
    {
      label: 'Payroll',
      items: [{ to: '/admin/payroll', label: 'Payroll', icon: Wallet }],
    },
    {
      label: 'Insights',
      items: [
        { to: '/admin/summary', label: 'Summary', icon: ScrollText },
        { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
        { to: '/admin/alerts', label: 'Alerts', icon: Bell },
      ],
    },
    ...(operations.length ? [{ label: 'Operations', items: operations }] : []),
  ]
}

const clientNavGroups = [
  {
    label: null,
    items: [{ to: '/client', label: 'Scan History', end: true, icon: History }],
  },
  {
    label: 'Site',
    items: [
      { to: '/client/coverage', label: 'Coverage', icon: CalendarDays },
      { to: '/client/checkpoints', label: 'Shift Clock', icon: Clock },
    ],
  },
  {
    label: 'Operations',
    items: [{ to: '/client/incidents', label: 'Incidents', icon: AlertTriangle }],
  },
  {
    label: 'Insights',
    items: [{ to: '/client/reports', label: 'Reports', icon: FileBarChart }],
  },
]

// Report + History unlock only while clocked in (Scan stays open — it's the
// NFC clock-in fallback).
const guardLinks = [
  { to: '/guard', label: 'Dashboard', end: true },
  { to: '/guard/scan', label: 'Scan' },
  { to: '/guard/schedule', label: 'Schedule' },
  { to: '/guard/incident', label: 'Report', needsClock: true },
  { to: '/guard/history', label: 'History', needsClock: true },
]

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const sidebarItemClass = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-1 text-sm leading-5 transition ${
    isActive
      ? 'sidebar-nav-active'
      : 'text-ink-2 hover:bg-white/5 hover:text-ink'
  }`

export function SidebarNav({ groups, onNavigate }) {
  return (
    <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
      {groups.map((group) => (
        <div key={group.label || 'home'}>
          {group.label && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((link) => {
              const Icon = link.icon
              return (
                <NavLink key={link.to} to={link.to} end={link.end} className={sidebarItemClass} onClick={onNavigate}>
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {link.label}
                </NavLink>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

const COLLAPSE_KEY = 'sp-sidebar-collapsed'

/** Enterprise sidebar shell (admin + client portals): 260px white sidebar on
 *  gray-50, collapsible on desktop, slide-over on mobile. */
function SidebarLayout({ children, groups, roleLabel, homeTo }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1')
      } catch {
        /* Safari private mode */
      }
      return !prev
    })
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const sidebarInner = (
    <>
      <div className="flex items-center gap-3 px-5 py-2.5">
        <Logo size="sm" showText={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold tracking-tight text-ink">{BRAND.name}</p>
          <p className="truncate text-[10px] font-semibold uppercase tracking-tight text-accent-orange">
            Workforce platform
          </p>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden rounded-lg p-1.5 text-ink-3 transition hover:bg-white/10 hover:text-ink lg:block"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>

      <SidebarNav groups={groups} onNavigate={() => setMenuOpen(false)} />

      <div className="border-t border-white/5 p-2">
        <ThemeSwitcher />
        <div className="px-2">
          <SyncIndicator />
        </div>
        <div className="flex items-center gap-3 rounded-lg px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-orange/15 text-xs font-bold text-accent-orange">
            {initialsOf(profile?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{profile?.name || '—'}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg p-2 text-ink-3 transition hover:bg-white/10 hover:text-ink"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col transition-transform duration-200 lg:flex ${
          collapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        {sidebarInner}
      </aside>

      {/* Reopen button when collapsed (desktop) */}
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="fixed left-4 top-4 z-40 hidden rounded-lg border border-white/10 bg-surface p-2 text-ink-2 transition hover:bg-white/10 hover:text-ink lg:block"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {/* Mobile top bar */}
      <header className="app-header sticky top-0 z-40 flex items-center gap-3 px-4 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg p-2 text-ink-2"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to={homeTo} className="flex items-center gap-2">
          <Logo size="sm" showText={false} />
          <span className="text-base font-bold tracking-tight text-ink">{BRAND.name}</span>
        </Link>
        <div className="ml-auto">
          <SyncIndicator />
        </div>
      </header>

      {/* Mobile slide-over */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute inset-y-0 left-0 flex w-[260px] flex-col app-sidebar shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-2 top-3 rounded-lg p-2 text-ink-3"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarInner}
          </div>
        </div>
      )}

      <main className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-14' : 'lg:pl-[260px]'}`}>
        <div className="app-main px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
      </main>
    </div>
  )
}

function AdminLayout({ children }) {
  const { canApproveScans, canManageShiftClock, isSuperAdmin } = useAuth()
  const groups = useMemo(
    () => buildAdminNavGroups({ canApproveScans, canManageShiftClock, isSuperAdmin }),
    [canApproveScans, canManageShiftClock, isSuperAdmin],
  )
  return (
    <SidebarLayout groups={groups} roleLabel="Administrator" homeTo="/admin">
      {children}
    </SidebarLayout>
  )
}

function ClientLayout({ children }) {
  return (
    <SidebarLayout groups={clientNavGroups} roleLabel="Client" homeTo="/client">
      {children}
    </SidebarLayout>
  )
}

/** Guard portal keeps the dark mobile-first top bar. */
function GuardLayout({ children }) {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { clockedIn } = useGuardClockStatus(user?.id)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navClass = ({ isActive }) => `sp-nav-link ${isActive ? 'sp-nav-link-active' : ''}`

  return (
    <div className="app-shell">
      <header className="app-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
          <Link to="/guard" className="shrink-0">
            <Logo size="lg" showText variant="light" framed />
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex">
            {guardLinks.map((link) =>
              link.needsClock && !clockedIn ? (
                <span
                  key={link.to}
                  title="Clock in first"
                  className="sp-nav-link flex cursor-not-allowed items-center gap-1 opacity-40"
                >
                  <Lock className="h-3 w-3" /> {link.label}
                </span>
              ) : (
                <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
                  {link.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden w-36 lg:block">
              <ThemeSwitcher menuPlacement="down" />
            </div>
            <SyncIndicator dark />
            <div className="hidden h-8 w-px bg-white/10 sm:block" />
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium text-ink">{profile?.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-3">Field Guard</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden rounded-lg p-2.5 text-ink-3 transition hover:bg-white/5 hover:text-ink md:inline-flex"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2.5 text-ink-2 md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-white/5 px-4 py-3 md:hidden">
            <div className="mb-3 px-1">
              <ThemeSwitcher menuPlacement="down" />
            </div>
            {guardLinks.map((link) =>
              link.needsClock && !clockedIn ? (
                <span
                  key={link.to}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-3 opacity-60"
                >
                  <Lock className="h-3.5 w-3.5" /> {link.label} — clock in first
                </span>
              ) : (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'bg-white/10 text-ink' : 'text-ink-2 hover:bg-white/5'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ),
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-accent-red hover:bg-accent-red/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="app-main mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}

export default function Layout({ children, variant = 'admin' }) {
  if (variant === 'admin') return <AdminLayout>{children}</AdminLayout>
  if (variant === 'client') return <ClientLayout>{children}</ClientLayout>
  return <GuardLayout>{children}</GuardLayout>
}
