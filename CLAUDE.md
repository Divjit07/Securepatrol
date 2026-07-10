# SecurePatrol

Security-workforce management app (guard patrol verification, scheduling, payroll) for
Productive Security Inc. Three role-gated portals in one React app: **admin** (sidebar
shell), **client** (sidebar shell, read-only), **guard** (dark mobile top bar).

**Read `docs/PROJECT_GUIDE.md` before non-trivial work** — it documents every page,
button, data table, edge function, the design system tokens, and the roadmap.

## Stack
React 19 + Vite 8 (JSX, no TS in app code) · Tailwind v4 (tokens in `src/index.css`) ·
Supabase (Postgres/RLS/Auth/Realtime/Edge Functions, project `vktxadadhnrcuxtubzxr`) ·
Resend email · jsPDF · lucide-react. Routes lazy-loaded in `src/App.jsx`.

## Commands
- `npm run dev` → localhost:5173 · `npm run build` (must pass — no tests/linter exist)
- Edge fn deploys: `npm run deploy:client-functions | deploy:schedule-function | deploy:alerts-function`

## Hard rules
- ⚠️ **NEVER `supabase db push`** — remote migration history is empty (002–024 applied
  manually); it would re-run every migration. New migrations = numbered file in
  `supabase/migrations/` + owner runs it in the Supabase SQL editor.
- Don't touch `prodsec.ca` nameservers/MX (company email lives at Bell Canada Hosting).
- Emails: senders/recipients from env vars only; resend.dev sandbox only delivers to owner.
- Keep raw clock punches immutable — payroll rounding/overtime are derived, never stored over raw.
- ALL portals use the **Dark Ops** design system (canvas #1A1A1E, surface cards,
  orange/cyan accents, white pill CTAs, no drop shadows, `.dk-*` + dark-redefined `sp-*`
  classes — tokens in `src/index.css`, full spec in guide §6 + the two UI spec docs).
  Printables (QR labels, PDFs) stay light. `text-ink-3` is decorative-only (contrast).

## Verifying changes
No test suite: verify with `npm run build` + headless browser screenshots.
Auth-free visual harnesses: `/dev/roster` and `/dev/admin` (DEV builds only).
Playwright browsers are cached at `~/Library/Caches/ms-playwright`; install the package
in a temp dir. macOS shell has no `timeout` — poll with `for` + `curl`.
