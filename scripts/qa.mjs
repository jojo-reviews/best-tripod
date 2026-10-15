// QA agent CLI.
//   node scripts/qa.mjs <slug>            check one post
//   node scripts/qa.mjs --all [--online]  check every post (CI adds --online)
//   node scripts/qa.mjs --failing         list posts that are blocked
import { listPosts } from '../agents/lib/store.mjs';
import { qaPost, readQa } from '../agents/qa-agent.mjs';
import { hasAmazonApi, getItems } from '../agents/lib/amazon.mjs';

const args = process.argv.slice(2);
const online = args.includes('--online');
const posts = listPosts();

if (args.includes('--failing')) {
  const failing = posts.map((p) => readQa(p.slug) ?? { slug: p.slug, pass: false, errors: ['no QA report'] }).filter((r) => !r.pass);
  console.log(JSON.stringify(failing.map((r) => ({ slug: r.slug, errors: r.errors })), null, 2));
  process.exit(0);
}

let live = null;
if (online && hasAmazonApi()) {
  const asins = [...new Set(posts.flatMap((p) => (p.data.products ?? []).map((x) => x.asin).filter(Boolean)))];
  live = new Map((await getItems(asins)).map((i) => [i.asin, i]));
}

const targets = args.includes('--all') ? posts : posts.filter((p) => args.includes(p.slug));
if (!targets.length) {
  console.error('usage: node scripts/qa.mjs <slug> | --all [--online] | --failing');
  process.exit(1);
}
let blocked = 0;
for (const post of targets) {
  const r = await qaPost(post, { posts, online, live });
  if (!r.pass) blocked++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${post.slug}`);
  for (const e of r.errors) console.log(`   ✗ ${e}`);
  for (const w of r.warnings) console.log(`   ! ${w}`);
}
console.log(`${targets.length - blocked}/${targets.length} posts pass QA`);
