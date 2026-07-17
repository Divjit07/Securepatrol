# SecurePatrol — AI Features Build Roadmap

> A build plan written to be handed to **Claude Code** (or any coding agent) working
> inside this repo. It turns the "Kronus AI Feature Capsule" into concrete, ordered work
> mapped onto SecurePatrol's real Supabase schema, edge functions, and `src/lib` code.
>
> Read `docs/PROJECT_GUIDE.md` and `CLAUDE.md` first. This roadmap assumes that context.
> Last updated: 2026-07-15.

---

## 0. The one principle that governs everything

**The AI never computes. It only decides what to fetch, and how to phrase it.**

- Every hard number — hours, pay, deductions, checkpoint counts, distances, geofence
  pass/fail, "2nd miss this week" — is produced by SQL / existing `src/lib` code that is
  already correct. The model only turns already-correct data into sentences.
- The LLM's only jobs: (1) pick which backend function answers a request, (2) call it,
  (3) rephrase the returned facts. It must never be the source of a number.
- Practical test for every AI feature you build: *if you deleted the AI layer, would the
  numbers still be right?* The answer must always be yes.

If a task ever tempts you to let the model add, average, or count something — stop and move
that math into a SQL function or a `src/lib` helper instead.

---

## 1. Non-negotiable guardrails (from CLAUDE.md + the capsule)

1. **Never call Gemini from the browser.** All AI runs inside Supabase **edge functions**.
   The API key and the role-scoping stay server-side. This mirrors the existing rule that
   guard/client writes go through edge functions / `SECURITY DEFINER` RPCs, never direct
   client writes.
2. **Never `supabase db push`.** New schema = a new numbered file in `supabase/migrations/`
   (next number is **038** — 032–037 landed after this doc was first written). The owner runs
   it by hand in the Supabase SQL editor. Migration history on the remote is empty; a push
   would re-run everything.
3. **Role filtering is structural, not prompt-based.** The client-facing summary must call a
   SQL function that *never selects* payroll/HR columns. Do not build one shared query plus a
   prompt that says "don't mention pay to clients" — that leaks under a clever question.
4. **Read vs. write.** Read tools (`get_*`) may fire automatically from a chat message.
   Anything that creates or sends a real artifact (paystub, email) requires an explicit
   admin tap-to-confirm before it runs. A chat message alone must never trigger a real-world
   action.
5. **Keep raw punches immutable.** AI reads derived views; it never writes over raw scans.
6. **Design system.** Any new UI uses the Dark Ops tokens / `.dk-*` classes already in
   `src/index.css`. No new color systems.
7. **Data privacy.** Gemini free tier may train on submitted content. Fine for **test data
   only**. Before any real guard/client data flows through it, flip to the paid tier (cost is
   pennies at this volume). Put a `# TODO: paid tier before real data` note wherever the
   Gemini key is read.

---

## 2. What already exists — reuse, don't rebuild

Before writing anything, know these are done and correct:

| Capability | Where it lives | Reuse it for |
|---|---|---|
| Late / no-show / stale-patrol **detection** | `supabase/functions/roster-alerts/index.ts` (pg_cron every 10 min → `alert_events`) | Phase 1 — AI only rephrases existing events |
| Alerts already shown in UI | `src/pages/Alerts.jsx` + `src/lib/alertEvents.js` (`fetchAlertEvents`) | Phase 1 — attach narrative, don't rebuild the page |
| Hours / OT / rounding | `src/lib/payroll.js` | Chat tool `get_shifts_by_site` |
| Paystub PDF | `src/lib/paystub.js` | Chat tool `generate_paystub` (unchanged math) |
| Clock in/out derivation from scans | `src/lib/clientStats.js`, `src/lib/clockPunch.js` | Chat tool `get_clock_events` |
| Scan / checkpoint queries | `src/lib/scans.js` | Chat tool `get_patrol_checkpoints` |
| Schedule / shifts | `src/lib/schedule.js` | Chat tool `get_schedule` |
| Incident intake + email + attachments | `supabase/functions/submit-incident-report/index.ts`, `src/lib/incidentReports.js` | Phase 5 — hook priority/vision into this pipeline |
| Outbound email | Resend, via `RESEND_API_KEY` + `*_FROM` / `*_TO` env vars | Digest delivery (Phase 2/3) |

