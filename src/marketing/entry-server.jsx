// Build-time renderer for the public marketing pages. Bundled by
// `vite build --ssr` and called from scripts/prerender.mjs — never shipped to
// the browser.
import { renderToString } from 'react-dom/server'
import Home from '../pages/Home.jsx'
import Landing from '../pages/Landing.jsx'
import { SITE, structuredData } from './content.js'
import { PAGES, pageStructuredData } from './pages.js'

export function render() {
  return renderToString(<Home />)
}

export function renderLanding(slug) {
  return renderToString(<Landing slug={slug} />)
}

export { PAGES, SITE, pageStructuredData, structuredData }
