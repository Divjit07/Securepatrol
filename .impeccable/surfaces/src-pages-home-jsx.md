---
version: 1
slug: "src-pages-home-jsx"
primary_target: "src/pages/Home.jsx"
related_targets: ["src/components/home/ReportSheet.jsx","src/components/home/PaperCanvas.jsx"]
---

## Scope

Public marketing homepage at `/` (`src/pages/Home.jsx`), served to unauthenticated
visitors only — signed-in users still redirect to their portal from `HomeRedirect`.
Visitor mode: **Persuade**.

## Audience and job

Owner-operators and ops managers of small-to-mid security guard companies (~10–300
guards), evaluating software while running a live operation. Their job: win and keep
contracts without adding office headcount. Direct competitor studied: guardowlco.com.

Action: book a demo. Secondary: sign in.

## Proof and content constraints

Product demonstration only, by the owner's decision. No customer names, logos,
testimonials, user counts, or benchmarks — none exist and none may be authored.

**Pricing reversed 30 Jul 2026 by the owner.** The surface previously carried no dollar
figures because no rate card existed. There is one now: Standard / Premium / Max at
$99.99 / $149.99 / $199.99 CAD monthly, annual at 20% off, seven-day free trial with no
card. Every annual total is 12 x monthly less 20% and every stated saving is that
difference — if one figure changes, all four on that plan change together. Demonstration records are authored at full
fidelity and labeled synthetic on the surface. Face recognition must never appear (removed
from the product); push and the native app are roadmap, not shipped.

## Chosen direction

**The Client Report** — the page is the proof document a guard company hands its client.
Surface seed key `d8a7b9a7`, assigned index 6 of the ordered grounded list, staged in the
inherited Dark Ops world. The rut it refuses: the category page (navy hero, gradient pill,
logo wall, `/01` feature strip, floating phone mockup).

Memorable moment: a real sheet of warm client stock standing in the operator's dark room,
lit in WebGL with a genuine curl, writing itself one GPS-verified scan at a time until the
VERIFIED stamp sets. Paired later by the "one record, two sides" section, where the dark
console and the light report show the same event — including the same raised alert.

The alert row is a deliberate content decision: the sample report shows a late round, so
the page proves the record is evidence rather than a rubber stamp.

## Unresolved

- `DEMO_HREF` in `Home.jsx` is a placeholder `mailto:` and needs the real demo destination.
- No Privacy / Terms / Cookie pages exist; the footer deliberately omits legal links until
  they do.
- Brand name diverges on purpose: this surface says "Kronus", `src/lib/brand.js` says
  "Kratos".
