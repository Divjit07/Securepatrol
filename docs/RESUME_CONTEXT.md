# Kronus — Context Pack for Resume, LinkedIn & Interviews

> **Purpose:** paste this whole file into Claude (or any assistant) as context when
> writing resume bullets, LinkedIn copy, cover letters, or interview prep.
> Last updated: 2026-08-15.

---

## 1. Ownership & identity

- **Product:** Kronus (kronus.space)
- **Category:** B2B SaaS — workforce management for private security companies
- **Builder & owner:** Divjit Singh — **sole developer and owner.** Designed,
  architected, built, and shipped independently. No team, no agency, no
  co-founder engineer. Product design, UX, frontend, backend, database schema,
  security model, DevOps, branding, and marketing site are all mine.
- **Nature of the work:** a real commercial product with live users, not a
  tutorial project, bootcamp capstone, or clone.
- **Note:** Productive Security Inc. is a **customer** of Kronus, not the owner.
  Kronus is independently owned.

---

## 2. One-liner (use verbatim or adapt)

> Kronus is a B2B SaaS platform that proves security guards actually patrolled a
> building, then turns that proof into payroll and client-facing reports —
> replacing paper logbooks and unverifiable timesheets for security contractors.

**Shorter:** Sole developer of Kronus, a SaaS platform for security companies
that turns GPS-verified patrol scans into payroll and auditable client reports.

---

## 3. The problem it solves

Security companies bill clients for patrols nobody can prove happened. A guard
can sit in the lobby and claim they walked every floor. Management has no audit
trail; the client has no visibility; disputes over service delivery are
unwinnable because there is no record.

Kronus makes the physical patrol the source of truth: a scan only counts when
the guard's device is physically at a checkpoint mounted in the building, and
every number downstream — hours, payroll, invoices, client reports — derives
from that one verified event.

---

## 4. Product architecture: three role-gated portals, one app

| Portal | User | Purpose |
|---|---|---|
| **Admin** | Company owner / office staff | Sites, guards, clients, checkpoints, scheduling, payroll, monitoring, reporting |
| **Guard** | Field guard on a phone | Clock in/out, walk patrols, scan checkpoints, claim shifts, file incidents, sign timesheets |
| **Client** | Building owner / property manager | Read-only proof: who is on duty, patrol coverage, hours billed, incidents, PDF exports |

Access is enforced at the **database** layer with Postgres Row Level Security,
not in the UI — a client physically cannot query another site's data.

---

## 5. Feature inventory

### Patrol verification (the core mechanism)
- **Physical checkpoints:** NTAG NFC stickers and printed QR labels mounted in
  the building; multi-floor sites supported
- **GPS validation:** a scan passes only if the device is within ~20 m of the
  checkpoint's recorded coordinates; distance is recalculated **server-side** in
  a Postgres trigger so the client cannot fake a pass
- **Indoor GPS handling:** accuracy-based tolerance and optional altitude checks
  for multi-floor buildings
- **Offline scan queue:** guards work in basements and dead zones; scans queue
  in local storage and sync on reconnect with the original timestamp preserved
- **Patrol rounds:** automatic round detection and coverage percentage per site

### Scheduling
- Drag-and-drop weekly/biweekly roster builder
- Draft → publish workflow; drafts are invisible to guards until published
- Publishing emails guards `.ics` calendar invites
- Open shifts guards can claim (race-safe at the database level)
- Shift templates, recurrence, and conflict detection
- Cross-site rostering

### Time & payroll
- Clock-in/out via GPS geofence with NFC fallback
- **Immutable raw punches** — rounding and overtime are derived views, never
  written over the original record
- 15-minute rounding, overtime split, statutory holiday handling
- Admin time corrections stored as attributed adjustments (who changed what, when)
- Guard timesheet sign-off
- Accounting CSV export, PDF paystubs

