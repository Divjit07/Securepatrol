#!/usr/bin/env node
/**
 * Tell Bing, Yandex, Seznam, Naver (and through them DuckDuckGo, Yahoo and
 * Copilot) that kronus.space pages changed, so they recrawl now instead of
 * "eventually". Run after a deploy is live:  npm run indexnow
 *
 * The key is public by design: search engines confirm we own the site by
 * fetching https://kronus.space/7e64a5ddd93313fd1e8b75655dd16139.txt.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KEY = '7e64a5ddd93313fd1e8b75655dd16139'
const HOST = 'kronus.space'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const urlList = JSON.parse(readFileSync(resolve(root, 'dist/.indexnow-urls.json'), 'utf8'))

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
})
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`)
if (!res.ok && res.status !== 202) process.exit(1)