Edge-function auth pattern to copy exactly (both existing functions use it): create an
`adminClient` with `SUPABASE_SERVICE_ROLE_KEY` for privileged work, and a `userClient` with
`SUPABASE_ANON_KEY` + the caller's `Authorization` header to verify who's calling and their
`profiles.role` before doing anything.

---

## 3. New secrets (Supabase → Edge Functions → Secrets)

```
GEMINI_API_KEY=...              # required for every AI phase
# Reuse existing: RESEND_API_KEY, INCIDENT_REPORT_TO/FROM, SCHEDULE_FROM, ROSTER_ALERTS_TO,
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
```

Model: **`gemini-flash-latest`** for narrative/chat; **`gemini-flash-lite-latest`** for
high-volume cheap tagging (Phase 5a priority). Use the `-latest` aliases — pinned versions
(e.g. `gemini-2.5-flash`) get retired for new accounts and 404. Endpoint:
`https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=<GEMINI_API_KEY>`.

---

## 4. Shared building block — the Gemini helper (build in Phase 0, reuse everywhere)

Create `supabase/functions/_shared/gemini.ts`:

- `callGemini({ model, systemPrompt, userParts, temperature })` → returns text. `userParts`
  can include text and, for Phase 5b/5c, inline base64 image/audio parts.
- One place that reads `GEMINI_API_KEY`, sets the paid-tier TODO, handles non-200s, and caps
  output tokens. Every AI feature imports this — no feature talks to the Gemini REST API
  directly.

---

## 5. Build order (each phase ships independently)

Ordering logic: start where the backend already computes the facts (lowest risk), prove the
"SQL computes, AI phrases" loop on one-shot generation, then take on interactive
tool-calling, then media capture. Native app / push is **not** a dependency of any phase.

### Phase 0 — AI foundation (do once)

**Goal:** the plumbing every feature reuses.

**Build:**
- `supabase/functions/_shared/gemini.ts` (section 4).
- Migration `038_ai_role_scoped_summaries.sql` defining two `SECURITY DEFINER` SQL functions:
  - `get_admin_summary_data(p_site_id uuid, p_start timestamptz, p_end timestamptz)` — returns
    a JSON blob: checkpoints done/missed with guard names + times, gaps, clock events, late
    starts, repeat-miss counts, response-time deltas. Full detail.
  - `get_client_summary_data(p_site_id uuid, p_start timestamptz, p_end timestamptz)` — returns
    a **structurally reduced** JSON blob: coverage window, checkpoints confirmed / total, a
    count of "reviewed delays," staffing status. **Selects zero payroll/HR/guard-name columns.**
  - Both enforce that the caller owns / is assigned to the site (reuse `user_owns_site`,
    `get_user_site_id`).

**Acceptance:** calling `get_client_summary_data` as a client returns no names, no pay, no
per-guard rows — verified by reading the SQL, not by trusting a prompt.

**Verify:** `npm run build` passes; call each function from the Supabase SQL editor with a
real site id and eyeball the JSON shape.

> **Prompt for Claude Code:**
> "Create `supabase/functions/_shared/gemini.ts` exposing `callGemini(...)` reading
> `GEMINI_API_KEY` (add a `TODO: paid tier before real data`). Then write
> `supabase/migrations/038_ai_role_scoped_summaries.sql` with `SECURITY DEFINER` functions
> `get_admin_summary_data` and `get_client_summary_data` per section 5 Phase 0 — the client
> one must never select payroll, HR, or per-guard-name columns. Follow the migration
> conventions in CLAUDE.md; do NOT run `supabase db push`. Make `npm run build` pass."

---

### Phase 1 — AI-phrased alerts (lowest effort; detection already exists)

**Goal:** turn the already-correct `alert_events` rows into one plain-English line each, and a
short "state of the site" blurb — without recomputing anything.

**Build:**
- New edge function `ai-alert-digest`: reads open `alert_events` (same query shape as
  `fetchAlertEvents`), passes the rows to `callGemini` with a system prompt that ONLY rewords
  and groups them (e.g. "Alvarez is late at Tower A; this is his 2nd flag today"). The counts
  and "2nd" come from the rows, not the model.
