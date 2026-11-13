// v18 rewrite. The old worker cached EVERY GET — including Supabase API
// responses — into one unbounded cache (grew forever, served stale data on
// flaky networks) and answered any failed request with index.html, which
// turned a dropped JS-chunk fetch into a parse error / white screen.
//
// Rules now:
//  - Cross-origin (Supabase, fonts) is never intercepted — straight to network.
//  - Hashed build assets (/assets/*) are cache-first: immutable by filename.
//  - Page navigations are network-first with a cached shell offline fallback:
//    "/" is the prerendered marketing page (index.html); every other route is
//    the SPA shell (app.html, see scripts/prerender.mjs + vercel.json).
//  - Everything else same-origin is network-first, cache fallback, and a failed
//    non-navigation request NEVER falls back to index.html.
const CACHE_NAME = 'securepatrol-v21'
const SHELL_URLS = [
  '/',
  '/index.html',
  '/app.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.svg',
  '/favicon-32.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  // One at a time and forgiving: a build without app.html (e.g. build:app)
  // must not fail the whole install.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all(SHELL_URLS.map((u) => cache.add(u).catch(() => {})))),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // Supabase/fonts: hands off

  // Immutable hashed bundles — serve from cache, fill on first fetch.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return response
          }),
      ),
    )
    return
  }

  // Navigations — fresh page when online, the matching cached shell offline.
  if (request.mode === 'navigate') {
    const shellKey = url.pathname === '/' ? '/index.html' : '/app.html'
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(shellKey, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(shellKey).then((hit) => hit || caches.match('/index.html')),
        ),
    )
    return
  }

  // Other same-origin static files (manifest, icons).
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request)),
  )
})
