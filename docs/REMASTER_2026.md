# Kratos Remaster 2026 — "Apple Bento × Command Deck"

Source of truth for the Admin + Client visual remaster. Guard portal = **theme/
colour only** (layout stays). Everything here is **additive** to the existing Dark
Ops system — adopt page-by-page; nothing old breaks.

## Direction (approved by Div, 2026-07-28)
- **Skin = Apple Bento** (heavily): warm rounded tiles (28px radius), soft depth,
  tap-friendly on iPhone, colourful KPI faces (lime / sky gradients).
- **Data = Command Deck** (Linear/Vercel precision): crisp 1px hairline tables,
  **mono ops numerals** (`.num` → SF Mono on Apple, JetBrains/Menlo elsewhere),
  restraint. Colour is reserved for **status only** — lime = live/positive,
  amber = late, red = no-show. Everything else is graphite/ink.
- **Motion = Balanced**: one GSAP stagger reveal on mount (`useReveal`), number
  count-up (`AnimatedNumber`), ring draw-on, live-status pulse. No looping bg
  motion, no 3D (gated out). Always `prefers-reduced-motion` safe.

## Primitives (in `src/index.css`)
| Class | Use |
|---|---|
| `.bento` | Dark premium tile — big radius, hairline, top light-seam, hover lift (`.bento-interactive`) |
| `.bento-face` | Colourful KPI tile (light gradient face, e.g. `KPI_TONES.lime/.sky`) |
| `.num` | Mono ops numerals (tabular). Use on ALL data numbers |
| `.deck-eyebrow` | Uppercase tracked section label |
| `.deck-row` | Command-Deck table row (hairline top, quiet hover) |
| `.live-dot` | Green status dot with soft outward pulse |

Tokens: `--font-mono` (@theme). Reuse `KPI_TONES` (`src/lib/brandPalette.js`) for
tile faces, `AnimatedNumber` (`src/components/overview/widgets.jsx`) for count-up.

## Motion (in `src/lib/motion.js`)
`useReveal({ deps })` → returns a ref; add `data-reveal` to each child to stagger
it in on mount. Uses `useLayoutEffect` (no opacity flash) + reduced-motion snap.

## Reference implementation
`src/components/overview/OverviewBoard.jsx` — the Admin Overview flagship.
Preview auth-free at **`/dev/admin`** (mock data mirrors the production props).

## Rollout order
1. ✅ Admin Overview (flagship) — approved reference for the pattern.
2. Admin: Roster, Sites, Guards, Clients, Payroll, Reports, Alerts, Ops, Live Map,
   Checkpoints, Assistant, Incidents, Shift Clock, Approve, Summary, Site dashboard.
3. Client portal (read-only): Scan History, Coverage, Checkpoints, Reports, Incidents.
4. Guard portal: colour/background/theme only — keep the dark mobile layout.

## Guardrails
- Keep every page's data/props contract intact (visual-only changes).
- `npm run build` must pass; verify with `/dev/admin` screenshots at 390 + 1440.
- Printables (PDFs, QR/NFC labels) stay light — never bento them.
- Respect memory: search-first Overview was rolled back; keep the approved IA.
