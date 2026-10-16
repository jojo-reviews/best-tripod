// QA agent: reviews a post the way a human QA editor would, before it may go
// live. Every post needs a passing report in data/qa/<slug>.json; the site
// build hides posts without one (see src/lib/posts.ts).
//
// Automatic checks (errors block publishing, warnings don't):
//   facts & claims   no prices, star ratings, review counts or invented testing claims
//   amazon           affiliate tag set, every product linked, product photo matches the product
//   content          required fields, lengths, FAQs, no H1/placeholder text, product sections
//   links            internal links exist and are already live; sources are real https pages
//   seo              audit score >= 85 (data/briefs/<slug>.json), cannibalization warning
//   online (--online, run in CI)  source URLs respond; Amazon listing still returned
// Manual check (recorded with `routine.mjs factcheck`): every product spec and
// claim was verified against the sources; a post can't pass without it.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, SITE } from './lib/config.mjs';
import { listPosts } from './lib/store.mjs';
import { findCannibal } from './lib/cannibal.mjs';
import { audit } from './seo-agent.mjs';
import { matches } from '../src/lib/remark-product-figures.mjs';
import { productMatches } from './lib/product-match.mjs';
import { amazonTag } from '../src/lib/affiliate.mjs';

export const QA_DIR = path.join(DATA_DIR, 'qa');
const BRIEFS = path.join(DATA_DIR, 'briefs');
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 1));
const overlap = (a, b) => {
  const A = words(a), B = words(b);
  return [...A].filter((w) => B.has(w)).length / Math.max(1, A.size);
};
/** Link text like "Peak Design Travel Tripod" matches the query "Peak Design Travel Tripod Carbon Fiber". */
const linkMatches = (q, p) => Math.max(overlap(q, p.query), overlap(p.query, q), overlap(q, p.name), overlap(p.name, q)) >= 0.5;

const BANNED = [
  [/\$\s?\d/, 'mentions a price (prices change; never state them)'],
  [/\b\d(\.\d)?\s*(out of 5|\/\s?5|-star|stars?\b)/i, 'mentions a star rating'],
  [/\b\d[\d,]*\s+(customer\s+)?(reviews|ratings)\b/i, 'mentions a review count'],
  [/\b(we|i)\s+(have\s+)?(tested|hands-on tested|bench-?tested|lab-tested)\b/i, 'claims hands-on testing'],
  [/\bin our (tests|testing|lab)\b/i, 'claims hands-on testing'],
  [/\b(after|during)\s+(weeks|months)\s+of\s+(use|testing)\b/i, 'claims long-term use'],
  [/\b(I|we)\s+(bought|purchased|ordered|have been using|installed (it|this|ours|mine) in (my|our))\b/i, 'claims personal ownership (only allowed for stories in data/stories.json)'],
  [/\b(TODO|TBD|lorem ipsum|REPLACE|PUBDATE)\b/, 'placeholder text left in'],
];

export function readQa(slug) {
  try {
    return JSON.parse(fs.readFileSync(path.join(QA_DIR, `${slug}.json`), 'utf8'));
  } catch {
    return null;
  }
}

function writeQa(slug, report) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const prev = readQa(slug);
  const same = prev && JSON.stringify([prev.pass, prev.errors, prev.warnings, prev.factCheck]) === JSON.stringify([report.pass, report.errors, report.warnings, report.factCheck]);
  // Keep the file byte-identical when nothing changed, so daily CI runs don't commit noise.
  if (same) return prev;
  fs.writeFileSync(path.join(QA_DIR, `${slug}.json`), JSON.stringify(report, null, 2) + '\n');
  return report;
}

async function urlOk(url) {
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (res.status === 405 || res.status === 403) res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    return res.status;
  } catch {
    return 0;
  }
}

