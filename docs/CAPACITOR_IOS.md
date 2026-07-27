# Shipping Kratos to the App Store (Capacitor / iOS)

The web app is wrapped with **Capacitor** — a native iOS shell that loads the
built web app (`dist/`) bundled inside it. `appId` is **`space.kronus.app`**,
display name **Kratos**. This guide takes you from a clean Mac to a TestFlight
build and an App Store submission.

> Everything in **§0 Prerequisites** and every step marked **(you)** must be done
> by the account owner on the Mac — they need Xcode, your Apple Developer account,
> and signing. The Capacitor config, scripts, and web build are already wired.

---

## 0. Prerequisites (one-time, ~1 hour incl. downloads)

1. **Apple Developer Program** — enrolled ($99/yr). You have this.
2. **Xcode** — install the *full* Xcode from the Mac App Store (~15 GB). CLI
   tools alone are **not** enough. Then:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   xcodebuild -runFirstLaunch
   ```
3. **CocoaPods** (installs the native pods Capacitor needs):
   ```bash
   brew install cocoapods        # or: sudo gem install cocoapods
   pod --version                 # confirm it works
   ```

---

## 1. Generate the native iOS project (you, once)

From the repo root:
```bash
npm run build            # produces dist/
npx cap add ios          # creates the ios/ Xcode project + runs pod install
```
This creates `ios/App/…`. Commit that folder — it's part of the repo.

Any time the web code changes, re-bundle it into the app with:
```bash
npm run cap:sync         # build + copy dist into ios + update pods
```

---

## 2. iOS permission strings (you, once)

The app asks for **location** (clock-in geofencing + checkpoint GPS) and the
**camera / photos** (incident report attachments). iOS rejects the build at
runtime — and App Review rejects the submission — if the usage strings are
missing. Open `ios/App/App/Info.plist` in Xcode (or edit the XML) and add:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Kratos uses your location to confirm you're on-site when you clock in and scan checkpoints.</string>
<key>NSCameraUsageDescription</key>
<string>Kratos uses the camera to attach photos to incident reports.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Kratos attaches photos from your library to incident reports.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Kratos saves generated reports and QR labels to your photos.</string>
```

(Location is **When In Use** only — the app does not track in the background.
If you later add background patrol tracking, that needs a separate
`NSLocationAlwaysAndWhenInUseUsageDescription` string and an App Review
justification.)

---

## 3. App icon & splash (you)

- **Icon:** a 1024×1024 PNG (no transparency, no rounded corners — iOS rounds it).
  In Xcode: `App/App/Assets.xcassets → AppIcon → drag in the 1024 image` (recent
  Xcode fills all sizes from the single asset).
- **Splash:** the config shows a solid `#0d110c` (the app canvas) for ~0.6s.
  Good enough to ship; a branded splash can come later.

---

## 4. Open in Xcode & sign (you)

```bash
npm run cap:open         # opens ios/App/App.xcworkspace in Xcode
```
In Xcode:
1. Select the **App** target → **Signing & Capabilities**.
2. **Team:** pick your Apple Developer team. Check **Automatically manage signing**.
3. **Bundle Identifier:** confirm it reads `space.kronus.app`.
4. Xcode creates the signing certificate + provisioning profile for you.

---

## 5. Test before submitting (you)

- **Simulator:** pick an iPhone simulator in Xcode, press ▶. Log in as a guard,
  confirm the dashboard, clock card, and scan screen render. (Note: the simulator
  fakes GPS — set a custom location via *Features → Location* to test the fence.)
- **Real device (recommended for GPS/camera):** plug in an iPhone, trust the Mac,
  select it as the run target, ▶. This is the only way to truly test clock-in
  geofencing and the camera.

Fix anything that misbehaves in the web app, then `npm run cap:sync` and re-run.

---

## 6. Create the app in App Store Connect (you)

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → +**.
2. Platform **iOS**, name **Kratos** *(see the name note below)*, primary
   language, bundle ID **`space.kronus.app`** (register it under *Certificates,
   Identifiers & Profiles → Identifiers* first if it's not in the dropdown), and
   an SKU (any unique string, e.g. `kratos-ios-01`).

> **Name check:** "Kratos" may collide with an existing App Store app/trademark
> (it's also a famous game character). App Store *listing* names must be unique.
> If it's taken, use a distinct listing name like **"Kratos Workforce"** or
> **"Kronus Patrol"** — the home-screen name under the icon can stay "Kratos".

---

## 7. Archive & upload (you)

In Xcode:
1. Set the run destination to **Any iOS Device (arm64)** (not a simulator).
2. Bump **Version** (e.g. `1.0.0`) and **Build** (`1`) in the target's General tab.
3. **Product → Archive**. When it finishes, the Organizer opens.
4. **Distribute App → App Store Connect → Upload**. Let Xcode manage signing.
5. Wait for the build to finish "Processing" in App Store Connect (~5–30 min).

---

## 8. TestFlight (you) — test on real phones before the public

1. App Store Connect → your app → **TestFlight**.
2. Add yourself / guards as **internal testers** (they install the TestFlight app
   and get the build). Great way to trial clock-in with real guards first.
3. First external testing round needs a light "Beta App Review".

---

## 9. Submit for App Store review (you)

App Store Connect → **App Store** tab → prepare the version:
- **Screenshots** (6.7" iPhone required): a few from the running app.
- **Description, keywords, support URL, privacy policy URL** (required — a simple
  hosted page is fine; you have kronus.space).
- **App Privacy:** declare **Location** (app functionality) and **Photos/Camera**
  (app functionality) — Kratos doesn't sell or track data, so it's a short form.
- **Sign-in for review:** because the app is login-gated, provide App Review a
  **demo guard account** (email + password) in the "App Review Information" notes,
  or they'll reject it as "can't access the app".
- Set **Manually release** (or auto), then **Add for Review → Submit**.

Review is typically **24–48h**. Common rejections to preempt: missing demo login
(§9), missing permission strings (§2), or "just a website" (§10 mitigates this).

---

## 10. Why this passes the "not just a web page" rule (4.2)

Apple rejects thin website wrappers. Kratos is fine because it uses real device
capabilities — **GPS geofencing** for clock-in/checkpoints and the **camera** for
incident photos — and is a genuine workforce tool, not a marketing site. Keep the
build **bundled** (not a remote-URL shell), which is what we configured.

---

## 11. After approval — instant JS updates without resubmitting (later)

Bundled means UI/logic changes normally need a new build + review. To get
Vercel-style instant updates for the **web layer**, add **Capgo** live-updates
(open-source OTA): it pushes a new `dist/` to installed apps on next launch, no
review — allowed by Apple 3.3.2 for JS/HTML/CSS as long as the app's purpose
doesn't change. Only **native** changes (new plugin, new permission, new icon)
then need a resubmit. Ask and I'll wire Capgo in.

---

## Quick command reference

| Command | What it does |
|---|---|
| `npm run build` | Build the web app into `dist/` |
| `npx cap add ios` | Create the native iOS project (once) |
| `npm run cap:sync` | Build + copy web into iOS + update pods |
| `npm run cap:copy` | Build + copy web into iOS (no pod changes) |
| `npm run cap:open` | Open the project in Xcode |
