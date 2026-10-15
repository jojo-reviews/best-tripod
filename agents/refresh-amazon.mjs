// Daily Amazon catalog refresh (Creators API).
// - Products with an ASIN: refresh image URL/size (Amazon requires product
//   content shown on the site to be refreshed at least every 24 hours).
// - Products without an ASIN: look up the listing to add ASIN + image.
// Runs from .github/workflows/amazon-refresh.yml.
import { fileURLToPath } from 'node:url';
import { log } from './lib/config.mjs';
import { listPosts, writePost } from './lib/store.mjs';
import { hasAmazonApi, getItems, matchProduct } from './lib/amazon.mjs';

const AGENT = 'amazon-refresh';

export async function refreshAmazon() {
  if (!hasAmazonApi()) {
    log(AGENT, 'Creators API credentials or Amazon tag missing; skipping');
    return 0;
  }
  const posts = listPosts().filter((p) => (p.data.products || []).length);
  const asins = [...new Set(posts.flatMap((p) => p.data.products.map((x) => x.asin).filter(Boolean)))];
  const live = new Map((asins.length ? await getItems(asins) : []).map((i) => [i.asin, i]));
  log(AGENT, `refreshed ${live.size}/${asins.length} ASINs`);

  let changed = 0;
  for (const post of posts) {
    let dirty = false;
    for (const p of post.data.products) {
      try {
        if (p.asin && live.has(p.asin)) {
          const { image, gallery, title } = live.get(p.asin);
          if (JSON.stringify(image) !== JSON.stringify(p.image) || JSON.stringify(gallery ?? []) !== JSON.stringify(p.gallery ?? []) || (title && title !== p.amazonTitle)) {
            p.image = image;
            if (title) p.amazonTitle = title;
            p.gallery = gallery ?? [];
            dirty = true;
          }
        } else if (!p.asin) {
          const hit = await matchProduct(p.name, p.query, p.brand);
          if (hit) {
            p.asin = hit.asin;
            p.image = hit.image;
            if (hit.title) p.amazonTitle = hit.title;
            p.gallery = hit.gallery ?? [];
            dirty = true;
          }
        } else if (p.image) {
          // ASIN no longer returned (unavailable): stop showing a stale image.
          delete p.image;
          delete p.gallery;
          dirty = true;
        }
      } catch (e) {
        log(AGENT, `${post.slug} / ${p.name}: ${e.message}`);
      }
    }
    if (dirty) {
      writePost(post.slug, post.data, post.content);
      changed++;
    }
  }
  log(AGENT, `${changed} posts updated`);
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  refreshAmazon().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
