# SecurePatrol (Kratos) — How The Software Works

> **The master context document.** A deep, plain-language explanation of what this
> product is, how it works end to end, everything each of the three portals can do,
> how payroll connects to QuickBooks and other accounting systems, and how the three
> commercial plans (Standard / Premium / Max) map onto real features.
>
> Written to be read cold by a new engineer, a stakeholder, an investor, a salesperson,
> or an AI agent picking up the project.
>
> **Companion docs:** `docs/PROJECT_GUIDE.md` is the terse engineering reference (design
> tokens, exact button copy, file map, schema columns). `PRD.md` is the testable
> requirements spec. This document is the narrative — it explains the *why* and the *how*.
>
> **Last verified against the codebase:** 2026-07-30.
> Every claim below is marked **[BUILT]**, **[PARTIAL]**, or **[NOT BUILT]** so nobody
> mistakes a roadmap item for a shipped feature.

---

## Table of contents

- [0. The product in one paragraph](#0-the-product-in-one-paragraph)
- [1. The core idea: verified scans as the single source of truth](#1-the-core-idea-verified-scans-as-the-single-source-of-truth)
- [2. Roles, portals, and the security model](#2-roles-portals-and-the-security-model)
- **[PART ONE — THE ADMIN PORTAL](#part-one--the-admin-portal)**
- **[PART TWO — THE CLIENT PORTAL](#part-two--the-client-portal)**
- **[PART THREE — THE GUARD PORTAL](#part-three--the-guard-portal)**
- [6. Payroll, accounting & integrations (QuickBooks, ADP, Xero…)](#6-payroll-accounting--integrations)
- [7. Automation & intelligence](#7-automation--intelligence)
- [8. How it's built (the technical foundation)](#8-how-its-built)
- [9. The three commercial plans mapped to features](#9-the-three-commercial-plans-mapped-to-features)
- [10. Gap analysis — what must be built to sell these plans](#10-gap-analysis)
- [11. Quick capability checklist](#11-quick-capability-checklist)

---

## 0. The product in one paragraph

**SecurePatrol** (branded **Kratos**) is a security-workforce management platform built
for **Productive Security Inc.** (prodsec.ca). It answers the three questions every
security company and its clients constantly ask:

> *Are guards actually walking the building? How many hours did they really work?
> Is every site covered right now?*

It answers them by turning physical checkpoints into **NFC tags** that guards tap during
patrols, validating every tap against **GPS coordinates**, and then building scheduling,
payroll, alerting, and client reporting on top of that verified, tamper-resistant stream
of "scans." One React application serves three role-gated experiences — **Admin** (the
security company's office), **Client** (the building owner), and **Guard** (the officer
in the field on their phone).

The commercial thesis: a guard tour system that most competitors sell as a bare
checkpoint logger, but which here extends all the way through to **payroll, statutory
Canadian deductions, paystubs, and accounting sync** — so a small-to-mid security
company can run its entire operation, not just its patrols, in one product.

---

## 1. The core idea: verified scans as the single source of truth

Everything in this product rests on one architectural decision. Understanding it makes
the rest of the system obvious.

### 1.1 How a "scan" physically happens

1. The company sticks an **NTAG NFC sticker** at each checkpoint — a stairwell, a lobby
   desk, a rooftop door, a parking level, a loading dock.
2. Each tag is written with a **checkpoint UUID** generated inside the app (copied from
   the Checkpoints page and written to the tag using the NFC Tools app).
3. When a guard taps the tag with their phone, the app reads the UUID, captures the
   phone's **GPS coordinates** (multiple samples for accuracy), and submits a **scan**.
4. **The server — not the phone — decides pass or fail.** A Postgres trigger computes
   the Haversine distance between the guard's GPS and the checkpoint's recorded
   coordinates. Inside the effective radius (≈20 m base + a tolerance derived from the
   reported GPS accuracy) → **pass**. Outside, or GPS failed → **fail**, with the measured
   distance recorded. A malicious client cannot force a pass.
5. A special class of checkpoint is a **shift clock-in** or **clock-out** point. Clocking
   in for a shift is *literally just a pass scan on a clock-in checkpoint* — so attendance
   and patrol verification run on the exact same trusted mechanism. One mechanism, no
   second system to reconcile.

Multi-floor buildings get special handling: because indoor GPS stacks vertically, each
floor needs distinct map pins (≥20 m apart) to disambiguate, plus an optional altitude
check (fail only if vertical difference > 18 m *and* GPS accuracy ≤ 30 m). This logic
lives in `src/lib/gps.js` and migrations 007–014.

### 1.2 Why immutability matters commercially

**Raw scans are never edited in place.** Corrections live in a *separate* adjustments
table (`guard_shift_adjustments`), so the original evidence always survives an audit.
Hours, rounding, overtime, coverage percentages, and pay are all **derived views** over
that immutable stream.

This is the design principle that makes the whole product defensible:

- A guard can't fake a patrol (server-side GPS validation).
- An admin can't quietly rewrite history (corrections are additive and attributed).
- A client can trust the report (they see the same derived numbers the admin sees).
- An accountant can trust the payroll (every dollar traces back to a punch).
- The paystub PDF, the QuickBooks import, and the client's PDF **always agree**, because
  they're all computed from the same source by the same code.

That last point is the commercial moat. It's also the thing to protect in every future
change: **never mutate a punch.**

---

## 2. Roles, portals, and the security model

There are four roles on `profiles.role`:

| Role | Scope |
|---|---|
| `super_admin` | Sees and manages everything, all sites |
| `admin` | Manages the sites they own (`sites.admin_id`) |
| `guard` | Tied to exactly one site; sees only their own activity |
| `client` | Tied to exactly one site; strictly read-only |

| Portal | Who uses it | Device | Shape |
|---|---|---|---|
| **Admin** | Company owner / office staff | Desktop | Light/dark collapsible sidebar app, fluid width |
| **Client** | Building owner / property manager | Desktop + tablet | Same sidebar shell, **read-only**, with a 3D command-deck backdrop |
| **Guard** | Field officers | Phone | Dark, mobile-first, top-bar app |

### 2.1 Two enforcement layers that must agree

- **In the app:** `ProtectedRoute` gates each route by role (`requireAdmin` /
  `requireGuard` / `requireClient`) and redirects the wrong role to their own home.
  Inactive accounts (`active = false`) get a hard "Account Inactive" screen.
- **In the database:** Postgres **Row-Level Security is on every table**, so even a
  hand-crafted API call can only read or write rows the user is entitled to. Admins act
  through site ownership; guards and clients get narrow SELECT policies; any guard
  *write* goes through a `SECURITY DEFINER` function or an edge function — never a raw
  table UPDATE.

**The UI is a convenience over the real security boundary, which lives in the data
layer.** This matters when adding features: a new page that "hides" a field is not
security. The RLS policy is.

Two additional permission flags on `profiles` gate sensitive admin operations:
`can_approve_scans` and `can_manage_shift_clock`. These control the conditional
**Operations** nav group (Shift Clock, Incidents, Approve), so not every office user
can override a GPS failure or edit a punch.

---

# PART ONE — THE ADMIN PORTAL

> **Who it's for:** the security company's owner and office staff.
> **What it is:** the operational cockpit. Sites, guards, clients, checkpoints,
> schedules, payroll, invoicing, and alerts all live here.
> **Route prefix:** `/admin`

Navigation is grouped: **Overview / Ops Board / Roster / Assistant**, then **SITE**
(Sites, Live Map, Checkpoints, Guards, Clients), then **PAYROLL**, then **INSIGHTS**
(Summary, Reports, Alerts), then a conditional **OPERATIONS** group (Shift Clock,
Incidents, Approve) that appears only for admins holding the matching permission flags.

## 3.1 The daily picture — Overview, Ops Board, Summary

**Overview (`/admin`)** — the flagship dashboard. **[BUILT]**

- Four KPI tiles: total sites, active guards (with an unassigned count as a hint),
  scans today, average compliance.
- An amber warning banner when guards are unassigned, linking to the Guards page.
- One card per site showing: building name and address, operating hours, the list of
  assigned guards, and a live metrics bar (checkpoints, scanned today, compliance —
  which renders **red at 0%** so a dead site is impossible to miss).
- Per-site action icons: a clock (opens the operating-hours editor), a trash can
  (delete site, with a confirm listing exactly what gets destroyed), a chevron (drill in).
- Auto-refreshes when you refocus the browser tab — so the morning glance is never stale.

**Ops Board (`/admin/ops`)** — the "who's on right now" board across *all* sites.
**[BUILT]** Overlapping shifts, live clock status per guard, quick jumps into any site or
roster cell. This is the fast pre-shift glance before the day starts.

**Summary (`/admin/summary`)** — the narrative digest. **[BUILT]** The day's activity and
exceptions rolled up into prose for a quick read, backed by role-scoped SQL
(`get_admin_summary_data`, migration 038/039) so the numbers are computed by the
database, not assembled in the browser.

## 3.2 The physical estate — Sites, Checkpoints, Live Map

**Sites (`/admin/sites`)** — a searchable directory built for many buildings. **[BUILT]**
Big autofocused search over name and address with a live result count. A red banner
totals any sites missing GPS coordinates — because **a site with no coordinates cannot
validate a clock-in**, which makes it the single most important data-quality warning in
the product. Each row shows the address, assigned-guard count, and a geofence badge
(green pill with radius, or a red "No GPS" flag).

**Site dashboard (`/admin/site/:id`)** — drills into one building. **[BUILT]** A date
picker, the live scan feed, and the guard clock table — all windowed to that site's
operating hours. **Live feed (`/admin/site/:id/live`)** is the full-page realtime version.

**Checkpoints (`/admin/checkpoints`)** — where the physical tags are born. **[BUILT]**
This page is the bridge between the database and the real building:

1. Select a site, create **floors**.
2. Create **checkpoints** on each floor, capturing coordinates with
   **"Use my current GPS location"** (or entering them manually, validated by
   migration 012).
3. Assign each checkpoint a **role**: `patrol`, `shift_clock_in`, or `shift_clock_out`.
4. **Copy the UUID** to write onto an NFC tag, and/or **generate and print a QR label**.
5. Rename or delete as the building changes.

**Live Map (`/admin/map`)** — **[PARTIAL]** Plots every site's geofence on a dark Leaflet
map and shows **where each guard's phone last was**, derived from the GPS on their most
recent scan (rendered fresh vs. stale by age). You can also add and geocode sites and drop
shifts directly from the map. *Continuous background location tracking arrives with the
native app wrap; today this is "last known position per guard," not a live breadcrumb
trail.*

## 3.3 The people — Guards and Clients

**Guards (`/admin/guards`)** — **[BUILT]** Creates guard logins (name / email / password
via the `create-guard` edge function, so the admin is never logged out of their own
session), assigns them to a site, sets their hourly rate, and can remove a guard
permanently. **The email stored here is where schedule and alert emails go** — a
`*@guard.local` address is treated as a placeholder and skipped by the email functions.

Note the deliberate split: guard identity lives in **two** rows — `profiles`
(name / role / site / active) and `guards` (email, patrol metadata). Pay rates live in a
*third* table, `guard_pay_rates` (migration 034), with admin-only RLS so pay data is
**structurally invisible** to clients rather than merely hidden in the UI.

**Clients (`/admin/clients`)** — **[BUILT]** The same pattern via `create-client` /
`list-clients` / `delete-client` edge functions, binding each building-owner login to the
one site they're allowed to see.

## 3.4 Roster — drag-and-drop scheduling

**Roster (`/admin/roster`)** — a full scheduling suite. **[BUILT]** This is one of the
most complete parts of the product.

- A **week / fortnight grid** of guards × days. Click an empty cell to create a shift;
  click a chip to edit; **drag a chip** to another day or another guard to move or
  reassign it (optimistic UI, then reconciled against the server).
- **Open shifts** (unassigned, `guard_id IS NULL`) sit in a highlighted amber lane so
  gaps are impossible to overlook.
- **Shift templates** give one-click common shifts.
- **Recurrence** (weekly / biweekly / monthly × N occurrences) materializes a real series
  of rows rather than a virtual rule — simpler to reason about and to edit individually.
- **Overnight shifts** (end ≤ start) roll correctly to the next day. *This was a real
  bug, caught by the `/dev/scale` harness: before the fix, a 20:00→06:00 site produced
  negative hours and silently dropped evening scans.*
- **Conflict detection** rings any overlap and explains it on hover. Weekly hours turn
  red past 40h, so overtime is visible **before** it's scheduled — not after it's paid.
- Work is created as **drafts**, invisible to guards and clients. Hitting **Publish**
  flips the range to published and, through the `publish-schedule` edge function, emails
  each guard their shifts **with a real `.ics` calendar attachment**, broadcasts open
  shifts, and logs the publication to `schedule_publications`. If that function isn't
  deployed, the app still publishes directly to the database — just without the emails.
- **"Copy last week"** clones a week forward.
- The grid updates live via Supabase realtime subscriptions and on tab refocus.

## 3.5 Corrections and exceptions — Shift Clock, Approve, Incidents

**Shift Clock (`/admin/shift-clock`)** — **[BUILT]** (gated on `can_manage_shift_clock`).
Per-guard clock-in/out derived from scans for a chosen date and site. Admins can:

- **Edit** any row — which writes a *manual adjustment*, never overwriting the raw punch.
- Flag a **statutory holiday**, crediting full scheduled hours. Stat minutes are tracked
  separately and never count toward the overtime threshold.
- See **early clock-outs** surfaced with the guard's typed reason ("Early out: …").
- **Force clock-out** a guard who forgot (migration 037).

**Approve Scan (`/admin/approve-scan`)** — **[BUILT]** (gated on `can_approve_scans`).
Lets an authorized admin manually record a pass when GPS legitimately failed — a
concrete-basement parking level, a dead phone GPS — with a note and the approver's
identity logged, so the override is fully auditable rather than invisible.

**Incidents (`/admin/incidents`)** — **[BUILT]** Lists guard-submitted incident reports:
description, GPS coordinates, photo/PDF attachments (with a lightbox), and an **email
badge** showing whether the admin notification was delivered (green "Emailed") or why it
failed (red, with the reason on hover). **The report is always stored even if the email
fails** — a deliberate decision so a mail outage can never lose evidence. Admins can edit
reports (migration 023) and there's a review gate (migration 033).

## 3.6 Alerts and the Assistant

**Alerts (`/admin/alerts`)** — **[BUILT]** Manages per-checkpoint alert configuration (how
many minutes of silence triggers an alert, on/off toggle) and shows the recent alert log.
*Note: the automation table `alert_events` — late/no-show/stale-patrol — is currently
email-only; surfacing those events on this page is a known TODO.*

**Assistant (`/admin/assistant`)** — **[BUILT]** A **deterministic ops chatbot — not an
LLM.** It maps your question to a fixed set of live, RLS-scoped data lookups ("how many
scans today at X?", "who's late?") and templates the answer.

This design is a feature, not a limitation: because it can only run the same queries the
app already makes, **it cannot invent a number**, it can't leak across sites (RLS still
applies), and no data leaves the browser beyond normal API calls. For a product whose
entire value is trustworthy numbers, a hallucinating assistant would be worse than none.
Implementation: `src/lib/assistant/` (intents, entity extraction, matcher, data layer).

## 3.7 Payroll — the money engine

**Payroll (`/admin/payroll`)** — the office's financial home. **[BUILT]** Three tabs
behind one shared filter bar: site, pay-period from/to, and an **Exact / 15-minute
rounding** toggle that defaults to the labor-safe **nearest-15** (never floor —
`roundToQuarterHour` uses a 7.5-minute split).

### Tab 1 — Guard hours

Hours computed from the immutable clock punches plus any manual adjustments, windowed by
each site's operating hours. Produces:

- A weekly **regular / overtime split** (overtime past 40h/week —
  `OVERTIME_WEEKLY_MINUTES`), with statutory-holiday minutes credited separately.
- An **accounting CSV** — one row per guard per week:
  `Guard, Week starting, Days, Regular hours, Overtime hours, Stat holiday hours, Total hours, Timesheet`
  (the last column reads "Approved by guard" or "Not approved").
- A **daily CSV**, a **PDF**, and per-guard total cards with an overtime badge and an
  approvals column.

### Tab 2 — Paystub generator

Per guard: an hourly rate (persisted to `guard_pay_rates`), then **percentage-based
statutory deductions computed live**:

```
Net = Gross − (Gross × EI%) − ((Gross − CPP exemption) × CPP%) − other fees
```

Canadian defaults, all editable in the UI so a rate-year change doesn't require a deploy:

| Deduction | Default | Notes |
|---|---|---|
| **EI** | 1.63% of gross | |
| **CPP** | 5.95% over the basic exemption | |
| **CPP basic exemption** | $3,500/year, **prorated to the actual pay period** | CRA per-period method: annual ÷ periods per year. 14-day period ⇒ 26 periods ⇒ $134.62. *A hardcoded per-period figure was only correct for 14-day runs — this was fixed.* |
| **Overtime multiplier** | 1.5× (or a typed OT rate) | |
| **Period OT threshold** | 88h default (44h/wk biweekly), editable | Re-splits regular vs OT across a whole period |

Output is a **Dayforce-style paystub PDF** (`src/lib/paystub.js`): company logo and
PRODUCTIVE SECURITY INC. letterhead, employee and pay-period blocks, one bordered grid
with **Current + YTD** column groups covering Earnings (REG / OT / STAT with hours and
rate) / Taxes (E.I., C.P.P., Other) / Net Pay, and an employer-messages box. **YTD is
computed from real punches** (Jan 1 of the period's year → period end, cached per
site+period) — not typed in. "All paystubs" exports one page per guard in a single PDF.

### Tab 3 — Invoice generator

**[BUILT]** Bill a client for extra services — event coverage, call-outs, extra patrols.
Invoice number / date / due date, bill-to block, line items (description × qty × rate,
add/remove), tax % (HST 13% default), notes → a letterheaded **Invoice PDF**
(`src/lib/invoice.js`). Nothing is persisted; the PDF is the artifact.

---

# PART TWO — THE CLIENT PORTAL

> **Who it's for:** the building owner or property manager.
> **What it is:** strictly read-only transparency. Its entire job is trust.
> **Route prefix:** `/client`

A building owner logs in and sees **only their own site**, with no ability to change
anything. It uses the same polished sidebar shell as admin, now with the **3D
"command-deck" grid backdrop** (Three.js / React-Three-Fiber, with a pure-CSS fallback
and reduced-motion / low-power gating) and colorful bento tiles for the numbers that
matter.

The commercial logic: this portal is what a security company shows a prospect to win the
contract, and what stops a client from churning. It converts "trust us, we patrolled"
into "here, watch it happen."

## 4.1 What the client can see

**Patrol Overview / Scan History (`/client`)** — **[BUILT]** A date-picked table of every
verified scan at their building, with a shift-stats strip and **realtime** updates as
guards tap checkpoints. The owner literally watches patrols happen live.

**Coverage (`/client/coverage`)** — **[BUILT]** A week view of scheduled guard coverage
straight from the **published** roster (drafts never leak), with a live emerald
**"On duty now"** banner and today highlighted. Week navigation. Answers "who's
protecting my building, and when?"

**Shift Clock (`/client/checkpoints`)** — **[BUILT]** Per-guard clock-in/out times and
hours for a chosen day, plus the checkpoint list with green/red compliance cards.

**Incidents (`/client/incidents`)** — **[BUILT]** Incident reports filed at their site,
with a photo lightbox and a per-incident **PDF export**.

**Reports (`/client/reports`)** — **[BUILT]** The export center, two tabs:

- **Scan report** — scan history with a stat strip (scans logged, checkpoints hit, guards
  on site) and CSV/PDF export.
- **Guard hours (2 weeks)** — clocked hours by guard with a per-guard summary and a
  downloadable hours PDF.

Everything is locked to their site and uses their site's operating hours, so **the numbers
match exactly what admin sees.**

## 4.2 What the client can never see

This list is as important as the feature list, and it's enforced by RLS, not just UI:

- ❌ Other buildings (single `site_id` on the profile)
- ❌ Draft shifts (only `status = 'published'` is readable)
- ❌ **Failed scan attempts** — a guard retrying a weak-GPS scan three times would look
  like incompetence; clients see verified passes only (FR-CLIENT-2)
- ❌ Pay rates, paystubs, payroll internals (`guard_pay_rates` has admin-only RLS)
- ❌ Any write operation whatsoever

---

# PART THREE — THE GUARD PORTAL

> **Who it's for:** the officer in the field.
> **What it is:** a dark, mobile-first, one-thumb app built around a single behavioral
> truth — **the app locks until you clock in.**
> **Route prefix:** `/guard`

The guard app is deliberately different from the other two: `GuardLayout` gives it a
sticky dark navy top bar instead of a sidebar, and it keeps the legacy `sp-*` component
classes tuned for touch. Design intent: a guard standing in a cold stairwell at 3 AM with
one hand free should never have to think about what to tap.

## 5.1 The lock, and the traffic light

**Dashboard (`/guard`)** — **[BUILT]** The centerpiece is the **ClockInCard, a traffic
light**:

| Color | Meaning |
|---|---|
| **Grey** | Off duty / before the shift window — or shift already over, in which case it shows the *next* published shift and when clock-in opens, rather than nagging |
| **Yellow** | The 15-minute early window before start |
| **Green** | On duty (clocked in) |
| **Red** | You're **late to clock in**, or your shift **ended and you haven't clocked out** — *"your shift ended at 8 PM — CLOCK OUT NOW"* |

Rules that make this trustworthy:

- **Clock-in requires the site geofence.** You must physically be at the building.
- **Clock-out works from anywhere.** GPS is still recorded for audit, but a guard escorted
  off-site or finishing at a perimeter gate isn't trapped. (Migration 031.)
- **Punching out more than 15 minutes early** opens an amber confirm requiring a typed
  reason (min 3 characters), stored on the clock-out scan's `approval_note` and shown to
  admins in Shift Clock.
- **The lock is instant and portal-wide.** `useGuardClockStatus` is a module-level shared
  store, so a punch anywhere flips the nav, the gate, and the dashboard at once — no 60s
  poll lag.
- **Clock state is strictly per-guard**, so handoffs work cleanly: guard B clocks in
  normally while guard A is still on shift, and both rows appear in Shift Clock.
- **New hires**: the no-site screen still renders the ClockInCard, so a guard can be
  onboarded before a site or schedule is assigned.

Once clocked in, the full dashboard appears: current-shift panel, next-shift card,
scan/report buttons, shift-stats bar, today's scan history, and checkpoint status cards.

## 5.2 Scan (`/guard/scan`) — **[BUILT]**

**NFC tap** to record a checkpoint pass. Read the tag → capture GPS for audit → submit →
land on a **Verified / Failed** result screen (`/guard/scan/result`) showing the distance
and checkpoint name.

- **Offline-first:** if there's no connectivity, the scan is queued in `localStorage`
  (`src/lib/offlineQueue.js`) with its **original timestamp preserved**, and syncs
  automatically on reconnect. A `SyncIndicator` badge shows the pending count, polling
  every 5s and flushing on the `online` event, app load, and dashboard mount.
- **NFC UID binding** (migration 035) ties a tag's hardware serial to the checkpoint, so
  a cloned or re-written tag doesn't silently pass.
- QR scanning was **retired** (migrations 045, and `html5-qrcode` removed) — checkpoints
  are physical NFC tags now.
- On iPhones, Web NFC doesn't exist, so a banner points to the native path. **iPhone
  tap-to-scan requires the Capacitor wrap** (Core NFC) — see the roadmap.

## 5.3 Schedule (`/guard/schedule`) — **[BUILT]**

The guard's own shifts, toggleable **2 weeks / Month**, grouped by day with site, time,
hours, and notes. Only **published** shifts appear. Three self-serve actions:

- **Confirm** a shift — acknowledges it (`acknowledge_shift` RPC), showing the office a
  green check on the roster chip.
- **Claim** an open shift — first-come-first-served via the **race-safe**
  `claim_open_shift` RPC (atomic `WHERE guard_id IS NULL`, plus role, site, and overlap
  checks). Two guards tapping simultaneously cannot both win; the loser sees "just
  claimed."
- **Approve hours** — sign off last week's timesheet, writing to `timesheet_approvals`
  with an hours snapshot. This appears in the admin payroll approvals column and in the
  accounting CSV.

## 5.4 Report (`/guard/incident`) — **[BUILT]**

File a site incident: a description textarea, up to **5 attachments** (≤10 MB each;
images / PDF / DOCX), auto-captured GPS → submitted through the `submit-incident-report`
edge function, which stores the report and emails the office with attachments inlined.
Locked until clocked in.

> ⚠️ **Gap:** the report is currently **free-text description + attachments only.** There
> is **no incident type taxonomy** in the schema (`incident_reports` has
> `description`, `guard_lat`, `guard_lng`, `photo_path`, but no `incident_type` column).
> The Premium plan promises ten selectable categories — see [§10](#10-gap-analysis).

## 5.5 History (`/guard/history`) — **[BUILT]**

The guard's own scans for the day. Locked until clocked in.

---

## 6. Payroll, accounting & integrations

This section covers the question "**can payroll be linked to QuickBooks and other
services?**" — honestly, including what exists today versus what has to be built.

### 6.1 Why this integrates cleanly (the architectural argument)

The reason SecurePatrol can feed external payroll and accounting systems reliably is the
immutability principle from [§1](#1-the-core-idea-verified-scans-as-the-single-source-of-truth):

- Hours are **derived** from verified punches, not typed in by a person.
- Rounding, overtime splits, and deductions are **pure functions** over those hours
  (`src/lib/payroll.js`, `src/lib/paystub.js`) — reproducible, not stateful.
- Every export is regenerable from the same source of truth at any time.

So an accountant's spreadsheet, a QuickBooks import, and the guard's paystub PDF can
never disagree. That's exactly the property an accounting integration needs — most guard
tour products can't offer it because their hours are hand-entered downstream.

### 6.2 What exists today — **[BUILT]**

| Export | Contents |
|---|---|
| **Accounting CSV** | One row per guard per week: Guard, Week starting, Days, Regular hours, Overtime hours, Stat holiday hours, Total hours, Timesheet approval status |
| **Daily CSV** | Per-day punch detail |
| **Hours PDF** | Formatted hours report for the period |
| **Paystub PDF** | Dayforce-style, Current + YTD, EI/CPP/Other, one page per guard |
| **Invoice PDF** | Client service invoicing with HST |

A bookkeeper can import the accounting CSV into essentially any system today. **This is
the shipping capability.**

### 6.3 What is NOT built — **[NOT BUILT]**

> A codebase-wide search for `quickbooks`, `qbo`, `intuit`, `adp`, `dayforce`,
> `wagepoint`, `xero`, `sage`, `gusto`, `payworks`, and `oauth` returns **zero matches**
> in `src/`, `supabase/`, and the schema.

There is **no integration code of any kind** — no OAuth client, no field mapping, no
vendor-specific export format, no sync scheduler, no connection-status UI, no tokens
table. The Max plan's promise of "Sync to QuickBooks — payroll flows directly into your
accounting, no re-entry" **is not implemented.** Today it is a manual CSV import.

### 6.4 How to build it (recommended architecture)

Because the derived-hours model is already clean, integration is a mapping problem rather
than a data problem. Recommended phasing:

**Phase 1 — Vendor-shaped file exports (fastest path to "it works").**
Add a per-vendor formatter alongside `buildAccountingCsv`. Each is a pure function from
the same weekly rows to that vendor's import schema:

| Vendor | Import mechanism | Mapping notes |
|---|---|---|
| **QuickBooks Online** | Time-activity / timesheet CSV, or IIF for Desktop | guard → Employee, site → Class or Customer, REG/OT/STAT → Service Items or Payroll Items |
| **QuickBooks Desktop** | IIF timer import | Same mapping, different file grammar |
| **ADP** | Paydata CSV import | Employee File #, earnings codes (REG / OT / HOL) |
| **Ceridian Dayforce** | Timesheet import | Employee number, pay code, hours, department |
| **Wagepoint** | Hours CSV | Employee, regular/OT hours per period |
| **Xero** | Payroll timesheet CSV / API | Employee, earnings rate, tracking category = site |
| **Sage** | Timeslip / payroll import | Employee, activity, hours |
| **Payworks / Gusto** | Hours import | Same shape |

Deliverable: a vendor dropdown on the Payroll page and a `src/lib/exports/<vendor>.js`
module each. Low risk, no OAuth, immediately sellable.

**Phase 2 — Direct API sync (the real "no re-entry" promise).**

1. **A connections table** — `integration_connections` (org/site, vendor, encrypted
   OAuth access + refresh tokens, scopes, status, last_sync_at, last_error). Admin-only
   RLS. Tokens must be held server-side in edge functions and **never** exposed to the
   browser.
2. **An OAuth flow per vendor** — QuickBooks Online and Xero both use standard OAuth2
   with refresh tokens; ADP uses certificate-based auth; Dayforce and Wagepoint are
   API-key based. Each needs an edge function pair (`oauth-start`, `oauth-callback`).
3. **A field-mapping screen** — guard → vendor employee ID, site → class/department/
   tracking category, earning codes → REG / OT / STAT. Persist the mapping so it isn't
   re-chosen every run. This screen is where most integration projects actually live or
   die; budget for it properly.
4. **A push job** — an edge function on a cron that finds pay periods where every
   timesheet is approved and pushes them, plus a manual "Sync now" button. Must be
   **idempotent** (an external reference key per pay period per guard) so a retry can't
   double-pay someone.
5. **A sync log + reconciliation view** — what was pushed, when, by whom, with what
   result; and a diff when the vendor's totals disagree.

**Phase 3 — Full Canadian payroll compliance.** See the gap in [§10](#10-gap-analysis):
EI and CPP are implemented, but **federal and provincial income tax withholding is
not** — and neither are CPP2, EI/CPP annual maximums, vacation pay accrual, ROEs, or
T4s. "Canadian deductions built-in" as a Max-plan claim needs either that work, or
narrower marketing language, or delegation of tax calculation to the connected payroll
provider (which is the cheaper and safer route: let ADP/Wagepoint compute tax, and send
them verified hours).

### 6.5 A note on liability

Statutory deduction rates change annually, and getting withholding wrong creates real
employer liability. The current implementation makes the right choice by keeping EI %,
CPP %, and the CPP exemption **editable in the UI** rather than hardcoded — no deploy is
needed for a rate-year change. Preserve that property. If you add income tax, prefer
integrating a maintained payroll engine over hand-rolling CRA tables.

---

## 7. Automation & intelligence

Works across all three portals.

**Late / no-show / stale-patrol alerts.** **[BUILT]** A `pg_cron` job runs **every 10
minutes** and calls the `roster-alerts` edge function, which detects:

| Event | Trigger |
|---|---|
| `late` | ≥10 min past a published shift start with no clock-in scan |
| `no_show` | ≥30 min past start |
| `stale_patrol` | Clocked in, but no scan for longer than the site's `patrol_interval_minutes` |

It de-dupes against `alert_events`, logs each event, and emails a single digest to
`ROSTER_ALERTS_TO`. **The point is that the office learns about a gap before the client
does** — which is the difference between a save and a lost contract.

**Daily operations digest.** **[BUILT]** The `ai-daily-digest` edge function runs on a
`pg_cron` schedule at **11:00 UTC = 07:00 Toronto** (06:00 in winter — `pg_cron` has no
timezone support, and that drift is acceptable for a digest). Despite the name it is
**fully templated, with no LLM**: every number comes from `get_admin_summary_data` and
`get_client_summary_data` (migrations 038/039), so the database computes and the function
only formats. It sends **two different digests**:

- An **admin digest** — full operational detail.
- A **client digest** — a reassurance-shaped coverage summary.

This directly satisfies the Premium plan's "daily operations email before 9 AM."

**Missed-checkpoint tracking.** **[BUILT]** A third `pg_cron` job runs the
`detect_checkpoint_misses()` SQL function **every 30 minutes** over shifts that ended in
the last 48h, persisting "checkpoint X was not scanned during guard Y's shift" as real
rows in `checkpoint_misses` (migration 032). This turns completion rates ("24/25
checkpoints hit") and repeat-offender patterns ("2nd miss this week") into **queryable
facts** rather than render-time labels — which is what makes them usable in reports and
performance conversations.

Two deliberate design choices: it's **idempotent** via `UNIQUE (shift_id, checkpoint_id)`
so re-runs can't duplicate, and misses are recorded **only for shifts where the guard
actually clocked in** — because marking every checkpoint as missed for a full no-show
would drown the pattern data (no-shows are already `alert_events`). It runs as
`SECURITY DEFINER` and cron calls it directly in SQL, so no edge function or API key is
involved.

**Alert digest.** **[BUILT]** `ai-alert-digest` produces a plain-language summary of
active alerts on the same data.

### 7.1 The three scheduled jobs, in one place

| Job | Schedule | What it does |
|---|---|---|
| `roster-alerts-every-10min` | `*/10 * * * *` | Late / no-show / stale-patrol detection + email digest |
| `checkpoint-miss-detection-every-30min` | `*/30 * * * *` | Persists missed checkpoints per shift |
| `ai-daily-digest` | `0 11 * * *` (07:00 ET summer) | Admin + client daily operations email |

**There is no weekly or monthly job.** That is the mechanical reason the Premium weekly
summary and the Standard monthly patrol report are not yet delivered — see
[§10](#10-gap-analysis).

**Schedule publishing emails.** **[BUILT]** Each guard gets their shifts with a real
`.ics` calendar attachment; open shifts are broadcast.

**Incident emails.** **[BUILT]** The office is notified instantly with attachments
inlined; the report is stored regardless of email success.

**Realtime + offline.** **[BUILT]** Scan feeds and roster changes stream live via Supabase
Realtime; dashboards also refresh on tab refocus; guards work offline-first with a local
queue that flushes on reconnect.

---

## 8. How it's built

### 8.1 Stack

- **Frontend:** React 19 + Vite 8, Tailwind CSS v4 (design tokens in an `@theme` block in
  `src/index.css`), `react-router-dom` 7 with **every route lazy-loaded**. Three portal
  shells live in one `Layout.jsx` (`SidebarLayout` for admin + client, `GuardLayout` for
  guards). No TypeScript in app code.
- **Backend:** **Supabase** — Postgres with **RLS on every table**, Auth, Storage
  (incident photos), Realtime, and **Deno edge functions** for anything needing the
  service role.
- **Email:** Resend, with all senders and recipients read from environment variables.
- **Documents:** jsPDF + jspdf-autotable build the paystubs, invoices, incident PDFs, and
  report exports. Printables stay light-themed for real paper.
- **Mobile:** PWA today (manifest, service worker, offline queue). A **Capacitor** wrap is
  configured (`capacitor.config.json`) for the native iOS path.
- **Hosting:** Vercel (SPA rewrite in `vercel.json`).

### 8.2 Edge functions

| Function | Trigger | Purpose |
|---|---|---|
| `create-guard` / `delete-guard` | Admin UI | Auth user + row management with service role |
| `create-client` / `delete-client` / `list-clients` | Admin UI | Same for client logins |
| `submit-incident-report` | Guard UI | Store incident, download attachments, email office |
| `publish-schedule` | Roster Publish | Flip drafts→published, email guards with `.ics`, log publication |
| `roster-alerts` | pg_cron / 10 min | Late / no-show / stale-patrol detection + digest |
| `ai-daily-digest` | pg_cron / daily 07:00 ET | Admin + client daily operations email |
| `ai-alert-digest` | On demand | Active-alerts summary |

### 8.3 Data model highlights

Core: `profiles`, `sites` (with `patrol_interval_minutes` and `operating_hours` jsonb),
`floors`, `checkpoints` (with `checkpoint_role`), `guards`, `scans` (the immutable
stream), `alert_configs`, `alerts`.

Corrections and evidence: `guard_shift_adjustments`, `incident_reports` (+
`incident-photos` storage bucket), `incident_attachments`.

Scheduling: `shifts` (with `guard_id IS NULL` = open shift, `status draft|published|
cancelled`), `shift_recurrences`, `shift_templates`, `schedule_publications`.

Automation and payroll: `alert_events`, `timesheet_approvals`, `guard_pay_rates`
(admin-only RLS).

RLS helpers used everywhere: `get_user_role()`, `get_user_site_id()`,
`user_owns_site(id)`. Guard writes go through `SECURITY DEFINER` RPCs
(`claim_open_shift`, `acknowledge_shift`) — never direct UPDATE policies.

### 8.4 ⚠️ Critical operational warning

**Never run `supabase db push`.** The remote migration history is empty — migrations
002–024 were applied by hand — so a push would attempt to re-run everything. Apply new
migrations through the Supabase SQL editor, or repair the history first with explicit
approval. This is written in `PROJECT_GUIDE.md` too, and it's the single most destructive
mistake available in this repo.

### 8.5 Verification: there is no test suite

There is **no unit test suite and no linter.** The safety net is:

- `npm run build` must pass.
- **The `/dev/scale` harness** — the most valuable testing asset in the repo. It seeds
  40 guards × 15 sites × 14 days of punches (covering late, no-show, forgot-to-clock-out,
  early-out-with-note, stat holiday, adjusted, and overnight scenarios), runs them
  through the **real** payroll, rounding, OT, paystub, and punch-state code, and asserts
  **18 invariants** on the page — green banner or red failures. It caught the overnight
  shift bug. Use it after any payroll or scheduling change.
- `/dev/admin`, `/dev/admin-scale`, `/dev/roster`, `/dev/client` are auth-free visual
  harnesses (DEV builds only) for headless screenshots.

---

## 9. The three commercial plans mapped to features

The three plans below are the commercial packaging. **The important thing to understand
is that no entitlement system exists yet** — see [§10](#10-gap-analysis).

### STANDARD — *"See your patrols + get reports"*

**$99.99/month · $959.90/year** (20% off — saves $240)

| Promised | Status | Where it lives |
|---|---|---|
| Guard check-in at each patrol point (time + location logged) | **[BUILT]** | `/guard/scan`, GPS trigger |
| Patrol history on phone/computer, anytime | **[BUILT]** | `/client`, `/admin/site/:id` |
| Monthly patrol report (PDF of all checkpoints hit) | **[PARTIAL]** | On-demand PDF export exists; **no scheduled monthly delivery** |
| Incident reports (guards log problems + attach photos) | **[BUILT]** | `/guard/incident`, `/admin/incidents` |
| Email alerts if a guard misses a patrol or is late | **[BUILT]** | `roster-alerts`, 10-min cron |
| Email support | Business process | — |

### PREMIUM — *"See everything + full control"*

**$149.99/month · $1,439.90/year** (20% off — saves $360)
Everything in Standard, plus:

| Promised | Status | Where it lives |
|---|---|---|
| Live accurate clock in/out timestamps, real-time | **[BUILT]** | `/admin/live-clock`, `/admin/shift-clock` |
| Live view: watch patrols happen in real-time | **[BUILT]** | `LiveFeed`, Supabase Realtime |
| Guard hours log | **[BUILT]** | `/admin/payroll` Guard hours tab |
| Schedule management | **[BUILT]** | `/admin/roster` (drag-drop, templates, recurrence, publish) |
| Daily operations email before 9 AM | **[BUILT]** | `ai-daily-digest`, 07:00 ET cron |
| ↳ guards on duty + hours worked | **[BUILT]** | `get_admin_summary_data` |
| ↳ patrols completed / checkpoints hit | **[BUILT]** | " |
| ↳ incidents filed with summaries | **[BUILT]** | " |
| ↳ coverage gaps | **[BUILT]** | " |
| ↳ quick stats (total patrols, compliance %) | **[BUILT]** | " |
| **Detailed incident reports with 10 selectable types** | **[NOT BUILT]** | Free-text only — no `incident_type` column |
| Each report: timestamp, location, photos, notes | **[BUILT]** | `incident_reports` |
| **Weekly summary emails** | **[NOT BUILT]** | Only a *daily* digest exists |
| Phone + email support | Business process | — |

The ten incident types promised: Trespassing · Maintenance required · Property damage ·
Suspicious activity · Noise complaint · Unauthorized access · Emergency/medical ·
Parking violation · Vandalism · Other (custom).

### MAX — *"Automatic payroll + accounting sync"*

**Pricing: TBD** — *not specified; the source spec was cut off at "Pricing:".*
Everything in Premium, plus:

| Promised | Status | Where it lives |
|---|---|---|
| Daily operations email (same as Premium) | **[BUILT]** | `ai-daily-digest` |
| Automatic paystubs (hours calculated from app, no manual timesheets) | **[BUILT]** | `/admin/payroll` Paystub tab, `src/lib/paystub.js` |
| Canadian deductions built-in (taxes, EI, CPP automatic) | **[PARTIAL]** | **EI + CPP built.** Federal/provincial **income tax withholding is NOT** |
| **Sync to QuickBooks** | **[NOT BUILT]** | Zero integration code |
| **Also syncs with ADP, Dayforce, Wagepoint, Xero, Sage** | **[NOT BUILT]** | Zero integration code |
| Service invoicing (extra coverage, call-outs) | **[BUILT]** | `/admin/payroll` Invoice tab, `src/lib/invoice.js` |
| Accounting CSV for your accountant | **[BUILT]** | `buildAccountingCsv` |
| Priority support (same-day) | Business process | — |

---

## 10. Gap analysis

**What must be built before these plans can be sold as written.** Ordered by commercial
risk — the first item is the biggest, because without it the plans cannot be enforced at
all.

### 🔴 P0 — Blocking

**1. There is no plan / entitlement system.** A search for `plan`, `tier`,
`subscription`, `entitlement`, `feature_flag`, `stripe`, `billing`, and `checkout` finds
**no commercial code at all** — the only matches are Supabase realtime `.subscribe()`
calls. Today every admin sees every feature. Selling three tiers requires:

- A `subscriptions` or `plan` column/table keyed to the org or site
  (`standard | premium | max`), with admin-only RLS.
- A `usePlan()` hook plus a `<Gated feature="…">` wrapper, and nav filtering in
  `Layout.jsx`.
- **Server-side enforcement.** Hiding a nav item is not entitlement — the RLS policies
  and edge functions must also check the plan, or a Standard customer can call the
  payroll endpoints directly.
- Billing (Stripe or equivalent) with monthly/annual SKUs and the 20% annual discount,
  plus upgrade/downgrade and dunning handling.

**2. MAX pricing is undefined.** The source spec was truncated. Needs a decision.

### 🟠 P1 — Promised in a paid tier, not built

**3. QuickBooks + other payroll/accounting sync (Max).** The headline feature of the
most expensive plan. Start with Phase 1 vendor-shaped CSVs from
[§6.4](#64-how-to-build-it-recommended-architecture) — that's genuinely quick and lets you
sell "works with QuickBooks" honestly — then build OAuth sync for QuickBooks Online and
Xero, which are the two easiest real APIs.

**4. Incident type taxonomy (Premium).** Add `incident_type` to `incident_reports` via a
new migration, with a check constraint over the ten categories, a picker on
`/guard/incident`, and type filters/badges on `/admin/incidents` and `/client/incidents`.
This is a small, high-visibility win — probably the best effort-to-value ratio on this
list.

**5. Weekly summary emails (Premium).** `ai-daily-digest` already has the whole pattern.
A weekly variant is largely a date-range change plus a second cron entry.

**6. Scheduled monthly patrol report PDF (Standard).** The PDF generation exists; what's
missing is a monthly cron that renders and **emails** it. Note this is the *only*
deliverable in the entry-level plan that isn't fully shipped, so it's worth doing before
launch.

**7. Income tax withholding (Max).** "Canadian deductions built-in (taxes…)" currently
means EI and CPP only. Either build federal + provincial withholding (plus CPP2, annual
maximums, vacation accrual, ROE, T4), or delegate tax to the connected payroll provider,
or soften the marketing claim. **Recommendation: delegate.** Sending verified hours to
ADP/Wagepoint and letting them compute tax is far cheaper and moves the compliance
liability off your books.

### 🟡 P2 — Product completeness

8. **iPhone NFC** requires the Capacitor wrap (Core NFC). Until then iOS guards can't tap
   tags — a significant field limitation given iPhone share.
9. **Live guard map** is "last known position," not continuous tracking; background
   geofencing needs the native wrap.
10. **Email deliverability**: Resend is still sandboxed on `onboarding@resend.dev`, so
    mail only reaches the account owner's inbox. Verify `send.prodsec.ca` (DNS records at
    **Bell Canada Hosting** — the nameservers are *not* at Vercel, never move them) and
    set the `SCHEDULE_FROM` / `INCIDENT_REPORT_FROM` secrets. **Every email feature in
    every plan depends on this one-time step.**
11. **Custom domain** — `app.prodsec.ca` CNAME → Vercel.
12. `alert_events` should surface on `/admin/alerts` instead of being email-only.
13. Web push notifications (open-shift broadcasts, patrol reminders) — needs the native
    wrap for full iOS fidelity.

---

## 11. Quick capability checklist

**Verification** — NFC checkpoints · server-side GPS geofence validation · pass/fail with
measured distance · NFC UID binding · multi-floor altitude logic · offline scan queue with
preserved timestamps · immutable audit trail · auditable manual overrides.

**Scheduling** — drag-drop roster · templates · recurrence (weekly/biweekly/monthly) ·
overnight shifts · conflict + overtime warnings · draft→publish with `.ics` calendar
emails · race-safe open-shift claim · shift confirmation · guard timesheet sign-off ·
copy-last-week.

**Attendance** — geofenced clock-in · clock-out from anywhere · early-out reason capture ·
admin force clock-out · manual adjustments (never overwriting punches) · statutory
holidays · traffic-light guard state · instant portal-wide lock · clean shift handoffs.

**Payroll & billing** — nearest-15 rounding · weekly regular/OT split · period OT
threshold · EI + CPP deductions with CRA per-period exemption proration · Dayforce-style
paystubs with Current + YTD · all-guard batch paystubs · service invoicing with HST ·
accounting CSV · daily CSV · hours PDF. *Direct QuickBooks/ADP/Xero sync: not built.*

**Visibility** — live scan feeds · live guard map (last known) · client coverage view ·
per-site operating hours · read-only client portal · CSV/PDF exports everywhere ·
compliance percentages.

**Automation** — late/no-show/stale-patrol alerts on a 10-minute cron · missed-checkpoint
detection on a 30-minute cron (idempotent, queryable completion rates and repeat-offender
patterns) · daily ops digest at 07:00 ET to both admins and clients · alert digest ·
schedule + incident emails · deterministic (non-hallucinating) ops assistant · realtime
subscriptions · offline-first guard app. *No weekly or monthly job exists.*

---

*SecurePatrol / Kratos — Productive Security Inc. (prodsec.ca)
Document verified against the codebase on 2026-07-30.*
