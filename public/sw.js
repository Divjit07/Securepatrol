// v18 rewrite. The old worker cached EVERY GET — including Supabase API
// responses — into one unbounded cache (grew forever, served stale data on
// flaky networks) and answered any failed request with index.html, which
// turned a dropped JS-chunk fetch into a parse error / white screen.
//
// Rules now:
//  - Cross-origin (Supabase, fonts) is never intercepted — straight to network.
//  - Hashed build assets (/assets/*) are cache-first: immutable by filename.
//  - Page navigations are network-first with a cached index.html offline fallback.
//  - Everything else same-origin is network-first, cache fallback, and a failed
//    non-navigation request NEVER falls back to index.html.
const CACHE_NAME = 'securepatrol-v20'
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.svg',
  '/favicon-32.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)))
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

  // App navigations — fresh index.html when online, cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone))
          return response
        })
        .catch(() => caches.match('/index.html')),
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
