# SecurePatrol — Guard Patrol Verification System

**Product Requirements Document · v2.0 · June 2026**

| Field | Value |
|-------|-------|
| **Product** | SecurePatrol |
| **Version** | 2.0 (Production) |
| **Company** | Productive Security Inc., Greater Toronto Area |
| **Platform** | Progressive Web App (React/Vite) — no app store required |
| **Production URL** | https://prod-securepatrol.vercel.app |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **Hosting** | Vercel (free tier) |
| **Status** | Live — 800 Bathurst deployed |
| **Supersedes** | SecurePatrol_PRD.docx v1.0 (June 2025) |

---

## 1. Overview

SecurePatrol is a web-based guard tour verification system that uses **printed QR code labels** and **GPS location validation** to confirm security guards have physically visited assigned checkpoints on their patrol route.

Management gets a real-time dashboard showing patrol compliance. Property clients get a **read-only portal** showing which checkpoints were scanned during a shift — without seeing failed retry attempts.

### 1.1 What changed from v1.0

| v1.0 (original PRD) | v2.0 (current production) |
|---------------------|---------------------------|
| NFC tags as **primary** scan method | **QR codes as primary** (iPhone cannot scan NFC in web apps) |
| QR as fallback only | NFC still supported on **Android**; iPhone uses QR only |
| Admin + Guard roles only | Added **Client** role (read-only portal) |
| Map pin picker for GPS | **Manual Google Maps coordinates** (paste or GPS at tag) |
| Simple 20m radius | 20m base + indoor GPS tolerance + optional altitude check |
| Single-floor focus | **Multi-floor** sites (lobby through rooftop) |
| No branded labels | **Printable QR labels** with Productive Security branding |
| No site delete | Admins can **remove sites** from Overview |

### 1.2 The problem

Security companies have no reliable proof that guards walked every checkpoint. Guards could sit in the lobby and claim they patrolled every floor. Management has no audit trail; clients have no visibility.

### 1.3 The solution

1. Admin places **QR labels** at physical checkpoints (stairwells, exits, floors, rooftop).
2. Guard scans the QR with the SecurePatrol app on their phone.
3. App captures **GPS at scan time**.
4. **Server** recalculates distance and sets pass/fail — guards cannot fake scans in the browser.
5. Admin and clients see compliance in real time.

---

## 2. Scan method — QR first

### 2.1 Why QR, not NFC

Apple **does not allow Web NFC** in Safari/iPhone browsers. Guards on iPhone (the primary field device) **must use QR codes**.

| Device | Primary method | Notes |
|--------|----------------|-------|
| iPhone | **QR Code** | Camera scan via html5-qrcode |
| Android | NFC or QR | Web NFC API available; QR always works |

### 2.2 QR label workflow

1. Admin creates checkpoint in **Checkpoint Manager**.
2. Sets GPS coordinates from **Google Maps** (paste coordinates at exact label location).
3. Clicks **QR icon** → preview branded label.
4. **Print full label** or **Download full label (PNG)**.
5. Stick label on wall at that exact spot.
6. Guard scans QR → app opens checkpoint URL → GPS verified.

### 2.3 Branded label contents

Each printed label includes:

- **Header:** Site name (e.g. 800 BATHURST-DJ)
- **Subheader:** SecurePatrol · Productive Security Inc.
- **Floor** name
- **QR code** (encodes checkpoint URL)
- **Checkpoint name**
- **Footer:** Protected by Productive Security
- Hint: Scan with SecurePatrol guard app

NFC remains optional on Android: admin copies checkpoint UUID and writes to tag with NFC Tools.

---

## 3. How it works

### 3.1 One-time setup (admin)

1. Log in as **admin** or **super admin**.
2. **Create site** (Admin Overview → New Site).
3. **Add floors** (Checkpoint Manager → Add Floor).
4. **Add checkpoints** per floor with GPS from Google Maps satellite view.
5. **Print QR labels** and stick at each location.
6. **Add guards** (Guard Manager) and assign to site.
7. **Add clients** (Client Manager) for property owners — read-only access.

### 3.2 Guard patrol flow (every shift)

