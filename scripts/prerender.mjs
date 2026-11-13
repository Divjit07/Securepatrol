#!/usr/bin/env node
/**
 * Prerender the public homepage into static HTML (runs after `vite build` and
 * `vite build --ssr src/marketing/entry-server.jsx --outDir dist-ssr`).
 *
 * Why: the app is a client-rendered SPA, so crawlers and link previews used to
 * get an empty <div id="root">. Now kronus.space/ is real HTML — full copy,
 * meta tags and schema.org data — with ~5 kB of JS for the interactive bits.
 *
 * Output:
 *   dist/index.html  → the static marketing page (served for "/")
 *   dist/app.html    → the untouched SPA shell (vercel.json rewrites every other
 *                      route here; marked noindex)
 *   dist/sitemap.xml
 *
 * The Capacitor build (`npm run build:app`) skips this step, so the native app's
 * index.html stays the SPA shell.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const ssrDir = resolve(root, 'dist-ssr')
const ssrEntry = resolve(ssrDir, 'entry-server.js')

if (!existsSync(ssrEntry)) {
  console.error('prerender: dist-ssr/entry-server.js missing — run the SSR build first.')
  process.exit(1)
}

const { render, SITE, structuredData } = await import(pathToFileURL(ssrEntry).href)

// ---- Assets for the marketing entry, from the Vite manifest ---------------
const manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'))
const entryKey = 'src/marketing/entry-client.js'
const entry = manifest[entryKey]
if (!entry) {
  console.error(`prerender: ${entryKey} not in manifest — is it a build input?`)
  process.exit(1)
}
const css = new Set()
const collectCss = (key, seen = new Set()) => {
  if (seen.has(key)) return
  seen.add(key)
  const chunk = manifest[key]
  chunk?.css?.forEach((c) => css.add(c))
  chunk?.imports?.forEach((k) => collectCss(k, seen))
}
collectCss(entryKey)

// ---- Keep the SPA shell for every other route ------------------------------
const shell = readFileSync(resolve(dist, 'index.html'), 'utf8')
const appShell = shell.replace(
  '<meta charset="UTF-8" />',
  '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex" />',
)
writeFileSync(resolve(dist, 'app.html'), appShell)

// ---- The page --------------------------------------------------------------
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const url = `${SITE.url}/`
const ogImage = `${SITE.url}${SITE.ogImage}`
const jsonLd = JSON.stringify(structuredData()).replace(/</g, '\\u003c')
// React 19 hoists its own preload for the hero image into the markup; the head
// already declares it, so drop the duplicate.
const body = render().replace(/<link rel="preload" as="image"[^>]*\/>/g, '')

const html = `<!doctype html>
<html lang="en-CA">
  <head>
    <meta charset="UTF-8" />
    <script>
      // Signed-in users skip the marketing page and land in their portal.
      try {
        if (Object.keys(localStorage).some(function (k) { return /^sb-.+-auth-token$/.test(k) })) {
          location.replace('/app')
        }
      } catch (e) {}
      // Hold the headline highlighter back until the page script draws it in.
      // Safety valve: it always appears within 3s even if that script never runs.
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var h = document.documentElement
        h.classList.add('mk-arrive')
        setTimeout(function () { h.classList.remove('mk-arrive') }, 3000)
      }
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(SITE.title)}</title>
    <meta name="description" content="${esc(SITE.description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#f4f3ec" />
    <meta name="geo.region" content="CA-ON" />
    <meta name="geo.placename" content="${esc(SITE.city)}" />

    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
    <link rel="manifest" href="/manifest.json" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kronus" />
    <meta property="og:locale" content="en_CA" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(SITE.ogTitle)}" />
    <meta property="og:description" content="${esc(SITE.ogDescription)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Kronus security guard management software dashboard" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(SITE.ogTitle)}" />
    <meta name="twitter:description" content="${esc(SITE.ogDescription)}" />
    <meta name="twitter:image" content="${ogImage}" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Archivo:wght@600..800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap"
    />
${[...css].map((c) => `    <link rel="stylesheet" href="/${c}" />`).join('\n')}
    <script type="module" src="/${entry.file}"></script>
    <script type="application/ld+json">${jsonLd}</script>
    <style>html,body{margin:0;background:#f4f3ec}</style>
  </head>
  <body>
    ${body}
  </body>
</html>
`
writeFileSync(resolve(dist, 'index.html'), html)

// ---- Sitemap ---------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  resolve(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${url}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>
`,
)

rmSync(ssrDir, { recursive: true, force: true })
console.log(
  `prerender: dist/index.html (${(html.length / 1024).toFixed(1)} kB, ${css.size} css), dist/app.html, dist/sitemap.xml`,
)