- Surface the blurb at the top of `src/pages/Alerts.jsx` (Dark Ops card). Add a `src/lib`
  helper `fetchAlertNarrative()` that invokes the function.

**Acceptance:** the narrative names only events that exist in `alert_events`; deleting the AI
card leaves the existing alerts list fully intact.

**Verify:** build + headless screenshot of `/admin/alerts`.

> **Prompt for Claude Code:**
> "Add edge function `ai-alert-digest` that fetches open `alert_events` and uses
> `_shared/gemini.ts` to produce a short grouped narrative (rephrase only — never invent
> counts). Add `fetchAlertNarrative()` to `src/lib/alertEvents.js` and render the result in a
> Dark Ops card at the top of `src/pages/Alerts.jsx`. Build must pass."

---

### Phase 2 — Admin digest (one-shot narrative, read-only)

**Goal:** a scheduled detailed daily/weekly summary for admins.

**Build:**
- Edge function `ai-admin-digest`: for each site, call `get_admin_summary_data`, feed the JSON
  to `callGemini` with the "heavily detailed" admin prompt (exact names, times, gaps,
  repeat-offender flags, week-over-week response deltas), send via Resend (reuse
  `SCHEDULE_FROM` / `INCIDENT_REPORT_TO`).
- Schedule with pg_cron (copy the `roster-alerts-every-10min` pattern; daily, e.g. 07:00
  America/Toronto).
- Add a `deploy:ai-functions` script to `package.json` mirroring the existing deploy scripts.

**Acceptance:** digest content is all traceable to the `get_admin_summary_data` JSON.

**Verify:** invoke the function once manually; confirm the email renders and every number
matches the function output.

> **Prompt for Claude Code:**
> "Add edge function `ai-admin-digest` that loops the admin's sites, calls
> `get_admin_summary_data`, generates a detailed narrative via `_shared/gemini.ts`, and emails
> it through Resend using existing env vars. Add a pg_cron migration `039_ai_digest_cron.sql`
> modeled on the roster-alerts cron. Add a `deploy:ai-functions` npm script. Do not run db
> push."

---

### Phase 3 — Client digest (reuses Phase 2, swaps the data function)

**Goal:** the lighter, reassurance-oriented report — the competitive differentiator.

**Build:**
- Extend `ai-admin-digest` into a shared generator, or add `ai-client-digest`, that calls
  **`get_client_summary_data`** and uses the "light / reassurance" prompt (coverage confirmed,
  one thing worth knowing, no ops/HR detail). Deliver to the client contact.

**Acceptance:** run the same site through admin vs. client generation — client output contains
no guard names, no pay, no internal ops detail, because the data function never returned them.

**Verify:** diff the two outputs for the same site + period; confirm structural filtering.

> **Prompt for Claude Code:**
> "Add client digest generation using `get_client_summary_data` and a reassurance-tone prompt,
> reusing the Phase 2 email + cron plumbing. Confirm via the SQL function (not the prompt) that
> no sensitive columns can reach the client output."

---

### Phase 4 — Ops/payroll chat assistant (tool-calling; highest complexity)

**Goal:** ask-anything chat over the data, using function calling.

**Build:**
- Edge function `ai-chat`: implements a Gemini function-calling loop exposing these tools,
  each a thin wrapper over existing code / new SQL:
  - `resolve_guard(name_or_alias)` → **returns all matches** on ambiguity; never guesses.
  - `get_clock_events(guard_id, start, end)` → from `clientStats.js` / `clockPunch.js` logic.
  - `get_shifts_by_site(guard_id, start, end)` → from `payroll.js`.
  - `get_patrol_checkpoints(guard_id|site_id, start, end)` → from `scans.js`; flags misses/gaps.
  - `get_schedule(guard_id|site_id, start, end)` → from `schedule.js`.
  - `generate_paystub(guard_id, pay_period)` → **write action**: returns a confirmation token;
    the actual `paystub.js` generation only runs after an explicit admin confirm call.
- All tools re-check the caller's role/site server-side (never trust the model's arguments for
  authorization).