1. Guard opens SecurePatrol PWA (Add to Home Screen on iPhone).
2. Logs in → sees assigned site and checkpoint list.
3. Walks to checkpoint → opens **Scan** → selects **QR Code**.
4. Points camera at label → app reads checkpoint ID.
5. App captures GPS (multiple samples for best accuracy).
6. Scan sent to Supabase → **database trigger** validates distance.
7. **Pass:** green checkmark. **Fail:** clear message (too far, wrong floor, weak GPS).
8. Failed attempts are logged for **admin only** — not shown to clients.

### 3.3 Admin monitoring

- **Overview** — all sites, compliance %, guard assignments, delete site.
- **Site dashboard** — floor-by-floor checkpoint status (green/yellow/red for guards).
- **Live feed** — real-time scan stream.
- **Checkpoint Manager** — floors, checkpoints, rename, GPS, print QRs.
- **Guard Manager** — create/assign/remove guards.
- **Client Manager** — create read-only client logins.
- **Reports** — filter and export scan data.
- **Alerts** — missed-checkpoint notifications.

### 3.4 Client portal (property owners)

Clients (e.g. Amjad, Ali @ 800 Bathurst) see **one site only**.

| Tab | Content |
|-----|---------|
| **Scan History** | Successful check-ins only (no failed retries) |
| **Checkpoints** | Green/red cards per checkpoint for selected shift |

Features:

- Date and shift window picker (default 11:00–20:00).
- Compliance stats (checkpoints scanned, %, total scans).
- Live feed (passes only).
- Cannot edit anything.

---

## 4. GPS verification

### 4.1 Primary check — horizontal distance

Uses **Haversine formula** on server (PostgreSQL trigger):

| Input | Source |
|-------|--------|
| Guard location | Phone GPS at scan time |
| Checkpoint location | Admin-entered coordinates (Google Maps) |
| Allowed radius | 20m default + indoor tolerance from GPS accuracy |

**Pass** if distance ≤ effective radius. **Fail** if too far.

### 4.2 Multi-floor sites

Indoor GPS often reports the **same lat/lng** for different floors. Fix:

- Pin each upper-floor checkpoint at a **distinct map location** (window, far corner) — **not** stacked above lobby.
- Floor 2+ pins must be **≥ 20m** from lobby pins on the map.
- See `docs/MULTI_FLOOR_SETUP.md`.

### 4.3 Optional altitude check (upper floors)

When phone reports altitude **and** GPS accuracy ≤ 30m:

- Fail only if vertical difference **> 18m** (~5+ floors).
- Prevents extreme cross-floor spoofing without blocking legitimate scans.

Migration: `014_relax_altitude_check.sql`

### 4.4 Anti-spoofing

- Distance recalculated **server-side** — client cannot fake pass.
- Failed attempts logged (admin view).
- Row Level Security — guards only see their site.
- Scan records immutable after insert.

### 4.5 Offline

Scans queue in localStorage when offline; sync when connectivity returns. Timestamp preserved.

---

## 5. Technology stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Frontend | React (Vite) + Tailwind CSS | Guard, admin, client UIs |
| Hosting | Vercel | Auto-deploy from GitHub |
| Database | Supabase PostgreSQL | Sites, floors, checkpoints, scans |
| Auth | Supabase Auth | Login, roles |
| Realtime | Supabase Realtime | Live feed |
| QR scan | html5-qrcode | Camera-based scanning |
| QR print | qrcode.js + labelExport | Branded printable labels |
| NFC (Android) | Web NFC API | Optional tap-to-scan |
| GPS | Browser Geolocation + Haversine | Distance validation |
| Edge Functions | create-guard, create-client, etc. | Admin creates accounts without logout |

**Monthly cost:** $0 on free tiers.

---

## 6. User roles

| Permission | Super Admin | Admin | Guard | Client |
|------------|:-----------:|:-----:|:-----:|:------:|
| Create / delete sites | ✓ | Own sites | — | — |
| Manage floors & checkpoints | ✓ | Own sites | — | — |
| Print QR labels | ✓ | Own sites | — | — |
| Add / remove guards | ✓ | Own site | — | — |
| Add / remove clients | ✓ | Own site | — | — |
| Scan checkpoints | — | — | ✓ | — |
| View live dashboard | All | Own site | Own scans | — |
| Client portal | — | — | — | ✓ (one site) |
| Export reports | ✓ | Own site | — | — |
| Configure alerts | ✓ | Own site | — | — |

