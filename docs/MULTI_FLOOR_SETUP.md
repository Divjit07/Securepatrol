# Multi-Floor Buildings (800 Bathurst etc.)

GPS patrol apps cannot perfectly detect floors indoors. SecurePatrol uses a **layered approach**.

## What the app checks

1. **Horizontal distance** — are you near the checkpoint coordinates?
2. **GPS accuracy** — is the phone giving a usable signal?
3. **Altitude** — when the phone reports it, is it the right floor?
4. **Lobby stack detection** — if you scan an upper-floor checkpoint while your GPS matches the **lobby/ground-floor zone**, the scan fails.

## Critical setup rule for floors 2+

**Do not place upper-floor checkpoints directly above the lobby or elevator.**

| Bad placement | Good placement |
|---------------|----------------|
| Above main entrance | Far end of hallway |
| Next to elevator on floor 5 | Near exterior window |
| Same GPS as lobby | 25m+ away from lobby checkpoints |

When creating a floor 5 checkpoint:
1. Walk to the **far end** of the floor near a **window**
2. Stand where the QR label will be stuck
3. Tap **Use my current GPS location**
4. Confirm the app warns you if you're too close to lobby GPS

## Why ground-floor scanning was passing

Indoor phones report the **same latitude/longitude** for the lobby and floor 5 when you're in the vertical stack of the building. QR codes only encode the checkpoint ID — a guard with a printed label can scan from anywhere unless GPS rules block it.

Migration `010_lobby_stack_detection.sql` blocks upper-floor scans when GPS matches the lobby zone.

## If floor 5 scans fail for real guards

The checkpoint GPS is probably still in the lobby stack. **Re-capture GPS** at the window end of the hall.

## Techniques beyond GPS (for your boss)

| Technique | Cost | Works indoors? | Notes |
|-----------|------|----------------|-------|
| **QR at physical location only** | Free | Partial | Policy: never give guards loose printed QRs |
| **Lobby stack detection** (current) | Free | Good | Requires correct checkpoint placement |
| **GPS altitude** | Free | Poor on iPhone | Used when available |
| **NFC tags** | ~$10/30 tags | Good | Android guards only; iPhone needs QR |
| **Bluetooth beacons** | ~$20–40/floor | Excellent | Industry standard for indoor patrol |
| **Supervisor spot checks** | Staff time | Good | Random physical audits |

### Recommended long-term for high-rises

1. **Short term:** Lobby stack detection + checkpoint placement at window ends
2. **Medium term:** NFC stickers for Android guard phones
3. **Production grade:** One BLE beacon per floor (e.g. Minew i3, ~$15 each)

## Test procedure

1. Create lobby checkpoint first (floor 1)
2. Create floor 5 checkpoint at **window end of hall**
3. Scan floor 5 QR **from ground floor** → must **FAIL**
4. Scan floor 5 QR **on floor 5 at tag** → must **PASS**