### Client-facing proof
- Read-only portal: live duty status, patrol rounds, coverage, checkpoint hits
- Incident reports with photo attachments, emailed and exported as PDF
- Message board between office, client, and guards with one-way acknowledgements
  (a guard cannot un-see a standing order — it is an audit record)
- PDF and CSV export of the exact record the invoice was built from

### Operations & monitoring
- **God's Eye live map:** real-time guard positions, breadcrumb trails showing
  the *order* a round was walked, and a coverage heat map exposing which parts
  of a building never get patrolled
- Live activity feed with realtime updates
- Site geofence management

---

## 6. AI & automation features

**Important framing:** the intelligent behaviour in Kronus is **deterministic
automation, not a language model.** An LLM (Gemini) was integrated and then
**deliberately removed**. This is a defensible engineering decision, not a gap —
see §8.

### Automated monitoring engine
A scheduled job runs every 10 minutes against every published shift and raises
three classes of alert:
- **Late** — shift started, no clock-in
- **No-show** — escalation when still no clock-in
- **Stale patrol** — guard is clocked in but has not scanned a checkpoint within
  the site's configured patrol interval

Alerts are deduplicated so a single ongoing problem does not spam the office,
and are delivered as a batched email digest.

### Athena — the operations console
- **Editable alert intelligence:** the wording of every automated alert and
  digest is a template stored in the database with token substitution
  (`{guard}`, `{site}`, `{minutes}`), editable by the operator with live preview
  and validation — no redeploy needed to change what the system says
- **On-demand dispatch:** trigger the monitoring sweep or the daily digest
  immediately instead of waiting for the schedule
- **Broadcast:** push standing orders to the guard message board