/** Run every check on one post. `online` adds network checks (CI only). */
export async function qaPost(post, { posts = listPosts(), online = false, live = null } = {}) {
  const d = post.data;
  const body = post.content;
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  const now = Date.now();
  const pub = Date.parse(d.pubDate);

  // --- Content and required fields
  if (!d.title) err('missing title');
  // Click-worthy titles: new posts carry a year or a number (picks, tips, steps) and fit in the SERP.
  if (pub >= Date.parse(SITE.qa?.voiceRequiredFrom ?? '2100-01-01') && !/\b(20\d\d|\d+)\b/.test(d.seoTitle ?? d.title ?? '')) err('seoTitle needs a year or a number (e.g. "(2026)", "7 Picks", "12 Tips") to earn the click');
  if ((d.seoTitle ?? d.title ?? '').length > 65) err(`seoTitle is ${(d.seoTitle ?? d.title).length} characters (max 65)`);
  const desc = (d.description ?? '').trim();
  if (desc.length < 110 || desc.length > 170) err(`description is ${desc.length} characters (aim for 140-160)`);
  if (!d.keyword) err('missing keyword');
  if (!SITE.categories.some((c) => c.slug === d.category)) err(`unknown category "${d.category}"`);
  const author = d.author ?? SITE.authors[0].slug;
  if (!SITE.authors.some((a) => a.slug === author)) err(`unknown author "${author}"`);
  if (Number.isNaN(pub)) err('pubDate is missing or invalid');
  if (!d.reviewedDate) err('missing reviewedDate');
  else if (now - Date.parse(d.reviewedDate) > 180 * 86400000) warn('reviewedDate is over 6 months old; re-check facts and products');
  const faqs = d.faqs ?? [];
  if (faqs.length < 3 || faqs.length > 8) err(`${faqs.length} FAQs (need 3-8)`);
  if (!(d.tldr ?? []).length) err('missing tldr (short answer)');
  if (/^# /m.test(body)) err('body has an H1; the title is the only H1');
  if (/^##\s+(faq|frequently asked)/im.test(body)) err('body has its own FAQ section; FAQs belong in frontmatter');

  // --- Voice: first person and a personal story block (posts written after the rule existed)
  if (pub >= Date.parse(SITE.qa?.voiceRequiredFrom ?? '2100-01-01')) {
    const firstPerson = (body.match(/\b(I|I'd|I'm|I've|my|me|we|we'd|we're|we've|our|us)\b/g) ?? []).length;
    if (firstPerson < 10) err(`only ${firstPerson} first-person words (I, my, me, we, our, us); use at least 10`);
    if (!/^>\s*\*\*From our notes:\*\*/m.test(body)) err('missing the "> **From our notes:**" personal story block');
  }

  // --- Structure follows the top search results (posts written after the rule existed)
  if (pub >= Date.parse(SITE.qa?.voiceRequiredFrom ?? '2100-01-01')) {
    let brief = null;
    try { brief = JSON.parse(fs.readFileSync(path.join(BRIEFS, `${post.slug}.json`), 'utf8')); } catch {}
    const serp = brief?.serpStructure;
    if (!serp || (serp.analyzedUrls ?? []).length < 3) err('brief has no serpStructure from at least 3 top results (see ROUTINE.md step 4)');
    else if (d.productStyle !== serp.productStyle) err(`productStyle "${d.productStyle ?? 'pros-cons'}" doesn't match the top results ("${serp.productStyle}")`);
    const sections = body.split(/^### /m).slice(1);
    for (const p of d.products ?? []) {
      const sec = sections.find((x) => matches(x.split('\n')[0], p.name));
      if (d.productStyle === 'paragraph' && sec && sec.split(/\s+/).length < 110) err(`paragraph style: the review of "${p.name}" is under ~100 words`);
      if (d.productStyle === 'specs' && Object.keys(p.specs ?? {}).length < 4) err(`specs style: "${p.name}" needs at least 4 spec rows`);
    }
  }

  // --- Facts and claims
  const text = [d.title, d.description, ...(d.tldr ?? []), body, ...faqs.flatMap((f) => [f.q, f.a]),
    ...(d.products ?? []).flatMap((p) => [p.summary, p.renterNote, ...(p.pros ?? []), ...(p.cons ?? [])])].join('\n');
  for (const [re, why] of BANNED) {
    // Ownership wording is fine when the post tells a real owner story (data/stories.json).
    if (d.ownerStory && /personal ownership/.test(why)) continue;
    const m = text.match(re);
    if (m) err(`${why}: "${m[0]}"`);
  }

  // --- Sources
  const sources = d.sources ?? [];
  if (sources.length < 2) err(`${sources.length} sources (need at least 2)`);
  for (const s of sources) {
    if (!/^https:\/\//.test(s.url ?? '')) err(`source is not an https URL: ${s.url}`);
    if (/amazon\.|amzn\./i.test(s.url ?? '')) err(`source is an Amazon page: ${s.url}`);
  }

  // --- Amazon and products
  if (/REPLACE/.test(amazonTag())) err('Amazon affiliate tag is not configured');
  const products = d.products ?? [];
  if (d.articleType === 'roundup' && products.length < 2) err('roundup with fewer than 2 products');
  if (d.productCount && products.length !== d.productCount) warn(`features ${products.length} products; the plan for this post was ${d.productCount}`);
  const amznLinks = [...body.matchAll(/\]\(amzn:([^)]*)\)/g)].map((m) => decodeURIComponent(m[1].replace(/\+/g, ' ')));
  const h3s = [...body.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1]);
  for (const p of products) {
    const label = `product "${p.name}"`;
    if (!p.badge || !p.summary || !p.renterNote || !p.query) err(`${label} is missing badge, summary, renterNote ("Who it's for") or query`);
    if ((p.pros ?? []).length < 2) err(`${label} needs at least 2 pros ("What we like")`);
    if ((p.cons ?? []).length < 1) err(`${label} needs at least 1 con ("What we don't like")`);
    if (pub >= Date.parse(SITE.qa?.voiceRequiredFrom ?? '2100-01-01')) {
      const sc = p.scores ?? {};
      // height is optional (plates, clamps, bags and other accessories have no working height).
      const missingScores = ['stability', 'portability', 'build', 'value'].filter((k) => typeof sc[k] !== 'number');
      if (missingScores.length) err(`${label} needs Best Tripod scores (missing ${missingScores.join(', ')}; see /how-we-score/)`);
      if (!p.scoreNote) err(`${label} needs a scoreNote explaining its scores`);
    }
    if (!amznLinks.some((q) => linkMatches(q, p))) err(`${label} has no Amazon link in the body`);
    if (!h3s.some((h) => matches(h, p.name))) warn(`${label} has no "### ${p.name}: ..." section, so it gets a card instead`);
    if (!p.image?.url) warn(`${label} has no Amazon photo yet (the Amazon refresh adds it after push)`);
    if (p.asin && p.amazonTitle) {
      const m = productMatches(p.matchName ?? p.name, p.amazonTitle, p.brand);
      if (!m.ok) err(`${label} is linked to a different Amazon listing ("${p.amazonTitle.slice(0, 80)}"${m.accessory ? `, an accessory` : `, missing ${m.missing.join(', ')}`}); clear its asin so the refresh re-matches it`);
    }
  }
  for (const q of amznLinks) {
    if (products.length && !products.some((p) => linkMatches(q, p))) {
      warn(`Amazon link "${q}" doesn't match any listed product`);
    }
  }

  // --- Internal links
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  for (const m of body.matchAll(/\]\(\/blog\/([^)/#]+)\/?[^)]*\)/g)) {
    const target = bySlug.get(m[1]);
    if (!target) err(`internal link to missing post /blog/${m[1]}/`);
    else if (Date.parse(target.data.pubDate) > Math.max(pub, now)) err(`internal link to /blog/${m[1]}/, which isn't live until ${target.data.pubDate}`);
  }
  const internal = [...body.matchAll(/\]\(\/(blog\/[^)]+|tripod-buying-checklist\/)\)/g)].length;
  if (internal < 2) warn(`only ${internal} internal links (aim for 3-5)`);

  // --- SEO
  const briefFile = path.join(BRIEFS, `${post.slug}.json`);
  if (fs.existsSync(briefFile)) {
    const brief = JSON.parse(fs.readFileSync(briefFile, 'utf8'));
    const r = audit({
      item: { keyword: d.keyword, secondaryKeywords: d.secondaryKeywords ?? [], articleType: d.articleType },
      brief,
      meta: { title: d.title, seoTitle: d.seoTitle ?? d.title, description: d.description },
      body,
      products,
    });
    if (r.score < 85) err(`SEO audit score ${r.score} (< 85): ${r.issues.join(' | ')}`);
  } else warn('no semantic brief (data/briefs), SEO audit skipped');
  const clash = findCannibal({ keyword: d.keyword }, posts.filter((p) => p.slug !== post.slug));
  if (clash) warn(`keyword overlaps /blog/${clash.slug}/ (${clash.reason})`);

  // --- Online checks (CI)
  if (online) {
    for (const s of sources) {
      const status = await urlOk(s.url);
      // A dead source on a post that is already live is flagged for the daily fact-check instead of
      // hiding the post; before it goes live it still blocks publishing.
      if (status === 404 || status === 410) (pub <= now ? warn : err)(`${pub <= now ? 'LIVE POST, FIX: ' : ''}source returns ${status}: ${s.url}`);
      else if (status === 0 || status >= 400) warn(`source didn't respond normally (${status || 'no response'}): ${s.url}`);
    }
    if (live) {
      for (const p of products) if (p.asin && !live.has(p.asin)) warn(`product "${p.name}" (${p.asin}) is no longer returned by Amazon`);
    }
  }

  const prev = readQa(post.slug);
  const factCheck = prev?.factCheck ?? { verified: false };
  if (!factCheck.verified) err('facts not verified yet: check every product spec and claim against the sources, then run `node scripts/routine.mjs factcheck <slug> "<notes>"`');

  // A post that is already live stays up when a later check finds a problem
  // (removing it would 404); the problem is reported as a warning to fix.
  // Posts published before the QA agent existed count as live too.
  const legacy = pub < Date.parse(SITE.qa?.requiredFrom ?? 0);
  const isLive = legacy || (pub <= now - 24 * 3600000 && prev?.pass);
  const blocking = isLive ? [] : errors;
  if (isLive) warnings.unshift(...errors.map((e) => `LIVE POST, FIX: ${e}`));
  const report = { slug: post.slug, pass: blocking.length === 0, checkedAt: new Date().toISOString(), errors: blocking, warnings, factCheck };
  return writeQa(post.slug, report);
}

/** Record the manual fact check (done by the routine's writer with web research). */
export function recordFactCheck(slug, notes) {
  const prev = readQa(slug) ?? { slug, pass: false, errors: [], warnings: [] };
  prev.factCheck = { verified: true, notes, at: new Date().toISOString() };
  fs.mkdirSync(QA_DIR, { recursive: true });
  fs.writeFileSync(path.join(QA_DIR, `${slug}.json`), JSON.stringify(prev, null, 2) + '\n');
  return prev.factCheck;
}
