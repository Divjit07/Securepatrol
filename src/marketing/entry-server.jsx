// Build-time renderer for the homepage. Bundled by `vite build --ssr` and called
// from scripts/prerender.mjs — never shipped to the browser.
import { renderToString } from 'react-dom/server'
import Home from '../pages/Home.jsx'
import { SITE, structuredData } from './content.js'

export function render() {
  return renderToString(<Home />)
}

export { SITE, structuredData }
