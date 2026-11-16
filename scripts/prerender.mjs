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
 *   dist/<slug>/index.html → one static page per keyword landing page (pages.js)
 *   dist/sitemap.xml
 *
 * The Capacitor build (`npm run build:app`) skips this step, so the native app's
 * index.html stays the SPA shell.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

const { render, renderLanding, PAGES, SITE, structuredData, pageStructuredData } = await import(
  pathToFileURL(ssrEntry).href
)

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

// ---- Pages -----------------------------------------------------------------
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const ogImage = `${SITE.url}${SITE.ogImage}`
// React 19 hoists its own preload for the hero image into the markup; drop it.
const clean = (html) => html.replace(/<link rel="preload" as="image"[^>]*\/>/g, '')

// Signed-in users skip the homepage and land in their portal. Landing pages are
// pure marketing and never redirect.
const SIGNED_IN_HOP = `
      try {
        if (Object.keys(localStorage).some(function (k) { return /^sb-.+-auth-token$/.test(k) })) {
          location.replace('/app')
        }
      } catch (e) {}`

function pageHtml({ url, title, description, ogTitle, ogDescription, jsonLd, body, hop }) {
  const ld = JSON.stringify(jsonLd).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="en-CA">
  <head>
    <meta charset="UTF-8" />
    <script>${hop ? SIGNED_IN_HOP : ''}
      // Hold the headline highlighter back until the page script draws it in.
      // Safety valve: it always appears within 3s even if that script never runs.
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var h = document.documentElement
        h.classList.add('mk-arrive')
        setTimeout(function () { h.classList.remove('mk-arrive') }, 3000)
      }
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="author" content="${esc(SITE.owner)}" />
    <link rel="canonical" href="${url}" />
    <link rel="alternate" hreflang="en-ca" href="${url}" />
    <link rel="alternate" hreflang="x-default" href="${url}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
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
    <meta property="og:title" content="${esc(ogTitle)}" />
    <meta property="og:description" content="${esc(ogDescription)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Kronus security guard management software dashboard" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(ogTitle)}" />
    <meta name="twitter:description" content="${esc(ogDescription)}" />
    <meta name="twitter:image" content="${ogImage}" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Archivo:wght@600..800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap"
    />
${[...css].map((c) => `    <link rel="stylesheet" href="/${c}" />`).join('\n')}
    <script type="module" src="/${entry.file}"></script>
    <script type="application/ld+json">${ld}</script>
    <style>html,body{margin:0;background:#f4f3ec}</style>
  </head>
  <body>
    ${body}
  </body>
</html>
`
}

const written = []

// The homepage.
const home = pageHtml({
  url: `${SITE.url}/`,
  title: SITE.title,
  description: SITE.description,
  ogTitle: SITE.ogTitle,
  ogDescription: SITE.ogDescription,
  jsonLd: structuredData(),
  body: clean(render()),
  hop: true,
})
writeFileSync(resolve(dist, 'index.html'), home)
written.push({ path: '/', bytes: home.length, priority: '1.0' })

// One page per keyword, at /<slug> (served from dist/<slug>/index.html).
for (const page of PAGES) {
  const html = pageHtml({
    url: `${SITE.url}/${page.slug}`,
    title: page.title,
    description: page.description,
    ogTitle: page.title.replace(' | Kronus', ' — Kronus'),
    ogDescription: page.description,
    jsonLd: pageStructuredData(page),
    body: clean(renderLanding(page.slug)),
    hop: false,
  })
  mkdirSync(resolve(dist, page.slug), { recursive: true })
  writeFileSync(resolve(dist, page.slug, 'index.html'), html)
  written.push({ path: `/${page.slug}`, bytes: html.length, priority: '0.9' })
}

// ---- Sitemap ---------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  resolve(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${written
  .map(
    (w) =>
      `  <url><loc>${SITE.url}${w.path === '/' ? '/' : w.path}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${w.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`,
)
// The URL list IndexNow pings after a deploy (scripts/indexnow.mjs).
writeFileSync(resolve(dist, '.indexnow-urls.json'), JSON.stringify(written.map((w) => `${SITE.url}${w.path}`)))

rmSync(ssrDir, { recursive: true, force: true })
console.log(
  `prerender: ${written.map((w) => `${w.path} (${(w.bytes / 1024).toFixed(1)} kB)`).join(', ')}; ${css.size} css; app.html; sitemap.xml`,
)
