# SecurePatrol — Resume & Product Context

> Use this for resume bullets, LinkedIn, interviews, and pitch notes.
> Last updated: 2026-07-10. Vision items below are planned — not built yet.

---

## One-liner

Built an in-house security workforce platform (patrol verification, scheduling, payroll) for Productive Security Inc.; planning to productize it as multi-tenant SaaS with an AI admin agent for reports and paystubs.

---

## What I built (shipped / live)

**SecurePatrol** — full-stack workplace ops platform for a security company. Live in production (e.g. 800 Bathurst). Three role-gated portals in one React app:

| Portal | Audience | What it does |
|--------|----------|--------------|
| **Admin** | Owner / office | Sites, guards, clients, checkpoints, drag-drop roster, payroll reports, scan approval, alerts |
| **Guard** | Field staff (mobile) | NFC/QR + GPS clock-in & patrol scans, schedule, open-shift claim, incidents, timesheet sign-off |
| **Client** | Building owners | Read-only: who’s on duty, scan history, coverage, hours, incidents, PDF/CSV exports |

### Core capabilities
- **Patrol proof**: QR + NFC checkpoints with GPS validation (~20 m); offline scan queue; realtime live feed
- **Scheduling**: week roster (drag-drop), templates, recurrence, conflict detection, draft → publish with .ics email
- **Workforce ops**: open-shift claim (race-safe), shift confirm, late / no-show / stale-patrol alerts (cron)
- **Payroll**: immutable raw punches; 15-min rounding + weekly OT derived; accounting CSV; timesheet approvals
- **Incidents**: photo attachments, email to admin, PDF export
- **Multi-site / multi-floor** sites with printable branded QR labels

### Stack I own end-to-end
- **Frontend:** React 19, Vite, Tailwind v4, React Router, PWA-style mobile guard UX
- **Backend:** Supabase (Postgres, RLS, Auth, Realtime, Storage, Edge Functions)
- **Integrations:** Resend (email), jsPDF, Web NFC / camera QR, Vercel hosting
- **Ops:** schema migrations, edge function deploys, role-based access, design system (“Dark Ops”)

### Resume-ready bullets (pick / trim)
- Designed and shipped a production security workforce platform with admin, guard, and client portals — patrol verification, scheduling, and payroll in one product.
- Built GPS-validated QR/NFC checkpoint scanning with offline queue and realtime compliance dashboards for admins and building clients.
- Implemented drag-drop weekly roster with publish workflow, calendar invites, open-shift claiming, and automated late/no-show/stale-patrol alerts.
- Built payroll reporting from immutable clock punches (15-min rounding, overtime split, CSV/PDF exports) without overwriting raw time data.
- Owned full stack: React SPA, Supabase (RLS + Edge Functions), email automation, and Vercel deployment for live multi-site use.

---

## What’s next (planned — not built)

### 1. AI admin agent (inside the platform)
In-app AI assistant for admins that can:
- Answer natural-language questions about operations (“Who was late this week?”, “Hours for Guard X at Site Y”)
- Generate and pull **reports** (patrol compliance, coverage, incidents)
- Generate / retrieve **paystubs** and payroll summaries from existing punch + OT logic
- Act as an **agent**: multi-step tasks (query data → summarize → export PDF/CSV → email) with admin auth and audit trail

Positioning: AI co-pilot for the office, not a chatbot bolted on — grounded in SecurePatrol’s live data (scans, shifts, payroll, incidents).

### 2. Scale in-house → SaaS
Today: single-tenant in-house software for Productive Security Inc.  
Next: multi-tenant **SaaS** for other security / workforce companies:
- Org / tenant isolation (data + auth + billing)
- Self-serve onboarding, roles, and site setup
- Usage or seat-based pricing
- White-label / branding options (optional later)

### 3. Product roadmap already on the board (supporting SaaS + field)
- Face / biometric clock-in + geofence hardening
- Web push + Capacitor native wrap (iPhone NFC, Face ID, background geofence)
- UI polish across remaining admin/client surfaces

---

## How to say it in interviews

> “I built SecurePatrol as in-house software for our security company — guards prove patrols with GPS-checked scans, admins run roster and payroll, clients get a read-only portal. Next I’m adding an AI agent so admins can ask for reports and paystubs in natural language, and packaging the product as multi-tenant SaaS so other companies can run the same platform.”

---

## Keywords (ATS / LinkedIn)

React · Vite · Tailwind · Supabase · PostgreSQL · RLS · Edge Functions · Realtime · Auth · Payroll · Workforce management · Scheduling · GPS · PWA · SaaS · Multi-tenant · AI agent · RAG / tool-calling (planned) · Vercel · Full-stack
