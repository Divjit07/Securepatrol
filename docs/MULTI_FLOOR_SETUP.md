# Multi-Floor GPS — The Real Fix

## The honest truth

**100% floor-proof verification with software-only GPS is not possible** inside concrete high-rises. iPhones do not reliably report altitude indoors.

| Approach | Reliability | Cost |
|----------|-------------|------|
| Phone GPS indoors | 60–80% | Free |
| **Manual Google Maps coordinates** | **85–95%** | Free |
| NFC tap (Android) | ~99% | ~$10/30 tags |
| Bluetooth beacon per floor | ~99% | ~$20/floor |

## The best free fix: Manual map coordinates

GPS only measures **horizontal position on a map**. Floors fail when lobby and floor 2 share the same map pin.

### The solution

Give each checkpoint **different map coordinates** from Google Maps satellite view:

| Floor | Where to pin on Google Maps |
|-------|----------------------------|
| Lobby | Main entrance |
| Floor 2 | Window or far corner of floor 2 — **not** above the lobby |
| Floor 5 | Window or far corner of floor 5 |

### Why this works

- Guard on **ground floor** → phone GPS near lobby pin → floor 2 checkpoint pin is 30–50m away → **FAIL (too far)** ✓
- Guard on **floor 2 at tag** → phone GPS near floor 2 pin → **PASS** ✓

No lobby heuristics. No altitude required. Just **distinct map pins**.

## Setup steps (per checkpoint)

1. Open **Google Maps** → find 800 Bathurst
2. Switch to **Satellite** view
3. Long-press the exact spot where the QR label will be stuck
4. Copy the coordinates (tap the numbers at the bottom)
5. In SecurePatrol **Admin → Checkpoints → Add checkpoint**:
   - Paste coordinates
   - Set altitude: floor 1 = `0`, floor 2 = `3.5`, floor 5 = `14` (or tap **Floor default**)
   - Radius: `20` metres
6. Print QR and stick label at that exact physical spot

## Rules

- Floor 2+ pins must be **at least 20m** from lobby pins on the map
- Stick QR labels **on the wall only** — never give guards loose prints
- If scans fail: re-pin on Maps at the exact label location

## If you need 100%

Add **Bluetooth beacons** (~$20 per floor). Guards must be in range of the floor beacon to complete a scan. Contact your developer when ready — this is a small hardware add-on.

## Run migration

After code deploy, run in Supabase SQL Editor:

```
supabase/migrations/012_manual_coords_validation.sql
```

This removes lobby heuristics and uses simple distance-to-checkpoint validation.
