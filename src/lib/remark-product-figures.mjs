import { amazonUrl, AFFILIATE_REL } from './affiliate.mjs';
import { CRITERIA, productScore } from './score.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const textOf = (node) => (node.value ?? '') + (node.children ?? []).map(textOf).join('');
const tokens = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean));

/** A heading matches a product if it contains the full name, or if every word of
 *  its subject (the part before ":") appears in the product name, e.g.
 *  "Befree Advanced: best budget" → "Manfrotto Befree Advanced Aluminum Travel Tripod". */
export function matches(headingText, name) {
  const h = headingText.toLowerCase();
  if (h.includes(name.toLowerCase())) return true;
  const subject = [...tokens(h.split(':')[0])];
  const nameTokens = tokens(name);
  return subject.length >= 2 && subject.every((t) => nameTokens.has(t));
}

/** Credit line shown under every product photo. */
export function imageCredit(p) {
  const via = p.brand && !/^amazon$/i.test(p.brand) ? `${p.brand} via ` : '';
  return `Image: ${via}Amazon.com`;
}

/** "Best Tripod Score 4.6/5" badge with the criteria behind it. */
export function scoreHtml(p) {
  const score = productScore(p.scores);
  if (score == null) return '';
  const rows = CRITERIA.filter((c) => typeof p.scores[c.key] === 'number')
    .map((c) => `<li><span>${esc(c.label)}</span><span class="bar"><i style="width:${p.scores[c.key] * 10}%"></i></span><b>${p.scores[c.key]}/10</b></li>`)
    .join('');
  return (
    `<details class="rscore"><summary><span class="rscore-num">${score.toFixed(1)}</span><span class="rscore-label">Best Tripod Score <small>out of 5</small></span></summary>` +
    `<ul>${rows}</ul>${p.scoreNote ? `<p>${esc(p.scoreNote)}</p>` : ''}<p class="rscore-how"><a href="/how-we-score/">How we score</a></p></details>`
  );
}

/** Product block in the style of a magazine buying guide: gallery of official
 *  Amazon photos with a credit line, a buy button, and what we like / don't like. */
export function productBlockHtml(p, { badge = false, style = 'pros-cons' } = {}) {
  const href = esc(amazonUrl({ asin: p.asin, query: p.query }));
  const imgs = [p.image, ...(p.gallery ?? [])].filter((x) => x?.url);
  const main = imgs[0];
  const thumbs = imgs.length > 1
    ? `<div class="pg-thumbs" role="list">${imgs.map((im, n) =>
        `<button type="button" role="listitem" class="pg-thumb${n === 0 ? ' is-on' : ''}" data-src="${esc(im.url)}" aria-label="Show photo ${n + 1} of ${esc(p.name)}">` +
        `<img src="${esc(im.url)}" alt="" width="64" height="64" loading="lazy" decoding="async" /></button>`).join('')}</div>`
    : '';
  const like = (p.pros ?? []).map((x) => `<li>${esc(x)}</li>`).join('');
  const dislike = (p.cons ?? []).map((x) => `<li>${esc(x)}</li>`).join('');
  return (
    `<div class="pblock">` +
    (badge ? `<p class="pblock-badge">${esc(p.badge)}</p>` : '') +
    (main
      ? `<figure class="pgallery"><a class="pg-main" href="${href}" rel="${AFFILIATE_REL}" target="_blank">` +
        `<img src="${esc(main.url)}" alt="${esc(p.name)}" width="${main.width ?? 500}" height="${main.height ?? 500}" loading="lazy" decoding="async" /></a>` +
        thumbs +
        `<figcaption>${esc(p.name)}. <span class="credit">${esc(imageCredit(p))}</span></figcaption></figure>`
      : '') +
    scoreHtml(p) +
    `<a class="btn btn-buy pblock-cta" href="${href}" rel="${AFFILIATE_REL}" target="_blank">Check price on Amazon</a>` +
    (style === 'pros-cons' && (like || dislike)
      ? `<div class="likes"><div class="like"><p class="likes-h">What we like</p><ul>${like}</ul></div>` +
        `<div class="dislike"><p class="likes-h">What we don't like</p><ul>${dislike}</ul></div></div>`
      : '') +
    (style === 'specs' && p.specs && Object.keys(p.specs).length
      ? `<table class="spec-table"><caption>Key specs</caption><tbody>${Object.entries(p.specs)
          .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)
          .join('')}</tbody></table>`
      : '') +
    `<p class="pblock-fit"><b>Who it's for:</b> ${esc(p.renterNote)}</p>` +
    `</div>`
  );
}