- Minimal Dark Ops chat panel (admin only to start — see section 6 decisions). Read answers
  stream back; a `generate_paystub` intent renders a **Confirm** button before anything runs.

**Acceptance:** "give guard B biweekly hours + a paystub" resolves B, reports hours from the
real functions, and *waits* for a tap before generating the PDF. An ambiguous name returns all
matches rather than picking one.

**Verify:** build; exercise the two capsule example flows end-to-end against seed data.

> **Prompt for Claude Code:**
> "Add edge function `ai-chat` implementing Gemini function-calling with the six tools in
> section 5 Phase 4, each wrapping existing `src/lib` logic or a new SECURITY DEFINER SQL
> function, re-checking caller role/site inside every tool. `generate_paystub` must be a
> two-step confirm (no auto-execute). Add an admin-only Dark Ops chat panel. Build must pass."

---

### Phase 5 — Incident intelligence (in this internal order)

**5a — Priority flagging (cheapest, immediate value).**
- Migration `040_incident_priority.sql`: add `priority text check (priority in
  ('routine','needs_review','urgent'))` + optional `priority_reason text` to `incident_reports`.
- In `submit-incident-report/index.ts`, right **after** the insert, call `_shared/gemini.ts`
  (Flash-Lite) to classify the description → update the row's `priority`. Never block the
  guard's submit on it; default `routine` if the call fails.
- Show a priority badge + sort in `src/pages/AdminIncidents.jsx` (Dark Ops pills).

**5b — Photo → report draft.**
- In `src/pages/GuardIncidentReport.jsx`, add "Draft from photo": send the attached image
  (base64 inline part) to `callGemini` (vision) → returns Loss-Prevention-format draft text the
  guard edits before submit. Reuse the existing attachment validation in `incidentReports.js`.

**5c — Voice-note report (last — input capture is the only hard part).**
- Record with the **`MediaRecorder` API** (works on iOS Safari, web + Capacitor). Do **not**
  use Web Speech / `SpeechRecognition` (broken in wrapped iOS contexts).
- Send the audio blob (inline part) to `callGemini` → transcribe + structure into report format
  → guard reviews before submit.

**Acceptance:** priority never blocks submission; photo/voice produce an editable draft, never
an auto-submitted report (guard always confirms).

**Verify:** build; submit a test incident and confirm the badge appears; draft-from-photo and
draft-from-audio populate the textarea without auto-sending.

> **Prompt for Claude Code:**
> "Phase 5a: migration `040_incident_priority.sql` adding a `priority` enum column to
> `incident_reports`; classify via `_shared/gemini.ts` after the insert in
> `submit-incident-report` (non-blocking, default routine); badge + sort in AdminIncidents.
> Then 5b photo-to-draft and 5c MediaRecorder audio-to-draft in GuardIncidentReport, both
> editable-before-submit. Build must pass."

---

## 6. Decisions baked in (change these if you disagree)

- **Digest delivery:** email via the existing Resend pipeline. Push notifications are deferred
  to the native/Capacitor migration (not required for any AI phase).
- **Who can chat:** admins only for v1. Widen to other staff later behind a `profiles` flag.
- **Model:** Gemini 2.5 Flash (narrative/chat), 2.5 Flash-Lite (priority tagging).
- **Tier:** free while on test data; flip to paid before real client/guard data — trivial cost,
  real confidentiality obligation.

---

## 7. Definition of done (every phase)

1. `npm run build` passes (no test suite exists — build + headless screenshots are the net).
2. No number in any AI output originates from the model — trace each to a SQL/`lib` source.
3. Client-facing output verified filtered at the **query** layer, not the prompt.
4. Any real-world action (paystub, send) sits behind an explicit confirm.
5. New schema is a numbered migration the owner runs manually — no `supabase db push`.
6. Secrets read from env; `TODO: paid tier` noted at the Gemini key.

---

## 8. Suggested sequencing for Claude Code sessions

Phase 0 → 1 in one session (foundation + fastest visible win). Phase 2 → 3 next (digests share
plumbing). Phase 4 alone (largest). Phase 5a, then 5b, then 5c as separate small sessions. Keep
each phase a separate PR/commit so a regression is easy to bisect.
