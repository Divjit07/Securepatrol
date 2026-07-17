// DEV-ONLY (/dev/sidebar): the admin sidebar with ALL permission flags forced
// on, no auth — verifies every nav item (incl. Operations → Approve) fits the
// viewport. Mirrors the real SidebarLayout markup; keep classes in sync.
import { PanelLeft, LogOut } from 'lucide-react'
import Logo from '../../components/Logo.jsx'
import ThemeSwitcher from '../../components/ThemeSwitcher.jsx'
import { buildAdminNavGroups, SidebarNav } from '../../components/Layout.jsx'
import { BRAND } from '../../lib/brand.js'

export default function SidebarPreview() {
  const groups = buildAdminNavGroups({
    canApproveScans: true,
    canManageShiftClock: true,
    isSuperAdmin: true,
  })

  return (
    <div className="app-shell">
      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col">
        <div className="flex items-center gap-3 px-5 py-1.5">
          <Logo size="sm" showText={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold tracking-tight text-ink">{BRAND.name}</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-tight text-accent-orange">
              Workforce platform
            </p>
          </div>
          <button type="button" className="rounded-lg p-1.5 text-ink-3" aria-label="Collapse sidebar">
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>

        <SidebarNav groups={groups} onNavigate={() => {}} />

        <div className="border-t border-white/5 p-1.5">
          <ThemeSwitcher />
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-0.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-orange/15 text-[11px] font-bold text-accent-orange">
              DV
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-4 text-ink">Divjit</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-3">Administrator</p>
            </div>
            <button type="button" className="rounded-lg p-2 text-ink-3" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="p-8 pl-[292px] text-sm text-ink-2">
        DEV sidebar harness — all flags true. The Operations group must end with “Approve” and be
        fully visible without scrolling at the target viewport height.
      </main>
    </div>
  )
}
