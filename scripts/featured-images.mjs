// Generates a branded 1200×630 featured image for every post that lacks one,
// and records it in the post's frontmatter (`heroImage`, `heroAlt`).
// Used as the article hero, the card thumbnail, og:image and schema image.
//
//   node scripts/featured-images.mjs            # only missing images
//   node scripts/featured-images.mjs --force    # regenerate all
//   node scripts/featured-images.mjs --pages    # also share images for home, blog, categories, checklist
//   node scripts/featured-images.mjs --brand    # also logo-512.png and og-default.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { ROOT, SITE } from '../agents/lib/config.mjs';
import { listPosts, writePost } from '../agents/lib/store.mjs';

const OUT_DIR = path.join(ROOT, 'public/images/featured');
const font = (pkg, file) => fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file));
const FONTS = [
  { name: 'Bricolage', data: font('bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff'), weight: 800, style: 'normal' },
  { name: 'Bricolage', data: font('bricolage-grotesque', 'bricolage-grotesque-latin-700-normal.woff'), weight: 700, style: 'normal' },
  { name: 'Serif', data: font('source-serif-4', 'source-serif-4-latin-400-normal.woff'), weight: 400, style: 'normal' },
];

const C = { drywall: '#f5f2ec', paper: '#ffffff', ink: '#1f1c1a', slate: '#5e5853', rule: '#ddd6cc', tape: '#c2410c', tapeInk: '#9a3412' };

// Same line icons as src/components/Icon.astro.
const ICONS = {
  tripod: '<rect x="8" y="2.5" width="8" height="5" rx="1"/><circle cx="12" cy="5" r="1.2"/><path d="M12 7.5v3M12 10.5L5 21.5M12 10.5l7 11M12 10.5v10"/>',
  bag: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4.5h6V7M3 12h18M10.5 12v2h3v-2"/>',
  phone: '<rect x="7.5" y="2.5" width="9" height="14" rx="2"/><path d="M11 14h2"/><path d="M12 16.5v2M7.5 21.5l4.5-3 4.5 3"/>',
  video: '<path d="M4 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path d="M17 11l5-3v8l-5-3"/><circle cx="9.5" cy="12" r="2.2"/>',
  mini: '<rect x="8" y="5" width="8" height="5" rx="1"/><path d="M12 10v2.5M12 12.5l-6 5.5M12 12.5l6 5.5M12 12.5V18"/><path d="M3 20.5h18"/>',
  monopod: '<rect x="8.5" y="2.5" width="7" height="4.5" rx="1"/><path d="M12 7v13M9.5 21.5L12 20l2.5 1.5M10.5 11h3M10.5 15h3"/>',
  ballhead: '<path d="M8 4.5h8M12 4.5v1.5"/><circle cx="12" cy="10.5" r="4.5"/><path d="M16.5 10.5H20M9 16.5h6l1.5 4h-9z"/>',
  plate: '<path d="M3 10l2-3h14l2 3v4l-2 3H5l-2-3z"/><circle cx="12" cy="12" r="1.6"/><path d="M6.5 12h2M15.5 12h2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const CATEGORY_ICON = {
  'travel-tripods': 'bag', 'camera-tripods': 'tripod', 'phone-tripods': 'phone', 'video-tripods': 'video',
  'tabletop-mini-tripods': 'mini', monopods: 'monopod', 'tripod-heads': 'ballhead', 'tripod-accessories': 'plate',
};
const TYPE_LABEL = { roundup: 'Buying guide', review: 'Review', comparison: 'Comparison', 'how-to': 'How-to', guide: 'Guide' };

