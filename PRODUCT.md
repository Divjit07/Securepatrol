# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (marketing surface):** owner-operators and operations managers of small-to-mid
security guard companies (roughly 10–300 guards). They are evaluating software while
running a live operation — reading on a phone between callouts, or at a desk while a
shift is uncovered. Their job: win and keep contracts without adding office headcount.

**In-product users (three role-gated portals):**
- **Admin** — company owner/office admin. Manages sites, guards, clients, checkpoints;
  builds schedules (Roster); runs payroll; approves scans; monitors alerts.
- **Guard** — field guard on a phone. Clocks in by scanning an NFC/QR checkpoint, walks
  patrol rounds, views schedule, claims open shifts, files incident reports, signs timesheets.
- **Client** — building owner/property manager. Read-only: scan history, who is on duty,
  coverage schedule, guard hours, incidents, PDF exports.

## Product Purpose

Kronus proves that guards actually patrolled the building, then turns that proof into
hours, payroll, and client-facing reports without manual office work. Success is a
security company that can show a client verifiable patrol evidence and bill from the
same record it verified.

## Positioning

The mechanism a neighboring product cannot truthfully copy: **a patrol scan is a
physically-anchored, GPS-validated event, and every downstream number derives from it.**
A checkpoint is a real NTAG NFC sticker or printed QR label mounted in the building. A
scan only counts when the guard's device is within ~20 m of the checkpoint's recorded
coordinates. Clocking in is not a button — it is a pass scan on a `shift_clock_in`
checkpoint. Raw punches are immutable; rounding and overtime are derived views, never
written back over the raw record. So the chain from "someone walked Level 3 at 02:14" to
"this line on the invoice" is one unbroken, auditable record.

## Operating Context

- Physical layer: NTAG NFC stickers + printed QR labels mounted at checkpoints in
  buildings; multi-floor sites supported.
- Guards work nights, alone, on personal phones, often with poor connectivity — there is
  an offline scan queue that syncs later.
- Automated watch: a 10-minute cron raises late, no-show, and stale-patrol alerts.
- Scheduling ritual: build a roster as a draft, then publish — publishing emails guards
  `.ics` calendar invites. Open shifts can be claimed by guards (race-safe).
- Payroll ritual: 15-minute rounding, overtime split, accounting CSV export, guard
  timesheet sign-off.
- Client ritual: building owners log into a read-only portal and export PDFs.

## Capabilities and Constraints

**Live capabilities:** three role-gated portals · QR + NFC + GPS-validated scanning ·
offline scan queue · shift clock via clock-in checkpoints · manual time adjustments +
stat holidays · incident reports with photo attachments, email delivery, and PDF ·
Roster (drag-drop scheduling, templates, recurrence, conflict detection, draft→publish
with .ics emails) · open-shift claim · shift confirmation · late/no-show/stale-patrol
auto-alerts · payroll (15-min rounding, OT split, accounting CSV) · timesheet sign-offs ·
client coverage view · per-site operating hours · realtime updates.

**Technical constraints:** React 19 + Vite 8, JSX (no TypeScript in app code), Tailwind
v4 with tokens in an `@theme` block in `src/index.css`, Supabase (Postgres + RLS, Auth,
Storage, Realtime, Edge Functions), Resend for email, jsPDF for exports, lucide-react for
icons. All page routes must stay lazy-loaded in `src/App.jsx`. No test suite and no
linter — changes are verified with `npm run build` plus browser screenshots.

**Explicitly not a capability — must never be claimed:** face recognition / Face ID
clock-in was designed and then removed from the product entirely. Web push notifications
and the native iOS wrap are roadmap, not shipped.

**Pricing (set by the owner):** Standard / Premium / Max at $99.99 / $149.99 / $199.99 CAD
a month, 20% off yearly, 7-day free trial with no card — priced per company, not per guard.

## Brand Commitments

- **Marketing voice (owner, Nov 2026):** the homepage speaks to non-technical guard-company
  owners in the plainest words, benchmarked on guardowlco.com's clarity, on a light paper
  page with real interactive demos. "Smart" and "automated" are allowed; "AI" is not (the
  product has none). Buzzwords only when the feature exists.
- **Kronus is the only brand** (kronus.space), in the app (`src/lib/brand.js`) and on every
  public surface. Productive Security Inc. is a *client*: its name, logo and `prodsec.ca`
  never appear in UI, PDFs, exports or email. The iOS bundle is `space.kronus.app`.
- Mark: the Kronus rider (`src/components/home/RiderMark.jsx`, a CSS mask over
  `currentColor`), ink on paper and lime on dark.
- Incumbent app visual world ("Dark Ops"): dark olive-black canvas `#1c1f1a`, raised
  surfaces `#272b25`, lime primary accent `#96ee60`, secondary greens/pastels, no drop
  shadows. Tokens live in `src/index.css`.
- Do not touch `prodsec.ca` nameservers or MX records.

## Evidence on Hand

- **Real:** the working product itself — three portals, live schema, edge functions. The
  interface at work is the only first-party proof available, and it is strong.
- **Deliberately absent, must not be fabricated:** no customer names, no client logos, no
  testimonials, no user counts, no hours-saved or accuracy benchmarks, no press, no case
  studies. The homepage ships with product demonstration only; its savings calculator uses
  the visitor's own numbers with editable assumptions.
- Demonstration data on marketing surfaces is authored by design and labeled synthetic;
  commercial claims are never authored.
- Prices shown are the owner's rate card above; never invent other figures.

## Product Principles

1. **The scan is the source of truth.** Every claim, number, and report traces back to a
   GPS-validated physical scan; nothing downstream may be asserted without it.
2. **Raw records are immutable.** Derived views (rounding, overtime) never overwrite what
   actually happened — auditability outranks convenience.
3. **Proof is the product.** The reason a security company buys this is to show a client
   evidence, so evidence must always be exportable and client-legible.
4. **Built for the night shift.** Field use assumes one guard, one phone, bad signal,
   low light — offline tolerance and one-handed operation are requirements, not polish.
5. **Never claim what is not shipped.** Roadmap items and removed features stay out of
   product language entirely.

## Accessibility & Inclusion

Guards operate one-handed on personal phones at night; touch targets and low-light
contrast are functional requirements. `text-ink-3` in the token set is decorative-only
because it does not meet body-text contrast. Motion must respect
`prefers-reduced-motion`.
