# Design

<!-- impeccable:design-schema 1 -->

## The world

**Dark Ops.** The product is used at night, by one guard alone on a phone, and by an
office admin watching coverage on a desktop before dawn. The ground is a dark olive-black
that reads as a room with the lights down, not as a black void — surfaces are *raised*
into it rather than drawn on it. One saturated lime carries every signal. Nothing glows
for decoration.

The second material in this world is **paper**. Everything the product hands to a
building owner — QR labels, patrol PDFs, payroll exports — stays light, on warm white
stock. Dark is the operator's side of the record; paper is the client's side. That
opposition is the brand's own logic and the marketing surface is built on it.

## Tokens (authoritative: `@theme` block in `src/index.css`)

Base dark layer, refined per `data-theme` on `<html>` (`day` is the product default and is
a *light* theme; `night` is near-black; the guard portal defaults to `night`):

| Role | Value |
|---|---|
| canvas | `#1c1f1a` |
| surface / surface-2 | `#272b25` / `#343a31` |
| inset | `#151814` |
| paper | `#f7f6f2` |
| accent (primary, lime) | `#96ee60` — exposed as `--color-accent-orange` for legacy reasons; it is lime, not orange |
| moss / meadow / sky | `#7fd09f` / `#ecfab5` / `#d9f0ff` |
| alert red | `#ef4444` |
| ink / ink-2 / ink-3 | `#f4f6f1` / `#b6bdb0` / `#8b9284` |

`ink-3` is decorative-only — it does not meet body contrast. Hairlines come from the
`--hairline` / `--hairline-strong` `color-mix` variables, never from raw `white/10`.
Depth is hairlines and raised fills; there are **no drop shadows** in app chrome.

Legacy `--color-navy-*`, `--color-gold-*`, `--color-brand-5xx` tokens exist for
un-migrated screens. Do not use them for new work.

## Type

- Display: **Instrument Sans** (`--font-display`)
- Body: **DM Sans** (`--font-sans`)
- Measurement: the mono stack (`--font-mono`, SF Mono → JetBrains → Menlo). Reserved for
  data, timestamps, coordinates, IDs, and money — never as a "technical" costume.

## Marketing surface — extension

The public homepage (`/`, `src/pages/Home.jsx`) is the one **Persuade** surface. It
inherits Dark Ops and adds three things the app does not need:

**1. Its own fixed palette, independent of `data-theme`.** The theme boot script in
`index.html` sets `data-theme="day"` (light) for every non-`/guard` path, so a marketing
page built on `canvas`/`surface` tokens would render light and lose the world. The
homepage therefore owns `--kr-*` variables scoped to its root and never reads the theme
tokens. Values are the deep end of the same olive family:

| Role | Value |
|---|---|
| `--kr-void` (page ground) | `#0f1209` |
| `--kr-ground` | `#151a10` |
| `--kr-raise` | `#1d2417` |
| `--kr-edge` / `--kr-edge-strong` | olive-tinted hairlines |
| `--kr-lime` | `#96ee60` |
| `--kr-paper` / `--kr-paper-ink` | `#f7f6f2` / `#171a12` |

**2. A display face with a point of view: Archivo.** Instrument Sans is the app's UI
voice; it has no register for an *official document*. Archivo's lineage is print and
archival document setting, and its width axis gives the stamped, filed-record voice the
page's thesis depends on. It is used for display and document headers only — DM Sans keeps
the body, and the mono stack keeps all measurement. Loaded in `index.html` beside the
existing faces.

**3. Color strategy: Committed.** Warm paper is not an accent here — it owns 30–50% of
several viewports as a real material field, lit in 3D. Lime stays a signal: verification,
the primary action, live state. Alert red appears only where the product actually raises
an alert.

## Motion

One authored moment, not scattered effects: **the record assembling itself.** A scan
lands, GPS resolves, the stamp sets, the chain draws. GSAP ScrollTrigger with `scrub`
drives it; at most two pinned sections on the page. Content is visible by default and
never depends on JS to be readable. Easing is exponential ease-out. Everything collapses
to a static, fully-legible page under `prefers-reduced-motion`.

## Truth rules for this surface

- No customer names, logos, testimonials, user counts, or performance benchmarks. None
  exist; none may be authored.
- No prices. Pricing is scoped-on-contact.
- Demonstration data (sites, guards, timestamps, coordinates) is authored at full fidelity
  and **labeled synthetic on the surface itself**.
- Never imply face recognition, push notifications, or a native app — removed or roadmap.
- The product name on this surface is **Kronus**; `src/lib/brand.js` stays `Kratos`.
