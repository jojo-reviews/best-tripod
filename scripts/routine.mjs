// Helper for the daily Claude Routine (see ROUTINE.md). The routine session
// does the research and writing itself; this script handles the bookkeeping
// that the API-driven agents would otherwise do.
//
//   node scripts/routine.mjs status                 today's quota, queue size
//   node scripts/routine.mjs slots                  random go-live times (pubDate) for today's remaining posts
//   node scripts/routine.mjs next                   next keyword to write (skips over-cap / cannibalizing ones)
//   node scripts/routine.mjs cannibal "<keyword>"   check a keyword against existing posts
//   node scripts/routine.mjs links <slug>           internal-link candidates
//   node scripts/routine.mjs add-keywords <file>    merge researched keywords into the queue
//   node scripts/routine.mjs audit <slug>           SEO audit (needs data/briefs/<slug>.json)
//   node scripts/routine.mjs qa <slug>              QA agent review (must PASS before the post can go live)
//   node scripts/routine.mjs factcheck <slug> "notes"  record that every claim was verified against sources
//   node scripts/routine.mjs finalize <slug>        featured image, backlinks, queue/state, report
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, SITE } from '../agents/lib/config.mjs';
import { loadQueue, saveQueue, loadState, saveState, listPosts, saveReport } from '../agents/lib/store.mjs';
import { localNow, quotaFor, releaseTimes } from '../agents/lib/schedule.mjs';
import { slugify } from '../agents/lib/nlp.mjs';
import { audit, pickLinkTargets, addBacklinks } from '../agents/seo-agent.mjs';
import { nextKeyword, collectSources } from '../agents/orchestrator.mjs';
import { ensureFeatured } from './featured-images.mjs';
import { funnelOf } from '../agents/lib/funnel.mjs';
import { findCannibal } from '../agents/lib/cannibal.mjs';
import { qaPost, recordFactCheck } from '../agents/qa-agent.mjs';
import { productCountFor } from '../agents/lib/product-count.mjs';

const BRIEFS = path.join(DATA_DIR, 'briefs');
const [cmd, arg] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o, null, 2));

function itemFor(slug) {
  const queue = loadQueue();
  const post = listPosts().find((p) => p.slug === slug);
  const item = queue.find((q) => q.slug === slug) ?? (post && queue.find((q) => q.keyword === post.data.keyword));
  return { queue, post, item };
}

