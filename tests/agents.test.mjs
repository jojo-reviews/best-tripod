// Regression tests for the publishing agents' decision logic and the built pages.
// Run with `npm test` (node --test). Build-output checks skip when dist/ doesn't exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { findCannibal, overlap, serpShared } from '../agents/lib/cannibal.mjs';
import { keywordGate } from '../agents/orchestrator.mjs';
import { SITE, ROOT } from '../agents/lib/config.mjs';

const post = (slug, keyword, secondaryKeywords = []) => ({ slug, data: { keyword, secondaryKeywords } });
const serp = (...hosts) => ({ urls: hosts.map((h) => `https://${h}/page`) });

test('a topic already covered by an existing post is rejected', () => {
  const posts = [post('best-travel-tripod', 'best travel tripod for mirrorless camera')];
  const clash = findCannibal({ keyword: 'best travel tripod for mirrorless camera' }, posts, { serps: {} });
  assert.equal(clash?.slug, 'best-travel-tripod');
});

test('different wording with the same search intent (shared SERP) is rejected', () => {
  const posts = [post('tall', 'best tripod for tall photographers')];
  const serps = {
    'best tripod for tall photographers': serp('a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com'),
    'tripod for 6 foot 4 person': serp('a.com', 'b.com', 'c.com', 'd.com', 'x.com', 'y.com'),
  };
  const clash = findCannibal({ keyword: 'tripod for 6 foot 4 person' }, posts, { serps });
  assert.equal(clash?.slug, 'tall');
  assert.match(clash.reason, /4 of the top-10/);
});

test('a genuinely distinct topic is allowed even when the words overlap', () => {
  const posts = [post('ball-head', 'ball head vs pan tilt head')];
  const serps = {
    'ball head vs pan tilt head': serp('a.com', 'b.com', 'c.com', 'd.com'),
    'best ball head for heavy telephoto lens': serp('a.com', 'q.com', 'r.com', 's.com'),
  };
  assert.equal(findCannibal({ keyword: 'best ball head for heavy telephoto lens' }, posts, { serps }), null);
});

test('a one-word core does not clash with a longer, different keyword', () => {
  assert.equal(overlap('best magnetic cabinet locks', 'best lock'), 0);
  assert.ok(overlap('smart lock', 'lock smart') >= 0.75);
});

test('serpShared returns null when a SERP is not recorded (unable to verify)', () => {
  assert.equal(serpShared('a', 'b', {}), null);
});

test('a keyword without Ahrefs volume/KD is held as needs-data, not guessed', { skip: SITE.keywordRules?.requireAhrefs === false && 'requireAhrefs is off in site.config.json' }, () => {
  const gate = keywordGate({ keyword: 'some new long tail keyword' }, []);
  assert.equal(gate?.status, 'needs-data');
});

test('a keyword over the volume cap is parked', () => {
  const cap = SITE.keywordRules?.maxVolume ?? 250;
  const gate = keywordGate({ keyword: 'best tripod ever made', ahrefs: { volume: cap + 1, kd: 0 } }, []);
  assert.equal(gate?.status, 'parked');
});

test('a keyword over the KD cap is parked', () => {
  const max = SITE.keywordRules?.maxKd;
  if (typeof max !== 'number') return;
  const gate = keywordGate({ keyword: 'some low volume keyword here', ahrefs: { volume: 50, kd: max + 1 } }, []);
  assert.equal(gate?.status, 'parked');
});

test('a keyword with data inside the caps and no overlap passes', () => {
  assert.equal(keywordGate({ keyword: 'quiet zebra keyword phrase', ahrefs: { volume: 40, kd: 0 } }, []), null);
});

test('a long-tail keyword Ahrefs does not have passes only with a measurable proxy', { skip: SITE.keywordRules?.requireAhrefs === false && 'requireAhrefs is off in site.config.json' }, () => {
  assert.equal(keywordGate({ keyword: 'quiet zebra keyword phrase', ahrefs: { notInDatabase: true } }, [])?.status, 'parked');
  assert.equal(keywordGate({ keyword: 'quiet zebra keyword phrase', ahrefs: { notInDatabase: true, proxy: { keyword: 'zebra keyword', volume: 90, kd: 4 } } }, []), null);
});

test('keywords the owner supplied skip the gate', () => {
  assert.equal(keywordGate({ keyword: 'anything', source: 'user' }, []), null);
});

// Built pages: every published post has a self-referencing canonical and is indexable.
const DIST = path.join(ROOT, 'dist');
test('built blog pages have a self canonical and index,follow', { skip: !fs.existsSync(DIST) && 'dist/ not built' }, () => {
  const site = SITE.siteUrl ?? SITE.url ?? '';
  const pages = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f === 'index.html' && /\/blog\/[a-z0-9-]+\/index\.html$/.test(p)) pages.push(p);
    }
  };
  walk(DIST);
  assert.ok(pages.length > 0, 'no built blog pages found');
  for (const p of pages) {
    const html = fs.readFileSync(p, 'utf8');
    const rel = '/' + path.relative(DIST, path.dirname(p)).split(path.sep).join('/') + '/';
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.ok(canonical, `${rel}: no canonical`);
    assert.ok(canonical.endsWith(rel), `${rel}: canonical points to ${canonical}`);
    if (site) assert.ok(canonical.startsWith(site.replace(/\/$/, '')), `${rel}: canonical host ${canonical}`);
    const robots = html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? '';
    assert.ok(!/noindex/.test(robots), `${rel}: unexpected noindex`);
  }
});
