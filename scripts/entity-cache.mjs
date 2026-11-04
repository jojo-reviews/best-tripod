#!/usr/bin/env node
// Owner rule 2026-11-04: every TextRazor entity of a post goes into its schema as a Thing with
// name, description and sameAs [Wikipedia, Google Knowledge Graph (kgmid), Wikidata].
// This build step looks up each entity's Wikipedia article on Wikidata (description, Q-id and
// Freebase/Knowledge Graph id P646) and caches it in data/entity-cache.json. It runs before
// `astro build`. Wikimedia blocks some proxies (e.g. the Claude container), so any network error
// only logs a warning and keeps the cache as it is: the build never fails because of it.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const briefs = path.join(root, 'data', 'briefs');
const cacheFile = path.join(root, 'data', 'entity-cache.json');
const site = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const UA = `${(site.name || 'site').replace(/\s+/g, '')}SchemaBuild/1.0 (${site.url}; schema markup build step, ~1 run per deploy)`;

const titleOf = (wiki) => decodeURIComponent(String(wiki).split('/wiki/')[1] || '').replace(/_/g, ' ').trim();

const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
const want = new Set();
if (fs.existsSync(briefs)) {
  for (const f of fs.readdirSync(briefs).filter((f) => f.endsWith('.entities.json'))) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(briefs, f), 'utf8'));
      for (const e of d.sharedEntities ?? []) if (e.wiki) want.add(titleOf(e.wiki));
    } catch {}
  }
}
const todo = [...want].filter((t) => t && !(t in cache));
console.log(`[entity-cache] ${want.size} entities, ${todo.length} to look up`);

let ok = 0;
try {
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
      action: 'wbgetentities', sites: 'enwiki', titles: batch.join('|'), props: 'descriptions|claims|sitelinks',
      sitefilter: 'enwiki', languages: 'en', normalize: '1', format: 'json', maxlag: '5',
    });
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const found = new Map();
    for (const [qid, ent] of Object.entries(data.entities ?? {})) {
      if (ent.missing !== undefined || !qid.startsWith('Q')) continue;
      const t = ent.sitelinks?.enwiki?.title;
      const kg = ent.claims?.P646?.[0]?.mainsnak?.datavalue?.value ?? ent.claims?.P2671?.[0]?.mainsnak?.datavalue?.value;
      if (t) found.set(t, { qid, description: ent.descriptions?.en?.value ?? '', kgmid: kg ?? '' });
    }
    for (const t of batch) {
      const hit = found.get(t) ?? found.get(t.charAt(0).toUpperCase() + t.slice(1));
      cache[t] = hit ?? null; // null = looked up, nothing on Wikidata (not retried every build)
      if (hit) ok++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
} catch (e) {
  console.warn(`[entity-cache] Wikidata lookup skipped (${e.message}); schema uses the cached data and Wikipedia links only`);
}
fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1) + '\n');
console.log(`[entity-cache] ${ok} new entities resolved, cache has ${Object.keys(cache).length}`);
