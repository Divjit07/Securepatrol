# SecurePatrol — Product Requirements Document (TestSprite)

**Version:** 2.0 · **Type:** Web Application (Progressive Web App) · **Stack:** React 19 + Vite 8, Tailwind v4, Supabase (Postgres/RLS/Auth/Realtime/Edge Functions)

---

## 1. Product Summary

SecurePatrol is a security-workforce management web app for Productive Security Inc. It verifies that security guards physically visit assigned checkpoints during patrols using **printed QR code labels** + **GPS distance validation**, and provides scheduling, clock-in/out, incident reporting, and payroll.

It is a single React app with **three role-gated portals**:

- **Admin** — full management (sidebar shell).
- **Client** — read-only property-owner portal, scoped to a single site (sidebar shell).
- **Guard** — mobile-first patrol app (dark top bar).

Access is enforced by Supabase Auth + Row Level Security (RLS). Users are redirected to their portal by role after login.

---

## 2. User Roles & Permissions

| Capability | Super Admin | Admin | Guard | Client |
|---|:---:|:---:|:---:|:---:|
| Create/delete sites | ✓ | Own sites | — | — |
| Manage floors & checkpoints | ✓ | Own sites | — | — |
| Print QR labels | ✓ | Own sites | — | — |
| Add/remove guards | ✓ | Own site | — | — |
| Add/remove clients | ✓ | Own site | — | — |
| Scan checkpoints / clock in-out | — | — | ✓ | — |
| Submit incident reports | — | — | ✓ | — |
| View live dashboard | All | Own site | Own scans | — |
| Read-only client portal | — | — | — | ✓ (one site) |
| Export reports | ✓ | Own site | — | — |
| Configure alerts | ✓ | Own site | — | — |

**Test expectation:** A user of one role must never be able to reach another role's routes or data. Attempting to access an out-of-role route redirects to that user's own portal or the login page.

---

## 3. Authentication (FR-AUTH)

- **FR-AUTH-1** Login page (`/login`) accepts email + password.
- **FR-AUTH-2** On successful login, the user is redirected by role: admin → `/admin`, guard → `/guard`, client → `/client`.
- **FR-AUTH-3** Invalid credentials show an inline error and do not navigate away.
- **FR-AUTH-4** Signup page (`/signup`) exists for account creation flows.
- **FR-AUTH-5** Unauthenticated access to any protected route redirects to `/login`.
- **FR-AUTH-6** Passkey/WebAuthn login is supported (`@simplewebauthn/browser`, `passkey` edge function).
- **FR-AUTH-7** Logout returns the user to the login page and clears the session.

---

## 4. Guard Portal (FR-GUARD)

Routes are mobile-first with a dark top bar.

| Screen | Route | Requirement |
|---|---|---|
| Dashboard | `/guard` | Shows assigned site, patrol progress, checkpoint cards, and clock-in state. |
| Scan | `/guard/scan` | QR scan (primary) and NFC (Android only). |
| Scan result | `/guard/scan/result` | Pass/fail message with distance. |
| History | `/guard/history` | Today's scans for this guard. |
| Schedule | `/guard/schedule` | Guard's published shift times. |
| Incident report | incident report screen | Submit an incident with optional photo attachments. |

- **FR-GUARD-1** Guard sees only their own assigned site and checkpoints.
- **FR-GUARD-2** Scanning a QR label opens the checkpoint and captures GPS at scan time (multiple samples for accuracy).
- **FR-GUARD-3** Scan validation is **server-side**: a passing scan requires distance ≤ effective radius (20m base + GPS-accuracy tolerance). Client cannot force a pass.
- **FR-GUARD-4** A scan beyond the effective radius returns **fail** with a clear reason (too far / weak GPS / wrong floor).
- **FR-GUARD-5** Failed scan attempts are logged for admin only and are **never** shown to clients.
- **FR-GUARD-6** Clock-in/out records raw punches; these punches are immutable once recorded.
- **FR-GUARD-7** Guard shift times shown come only from the **published** roster.
- **FR-GUARD-8** Offline scans queue in localStorage and sync when connectivity returns; original timestamp is preserved.
- **FR-GUARD-9** Incident reports support text plus image attachments and appear in admin/client incident views per role scope.

---

## 5. Admin Portal (FR-ADMIN)

Sidebar-shell layout.

| Screen | Route | Requirement |
|---|---|---|
| Overview | `/admin` | All sites, compliance %, guard assignments, live clock pills; can remove a site. |
| Site dashboard | `/admin/site/:id` | Floor-by-floor checkpoint status (green/yellow/red). |
| Live feed | `/admin/site/:id/live` | Real-time scan stream via Supabase Realtime. |
| Live map | live map route | Guard/site positions on a Leaflet map. |
| Checkpoint Manager | `/admin/checkpoints` | Add/rename floors & checkpoints, set GPS, print QR labels. |
| Guard Manager | `/admin/guards` | Create, assign, and remove guards. |
| Client Manager | `/admin/clients` | Create read-only client logins. |
| Roster | roster route | Build and publish guard schedules. |
| Shift clock | shift clock route | View live clock-in/out punches. |
| Payroll | payroll route | Derived hours; rounding/overtime computed, never overwriting raw punches. |
| Reports | `/admin/reports` | Filter and export scan data. |
| Incidents | incidents route | Review guard-submitted incidents. |
| Alerts | `/admin/alerts` | Configure missed-checkpoint notifications. |

