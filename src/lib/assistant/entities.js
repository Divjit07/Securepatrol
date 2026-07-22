// Entity extraction for the ops assistant: figure out which guard or site a
// question is about by matching real names from the database against the text.
// Deterministic — a name either appears (whole name or a name-part token) or it
// doesn't. Ambiguity (two "Raj"s) is surfaced so the UI can ask which one.
import { supabase } from '../supabase.js'
import { listSites } from './data.js'

// Short-lived caches so a single conversation doesn't refetch the roster each
// turn. Cleared naturally when the page reloads.
let guardCache = null
let guardCacheAt = 0
let siteCache = null
let siteCacheAt = 0
const TTL = 60_000

async function loadGuards() {
  if (guardCache && Date.now() - guardCacheAt < TTL) return guardCache
  const { data, error } = await supabase
    .from('guards')
    .select('id, name, active, sites(name)')
  if (error) throw new Error(error.message)
  guardCache = data || []
  guardCacheAt = Date.now()
  return guardCache
}

async function loadSites() {
  if (siteCache && Date.now() - siteCacheAt < TTL) return siteCache
  siteCache = await listSites()
  siteCacheAt = Date.now()
  return siteCache
}

function normalize(text) {
  return ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `
}

// Common words that happen to appear in text — never treat these as a name part.
const NAME_STOPWORDS = new Set([
  'the', 'and', 'for', 'was', 'were', 'did', 'has', 'have', 'how', 'many',
  'hours', 'work', 'worked', 'shift', 'shifts', 'clock', 'clocked', 'schedule',
  'week', 'today', 'yesterday', 'site', 'sites', 'guard', 'guards', 'now',
])

/**
 * Find guards referenced in the text. Matches the full name as a substring, or
 * any name-part (≥3 chars, first/last name) as a whole token.
 * Returns [{ id, name, active, site }] — 0, 1, or several.
 */
export async function findGuardsInText(text) {
  const guards = await loadGuards()
  const hay = normalize(text)
  const hits = new Map()

  for (const g of guards) {
    const full = normalize(g.name).trim()
    if (full && hay.includes(` ${full} `)) {
      hits.set(g.id, g)
      continue
    }
    for (const part of full.split(' ')) {
      if (part.length >= 3 && !NAME_STOPWORDS.has(part) && hay.includes(` ${part} `)) {
        hits.set(g.id, g)
        break
      }
    }
  }
  return [...hits.values()].map((g) => ({
    id: g.id, name: g.name, active: g.active, site: g.sites?.name || null,
  }))
}

/** Resolve a guard from a bare answer like "Raj Singh" (follow-up to "which one?"). */
export async function resolveGuardByName(name) {
  const guards = await loadGuards()
  const q = normalize(name).trim()
  if (!q) return []
  const exact = guards.filter((g) => normalize(g.name).trim() === q)
  if (exact.length) return exact.map((g) => ({ id: g.id, name: g.name, active: g.active, site: g.sites?.name || null }))
  return (await findGuardsInText(name))
}

/** Find sites referenced in the text (full name or a distinctive token). */
export async function findSitesInText(text) {
  const sites = await loadSites()
  const hay = normalize(text)
  const hits = new Map()
  for (const s of sites) {
    const full = normalize(s.name).trim()
    if (!full) continue
    if (hay.includes(` ${full} `)) {
      hits.set(s.id, s)
      continue
    }
    for (const part of full.split(' ')) {
      if (part.length >= 4 && !NAME_STOPWORDS.has(part) && hay.includes(` ${part} `)) {
        hits.set(s.id, s)
        break
      }
    }
  }
  return [...hits.values()].map((s) => ({ id: s.id, name: s.name }))
}
