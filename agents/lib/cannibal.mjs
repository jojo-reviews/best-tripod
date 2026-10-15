// Keyword cannibalization guard: a new keyword must not target the same search
// intent as an existing post (or another queued keyword). We compare the
// keyword against each post's primary + secondary keywords and title, and
// treat an identical Ahrefs parent topic as the same intent.
import { tokenize, STOPWORDS } from './nlp.mjs';

const GENERIC = new Set(['best', 'for', 'top', '2026', 'vs', 'versus', 'guide', 'review', 'buying']);
const core = (s) => new Set(tokenize(String(s)).filter((t) => !STOPWORDS.has(t) && !GENERIC.has(t)).map((t) => t.replace(/s$/, '')));

function overlap(a, b) {
  const A = core(a);
  const B = core(b);
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((t) => B.has(t)).length;
  return inter / Math.min(A.size, B.size);
}

/** Returns the conflicting post/keyword or null. */
export function findCannibal(candidate, posts, { threshold = 0.75 } = {}) {
  const kw = candidate.keyword;
  const parent = candidate.ahrefs?.parentTopic ?? candidate.parentTopic;
  for (const p of posts) {
    const d = p.data;
    const targets = [d.keyword, ...(d.secondaryKeywords ?? [])].filter(Boolean);
    if (parent && d.parentTopic && parent === d.parentTopic) return { slug: p.slug, reason: `same Ahrefs parent topic "${parent}"` };
    for (const t of targets) {
      const o = overlap(kw, t);
      if (o >= threshold) return { slug: p.slug, reason: `"${kw}" overlaps "${t}" (${Math.round(o * 100)}%)` };
    }
  }
  return null;
}
