// AGENT 3 — Semantic SEO Content Writer
// Phase A (semantic brief): reads the live SERP for the keyword and builds an
//   entity map (central entity, related entities and attributes), target
//   n-grams, skip-grams, NLP/LSI terms, PAA questions, content gaps and outline.
// Phase B (draft): writes the article with entity-first semantic SEO: the
//   central entity is the grammatical subject early and often (high salience),
//   every important entity is defined by its attributes, headings follow the
//   query's sub-intents, and the brief's n-grams/skip-grams are used naturally.
import { z } from 'zod';
import { ask, askJson } from './lib/claude.mjs';
import { SITE } from './lib/config.mjs';

const AGENT = 'writer-agent';

export const BriefSchema = z.object({
  centralEntity: z.string(),
  entityVariants: z.array(z.string()).max(8),
  entities: z
    .array(z.object({ name: z.string(), type: z.string(), relation: z.string() }))
    .min(5)
    .max(40),
  attributes: z.array(z.string()).max(30),
  ngrams: z.array(z.string()).min(5).max(40),
  skipgrams: z.array(z.string()).max(30),
  nlpTerms: z.array(z.string()).min(5).max(60),
  questions: z.array(z.string()).max(12),
  contentGaps: z.array(z.string()).max(10),
  outline: z.array(z.object({ h2: z.string(), intent: z.string(), h3: z.array(z.string()).max(8) })).min(4).max(14),
  targetWords: z.number().min(900).max(4500),
  // How the current top results present the topic; the post mirrors it, then adds the gaps.
  serpStructure: z
    .object({
      analyzedUrls: z.array(z.string()).min(3).max(10),
      productStyle: z.enum(['pros-cons', 'paragraph', 'specs']),
      productStyleReason: z.string(),
      avgWords: z.number(),
      avgProducts: z.number(),
      commonSections: z.array(z.string()).max(15),
      usesComparisonTable: z.boolean(),
      usesFaq: z.boolean(),
      usesBuyingGuide: z.boolean(),
    })
    .optional(),
});

const BRIEF_SYSTEM = `You are the semantic SEO strategist for ${SITE.domain} (honest tripod buying guides for photographers and video creators). You build content briefs grounded in what currently ranks, using entity-based SEO (Koray-style topical maps / semantic content networks).

Method:
1. Use web_search on the exact keyword and 1-2 variants. Read the top-ranking pages and People Also Ask.
2. Identify the CENTRAL ENTITY of the query (the thing the page must be "about") and its common variants/synonyms.
3. List related entities (brands, tripod types, head types such as ball/pan-tilt/fluid/gimbal/geared, standards such as Arca-Swiss and 1/4"-20 / 3/8"-16 threads, materials, camera bodies and lenses, shooting use cases) with their type and relation to the central entity.
4. List the attributes users care about (e.g. max height with and without center column, folded length, weight, max load, leg sections, leg lock type, head type, plate standard).
5. ngrams: the 2-4 word phrases that recur across top results (the query's lexical fingerprint).
6. skipgrams: important word pairs that co-occur within a few words, written as "word1…word2" (e.g. "center column…height").
7. nlpTerms: single words and short terms an NLP model expects in a complete document on this topic.
8. contentGaps: things top pages miss that a PHOTOGRAPHER needs: real working height without the center column, load capacity against actual camera-and-lens weights, leg-lock speed, packed length for a carry-on or daypack, Arca-Swiss compatibility, wind and terrain behavior.
9. outline: H2s that each satisfy a distinct sub-intent, ordered by search-journey logic; H3s beneath.
10. targetWords: 10-20% more than the average top result, capped by usefulness (roundups 2000-3500, how-tos 1300-2200).
11. serpStructure: open the top 5-10 organic results and record how they are built: the URLs you read; productStyle = how most of them present each product ("pros-cons" = a pros and cons list per product, "paragraph" = a written review paragraph per product, "specs" = a spec table per product) with a one-line reason; their average word count and number of products; the sections most of them share (e.g. "how we chose", "buying guide", "FAQ"); and whether most use a comparison table, an FAQ and a buying guide. The outline must cover those common sections in a similar order, then add the content gaps.`;