- **FR-ADMIN-1** Admin sees/manages only sites they own (super admin sees all).
- **FR-ADMIN-2** Creating a checkpoint requires a name, floor, and GPS coordinates; a branded QR label can then be previewed, printed, and downloaded as PNG.
- **FR-ADMIN-3** QR/PDF printables render in light theme (not the Dark Ops theme).
- **FR-ADMIN-4** Creating a guard or client uses an edge function so the admin is not logged out.
- **FR-ADMIN-5** Overview compliance pills are driven by live clock punches.
- **FR-ADMIN-6** Publishing a roster makes those shift times visible to the assigned guards.
- **FR-ADMIN-7** Removing a site removes it from the Overview list.
- **FR-ADMIN-8** Reports can be filtered and exported (PDF via jsPDF).
- **FR-ADMIN-9** Payroll figures are derived; raw clock punches are never mutated.

---

## 6. Client Portal (FR-CLIENT)

Read-only, scoped to exactly one site.

| Screen | Route | Requirement |
|---|---|---|
| Scan history | `/client` | Successful check-ins only + live feed (passes only). |
| Checkpoints | `/client/checkpoints` | Green/red compliance cards for the selected shift. |
| Coverage / Reports / Incidents | client routes | Read-only views scoped to the one site. |

- **FR-CLIENT-1** Client sees exactly one site and cannot edit anything.
- **FR-CLIENT-2** Client views show only successful scans — never failed retry attempts.
- **FR-CLIENT-3** A date + shift-window picker (default 11:00–20:00) filters the displayed data.
- **FR-CLIENT-4** Compliance stats show checkpoints scanned, compliance %, and total scans.

---

## 7. GPS Verification Logic (FR-GPS)

- **FR-GPS-1** Distance uses the Haversine formula computed server-side (Postgres trigger) between guard GPS and admin-entered checkpoint coordinates.
- **FR-GPS-2** Effective radius = 20m base + indoor tolerance derived from GPS accuracy.
- **FR-GPS-3** Multi-floor sites require distinct map pins per floor (≥ 20m apart) to disambiguate stacked indoor GPS.
- **FR-GPS-4** Optional altitude check: when altitude is present and GPS accuracy ≤ 30m, fail only if vertical difference > 18m.
- **FR-GPS-5** Scan records are immutable after insert; RLS restricts each guard to their own site.

---

## 8. Design System (non-functional)

- All three portals use the **Dark Ops** theme: canvas `#1A1A1E`, surface cards, orange/cyan accents, white pill CTAs, no drop shadows.
- Printables (QR labels, PDFs) remain light-themed.
- Mobile layouts must not clip tables or overflow horizontally.
- Light theme variants (sky/ivory) must keep readable contrast.

---

## 9. Key Acceptance Criteria (testable)

- [ ] Login redirects each role to its correct portal; wrong-role routes are blocked.
- [ ] Guard QR scan within radius → **pass**; beyond radius → **fail** with a clear message.
- [ ] Server (not client) determines scan pass/fail.
- [ ] Successful scan appears on the admin live feed within seconds (Realtime).
- [ ] Client portal shows only successful scans, never failed retries.
- [ ] Client is limited to a single site and cannot mutate data.
- [ ] Admin can create sites, floors, checkpoints, guards, and clients.
- [ ] Admin can print/download a branded QR label.
- [ ] Admin can remove a site; it disappears from Overview.
- [ ] Roster publish exposes shift times to guards.
- [ ] Clock punches are immutable; payroll totals are derived.
- [ ] Offline scans queue and sync with preserved timestamps.
- [ ] PWA is installable on iPhone home screen.
- [ ] Reports export succeeds and reflects the active filters.

---

## 10. Environment / Test Setup Notes

- **Dev server:** `npm run dev` → `http://localhost:5173`.
- **Build:** `npm run build` (must pass; no unit-test suite or linter in the repo).
- **Backend:** Supabase project `vktxadadhnrcuxtubzxr` (Auth, Postgres/RLS, Realtime, Edge Functions).
- **Auth-free visual harnesses (DEV builds only):** `/dev/roster`, `/dev/admin`.
- Seeded example: site "800 Bathurst-DJ"; client logins `amjad@800bathurst.com`, `ali@800bathurst.com`.
- Roles under test: super admin, admin, guard, client.

---

*Derived from docs/SecurePatrol_PRD_v2.0.md and docs/PROJECT_GUIDE.md — Productive Security Inc.*
