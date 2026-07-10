# SecurePatrol — Complete Project Reference

> Deep reference for anyone (human or AI) working on this codebase — especially UI/UX
> updates. Covers architecture, every page and button, the design system, data model,
> automation, and the feature roadmap. Last updated: 2026-07-09 (Dark Ops UI).

---

## 1. What this product is

**SecurePatrol** is a security-workforce management platform for **Productive Security Inc.**
(prodsec.ca). It verifies that guards actually patrol buildings, tracks their hours, and
reports everything to building owners.

Three portals, one React app, role-gated:

| Portal | Who | Core jobs |
|---|---|---|
| **Admin** | Company owner/office admin | Manage sites, guards, clients, checkpoints; build schedules (Roster); payroll reports; approve scans; monitor alerts |
| **Guard** | Field guards (phones) | Clock in by scanning NFC/QR checkpoints, patrol rounds, view schedule, claim open shifts, report incidents, approve timesheets |
| **Client** | Building owners | Read-only: scan history, who's on duty, coverage schedule, guard hours, incidents, PDF exports |

Physical layer: **NTAG NFC stickers + printed QR labels** at checkpoints. A "scan" is
GPS-validated (guard must be within ~20 m of the checkpoint's recorded coordinates).
A checkpoint can be a normal patrol point or a **shift clock-in/out** point — clocking
in is just a pass scan on a `shift_clock_in` checkpoint.

---

## 2. Tech stack

- **React 19 + Vite 8** (JSX, no TypeScript in app code), `react-router-dom` 7
- **Tailwind CSS v4** (via `@tailwindcss/vite`, tokens in `@theme` block in `src/index.css`)
- **Supabase**: Postgres + RLS, Auth, Storage, Realtime, Edge Functions (Deno/TS)
- **Resend** for all outbound email
- **jsPDF + jspdf-autotable** (PDF exports), **qrcode** (QR generation), **html5-qrcode** (camera QR scanning), **lucide-react** (icons)
- PWA-ish: `manifest.json`, offline scan queue in localStorage (no service worker yet)
- All page routes are **lazy-loaded** (`React.lazy`) in `src/App.jsx` — keep new pages lazy

## 3. Repo map

```
src/
  App.jsx                 # All routes (lazy). Dev-only routes /dev/roster, /dev/admin
  main.jsx                # Entry; AuthProvider wrap; online-event queue flush
  index.css               # Tailwind @theme tokens + sp-* component classes
  components/
    Layout.jsx            # THE app shells: SidebarLayout (admin+client), GuardLayout (dark top bar)
    PageHeader.jsx        # H1 + subtitle + right action slot (mb-8)
    Logo.jsx              # Brand logo, sizes sm/md/lg/xl/hero, framed variant
    SyncIndicator.jsx     # Offline-queue badge; polls every 5s; "dark" prop for navy bars
    ProtectedRoute.jsx    # Role gate + loading spinner + inactive-account screen
    QRScanner.jsx         # html5-qrcode camera wrapper
    NFCScanner.jsx        # Web NFC (Android Chrome only); reads text/url NDEF records
    CheckpointCard.jsx    # Guard dashboard checkpoint status card
    ClientShiftBar.jsx    # Date picker + shift stats strip (guard/client dashboards)
    ClientShiftClock.jsx  # Clock-in/out table for client checkpoints page
    LiveFeed.jsx          # Realtime scan feed (subscribes to scans inserts)
    QrPrintModal.jsx      # Print/download QR label modal
    ImageLightbox.jsx     # Full-size photo viewer for incident photos
    IncidentReportAttachments.jsx # Attachment list/preview for incidents
    NextShiftCard.jsx     # Guard dashboard: next published shift + Confirm
    SiteHoursModal.jsx    # Per-day operating hours editor (admin overview)
    roster/
      RosterGrid.jsx      # Presentational week grid (guards × days, drag-drop)
      ShiftSheet.jsx      # Create/edit shift bottom-sheet modal
  hooks/
    useAuth.jsx           # AuthProvider; user, profile, role flags, privileged flags
    useClientShift.js     # Schedule core: DEFAULT_OPERATING_HOURS, getScheduledShiftForDate(date, hours), describeOperatingHours, shiftBounds, useClientShift(hours)
    useClientSiteData.js  # Site+floors+checkpoints+scans+adjustments loader with realtime scans
    useSiteHours.js       # Fetch a site's operating_hours (feeds useClientShift)
    useRealtime.js        # Generic realtime helper
  lib/                    # Data layer — plain async functions over supabase client
    supabase.js           # Client init from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    scans.js              # fetchSitesForAdmin, fetchCheckpointsForSite, scan queries, status helpers
    guards.js             # fetchGuardsWithSites, assignGuardToSite, removeGuard (edge fn + fallback)
    clients.js            # Same pattern for client accounts
    sites.js              # deleteSite
    schedule.js           # Roster: shifts CRUD, series, copyWeek, publishWeek, claim/acknowledge RPCs, detectConflicts, date helpers
    payroll.js            # 15-min rounding, weekly OT split, accounting CSV, timesheet approvals
    clientStats.js        # Clock-in/out derivation from scans, hours reports, patrol rounds
    shiftAdjustments.js   # Manual clock edits + statutory holiday helpers
    offlineQueue.js       # localStorage scan queue: submitScan, flushOfflineQueue, submitScanWithGps
    gps.js                # Haversine, radius/accuracy rules, floor/altitude logic
    qr.js                 # QR payload + data-url builder
    labelExport.js        # Printable checkpoint label PNG composer
    incidentReports.js    # Attachment validation/upload (5 files, 10 MB each), storage paths
    incidentReportPdf.js  # Client-side incident PDF
    scanApproval.js       # Manual scan approval (approver allowlist + db flag)
    device.js             # isIOS, supportsWebNfc, preferredScanMode
  pages/                  # One file per route (see §9)
  pages/dev/              # DEV-only visual harnesses (excluded from prod builds)
supabase/
  schema.sql              # Base schema (applied manually long ago)
  migrations/             # 002…027 numbered SQL files — see §14 warning
  functions/              # Edge functions (Deno): create/delete guard+client, list-clients,
                          # submit-incident-report, publish-schedule, roster-alerts
```

## 4. Environments & infrastructure

- **Supabase project**: `vktxadadhnrcuxtubzxr` ("Securepatrol"), region `ca-central-1`.
  Client env in `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- **Hosting**: Vercel (SPA rewrite in `vercel.json`). App currently on a `*.vercel.app` URL.
- **Email**: Resend. Sender currently `onboarding@resend.dev` → **delivers only to the
  account owner's inbox** until `send.prodsec.ca` is verified. Senders come from env:
  `INCIDENT_REPORT_FROM`, `SCHEDULE_FROM`, recipients `INCIDENT_REPORT_TO`, `ROSTER_ALERTS_TO`.
- **DNS facts (important)**: `prodsec.ca` nameservers + company email (MX) are at **Bell
  Canada Hosting** — NOT Vercel. Never move nameservers. Website cutover = change the
  A record (`69.156.240.29` → Vercel `76.76.21.21`); Resend = add records for the
  `send.prodsec.ca` subdomain at Bell.
- **Deploy commands**: `npm run build` (Vercel builds on push);
  `npm run deploy:client-functions`, `deploy:schedule-function`, `deploy:alerts-function`
  for edge functions.
- **Dev**: `npm run dev` → http://localhost:5173. Visual harnesses at `/dev/roster` and
  `/dev/admin` (mock data, no login needed; DEV builds only).

## 5. Roles & auth

`profiles.role ∈ super_admin | admin | guard | client`. Guards and clients are tied to
exactly one site via `profiles.site_id`. Admins own sites via `sites.admin_id`
(super_admin sees all).

`useAuth()` exposes: `user, profile, loading, signIn, signOut, isAdmin, isGuard,
isClient, isSuperAdmin, canApproveScans, canManageShiftClock, refreshProfile`.
The two `can*` flags come from profile columns / email allowlist and gate the
Operations nav items (Shift Clock, Incidents, Approve).

`ProtectedRoute` props: `requireAdmin | requireGuard | requireClient`. Wrong role →
redirect to their home. Inactive profile (`active=false`, non-super-admin) → red
"Account Inactive" screen. Loading → centered brand spinner.

Guard identity lives in TWO rows: `profiles` (name/role/site/active) + `guards`
(**email** — this is where schedule/alert emails go; `*@guard.local` = placeholder,
email functions skip it).

## 6. Design system

> **⚠️ 2026-07-09 (later): DARK OPS supersedes the light spec below for ALL portals.**
> Tokens now live in `src/index.css` `@theme`: surfaces `canvas #1A1A1E / surface #27272A /
> surface-2 #3F3F46 / inset #18181B / paper #FAFAFA`; accents `accent-orange #F59E0B,
> accent-cyan #A5E8F5 (blocks) / accent-cyan-line #67E8F9 (strokes), accent-green, accent-red`;
> text `ink / ink-2 #A1A1AA / ink-3 #52525B (decorative only — fails contrast for body text)`.
> Primitives: `.dk-card .dk-inset .dk-cta` (white pill CTA) `.dk-btn-2` (glass) `.dk-label`
> `.dk-pill-ok/.dk-pill-bad` `.hatch-empty` (empty schedule cells). **No drop shadows** — 1px
> white/5 borders + inset top highlight. The `sp-*` classes were REDEFINED dark, so guard app
> and modals inherit automatically. Cyan hero KPI = only cyan card per page. Full pixel spec:
> `master-ui-spec-workforce-management.md` + `securepatrol-dark-ui-adaptation-plan.md`.
> The "enterprise light" section below is HISTORICAL — do not use for new work.

### Fonts
- Body: **DM Sans** (`--font-sans`); Headings h1–h3: **Instrument Sans** (`--font-display`),
  `tracking-tight`. Loaded via Google Fonts import in `index.css`.

### Color tokens (`@theme` in `src/index.css`)
| Token | Hex | Use |
|---|---|---|
| `navy-950/900/800/700/600` | `#060d18 / #0a1628 / #0f2137 / #152a45 / #1e3a5f` | Guard top bar, dark overlays, login left panel |
| `brand-50/100/500/600/700` | `#eef4ff / #d9e6ff / #3b6bdb / #2b55c0 / #2348a8` | Legacy brand blue (guard app buttons, spinners) |
| `gold-400/500/600` | `#d4af37 / #b8962e / #9a7b26` | Accent (login subtitle) |

### The 2026-07 "enterprise light" spec (admin + client portals)
Newer screens follow this exactly — **use these tokens for all new admin/client UI**:
- App background `bg-gray-50` (#F9FAFB); cards/sidebar pure `bg-white`
- Borders `border-gray-200`; internal dividers `border-gray-100` / `divide-gray-50`
- Radius `rounded-xl` (12px) on cards; `rounded-lg` on buttons/inputs/nav items
- **No shadows** — separation by border. Hover-only: `shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]`
- Primary CTA: `bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium`
- Micro-copy (table headers, group labels, metric labels): `text-[10px]`–`text-xs`,
  `font-semibold uppercase tracking-wider text-gray-400/500`
- Status pill: `bg-green-50 text-green-700 text-xs font-medium px-2.5 py-0.5 rounded-full`
  + 1.5px solid dot. Red variant for inactive/failed.
- KPI card anatomy: icon chip (h-9 w-9 `rounded-lg`, tinted bg e.g. `bg-blue-50 text-blue-600`)
  \+ `text-sm text-gray-600` label on one row → value `mt-4 text-3xl font-bold tracking-tight
  text-gray-900` → hint `mt-1 text-xs text-gray-400`. Icon chip tints: blue/violet/teal/orange.
- Site-card metrics bar: single `bg-gray-50 rounded-lg p-3` strip, 3 columns with
  `divide-x divide-gray-200/70`; value `text-base font-bold` over `text-[10px]` uppercase label;
  **compliance renders `text-red-600` when 0**.
- Warning banner: `border-amber-200 bg-amber-50 text-amber-900 rounded-xl px-4 py-3 text-sm`.

### Legacy `sp-*` classes (still used across guard app + modals + older pages)
`sp-card` (rounded-2xl white, soft slate shadow) · `sp-card-elevated` · `sp-input`
(rounded-xl, brand focus ring) · `sp-label` (uppercase tracked xs) · `sp-btn-primary`
(brand-600, rounded-xl, shadow) · `sp-btn-secondary` · `sp-btn-ghost` · `sp-page-header`
· `sp-stat-card` · `sp-nav-link(-active)` (dark bar links) · `sp-logo-frame(-lg)`.
When restyling an admin/client page to the new spec, replace these with the spec
tokens above; guard app keeps them.

### Modals / bottom sheets
Pattern (ShiftSheet, SiteHoursModal): fixed inset overlay `bg-navy-950/50 backdrop-blur-sm`,
sheet slides bottom on mobile (`items-end`, `rounded-t-3xl`) and centers on ≥sm
(`sm:items-center`, `sm:rounded-3xl`), `max-w-lg/md`, internal `p-6`, click-outside closes.

### Shift chip colors (Roster)
`SHIFT_COLORS = blue | violet | teal | amber | rose` → chip = white card with
`border-l-4` in the color + tinted bg (`bg-{color}-50/80`). Draft = amber dot + "Draft";
acknowledged = small green check; conflict = `ring-2 ring-red-400/70` + red triangle.

## 7. Layout shells (`src/components/Layout.jsx`)

### SidebarLayout — admin & client portals
- **Desktop**: fixed left sidebar `w-[260px]`, white, `border-r border-gray-200`.
  Content `lg:pl-[260px]`, page padding `px-10 py-8`, **no max-width** (fluid grid).
- **Brand header** (top of sidebar): `Logo size="sm"` + "SecurePatrol" (`text-base font-bold`)
  over "PRODUCTIVE SECURITY" (`text-[10px] uppercase text-gray-400`) + **collapse button**
  (`PanelLeft` icon, `aria-label="Collapse sidebar"`).
- **Collapse behavior**: sidebar `-translate-x-full`, content `lg:pl-14`; a floating
  reopen button (`aria-label="Open sidebar"`, fixed left-4 top-4, white bordered) appears.
  State persisted in `localStorage['sp-sidebar-collapsed']`.
- **Nav groups** (label `text-xs uppercase tracking-wider text-gray-400 mb-2 px-3`; items
  `flex gap-3 px-3 py-2 text-sm text-gray-600 rounded-lg`, active `bg-gray-100 text-gray-900 font-medium`, icons h-4 w-4 stroke-2):
  - **Admin**: (no label) Overview `/admin`, Roster `/admin/roster` · **SITE** Checkpoints,
    Guards, Clients · **INSIGHTS** Reports, Alerts · **OPERATIONS** (conditional on can-flags)
    Shift Clock, Incidents, Approve
  - **Client**: (no label) Scan History `/client` · **SITE** Coverage, Shift Clock ·
    **OPERATIONS** Incidents · **INSIGHTS** Reports
- **Sidebar footer**: SyncIndicator, then profile row — avatar circle (`bg-blue-100
  text-blue-700` initials) + name (`text-sm font-semibold`) + role (`text-[10px]` uppercase:
  "Administrator"/"Client") + logout icon button.
- **Mobile (<lg)**: sticky white top bar (hamburger → slide-over drawer of the same sidebar,
  overlay `bg-gray-900/30 backdrop-blur-sm`).

### GuardLayout — guard portal (intentionally different: dark, mobile-first)
Sticky `bg-navy-900` top bar: framed logo left; centered nav links (Dashboard, Scan,
Schedule, Report, History) on ≥md; right side SyncIndicator (dark), name + "FIELD GUARD",
logout. <md: hamburger dropdown panel. Content `max-w-7xl px-4 py-8`.

### PageHeader (every page's first element)
`mb-8`, flex between: H1 `text-2xl sm:text-3xl font-bold tracking-tight text-gray-900`
(+ display font via base h1 style), subtitle `mt-1 text-sm text-gray-500 max-w-2xl`,
right-side `action` slot for the page's primary button.

## 8. Database schema (Supabase Postgres, RLS on everything)

Base tables (`schema.sql`): 
- **profiles** (id=auth.users.id, name, role, site_id, active, can_approve_scans, can_manage_shift_clock)
- **sites** (name, address, admin_id, `patrol_interval_minutes` int default 120,
  `operating_hours` jsonb — per-day `{start,end}` or null=closed; null column = company
  default Mon–Fri 11:00–20:00, Sat 10:00–17:00, Sun closed)
- **floors** (site_id, floor_number, floor_name)
- **checkpoints** (floor_id, name, lat/lng, radius, active, `checkpoint_role ∈ patrol |
  shift_clock_in | shift_clock_out`)
- **guards** (id=profile id, name, **email**, site_id, active) — patrol/email metadata
- **scans** (checkpoint_id, guard_id, scanned_at, guard_lat/lng, distance_metres,
  status pass|fail, sync_method realtime|offline_sync)
- **alert_configs** (per-checkpoint: minutes_until_alert, enabled) + **alerts** (log)
- **guard_shift_adjustments** (guard_id, site_id, shift_date, clock_in_at, clock_out_at,
  note — "Statutory holiday — X" prefix drives stat-holiday logic)
- **incident_reports** (guard_id, site_id, description, gps, attachments jsonb,
  email_sent_at/email_error) + storage bucket `incident-photos`

Roster tables (migration 025):
- **shifts** (site_id, guard_id nullable → **null = open shift**, starts_at, ends_at,
  break_minutes, status `draft|published|cancelled`, notes, color, recurrence_id,
  published_at, acknowledged_at, claimed_at, created_by). Drafts invisible to guards/clients.
- **shift_recurrences** (frequency weekly|biweekly|monthly) — series are materialized rows
- **shift_templates** (site_id nullable, name, start_minutes, duration_minutes, break, color)
- **schedule_publications** (audit: who published what range, emails_sent, email_error)
- RPCs: `claim_open_shift(uuid)` (atomic `WHERE guard_id IS NULL` = race-safe; checks role,
  site, overlap) and `acknowledge_shift(uuid)` — both SECURITY DEFINER.

Automation tables (migration 026):
- **alert_events** (site_id, shift_id, guard_id, event_type `late|no_show|stale_patrol`,
  message, acknowledged) — written by roster-alerts function, admin-readable
- **timesheet_approvals** (guard_id, site_id, week_start, hours_snapshot, approved_at,
  UNIQUE(guard_id, week_start))
- pg_cron job `roster-alerts-every-10min` → `net.http_post` to the roster-alerts function

RLS helpers used everywhere: `get_user_role()`, `get_user_site_id()`, `user_owns_site(id)`.
Pattern: admins FOR ALL via ownership; guards/clients narrow SELECTs; guard writes via
SECURITY DEFINER RPCs, never direct UPDATE policies.

## 9. Page-by-page reference

### Public
**`/login` — Login.jsx.** Split screen: left navy panel (hero logo, product pitch, three
feature bullets, gold "PRODUCTIVE SECURITY INC." accent), right form card — EMAIL/PASSWORD
(`sp-label`+`sp-input`), full-width `sp-btn-primary` **"Sign in to SecurePatrol"**. On auth →
HomeRedirect routes by role (`/admin`, `/client`, `/guard`).

### Admin portal (SidebarLayout)
**`/admin` — AdminDashboard "Overview".** Header action: **"+ New Site"** (blue-600 CTA)
→ inline create form (name+address, Create/Cancel). KPI row (4 cards): Sites, Active guards
(hint: unassigned count), Scans today (sum), Avg compliance. Amber banner when guards are
unassigned (links to Guards). Site cards grid (2-col): building icon + name/address (links
to site dashboard); action icons top-right — **Clock** (opens SiteHoursModal), **Trash**
(delete site w/ confirm listing what's destroyed), **ChevronRight** (open); schedule strip
(clock icon + `describeOperatingHours`); ASSIGNED GUARDS list; gray metrics bar
(Checkpoints / Scanned today / Compliance, red at 0%). Auto-refreshes on window focus.
NOTE: Guard Assignments table was removed from this page (2026-07-09) — management lives in /admin/guards.

**`/admin/roster` — AdminRoster "Roster".** Header action: **"Publish N drafts"** (primary;
disabled when 0 → "All published"). Toolbar: site select (if >1), week nav (‹ Today ›),
week-range label, Week/Fortnight toggle (dark pill), **"Copy last week"**. Stats strip
(hours scheduled, guards scheduled, open count, conflicts count). **RosterGrid**: sticky
header (day columns, today tinted), amber **Open shifts lane**, guard rows (name + weekly
hours, red if >40h). Cells: click empty → ShiftSheet create (seeded 9:00); click chip →
edit; **drag chip to any cell** → move day/reassign guard (optimistic + reload). Chips
show time range, hours, Open/Draft badges, ack check, conflict ring+tooltip.
**ShiftSheet** fields: template quick-chips, Assign to (Open shift option), Date/Start/End
(end ≤ start ⇒ "+1 day" overnight), break minutes, 5 color swatches, repeat
(weekly/biweekly/monthly × occurrences), notes; edit mode adds Delete + "Delete series".
Live: refetches on focus + Supabase realtime on shifts/profiles. Publish → edge function
(emails + .ics) with silent DB fallback if function missing.

**`/admin/site/:id` — SiteDashboard.** "← Back to overview" link; ClientShiftBar (date
picker + shift stats); live scan feed + guard clock table for one site. Respects site hours.

**`/admin/site/:id/live` — LiveFeedPage.** Full-page realtime scan feed for a site.

**`/admin/checkpoints` — CheckpointManager "Checkpoints".** Site selector; **"Create floor"**;
per floor: **"Create checkpoint"** (name + **"Use my current GPS location"** — captures
device GPS; checkpoint_role select patrol/clock-in/clock-out). Table rows: copy-UUID button
("Copy full UUID for NFC tag" — used with NFC Tools app), **QR print** button ("Generate &
print QR label" → QrPrintModal with PNG label download/print), rename (pencil→save/cancel),
delete. This page is the source of checkpoint IDs written to physical NFC tags.

**`/admin/guards` — GuardManager.** Guard list; create guard (name/email/password → edge
function `create-guard`); assign-to-site select; **"Remove guard permanently"** (edge fn
`delete-guard`, fallback to table deletes). Guard emails here = login + schedule emails.

**`/admin/clients` — ClientManager "Client Manager".** Same pattern via `create-client` /
`list-clients` / `delete-client` edge functions; assigns client login to a site.

**`/admin/reports` — Reports "Reports".** Two tabs (segmented): **Patrol scans** (site+date
filters; CSV + PDF export buttons; stat cards total/passed/failed; scan table) and
**Guard hours (payroll)** (pay-period filters; blue banner shows the site's live hours via
`describeOperatingHours`; **Exact / 15-min rounding** toggle; export buttons **Payroll CSV**
(weekly regular/OT/stat split + timesheet-approval column), CSV (daily rows), PDF; per-guard
total cards with amber `OT xh` badge; detail table Date/Guard/Clock in/Clock out/Hours/Day
type). Hours derive from clock-in scans + `guard_shift_adjustments`, windowed by
**per-site operating_hours**.

**`/admin/alerts` — Alerts.** Per-checkpoint alert configs (minutes_until_alert, enabled
toggle) + recent alerts log. (Roster alert_events currently email-only — surfacing them
here is a natural TODO.)

**`/admin/approve-scan` — ScanApproval "Approve Scan"** (gated `canApproveScans`). Manually
record a pass scan for a guard at a checkpoint (note field) — used when GPS fails; logs
approver.

**`/admin/shift-clock` — AdminShiftClock** (gated `canManageShiftClock`). Date + site pick;
per-guard clock-in/out rows derived from scans; **edit** any row (manual times = writes
`guard_shift_adjustments`), mark **statutory holiday** (credits full scheduled hours).
Respects per-site hours.

**`/admin/incidents` — AdminIncidents "Incident reports".** List of guard-submitted
incidents: description, GPS, attachments (ImageLightbox for photos), email status; edit
capability per migration 023.

### Guard portal (GuardLayout — dark top bar)
**`/guard` — GuardDashboard "Patrol Dashboard".** NextShiftCard (Today/Tomorrow + time +
site; **Confirm** button; chevron → schedule). Two big buttons: **"Scan checkpoint"**
(primary, → /guard/scan) and **"Report incident"** (secondary). ClientShiftBar (date, shift
window from site hours, rounds/scan stats). Scan history table for the shift; checkpoint
status cards (grid) with per-checkpoint last-scan state.

**`/guard/scan` — ScanScreen.** Mode tabs **NFC Tag / QR Code** (default from
`preferredScanMode()`: NFC on Android Chrome, QR on iOS). NFCScanner: **"Start NFC Scan"**
→ Web NFC read → checkpoint UUID; QRScanner: camera → decode. On read: gets GPS →
`submitScanWithGps` → distance check vs checkpoint (~20 m + accuracy bonus; floor/altitude
heuristics in gps.js) → navigate to `/guard/scan/result` (pass/fail screen with distance +
retry). Offline: scan queued locally, syncs on reconnect.

**`/guard/scan/result` — ScanResult.** Big green Verified / red Failed state, distance,
checkpoint name, "Scan another" / back-to-dashboard actions.

**`/guard/schedule` — GuardSchedule "My Schedule".** Range toggle **2 weeks / Month**.
TimesheetCard ("Last week's timesheet · Xh scheduled" + **"Approve hours"** → insert
timesheet_approvals; shows "Signed off ✓"). Amber **"Available shifts — first come, first
served"** card with **Claim** buttons (race-safe RPC; loser sees "just claimed"). Day-grouped
shift cards with time range, site, hours, notes + **Confirm** per shift (acknowledge RPC).

**`/guard/incident` — GuardIncidentReport "Site incident report".** Description textarea,
attachment picker (≤5 files, 10 MB each; images/PDF/DOCX), GPS auto-capture, submit →
`submit-incident-report` edge function → stores + emails admin (Resend). Send button has
loading state (was a past UX fix — keep it obviously tappable).

**`/guard/history` — GuardHistory.** Today's scans for the logged-in guard (list).

### Client portal (SidebarLayout)
**`/client` — ClientDashboard "Scan History".** Date-picked scan table for their site +
shift stats bar; realtime insert updates.
**`/client/coverage` — ClientCoverage "Coverage".** Week nav (‹ label ›); emerald **"On duty
now"** banner (live from published shifts); 7 day cards listing guard + time range
(today ringed). Read-only.
**`/client/checkpoints` — ClientCheckpoints "Shift Clock".** ClientShiftClock: per-guard
clock-in/out + hours for chosen date; checkpoint list.
**`/client/incidents` — ClientIncidents "Incident reports".** Read incidents for their site;
photo lightbox; PDF export of an incident.
**`/client/reports` — ClientReports.** Scan history + guard-hours reports w/ CSV+PDF
export for their site (same engines as admin Reports, site-locked, uses site hours).

### Dev harnesses (DEV builds only, no auth)
`/dev/roster` — RosterGrid + ShiftSheet with mock guards/shifts/conflicts.
`/dev/admin` — sidebar shell + spec components with mock data. **Use these to screenshot
UI changes** (headless browser) without credentials.

## 10. Edge functions & automation

| Function | Trigger | What it does |
|---|---|---|
| `create-guard` / `delete-guard` / `create-client` / `delete-client` / `list-clients` | Admin UI | Auth-user + rows management with service role |
| `submit-incident-report` | Guard UI | Stores incident, downloads attachments, emails admin (Resend, attachments inlined) |
| `publish-schedule` | Roster **Publish** | Verifies caller is admin → flips drafts→published in range → per-guard Resend email with **.ics calendar attachment** + open-shift broadcast → logs to schedule_publications. Client falls back to direct DB publish (no emails) if undeployed |
| `roster-alerts` | **pg_cron every 10 min** | Detects: **late** (≥10 min after published start, no clock-in scan), **no_show** (≥30 min), **stale_patrol** (clocked in but no scan for > site `patrol_interval_minutes`). Dedupes via alert_events, inserts events, sends one Resend digest to `ROSTER_ALERTS_TO`/`INCIDENT_REPORT_TO` |

Realtime channels: scans inserts (LiveFeed, useClientSiteData), shifts+profiles changes
(AdminRoster). Offline: `offlineQueue.js` localStorage queue; SyncIndicator polls count
every 5 s; flush on `online` event, app load, and dashboard mount.

## 11. Feature status

### Live now
Three portals · QR + NFC + GPS-validated scanning · offline queue · shift clock via
clock-in checkpoints · manual adjustments + stat holidays · incident reports w/ attachments
+ email + PDF · Roster (drag-drop scheduling, templates, recurrence, conflicts,
draft→publish w/ .ics emails) · open-shift claim (race-safe) · shift confirm ·
late/no-show/stale-patrol auto-alerts (10-min cron) · payroll (15-min rounding, OT split,
accounting CSV) · timesheet sign-offs · client coverage view · per-site operating hours
(editable) · realtime + focus refresh · enterprise-light sidebar shells (admin + client,
collapsible) · lazy-loaded routes.

### Built, awaiting a one-time step
- **Real guard email delivery** → verify `send.prodsec.ca` in Resend (records at Bell DNS),
  then set `SCHEDULE_FROM` / `INCIDENT_REPORT_FROM` secrets to `@send.prodsec.ca` senders.
- Custom domain for the app (`app.prodsec.ca` CNAME → Vercel).

### Planned roadmap (in intended order)
1. **UI/UX sweep**: bring remaining admin/client pages (Reports, Checkpoints, Guards,
   Clients, Shift Clock, Incidents, Alerts, client pages) fully onto the §6 enterprise-light
   spec. Guard app later gets a soft-card mobile redesign (reference: mint healthcare app —
   rounded cards, camera frame w/ corner brackets) recolored to brand.
2. **Face clock-in**: camera-based enrollment + verify screens (MediaPipe landmarks +
   on-device embeddings; consent gate; NFC/PIN fallbacks). WebAuthn passkey as fast path.
   Designed, not built. UI: FaceEnrollIntro → FaceEnrollCapture (3 angles) →
   FaceVerifySheet at clock-in (% progress) → fallback chooser.
3. **Web push notifications** (service worker + VAPID + subscriptions table): open-shift
   broadcasts, patrol reminders to guards, publish notifications. iOS requires
   installed-PWA; full fidelity arrives with native wrap.
4. **Capacitor wrap of guard app** (user has Apple dev account): native Face ID
   (LocalAuthentication), **Core NFC on iPhone**, background geofencing + live guard map,
   APNs push. Ship via Xcode → App Store Connect → TestFlight → review. Admin/client stay web.
5. Nice-to-haves discussed: alert_events surfaced in `/admin/alerts`, guard-hours variance
   (scheduled vs actual) on payroll PDF, schedule diff emails on republish.

## 12. Conventions & guardrails for future work

- **New pages**: lazy-import in `App.jsx`, wrap in `ProtectedRoute`, add nav item in
  `Layout.jsx` groups, use `PageHeader`, follow §6 tokens (admin/client) or `sp-*` (guard).
- **Data access**: add functions to `src/lib/*.js` (throw on error); never call supabase
  inline in components except trivial one-offs; keep RLS-first mindset — guard/client writes
  go through SECURITY DEFINER RPCs or edge functions.
- **Schema changes**: write `supabase/migrations/0XX_name.sql`. ⚠️ **NEVER run
  `supabase db push`** — remote migration history is empty (002–024 were applied by hand);
  push would re-run everything. Apply new migrations via the Supabase SQL editor (owner
  does this) or repair history first with explicit approval.
- **Emails**: always read sender/recipient from env vars; never hardcode; remember the
  resend.dev sandbox limitation.
- **Verification**: `npm run build` must pass; drive the UI headlessly (Playwright,
  browsers cached at `~/Library/Caches/ms-playwright`) against `/dev/*` harnesses or the
  login page; **look at the screenshots**. No test suite or linter exists — the build and
  the browser are the safety net. macOS note: no `timeout` cmd — poll with a `for`+`curl` loop.
- **Dates/times**: shifts stored as timestamptz (ISO); day-level payroll math is local-time
  via string `YYYY-MM-DD` + `shiftBounds`. Rounding: nearest 15 (never floor).
- Keep raw punches immutable — payroll rounding/OT are derived views, never overwrite.