### Natural-language assistant
An intent-matching assistant that answers operational questions ("who is on duty
at Bathurst?") by mapping natural language to a fixed set of live database
lookups and templating the answer from real records. It **cannot hallucinate a
number** — every value it returns came from a patrol record.

### Automated reporting
- Daily operations digest for admins, generated from the day's patrol records
- Coverage updates emailed to clients
- Automatic report assembly — reports build themselves from verified scans

---

## 7. Technical stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, lazy-loaded routes |
| Backend | Supabase — Postgres, Row Level Security, Auth, Realtime, Storage |
| Server logic | Postgres functions & triggers (SECURITY DEFINER), 10 Deno edge functions |
| Email | Resend (transactional: schedules, alerts, incidents, digests) |
| Documents | jsPDF (paystubs, invoices, patrol reports, QR labels) |
| Mapping | Leaflet with custom canvas layers |
| Mobile | Capacitor — native iOS and Android shells wrapping the web app |
| Hosting | Vercel, CI from GitHub |

**Scale of the codebase (as of Aug 2026):** ~32,000 lines across 157 source
files, 35 pages, 53 components, 49 database migrations, 10 edge functions, 165
commits since June 2026.

---

## 8. Engineering decisions worth discussing in interviews

These are the strongest talking points — they show judgment, not just output.

1. **Removing the LLM on purpose.** Gemini was integrated for the admin
   assistant and digests, then removed and replaced with deterministic intent
   matching and templating. Reason: the product's entire value is that its
   numbers are auditable. A model that can hallucinate a patrol time is a
   liability in a document a client might dispute contractually. Determinism was
   worth more than fluency.

2. **Server-side trust boundary.** GPS distance is recalculated in a Postgres
   trigger, not trusted from the client, because the person being measured is
   holding the device doing the measuring.

3. **Immutability as a design constraint.** Raw punches and scans are never
   overwritten. Corrections are additive, attributed adjustments. Derived views
   (rounding, overtime) sit on top. This is what makes the record defensible in
   a billing dispute.

4. **RLS as the authorization model.** Permissions live in the database, so a
   bug in the UI cannot leak another site's data.

5. **Offline-first for the real usage scene.** Guards work alone, at night, in
   basements, on personal phones with poor signal. The offline queue is a
   requirement, not polish.

6. **Recurring bug class caught and systematically fixed.** Site *operating
   hours* were being used as a stand-in for the actual rostered shift in several
   places, which silently hid real patrol activity and produced wrong labels and
   false "leaving early" prompts. Fixed by introducing a single shared
   time-window function and auditing every consumer.

---

## 9. Suggested resume bullets

Pick 3–5. Adjust seniority language to the role.

- Sole developer and owner of **Kronus**, a B2B SaaS platform for private
  security companies that converts GPS-verified patrol scans into payroll and
  auditable client reports; ~32k LOC across web and mobile.
- Designed a **tamper-resistant verification model** where checkpoint scans are
  validated server-side in Postgres triggers against physical GPS coordinates,
  making it impossible for a field user to forge proof of attendance.
- Built **three role-gated portals** (admin, guard, client) on a single React
  codebase, with authorization enforced by Postgres Row Level Security rather
  than UI logic.
- Implemented an **automated monitoring engine** that evaluates every active
  shift on a 10-minute schedule and raises deduplicated late, no-show, and
  stale-patrol alerts with batched email delivery.
- Built an **operator-editable alerting system** (Athena) that lets non-technical
  staff rewrite automated alert and digest copy through token templates with live
  preview, removing the need for a code deploy to change system messaging.
- Engineered an **offline-first mobile experience** with a local scan queue that
  preserves original timestamps and syncs on reconnect, for guards working in
  GPS and signal dead zones.
- Shipped **payroll infrastructure** with immutable raw time punches, derived
  rounding and overtime, attributed admin corrections, statutory holiday
  handling, PDF paystubs, and accounting CSV export.
- Packaged the web app as **native iOS and Android applications** using Capacitor
  and shipped to the **App Store and Google Play**.
- Deliberately **removed a generative AI integration** in favour of deterministic
  intent matching and templating, prioritising auditability of client-facing
  figures over conversational flexibility.

---

## 10. Interview soundbites

- *"The product exists because security companies bill for work nobody can
  prove happened. Kronus makes the physical scan the source of truth, and every
  number downstream derives from it."*
- *"I pulled the LLM out. If a number in a client's invoice can be hallucinated,
  the product doesn't work. Determinism beat fluency."*
- *"Authorization is in the database, not the UI. A frontend bug shouldn't be
  able to leak another building's patrol data."*
- *"Raw punches are immutable. Corrections are additive and attributed. That's
  what makes it hold up when a client disputes an invoice."*

---

## 11. What NOT to claim (accuracy guardrails)

Never state these — they are false and would not survive scrutiny:

- ❌ **Face recognition / Face ID clock-in.** Designed, then removed from the
  product entirely. Do not list it.
- ❌ **Named customers, logos, testimonials, user counts, revenue figures,
  hours-saved or accuracy benchmarks.** No verified figures exist. Do not invent
  metrics — describe capability, not adoption.
- ❌ **Team leadership / managing engineers.** Solo build.
- ❌ **Web push notifications.** Roadmap, not shipped.

---

## 12. STATUS FLAGS — read before sending anything out

These claims appear above but are **not true as of 2026-08-15**. Update this
section as they land, and until then either omit the bullet or soften it.

| Claim | Actual status |
|---|---|
| Shipped to the **App Store** | **In progress.** Capacitor is configured (`space.kronus.app`), the app icon and web build are ready, but Xcode is not yet installed, the native iOS project has not been generated, and nothing has been submitted to App Store Connect. |
| Shipped to **Google Play** | **Not started.** No Android platform has been added to the project yet — this is further out than iOS. |
| "Live users" / production deployment | The web app is deployed and in real use. That part is true. |

**Safe interim phrasing if asked today:** *"Packaged for iOS and Android with
Capacitor; App Store release in progress."* That is accurate, still demonstrates
the work, and cannot be contradicted.
