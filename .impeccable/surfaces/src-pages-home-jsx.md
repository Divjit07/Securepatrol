---
version: 1
slug: "src-pages-home-jsx"
primary_target: "src/pages/Home.jsx"
related_targets: ["src/marketing/content.js","src/marketing/marketing.css","src/marketing/enhance.js"]
---

## Scope

Public marketing homepage at `/` (`src/pages/Home.jsx`, copy in `src/marketing/content.js`,
styles in `src/marketing/marketing.css`, behaviour in `src/marketing/enhance.js`). Prerendered
to static HTML for SEO by `scripts/prerender.mjs`. Signed-in visitors hop to `/app`.
Visitor mode: **Persuade**.

## Audience and job

Owners and ops managers of Toronto / Canadian guard companies (5–150 guards) who are not
technical. Job: keep contracts by proving patrols, stop payroll-by-text. Benchmark the owner
pinned: guardowlco.com (plain promise, one-line features, pains they already have).

Action: book a free demo (form → `demo_requests`, migration 051; mailto fallback).
Secondary: sign in, shop.

## Proof and content constraints

Product demonstration only — no customers, logos, testimonials, counts or benchmarks.
Pricing is the owner's rate card: Standard / Premium / Max at $99.99 / $149.99 / $199.99 CAD
monthly, yearly 20% off, 7-day free trial, no card; annual total = 12 × monthly − 20% and the
saving is that difference. Demos labelled sample data. Calculator = visitor's own numbers,
assumptions editable, labelled an estimate. Patrol proof = the tap; GPS claims limited to
geofenced clock-in/out, the live map of check-ins, breadcrumb trails, heat map — never
"GPS-validated scan", no continuous vehicle tracking.

## Chosen direction

**The live shift, on paper** (Nov 2026, owner-pinned; replaces the dark "Client Report"
direction). Category canon at full fidelity: light paper page, ink type, lime as signal and
highlighter, one dark closing band. Memorable moment: the hero's live demo — a guard's phone
reads a tag, the scan lands in the client's portal, a late alert rises and clears.

Owner feedback (Nov 2026): "all light feels soulless" → day/night rhythm + real
night-shift photography + more hands-on interaction.

Section order (L = paper, D = night): hero live shift (L) → module strip → one night at 800
Bay Street pinned scroll story (D → L at 08:40) → how it works hands-on simulator (L) → old way vs Kronus (D→L on
switch) → walk the round flashlight patrol (D) → product tour tabs (L) → your client asks
chat (L) → GPS replay map (L, owner: keep light) → savings calculator (L) → industries (L) → pricing (L) →
FAQ (L) → demo form + footer (D).

## Unresolved

- `hello@kronus.space` must be confirmed as a monitored inbox.
- Migration 051 must be run for leads to save (fallback is email).
- No Privacy / Terms pages yet; footer omits legal links until they exist.
- Keyword landing pages (guard tour app, GPS tracking, scheduling) not built yet.