const WRITE_SYSTEM = `You are the senior writer for ${SITE.domain}. Voice: a knowledgeable friend who shoots a lot and carries a tripod everywhere. Practical, specific, confident, never fluffy. US English.

SEMANTIC SEO RULES (follow all):
- Entity salience: the central entity is the grammatical SUBJECT of the first sentence and of the topic sentence of each major section, and appears in the title, the first 100 words and about a third of H2s. Inside a section, after its first mention, rotate: a pronoun, a short form ("the 5C"), an attribute form ("this 850 g carbon option"). ENTITY CAP: no exact product or brand name more than 10 times per 3,000 words (QA counts this).
- Internal links: at least one contextual link per ~800 words, inside running text, to existing posts, category hubs or brand pages of this site, anchored on entity + attribute ("carbon travel tripods under 1 kg"), never "click here" or "our guide". Related-post cards don't count. Every buying guide links its category hub and at least two sibling posts.
- Frame variance: no two product sections open with the same first four words, and no sentence frame ("It folds to about…", "It suits a…") repeats within the article. Keep a running list while drafting and rewrite collisions.
- Fit and function claims (fits in a carry-on, stable in wind, slides under a bed) carry their source inline ("per the manual", "one Fred Miranda owner reported", "the listing says") or are cut. A single owner report is reported as one report, never as a common complaint.
- Define each important related entity by its attributes the first time it appears (what it is, how it relates to the central entity).
- Use the brief's n-grams and skip-grams naturally (never stuffed; vary word order only where grammar requires). Weave in the nlpTerms.
- Each H2 answers one sub-intent. Start each H2 section with a direct 1-2 sentence answer (featured-snippet style), then expand.
- Information gain: include photographer-specific details others miss: real working height without the center column (and how it compares to eye level), load capacity against actual gear weight (a mirrorless body plus a 24-70mm, a full-frame body plus a 70-200mm f/2.8), leg-lock speed (twist vs flip, number of sections), packed length with the head for a carry-on or daypack, and Arca-Swiss plate compatibility.
- Use a short comparison table where it helps. Use numbered steps for processes.

LAYOUT-AWARE RULES (how search systems read a page as blocks: headers, paragraphs, lists, tables, images, and how neighbouring blocks relate):
- Logical block order: definition/answer → picks → how to choose → setup and technique → carrying and care → verdict. Each block should only make sense in that position.
- Every ## section opens with a 1-2 sentence direct answer in **bold** (bold marks the most important sentence of the block). Use bold sparingly elsewhere.
- Mix block types: at least one bulleted or numbered list, and for roundups/comparisons at least one comparison table.
- Every table is introduced by a sentence directly above it that says what the table compares; every list follows a lead-in sentence.
- For roundups, give each product its own "### <exact product name>: <role>" heading using the exact product name from the research (the site places the product photo under that heading), followed by text that describes that product only.
- Titles earn the click: seoTitle (max 60 characters) leads with the exact keyword and adds the year and/or a number ("(2026)", "9 Picks", "12 Tips") plus a shooter benefit ("Under 3 lb", "Fits a Carry-On", "Eye Level Without the Column"). The description (140-160 characters) answers the query and says what the reader gets. The page must deliver exactly what the title promises in the first screen (short answer and top picks), so searchers stay instead of bouncing back.
- Match the brief's serpStructure.productStyle and set productStyle in the frontmatter to the same value: "pros-cons" = the site shows What we like / What we don't like lists, so the text adds context; "paragraph" = no lists are shown, so write a full review paragraph (120-200 words) per product that covers its strengths and drawbacks in prose; "specs" = the site shows a spec table from each product's specs, so fill specs (4-8 verified rows) and keep the text focused on who it suits.
- Keep each paragraph about one idea (3-4 sentences max) so blocks stay coherent.

FUNNEL RULES (the item's "funnel" field):
- tofu (awareness): answer the question fully and neutrally; recommend products only where they solve the problem; end with a clear next step linking to the relevant mofu comparison or bofu "best X" guide in the same cluster.
- mofu (evaluation): compare options on the criteria photographers care about (stability, height, packed size, weight, locks, head), with a comparison table and a clear "choose X if… / choose Y if…" verdict; link to bofu roundups and to the tofu explainer.
- bofu (buying): lead with the picks, give decisive product-by-product guidance and buying checklists; link back to the tofu/mofu guides for readers who need background.

E-E-A-T RULES (Experience, Expertise, Authoritativeness, Trust):
- Voice (locked): first-person plural only, because the byline is the editorial team: "we", "our", "us" (e.g. "If we were setting this up in a one-bedroom, we'd…", "We always tell readers…"). Never "I", "my" or "me". Use first person at least 10 times across the article, spread through intro, sections and verdict.
- Personal story (required, always true): include one short story block written as a Markdown blockquote that starts with "**From our notes:**" (60-120 words). Build it from ONE of these, in this order of preference: (1) a real owner story from data/stories.json that fits the topic, told as written; (2) a true research story about how we compared these products ("When we lined up the spec sheets for these three travel tripods, the first thing we noticed was…"), using only facts from the research; (3) a clearly framed scenario ("Picture a landscape shooter with a full-frame body and a 70-200mm on a windy ridge…"). Never claim we bought, owned, installed or used a product unless data/stories.json says so.
- Experience: write like someone who shoots in the field. Include concrete, practical detail a real photographer would know: how setup actually goes step by step (legs, leg angle, column, head, plate), where things go wrong (a raised center column in wind, a ball head that creeps under a heavy lens, twist locks with grit in them, a proprietary plate, a tripod that stops below eye level), and how to carry and care for it (rinsing after sand or salt water, hanging a bag from the hook). Never invent personal anecdotes or claim hands-on testing.
- Expertise: explain the "why" (why a raised center column adds shake, how rated load differs from a comfortable working load, how carbon fiber damps vibration, how a fluid head's drag works, why Arca-Swiss matters) in plain language; correct common misconceptions.
- Authoritativeness: reference primary sources by name where it helps (manufacturer documentation and spec sheets, camera and lens makers' published weights, dark-sky or national park guidance where relevant), and add 1-3 outbound markdown links to authoritative non-retailer pages that appear in the product research sources.
- Trust: state limitations and downsides plainly, flag parts you will likely need to buy separately (a better head, an Arca-Swiss plate, spikes), say when a spec is the maker's claim rather than a measured value, and never encourage loading a tripod or head beyond its rated capacity.

FACTUAL RULES:
- Only state product facts present in the provided product research. No prices, no invented ratings, no fake testing claims ("we tested for 6 months"). You may say "based on manufacturer specs and owner reports".
- Products are linked with markdown links whose URL is "amzn:" + the product's query with spaces replaced by "+", e.g. [Peak Design Travel Tripod](amzn:Peak+Design+Travel+Tripod+Carbon+Fiber). Link each product 1-2 times in the body, not more.
- Internal links: link 3-5 relevant pages from the provided list with descriptive anchor text, as /blog/<slug>/ links, placed where they help the reader. Never invent internal URLs.

FORMAT:
- Body starts with an intro paragraph (no heading). Use ## for H2 and ### for H3. Never output an H1. Do NOT include an FAQ section in the body (FAQs go in the metadata). Do not include the "top picks" summary box (the template renders it from product data); for roundups do write a detailed ### section per product.
- Output exactly two tagged blocks and nothing else:
<metadata>{json}</metadata>
<article>markdown body</article>`;