/**
 * Image–text alignment: when a "### Product name" heading in the body matches a
 * product from frontmatter, insert that product's block (photos, credit, buy
 * button, likes/dislikes) directly under the heading, so each image sits in the
 * same block as the text that describes it. The names placed in the body are
 * exposed as `productsInBody` so the page only renders cards for the rest.
 */
export function remarkProductFigures() {
  return (tree, file) => {
    const fm = file.data?.astro?.frontmatter;
    const products = fm?.products ?? [];
    const used = new Set();
    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i];
      if (node.type !== 'heading' || node.depth !== 3) continue;
      const heading = textOf(node);
      const p = products.find((x) => !used.has(x.name) && matches(heading, x.name));
      if (!p) continue;
      used.add(p.name);
      node.data = { ...node.data, hProperties: { ...(node.data?.hProperties ?? {}), id: `pick-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` } };
      tree.children.splice(i + 1, 0, { type: 'html', value: productBlockHtml(p, { style: fm?.productStyle ?? 'pros-cons' }) });
      i++;
    }
    if (fm) fm.productsInBody = [...used];
    addSectionPhotos(tree, products, used);
  };
}

const MAX_SECTION_PHOTOS = 4;

/**
 * Body photos: sections that don't already hold a product block get one of
 * the products' extra official Amazon photos (gallery) after their opening
 * paragraph, with a credit line, cycling through the products so the
 * article reads like a photo-led buying guide.
 */
function addSectionPhotos(tree, products, inBody) {
  const pool = [];
  const maxLen = Math.max(0, ...products.map((p) => (p.gallery ?? []).length));
  for (let n = 0; n < maxLen; n++) {
    for (const p of products) {
      const g = p.gallery ?? [];
      // Products with their own block already show gallery[0] as a thumbnail; start later for them.
      const idx = inBody.has(p.name) ? n + 1 : n;
      if (g[idx]?.url) pool.push({ p, im: g[idx] });
    }
  }
  if (!pool.length) return;
  const isProductBlock = (node) => node.type === 'html' && node.value.startsWith('<div class="pblock">');
  let placed = 0;
  for (let i = 0; i < tree.children.length && placed < MAX_SECTION_PHOTOS && pool.length; i++) {
    const node = tree.children[i];
    if (node.type !== 'heading' || node.depth !== 2) continue;
    let end = i + 1;
    while (end < tree.children.length && !(tree.children[end].type === 'heading' && tree.children[end].depth === 2)) end++;
    const section = tree.children.slice(i + 1, end);
    if (section.some(isProductBlock)) continue;
    const firstPara = section.findIndex((x) => x.type === 'paragraph');
    if (firstPara < 0) continue;
    const { p, im } = pool.shift();
    const href = esc(amazonUrl({ asin: p.asin, query: p.query }));
    tree.children.splice(i + 1 + firstPara + 1, 0, {
      type: 'html',
      value:
        `<figure class="section-photo"><a href="${href}" rel="${AFFILIATE_REL}" target="_blank">` +
        `<img src="${esc(im.url)}" alt="${esc(p.name)}" width="${im.width ?? 500}" height="${im.height ?? 500}" loading="lazy" decoding="async" /></a>` +
        `<figcaption>${esc(p.name)}. <span class="credit">${esc(imageCredit(p))}</span></figcaption></figure>`,
    });
    placed++;
  }
}
