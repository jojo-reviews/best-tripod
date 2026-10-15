// Fails the build if any post has broken internal links or malformed affiliate links.
import { listPosts } from '../agents/lib/store.mjs';

const posts = listPosts();
const slugs = new Set(posts.map((p) => p.slug));
const errors = [];
for (const p of posts) {
  for (const m of p.content.matchAll(/\]\(\/blog\/([^)/]+)\/?\)/g)) {
    if (!slugs.has(m[1])) errors.push(`${p.slug}: internal link to missing post "${m[1]}"`);
  }
  for (const m of p.content.matchAll(/\]\(amzn:([^)]*)\)/g)) {
    if (!m[1].trim() || /\s/.test(m[1])) errors.push(`${p.slug}: malformed amzn link "${m[1]}"`);
  }
  for (const r of p.data.related || []) if (!slugs.has(r)) errors.push(`${p.slug}: related post "${r}" missing`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`content OK: ${posts.length} posts`);
