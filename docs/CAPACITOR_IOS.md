# Shipping Kronus to the App Store (Capacitor / iOS)

The web app is wrapped with **Capacitor** — a native iOS shell that loads the
built web app (`dist/`) bundled inside it. `appId` is **`space.kronus.app`**,
display name **Kronus**. This guide takes you from a clean Mac to a TestFlight
build and an App Store submission.

> Everything in **§0 Prerequisites** and every step marked **(you)** must be done
> by the account owner on the Mac — they need Xcode, your Apple Developer account,
> and signing. The Capacitor config, scripts, and web build are already wired.

---

## 0. Prerequisites (one-time)

1. **Apple Developer Program** — enrolled. ✅
2. **Xcode** — install the *full* Xcode from the Mac App Store (~15 GB). CLI
   tools alone are **not** enough. Then:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   sudo xcodebuild -runFirstLaunch
   xcodebuild -downloadPlatform iOS     # simulator + SDK
   ```
   ✅ Done Nov 16 2026 (Xcode 27.2, macOS 27.2.1).
   Then in Xcode → **Settings → Accounts → +**, sign in with your Apple ID.
3. **CocoaPods is NOT needed** — Capacitor 8 uses Swift Package Manager
   (`ios/App/CapApp-SPM/Package.swift`); Xcode resolves packages itself.

---

## 1–3. Native project, permissions, icon — ✅ DONE (committed in `ios/`)

- `ios/` generated with `npx cap add ios` (SPM, plugins: splash-screen, status-bar).
- `ios/App/App/Info.plist` has the usage strings: **location when-in-use**
  (clock-in/out geofence), **camera** and **photo library** (incident report
  photos), plus `ITSAppUsesNonExemptEncryption = false` (HTTPS only — skips the
  export-compliance prompt on every upload).
- App icon: `resources/icon-1024.png` → `Assets.xcassets/AppIcon` (single 1024
  asset; Xcode derives all sizes).
- Splash: Kronus rider centred on `#0d110c` (`Assets.xcassets/Splash`, same
  colour on the LaunchScreen storyboard). It stays up until the web app has
  painted its first frame — `src/main.jsx` calls `SplashScreen.hide()` —
  with a 3s cap in `capacitor.config.json` so a JS failure can't strand it.
- **UIScene lifecycle (required on iOS 27):** apps built with the iOS 27 SDK
  that don't adopt scenes crash on launch (`EXC_BREAKPOINT` in
  `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). Capacitor
  8's template predates this, so `SceneDelegate.swift` + the
  `UIApplicationSceneManifest` in Info.plist (storyboard `Main`) were added by
  hand; URL / universal-link opens are forwarded to `ApplicationDelegateProxy`
  there. Keep them if `ios/` is ever regenerated.
- Inside the app (`isNativeShell()` in `src/lib/native.js`) the sign-in
  screen drops "Back to kronus.space" — there is no marketing site in the wrap.

Any time the web code changes, re-bundle it into the app with:
```bash
npm run cap:sync         # build + copy dist into ios
```

If you later add background patrol tracking, that needs
`NSLocationAlwaysAndWhenInUseUsageDescription` and an App Review justification.

---

## 4. Open in Xcode & sign (you)

```bash
npm run cap:open         # opens ios/App/App.xcodeproj in Xcode
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
2. Platform **iOS**, name **Kronus** *(see the name note below)*, primary
   language, bundle ID **`space.kronus.app`** (register it under *Certificates,
   Identifiers & Profiles → Identifiers* first if it's not in the dropdown), and
   an SKU (any unique string, e.g. `kronus-ios-01`).

> **Name check:** App Store *listing* names must be unique. If "Kronus" is taken,
> use e.g. **"Kronus Workforce"** or **"Kronus Patrol"** — the home-screen name
> under the icon stays "Kronus".

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
  (app functionality) — Kronus doesn't sell or track data, so it's a short form.
- **Sign-in for review:** because the app is login-gated, provide App Review a
  **demo guard account** (email + password) in the "App Review Information" notes,
  or they'll reject it as "can't access the app".
- Set **Manually release** (or auto), then **Add for Review → Submit**.

Review is typically **24–48h**. Common rejections to preempt: missing demo login
(§9), missing permission strings (§2), or "just a website" (§10 mitigates this).

---

## 10. Why this passes the "not just a web page" rule (4.2)

Apple rejects thin website wrappers. Kronus is fine because it uses real device
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
| `npm run build:app` | Build the app into `dist/` for iOS (no marketing prerender) |
| `npm run build` | Web deploy build: app + prerendered homepage (don't use for iOS) |
| `npx cap add ios` | Create the native iOS project (once) |
| `npm run cap:sync` | Build + copy web into iOS + update plugins |
| `npm run cap:copy` | Build + copy web into iOS (no plugin changes) |
| `npm run cap:open` | Open the project in Xcode |
