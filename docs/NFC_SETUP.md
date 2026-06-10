# NFC Tag Setup Guide (iPhone)

This guide walks you through writing SecurePatrol checkpoint IDs to NFC sticker tags using your iPhone.

## What you need

- **iPhone 7 or newer** (NFC read/write supported)
- **NTAG213 / NTAG215 / NTAG216 NFC stickers** (cheap packs on Amazon — ~$10 for 30 tags)
- **NFC Tools** app (free) — [Download on App Store](https://apps.apple.com/app/nfc-tools/id1252962749)
- A checkpoint already created in SecurePatrol **Checkpoints** page

---

## Step 1 — Create the checkpoint in SecurePatrol

1. Log in as admin → **Checkpoints**
2. Add a **Floor** if you haven't yet
3. Click **Add Checkpoint**
4. Stand at the exact spot where you'll stick the tag
5. Click **Use my current GPS location**
6. Click **Create**

---

## Step 2 — Copy the checkpoint UUID

1. In the checkpoints table, find your new checkpoint
2. Click the **copy icon** next to the ID column
3. The full UUID is copied — looks like:
   ```
   a1b2c3d4-e5f6-7890-abcd-ef1234567890
   ```
4. Keep this in your clipboard (or paste into Notes temporarily)

---

## Step 3 — Write the UUID to the NFC tag

1. Open **NFC Tools** on your iPhone
2. Tap **Write** (bottom tab)
3. Tap **Add a record**
4. Choose **Text** (recommended — simplest)
5. Paste the **full checkpoint UUID** as the text
6. Tap **OK**
7. Tap **Write**
8. Hold your iPhone flat against the NFC sticker for 2–3 seconds
9. You'll see **"Write successful"**

### Alternative: URL record

Instead of Text, you can use **URL / URI** with:
```
https://your-app-url.com/checkpoint/PASTE-UUID-HERE
```
SecurePatrol reads both formats.

---

## Step 4 — Stick the tag at the checkpoint

1. Peel and stick the NFC tag on the wall at the checkpoint location
2. Place it somewhere guards can easily tap with their phone (chest height, near a door frame)
3. Avoid metal surfaces directly behind the tag (blocks NFC signal) — use a plastic holder or offset with foam tape if needed

---

## Step 5 — Test the scan

### On guard phone (iPhone) — use QR Code

**Important:** Apple does **not** support Web NFC in Safari or any iPhone browser. iPhone guards must use **QR Code** scanning.

1. Open **Safari** → go to your SecurePatrol URL
2. **Share → Add to Home Screen** (install as PWA)
3. Log in as a guard
4. Go to **Scan** → tap **QR Code** tab
5. Tap **Open QR Scanner** and allow camera access
6. Point at the printed QR code on the checkpoint
7. You should see **Scan Verified** (green) if you're within 20 metres of the checkpoint GPS

> Print QR codes from **Admin → Checkpoints** (QR icon next to each checkpoint) and stick them beside the NFC tag.

### On guard phone (Android) — NFC or QR

1. Open **Chrome** on Android
2. Log in as guard → **Scan** → **NFC Tag**
3. Tap **Start NFC Scan** and hold phone on the tag

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Write failed" | Hold phone still, remove case, try a new sticker |
| "NFC not supported" | Use Safari, add app to Home Screen, or use QR scan |
| "Too far from checkpoint" | Re-create checkpoint GPS while standing at the tag |
| Tag reads wrong ID | Re-write the tag in NFC Tools with correct UUID |
| Tag won't scan | Tag may be damaged — use a fresh sticker |

---

## Recommended tag placement checklist

- [ ] Tag written with correct UUID (verify in NFC Tools → Read)
- [ ] GPS set while standing at tag location
- [ ] Tag stuck at guard-accessible height
- [ ] Test scan passes within 5 metres
- [ ] QR code printed as backup (optional)

---

## Bulk setup tip

For many checkpoints:

1. Create all checkpoints in SecurePatrol first
2. Copy each UUID into a spreadsheet with location names
3. Write tags one by one in NFC Tools
4. Label each sticker with checkpoint name (Sharpie on back) before sticking
