// AGENT 2 — Product Research
// Uses live web search to find real, currently-sold products for a keyword,
// judged on the Best Tripod criteria (stability, portability, working height,
// build, value). Output feeds the "Top picks" boxes and the
// writer. Links are built from the product name + your Amazon tag; an ASIN is
// only used when the agent saw it in an amazon.com/dp/ URL in its sources.
import { z } from 'zod';
import { askJson } from './lib/claude.mjs';
import { SITE, log } from './lib/config.mjs';
import { hasAmazonApi, matchProduct } from './lib/amazon.mjs';

const AGENT = 'product-agent';

export const ProductSchema = z.object({
  name: z.string().min(3),
  brand: z.string(),
  query: z.string().min(3),
  asin: z
    .string()
    .regex(/^B0[A-Z0-9]{8}$/)
    .or(z.literal(''))
    .optional(),
  badge: z.string().max(40),
  summary: z.string(),
  renterNote: z.string(),
  pros: z.array(z.string()).min(2).max(5),
  cons: z.array(z.string()).min(1).max(4),
  facts: z.array(z.string()).max(12),
  sources: z.array(z.string()).max(8),
});

import { productCountFor } from './lib/product-count.mjs';

// The number of products varies per post (see lib/product-count.mjs).
const COUNT_NOTE = { comparison: ' (the products being compared first, then alternatives)', review: ' (the reviewed product first, then alternatives)' };

const SYSTEM = `You are the Product Research Agent for ${SITE.domain}. You find REAL tripods, monopods, heads and tripod accessories currently sold on Amazon US and evaluate them for photographers and video creators.

Hard rules:
- Only include products you verified exist and are currently sold, using web_search (manufacturer pages, Amazon listings, reputable reviews from the last 18 months). Never invent model names, specs, prices or ratings.
- "query" must be the exact product name a shopper would type into Amazon search to land on that listing (brand + model + generation).
- "asin": only fill it if you saw the ASIN in an amazon.com/dp/ or /gp/product/ URL in your search results; otherwise use an empty string.
- Do NOT state prices (they change). Do NOT invent star ratings or review counts.
- "renterNote" (shown to readers as "Who it's for"): one sentence on the shooter and kit it suits and the key caveat, e.g. "Mirrorless shooters with a 24-70mm who fly carry-on; reaches eye level only with the center column raised."
- "facts": verifiable specs from the maker: max height with and without the center column, minimum height, folded length (with head if listed), weight, rated max load, leg sections, leg lock type (twist or flip), material (carbon fiber or aluminum), head type, plate standard (Arca-Swiss or proprietary), mounting threads, bowl size for video legs. The writer may cite only these.
- "badge": short role label like "Best overall", "Best budget", "Best for carry-on", "Best for astrophotography", "Best for video".
- Rank by fit for the searcher's use case (travel, landscape, astro, video, vlogging, phone), then stability and build, then value.`;

export async function runProductAgent(item) {
  const { products } = await askJson({
    agent: AGENT,
    system: SYSTEM,
    effort: 'medium',
    webSearch: 10,
    schema: z.object({ products: z.array(ProductSchema).min(1).max(8) }),
    prompt: `Keyword: "${item.keyword}"
Article type: ${item.articleType}
Working title: ${item.workingTitle}
Secondary keywords: ${item.secondaryKeywords.join(', ')}

Research and return exactly ${item.productCount ?? productCountFor(item)} products${COUNT_NOTE[item.articleType] ?? ''} that best serve a photographer or video creator searching this keyword. Prefer models with published height, folded length, weight and load specs.

Return ONLY a \`\`\`json block: {"products":[{"name":"","brand":"","query":"","asin":"","badge":"","summary":"2 sentences on who it is for and why","renterNote":"","pros":[""],"cons":[""],"facts":[""],"sources":["urls"]}]}`,
  });
  const out = products.map((p) => ({ ...p, asin: p.asin || undefined }));
  if (!hasAmazonApi()) return out;
  // Verify each product against the live Amazon catalog: real ASIN + product image.
  for (const p of out) {
    try {
      const hit = await matchProduct(p.name, p.query, p.brand);
      if (hit) {
        p.asin = hit.asin;
        p.image = hit.image;
      }
    } catch (e) {
      log(AGENT, `Amazon lookup failed for "${p.name}": ${e.message}`);
    }
  }
  return out;
}