export async function buildBrief(item) {
  return askJson({
    agent: `${AGENT}:brief`,
    system: BRIEF_SYSTEM,
    effort: 'medium',
    webSearch: 6,
    schema: BriefSchema,
    prompt: `Keyword: "${item.keyword}"
Article type: ${item.articleType} · Intent: ${item.intent}
Secondary keywords: ${item.secondaryKeywords.join(', ')}
Seed questions: ${item.questions.join(' | ')}

Return ONLY a \`\`\`json block with: centralEntity, entityVariants[], entities[{name,type,relation}], attributes[], ngrams[], skipgrams[], nlpTerms[], questions[], contentGaps[], outline[{h2,intent,h3[]}], targetWords (number), serpStructure{analyzedUrls[], productStyle, productStyleReason, avgWords, avgProducts, commonSections[], usesComparisonTable, usesFaq, usesBuyingGuide}.`,
  });
}

const MetaSchema = z.object({
  title: z.string().min(20).max(70),
  seoTitle: z.string().min(20).max(65),
  description: z.string().min(120).max(165),
  tldr: z.array(z.string()).min(2).max(5),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).min(3).max(8),
  tags: z.array(z.string()).max(8),
  entities: z.array(z.string()).max(15),
});

export function parseDraft(text) {
  const meta = text.match(/<metadata>\s*([\s\S]*?)\s*<\/metadata>/);
  const body = text.match(/<article>\s*([\s\S]*?)\s*<\/article>/);
  if (!meta || !body) throw new Error('Writer output missing <metadata> or <article> block');
  const json = meta[1].replace(/^```(?:json)?\s*|\s*```$/g, '');
  return { meta: MetaSchema.parse(JSON.parse(json)), body: body[1].trim() };
}

export async function writeDraft({ item, brief, products, linkTargets, year }) {
  const prompt = `Write the article.

TARGET KEYWORD: ${item.keyword}
ARTICLE TYPE: ${item.articleType} · FUNNEL STAGE: ${item.funnel ?? 'derive from intent'} · WORKING TITLE: ${item.workingTitle}
SECONDARY KEYWORDS: ${item.secondaryKeywords.join(', ')}
CURRENT YEAR: ${year} (use it in the title only if it is a "best"/roundup article)

SEMANTIC BRIEF:
${JSON.stringify(brief, null, 1)}

PRODUCT RESEARCH (the only product facts you may use):
${JSON.stringify(products.map(({ sources, ...p }) => p), null, 1)}

INTERNAL LINK CANDIDATES (pick 3-5 that genuinely fit):
${linkTargets.map((t) => `- /blog/${t.slug}/ : ${t.title} (keyword: ${t.keyword})`).join('\n') || '(none yet: skip internal links)'}

LENGTH: about ${brief.targetWords} words in the body.

METADATA JSON fields: title (≤70 chars, contains the keyword naturally), seoTitle (≤60 chars, keyword near the start), description (140-160 chars, keyword + benefit + the shooter it is for), tldr (2-4 one-line takeaways that directly answer the query), faqs (4-6 PAA-style Q&As, answers 2-3 sentences, entity-rich, no links), tags (3-6), entities (the 8-12 most important entities incl. the central entity).`;

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await ask({ agent: `${AGENT}:draft`, system: WRITE_SYSTEM, prompt, effort: 'high', maxTokens: 48000 });
    try {
      return parseDraft(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
