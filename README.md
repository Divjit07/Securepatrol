# SecurePatrol

NFC-based guard patrol verification system built as a Progressive Web App (PWA).

Guards scan NFC tags (or QR codes) at physical checkpoints. GPS coordinates are captured at scan time and verified using the Haversine formula — scans more than 20 metres from the checkpoint are rejected.

## Tech Stack

- **Frontend:** React (Vite) + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Hosting:** Vercel (free tier)
- **Scanning:** Web NFC API + html5-qrcode fallback

## Quick Start

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Open the **SQL Editor** and run the full contents of `supabase/schema.sql`
3. Go to **Authentication → Users** and create your admin account
4. In the SQL Editor, promote yourself to super admin:

```sql
UPDATE profiles SET role = 'super_admin', name = 'Your Name' WHERE id = '<your-user-id>';
```

5. Copy your project URL and anon key from **Settings → API**
6. Run `supabase/migrations/002_security_hardening.sql` in the SQL Editor (server-side GPS verification)
7. Run `supabase/migrations/005_checkpoint_delete_and_realtime.sql` (fix checkpoint delete + scan joins)
8. Run `supabase/migrations/006_client_role.sql` (client read-only portal)
9. Run `supabase/migrations/007_gps_floor_hardening.sql` (multi-floor altitude + tighter GPS radius)
10. Run `supabase/migrations/008_gps_indoor_tolerance.sql` (indoor GPS tolerance — run after 007)
11. Run `supabase/migrations/009_upper_floor_altitude_fix.sql` (fix upper-floor iPhone scans — run after 008)
12. Run `supabase/migrations/010_lobby_stack_detection.sql` (block ground-floor scans of upper-floor checkpoints — run after 009)
13. **Authentication → Sign In / Providers → Email** — disable public signup if available; only admins should create guard accounts

### Deploy guard creation (Edge Function)

Guard accounts are created server-side so admins stay logged in:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy create-guard
```

Your project ref is the ID in your Supabase URL: `https://YOUR_PROJECT_REF.supabase.co`

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with your admin account.

### 4. Deploy to Vercel

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
4. Deploy

## Setup Workflow

1. **Create a Site** — Admin dashboard → New Site
2. **Add Floors** — Checkpoint Manager → Add Floor
3. **Create Checkpoints** — Set GPS coordinates (use "Use my current GPS" while standing at the tag location)
4. **Write NFC Tags** — See [docs/NFC_SETUP.md](docs/NFC_SETUP.md) for full iPhone guide  
   **Multi-floor sites:** read [docs/MULTI_FLOOR_SETUP.md](docs/MULTI_FLOOR_SETUP.md) before placing upper-floor labels
5. **Print QR Codes** — Click the QR icon next to any checkpoint as a fallback
6. **Add Guards** — Guard Manager → create accounts (requires Edge Function deployed)
7. **Guards scan** — Guards log in on their phone, tap NFC tags, GPS is verified server-side

### Add a client login (read-only patrol view)

Clients see scan compliance for one site — which checkpoints were scanned during a shift (e.g. 11am–8pm), live feed, and scan history. They cannot edit anything.

1. **Authentication → Users → Add user** — create the client account (enable Auto Confirm)
2. Get your site ID from **Table Editor → sites**, or run:

```sql
SELECT id, name FROM sites;
```

3. Promote and link the client to their site:

```sql
INSERT INTO profiles (id, name, role, site_id)
SELECT id, 'Client Name', 'client', '<site-uuid>'
FROM auth.users
WHERE email = 'client@company.com'
ON CONFLICT (id) DO UPDATE
SET role = 'client', name = EXCLUDED.name, site_id = EXCLUDED.site_id;
```

4. Client signs in at your app URL → lands on **Patrol Overview**

## Security

- **Server-side GPS verification** — Database trigger recalculates distance and sets pass/fail; guards cannot fake scans via browser devtools
- **Row Level Security** — Guards only see their assigned site
- **Scan immutability** — Scan records cannot be edited or deleted after insert
- **Admin-only guard creation** — Edge Function uses service role; admin session is preserved

Run `supabase/migrations/002_security_hardening.sql` if you set up before this update.

## NFC Tag Setup (iPhone)

Full step-by-step guide: **[docs/NFC_SETUP.md](docs/NFC_SETUP.md)**

Quick version:
1. Create checkpoint in app → copy UUID (copy icon)
2. Open **NFC Tools** → Write → Add record → **Text** → paste UUID → Write
3. Hold iPhone on sticker until "Write successful"
4. Stick tag at checkpoint, test scan as guard

## User Roles

| Role | Access |
|------|--------|
| Super Admin | All sites, full management |
| Admin | Own sites only |
| Guard | Scan checkpoints at assigned site |
| Client | Read-only patrol compliance for assigned site (shift view + live feed) |

## PWA Installation (Guards)

On iPhone Safari: tap **Share → Add to Home Screen**. The app opens fullscreen without the browser bar.

## Project Structure

```
src/
  pages/          # Login, Guard app, Admin dashboard
  components/     # NFCScanner, QRScanner, CheckpointCard, LiveFeed
  lib/            # supabase, gps (Haversine), offlineQueue
  hooks/          # useAuth, useRealtime
supabase/
  schema.sql      # Database tables + RLS policies
public/
  manifest.json   # PWA manifest
  sw.js           # Service worker for offline support
```

## Offline Scans

When a guard scans without internet, the scan is saved to localStorage with the original timestamp. When connectivity returns, scans sync automatically to Supabase.

## License

Private — Confidential
