// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import siteConfig from './site.config.json' with { type: 'json' };
import { remarkAffiliateLinks } from './src/lib/remark-affiliate.mjs';
import { remarkProductFigures } from './src/lib/remark-product-figures.mjs';
import { rehypeSections } from './src/lib/rehype-sections.mjs';
import fs from 'node:fs';
import matter from 'gray-matter';

// Real last-modified dates for the sitemap: a post's updatedDate (set only when
// its content actually changes) or its pubDate. Crawlers use lastmod to decide
// what to re-fetch, so it must never be bumped without a real change.
const blogDir = new URL('./src/content/blog/', import.meta.url);
// Categories with at least one post that is already out; empty category pages are noindex, so keep them out of the sitemap.
const liveCategories = new Set();
const lastmod = new Map(
  (fs.existsSync(blogDir) ? fs.readdirSync(blogDir) : []).filter((f) => f.endsWith('.md')).map((f) => {
    const { data } = matter(fs.readFileSync(new URL(f, blogDir), 'utf8'));
    if (!data.draft && new Date(data.pubDate) <= new Date()) liveCategories.add(data.category);
    return [`${siteConfig.url}/blog/${f.replace(/\.md$/, '')}/`, new Date(data.updatedDate ?? data.pubDate)];
  }),
);
// Newest live post date (null while the blog is empty: no lastmod is better than a fake one).
const liveDates = [...lastmod.values()].filter((d) => d <= new Date()).map(Number);
const newest = liveDates.length ? new Date(Math.max(...liveDates)) : null;

export default defineConfig({
  site: siteConfig.url,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      filter: (page) => {
        if (page.includes('/404') || page.includes('/search/')) return false;
        const cat = page.match(/\/category\/([^/]+)\/$/);
        return !cat || liveCategories.has(cat[1]);
      },
      serialize(item) {
        const d = lastmod.get(item.url);
        if (d) item.lastmod = d.toISOString();
        else if (newest && /\/(blog|category)\/|^https?:\/\/[^/]+\/$/.test(item.url)) item.lastmod = newest.toISOString();
        return item;
      },
    }),
  ],
  markdown: {
    remarkPlugins: [remarkProductFigures, remarkAffiliateLinks],
    rehypePlugins: [rehypeSections],
    shikiConfig: { theme: 'github-light' },
  },
});