const svgUri = (inner, color, stroke = 1.6) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" color="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
  ).toString('base64')}`;
export const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#1f1c1a"/><rect x="12.5" y="6.5" width="15" height="8.5" rx="1.6" fill="#f5f2ec"/><rect x="14.5" y="5" width="4" height="2.4" rx=".6" fill="#f5f2ec"/><circle cx="20" cy="10.75" r="2.5" fill="#1f1c1a"/><rect x="18.4" y="15" width="3.2" height="3.2" fill="#f5f2ec"/><path d="M20 18.5L10 34M20 18.5L30 34M20 18.5V33" stroke="#f5f2ec" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M16.4 24.1L14.2 27.5" stroke="#f97316" stroke-width="4.4" fill="none"/></svg>';
const LOGO = `data:image/svg+xml;base64,${Buffer.from(
  LOGO_SVG,
).toString('base64')}`;

const h = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });
const img = (src, w, ht, style = {}) => ({ type: 'img', props: { src, width: w, height: ht, style } });

function hash(s) {
  let x = 0;
  for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return x;
}

function layout({ title, category, articleType, slug, kicker, label, iconName, blankCard = false }) {
  const catName = kicker ?? SITE.categories.find((c) => c.slug === category)?.name ?? 'Tripod guides';
  const icon = ICONS[iconName ?? CATEGORY_ICON[category]] ?? ICONS.tripod;
  const tilt = (hash(slug) % 2 ? 1 : -1) * (2 + (hash(slug) % 3));
  const size = title.length > 64 ? 52 : title.length > 46 ? 58 : 66;
  const text = (t, style = {}) => h('div', style, t);

  return h('div', { width: 1200, height: 630, background: C.drywall, fontFamily: 'Bricolage', position: 'relative' }, [
    // Left: text column
    h('div', { position: 'absolute', left: 72, top: 60, width: blankCard ? 640 : 660, height: 510, flexDirection: 'column', justifyContent: 'space-between' }, [
      h('div', { alignItems: 'center', color: C.tapeInk, fontSize: 26, fontWeight: 700 }, [img(svgUri(icon, C.tapeInk, 2), 34, 34, { marginRight: 12 }), text(catName)]),
      text(title, { fontSize: size, fontWeight: 800, color: C.ink, lineHeight: 1.06, letterSpacing: '-0.03em' }),
      h('div', { alignItems: 'center', fontSize: 26, fontWeight: 700, color: C.ink }, [
        img(LOGO, 44, 44, { marginRight: 14 }),
        text(SITE.name),
        text(SITE.domain, { fontFamily: 'Serif', fontWeight: 400, color: C.slate, fontSize: 24, marginLeft: 16 }),
      ]),
    ]),
    // Right: spec-sheet card with the category drawing and a gaffer-tape strip.
    // blankCard: an upright, empty card; the article page places the real
    // Amazon product photo (served from Amazon) over it at HERO_PHOTO_BOX.
    blankCard
      ? h('div', { position: 'absolute', left: 1200, top: 0, width: 1, height: 1 }, [])
      : h('div', { position: 'absolute', left: 820, top: 110, width: 300, height: 400, background: C.paper, border: `2px solid ${C.rule}`, transform: `rotate(${tilt}deg)`, flexDirection: 'column', padding: '58px 26px 26px' }, [
          h('div', { justifyContent: 'space-between', fontFamily: 'Serif', fontSize: 17, color: C.slate, borderBottom: `2px solid ${C.rule}`, paddingBottom: 10, width: 248 }, [text('Spec-checked'), text('No hype')]),
          h('div', { flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, [img(svgUri(icon, C.ink, 1.3), 190, 190)]),
        ]),
    text(label ?? TYPE_LABEL[articleType] ?? 'Guide', { position: 'absolute', left: blankCard ? 860 : 860, top: blankCard ? 70 : 86, background: C.tape, color: '#fff', fontSize: 26, fontWeight: 700, padding: '12px 26px', transform: `rotate(${blankCard ? -2 : -tilt - 1}deg)` }),
  ]);
}

export async function renderFeatured(post, { dir = OUT_DIR, urlBase = '/images/featured' } = {}) {
  const svg = await satori(layout(post), { width: 1200, height: 630, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${post.slug}.png`), png);
  return `${urlBase}/${post.slug}.png`;
}

/** Share images for non-article pages (home, categories, tools). */
export async function renderPageImages() {
  const dir = path.join(ROOT, 'public/images/og');
  const pages = [
    { slug: 'home', title: 'The right tripod for your camera, your bag and your shot', kicker: 'Honest tripod buying guides', label: 'Spec-checked', iconName: 'tripod' },
    { slug: 'tripod-buying-checklist', title: `The ${SITE.name} Buying Checklist: 20 things to check`, kicker: "Free buyer's tool", label: 'Checklist', iconName: 'check' },
    { slug: 'blog', title: 'Every tripod, monopod and head buying guide', kicker: 'All guides', label: 'Guides', iconName: 'tripod' },
    ...SITE.categories.map((c) => ({ slug: `category-${c.slug}`, title: `${c.name}: buying guides and picks`, kicker: c.name, category: c.slug, label: 'Category' })),
  ];
  for (const p of pages) await renderFeatured(p, { dir, urlBase: '/images/og' });
  return pages.length;
}

/** Brand assets: public/logo-512.png (schema.org logo) and public/og-default.png. */
export async function renderBrandImages() {
  const logo = new Resvg(LOGO_SVG, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
  fs.writeFileSync(path.join(ROOT, 'public/logo-512.png'), logo);
  await renderFeatured(
    { slug: 'og-default', title: 'Honest tripod buying guides', kicker: SITE.domain, label: 'Spec-checked', iconName: 'tripod' },
    { dir: path.join(ROOT, 'public'), urlBase: '' },
  );
  return 2;
}

const HERO_DIR = path.join(ROOT, 'public/images/hero');

/** Generate (if missing) and attach the featured image to a post's frontmatter.
 *  Also renders the article-header base (same design, blank product card). */
export async function ensureFeatured({ slug, file, data, content }, { force = false } = {}) {
  const target = path.join(OUT_DIR, `${slug}.png`);
  const base = { slug, title: data.title, category: data.category, articleType: data.articleType, blankCard: true };
  if (force || !fs.existsSync(path.join(HERO_DIR, `${slug}.png`))) await renderFeatured(base, { dir: HERO_DIR, urlBase: '/images/hero' });
  if (!force && fs.existsSync(target) && data.heroImage) return false;
  const url = await renderFeatured({ slug, title: data.title, category: data.category, articleType: data.articleType });
  writePost(slug, { ...data, heroImage: url, heroAlt: `${data.title}: ${SITE.name} ${TYPE_LABEL[data.articleType]?.toLowerCase() ?? 'guide'}` }, content);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force');
  let n = 0;
  for (const post of listPosts()) if (await ensureFeatured(post, { force })) n++;
  console.log(`featured images: ${n} generated`);
  if (process.argv.includes('--pages')) console.log(`page share images: ${await renderPageImages()}`);
  if (process.argv.includes('--brand')) console.log(`brand images: ${await renderBrandImages()}`);
}
