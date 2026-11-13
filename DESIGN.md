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

## Marketing surface — extension (paper world, Nov 2026)

The public homepage (`/`, `src/pages/Home.jsx`) is the one **Persuade** surface. By the
owner's call (Nov 2026) it is a **light paper world**, benchmarked against
guardowlco.com's clarity: plain words for non-technical guard-company owners, real
interaction, no metaphor to decode. It does not read the app's `data-theme` tokens; it owns
its palette in `src/marketing/marketing.css`, scoped to `.mk` (plain CSS, not Tailwind, so the
prerendered static page and the React render are identical).

| Role | Token | Value |
|---|---|---|
| Page ground | `--paper` | `#f4f3ec` |
| Alternate band | `--paper-2` | `#ebe9df` |
| Sheets, cards, frames | `--sheet` | `#ffffff` |
| Ink (headings, primary button, device frames) | `--ink` | `#141810` |
| Body / muted text | `--ink-2` / `--ink-3` | `#3e4535` / `#5d6453` (both ≥4.5:1 on paper) |
| Live signal, highlighter, featured CTA | `--lime` | `#96ee60` |
| Lime as text on paper | `--lime-deep` | `#2f6a0c` |
| Closing band (demo + footer), featured plan | `--night` | `#10150c` |
| Late alert | `--amber` / `--amber-wash` | `#8f4705` / `#fdf0d8` |

- **Color strategy: day and night.** The page alternates paper (what the office and client
  see) with night (`.mk-dark`: what the guard lives through) — night photo strip, the
  flashlight patrol, the demo close. The GPS map stays on paper (owner's call). The old-way/Kronus section is night until
  Kronus is switched on, then turns to paper. `.mk-dark` only remaps tokens, so every
  component works in both. Lime is a signal and owns two paper fields: the headline
  highlighter and the calculator answer. Never lime text on paper — use `--lime-deep`.
- **Imagery:** illustrative night-shift photography in `public/marketing/night-*.webp` /
  `day-*.webp` (labelled illustrative). Never a guard wearing "Kronus" branding — Kronus is
  software, not a guard company.
- **Type:** Archivo for display (h1 ≤3.75rem, tracking ≥ -0.038em), DM Sans for body (17px).
  Both are the incumbent brand faces.
- **Primary action:** ink pill with a lime arrow ("Book a free demo"). Secondary: outlined
  pill. On the dark band and featured plan: lime pill.
- **Depth:** hairlines (`--line`) for structure; offset soft shadows (`--device`) only on
  things that are objects — phones, browser frames, sheets, alerts.
- **No:** eyebrows on every section (only the hero eyebrow pill), numbered section labels,
  gradient text, glass, "AI" anywhere.

## Motion

Motion explains the product; nothing animates just because it scrolled into view.

- **Signature interactions:** the hero live shift; the night scroll story (pinned; scroll is
  the clock 22:02 → Friday, photos cross-fade, each moment shows what the office/client sees,
  clickable time rail, and at 08:40 the section turns from night to day); the guard tour
  simulator (drag/tap tags onto a building cutaway → tap them to walk the guard round →
  the client report builds from your scans → send stamps it); the flashlight patrol (cursor/finger is the
  torch, tap tags, the client's screen fills, the lights come on at 5/5); the client-asks
  chat (bubble → typing → answer with proof, plays when on screen).
- **Focal moment — the live shift (hero):** a guard's phone reads an NFC tag (rings
  ripple), the scan lands at the top of the client portal feed, the checkpoint count and bar
  advance, and every few scans a late-guard alert rises and then clears. Pausable; stops
  off-screen, on hidden tabs, and entirely under reduced motion.
- **State changes:** old-way/Kronus switch (blur-crossfade, staggered 70ms per row, flips
  once by itself if untouched), step tabs (auto-advance with a 6s progress line until the
  reader picks one), tour tabs, GPS replay (trail draws stop by stop; slider + play),
  calculator (live numbers). Panels enter with a 0.5s fade-rise-unblur.
- Easing `cubic-bezier(0.16, 1, 0.3, 1)`. Content is complete and visible with JS off.

## Truth rules for this surface

- No customer names, logos, testimonials, user counts, or performance benchmarks. None
  exist; none may be authored. The savings calculator is the visitor's own numbers with
  editable assumptions, labelled an estimate.
- Prices are the owner's rate card (see the surface brief); keep annual = 12 × monthly − 20%.
- Demonstration data (sites, guards, times, map) is labelled sample data on the surface.
- Allowed buzzwords only when true: guard tour, GPS tracking, live/real-time, smart alerts,
  automated reports, all-in-one. Never "AI" (none exists). A patrol is proven by the TAP on
  the tag — never "GPS-validated scan" and no "GPS ✓" on a scan row. GPS verifies clock-in/out
  (geofence) and positions check-ins on the live map; never claim continuous in-vehicle
  tracking between stops.
- Never imply face recognition or push notifications. Brand on this surface: **Kronus**.