Enforced via **Supabase Row Level Security (RLS)**.

---

## 7. Application screens (implemented)

### 7.1 Guard app

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/login` | Email + password, role redirect |
| Dashboard | `/guard` | Site, progress, checkpoint cards |
| Scan | `/guard/scan` | QR (primary) / NFC (Android) |
| Scan result | `/guard/scan/result` | Pass/fail with distance and message |
| History | `/guard/history` | Today's scans |

### 7.2 Admin app

| Screen | Route | Description |
|--------|-------|-------------|
| Overview | `/admin` | Sites, guards, compliance, delete site |
| Site dashboard | `/admin/site/:id` | Per-site floors and status |
| Live feed | `/admin/site/:id/live` | Real-time scans |
| Checkpoints | `/admin/checkpoints` | Floors, checkpoints, QR print, rename |
| Guards | `/admin/guards` | Create, assign, remove |
| Clients | `/admin/clients` | Create read-only client logins |
| Reports | `/admin/reports` | Filter and export |
| Alerts | `/admin/alerts` | Missed-checkpoint config |

### 7.3 Client app

| Screen | Route | Description |
|--------|-------|-------------|
| Scan history | `/client` | Successful scans + live feed |
| Checkpoints | `/client/checkpoints` | Green/red compliance cards |

---

## 8. Database (Supabase)

Core tables: `sites`, `floors`, `checkpoints`, `guards`, `profiles`, `scans`, `alert_configs`, `alerts`.

Key checkpoint fields:

- `latitude`, `longitude` — from Google Maps
- `altitude_metres` — optional floor elevation
- `radius_metres` — default 20m
- `active` — soft delete

Key scan fields:

- `guard_lat`, `guard_lng`, `guard_altitude`, `gps_accuracy`
- `distance_metres` — server-calculated
- `status` — `pass` or `fail`
- `sync_method` — `realtime` or `offline_sync`

Migrations **001–014** in `supabase/migrations/` (run in order after `schema.sql`).

---

## 9. Production deployment

| Item | Value |
|------|-------|
| GitHub | Divjit07/Securepatrol |
| Branch | `main` |
| Vercel | Auto-deploy on push |
| Supabase project | vktxadadhnrcuxtubzxr |
| Live site example | 800 Bathurst-DJ |
| Client logins | amjad@800bathurst.com, ali@800bathurst.com |

---

## 10. Known limitations & future options

| Limitation | Workaround / future |
|------------|---------------------|
| iPhone cannot use NFC in browser | QR labels (current solution) |
| Indoor GPS drift | Distinct map pins per floor; 20m + accuracy bonus |
| 100% floor proof indoors | Bluetooth beacons per floor (future, ~$20/floor) |
| Tight lobby checkpoints | Separate map pins ≥ 20m apart |

---

## 11. Acceptance criteria (v2.0 — met)

- [x] Guard scans QR on iPhone within seconds of approaching checkpoint
- [x] Scan > effective radius rejected with clear message
- [x] Successful scan appears on admin dashboard within seconds (Realtime)
- [x] Client portal shows green compliance without failed retries
- [x] Multi-floor site (800 Bathurst) operational
- [x] Branded QR labels printable from admin
- [x] Admin can create guards and clients
- [x] Admin can remove sites
- [x] App works offline with sync
- [x] PWA installable on iPhone home screen
- [x] RLS enforces site isolation per role

---

## 12. Related docs

| Document | Path |
|----------|------|
| Setup & deploy | `README.md` |
| Multi-floor GPS | `docs/MULTI_FLOOR_SETUP.md` |
| NFC (Android optional) | `docs/NFC_SETUP.md` |
| Database schema | `supabase/schema.sql` |

---

*SecurePatrol PRD v2.0 · Productive Security Inc. · Confidential*
