import { getCollection, type CollectionEntry } from 'astro:content';

// QA agent reports (data/qa/<slug>.json). A post only goes live once it passes QA.
const qa = import.meta.glob<{ pass: boolean }>('../../data/qa/*.json', { eager: true, import: 'default' });
const qaPassed = (slug: string) => qa[`../../data/qa/${slug}.json`]?.pass === true;

export async function getPublishedPosts(): Promise<CollectionEntry<'blog'>[]> {
  const now = Date.now();
  const posts = await getCollection('blog', ({ id, data }) => !data.draft && data.pubDate.getTime() <= now && qaPassed(id));
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}
