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
      <aside className="app-rail fixed inset-y-0 left-0 z-40 flex w-[268px] flex-col">
        <div className="app-rail-head">
          <Logo size="sm" showText={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[1.05rem] font-bold tracking-tight text-white">
              {BRAND.name}
            </p>
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-accent-orange">
              Workforce platform
            </p>
          </div>
          <button type="button" className="rounded-xl p-2 text-[#8d9785]" aria-label="Collapse sidebar">
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>

        <SidebarNav groups={groups} onNavigate={() => {}} />

        <div className="app-rail-foot">
          <ThemeSwitcher />
          <div className="mt-1 flex items-center gap-3 rounded-2xl px-1.5 py-1.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-orange/20 text-xs font-bold text-accent-orange">
              DV
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">Divjit</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8d9785]">
                Administrator
              </p>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[#8d9785]"
              aria-label="Sign out"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>
      <main className="p-8 pl-[300px] text-sm text-ink-2">
        DEV sidebar harness — all flags true. The Operations group must end with “Approve” and be
        fully visible without scrolling at the target viewport height.
      </main>
    </div>
  )
}