if (cmd === 'status') {
  const state = loadState();
  const now = localNow();
  const start = state.startDate ?? now.date;
  const q = quotaFor(now.date, start);
  const today = state.published.filter((p) => p.date === now.date).length;
  out({
    today: now.date,
    scheduleStart: start,
    week: q.week,
    phase: q.phase,
    quotaToday: q.quota,
    publishedToday: today,
    remainingToday: Math.max(0, q.quota - today),
    pendingKeywords: loadQueue().filter((k) => k.status === 'pending').length,
  });
} else if (cmd === 'slots') {
  // Today's posts go live at random times; use these as pubDate. The hourly
  // "Scheduled release" workflow rebuilds the site when each one comes due.
  const state = loadState();
  const now = localNow();
  const q = quotaFor(now.date, state.startDate ?? now.date);
  const done = state.published.filter((p) => p.date === now.date).length;
  // Drop the slot nearest each post already scheduled today, so no two posts share a time.
  const times = releaseTimes(now.date, q.quota);
  const taken = listPosts()
    .filter((p) => state.published.some((x) => x.slug === p.slug && x.date === now.date))
    .map((p) => Date.parse(p.data.pubDate));
  for (const t of taken) {
    if (!times.length) break;
    let best = 0;
    times.forEach((x, i) => { if (Math.abs(x - t) < Math.abs(times[best] - t)) best = i; });
    times.splice(best, 1);
  }
  times.splice(Math.max(0, q.quota - done));
  // A slot that has already passed moves to the first free time from a few minutes from now,
  // still at least minGapMinutes from every other post today, so two posts never share a time.
  const soon = Date.now() + 10 * 60000;
  const gap = (SITE.schedule.releaseWindowLocal?.minGapMinutes ?? 90) * 60000;
  const picked = times.filter((t) => t.getTime() >= soon).map((t) => t.getTime());
  for (const t of times.filter((t) => t.getTime() < soon)) {
    let c = soon;
    while ([...picked, ...taken].some((x) => Math.abs(x - c) < gap)) c += 5 * 60000;
    picked.push(c);
  }
  picked.sort((a, b) => a - b);
  out({ quotaToday: q.quota, publishedToday: done, pubDates: picked.map((t) => new Date(t).toISOString()) });
} else if (cmd === 'next') {
  // Skip (and park) keywords over the volume cap or that would cannibalize a post.
  const queue = loadQueue();
  const posts = listPosts();
  const cap = SITE.keywordRules?.maxVolume ?? 250;
  let item;
  for (;;) {
    item = nextKeyword(queue, loadState());
    if (!item || item.source === 'user') break;
    const clash = findCannibal(item, posts);
    if (item.ahrefs?.volume > cap) {
      item.status = 'parked';
      item.lastError = `volume ${item.ahrefs.volume} > ${cap} cap`;
    } else if (clash) {
      item.status = 'merged';
      item.mergedInto = clash.slug;
      item.lastError = `cannibalization: ${clash.reason}`;
    } else break;
  }
  if (item) item.productCount ??= productCountFor(item);
  saveQueue(queue);
  out(item ?? { error: 'queue empty: research keywords first (see ROUTINE.md step 1)' });
} else if (cmd === 'cannibal') {
  out(findCannibal({ keyword: arg }, listPosts()) ?? { ok: true, message: `no existing post targets "${arg}"` });
} else if (cmd === 'links') {
  const { item, post } = itemFor(arg);
  const probe = item ?? { keyword: arg.replace(/-/g, ' '), secondaryKeywords: [], workingTitle: '', cluster: '', category: post?.data.category };
  out(pickLinkTargets(probe, listPosts().filter((p) => p.slug !== arg)));
} else if (cmd === 'add-keywords') {
  const incoming = JSON.parse(fs.readFileSync(arg, 'utf8'));
  const queue = loadQueue();
  const taken = new Set([...queue.map((q) => q.keyword.toLowerCase()), ...listPosts().map((p) => String(p.data.keyword).toLowerCase())]);
  let added = 0;
  for (const k of incoming) {
    const kw = k.keyword.toLowerCase().trim();
    if (taken.has(kw)) continue;
    taken.add(kw);
    queue.push({ status: 'pending', attempts: 0, addedAt: new Date().toISOString(), secondaryKeywords: [], questions: [], priority: 5, ...k, keyword: kw, slug: slugify(kw) });
    added++;
  }
  saveQueue(queue);
  out({ added, pending: queue.filter((q) => q.status === 'pending').length });
} else if (cmd === 'audit') {
  const { item, post } = itemFor(arg);
  if (!post) throw new Error(`No post src/content/blog/${arg}.md`);
  const brief = JSON.parse(fs.readFileSync(path.join(BRIEFS, `${arg}.json`), 'utf8'));
  const report = audit({
    item: item ?? { keyword: post.data.keyword, secondaryKeywords: post.data.secondaryKeywords ?? [], articleType: post.data.articleType },
    brief,
    meta: { title: post.data.title, seoTitle: post.data.seoTitle ?? post.data.title, description: post.data.description },
    body: post.content,
    products: post.data.products ?? [],
  });
  out({ score: report.score, pass: report.score >= 85, issues: report.issues, metrics: report.metrics });
} else if (cmd === 'qa') {
  const post = listPosts().find((p) => p.slug === arg);
  if (!post) throw new Error(`No post src/content/blog/${arg}.md`);
  out(await qaPost(post));
} else if (cmd === 'factcheck') {
  const notes = process.argv.slice(4).join(' ').trim();
  if (notes.length < 20) throw new Error('Describe what you verified (which specs, against which sources).');
  out(recordFactCheck(arg, notes));
} else if (cmd === 'finalize') {
  const { queue, post, item } = itemFor(arg);
  if (!post) throw new Error(`No post src/content/blog/${arg}.md`);
  await ensureFeatured(post);
  const fresh = listPosts();
  const others = fresh.filter((p) => p.slug !== arg);
  const it = item ?? { keyword: post.data.keyword, secondaryKeywords: post.data.secondaryKeywords ?? [], workingTitle: post.data.title, cluster: '', category: post.data.category };
  const backlinks = addBacklinks({ newSlug: arg, item: it, meta: { entities: post.data.entities ?? [] }, posts: others, isLive: Date.parse(post.data.pubDate) <= Date.now() });

  const state = loadState();
  const now = localNow();
  state.startDate ??= now.date;
  if (!state.published.some((p) => p.slug === arg)) state.published.push({ date: now.date, slug: arg, keyword: it.keyword, category: post.data.category, funnel: post.data.funnel ?? funnelOf({ ...it, articleType: post.data.articleType }) });
  saveState(state);
  if (item) {
    item.status = 'published';
    item.slug = arg;
    item.publishedAt = new Date().toISOString();
    saveQueue(queue);
  }
  const briefFile = path.join(BRIEFS, `${arg}.json`);
  const brief = fs.existsSync(briefFile) ? JSON.parse(fs.readFileSync(briefFile, 'utf8')) : null;
  saveReport(arg, { keyword: it.keyword, createdAt: new Date().toISOString(), via: 'claude-routine', brief, sources: collectSources(post.data.products ?? []), backlinks });
  out({ finalized: arg, backlinks });
} else {
  console.log('usage: node scripts/routine.mjs status|next|links <slug>|add-keywords <file>|audit <slug>|finalize <slug>');
  process.exitCode = 1;
}
