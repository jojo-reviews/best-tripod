# Daily publishing routine (Claude Routine playbook)

A scheduled Claude Code session runs this playbook once a day. It does the work of
the four agents in `agents/` itself (no Anthropic API key needed), then pushes,
which triggers the Cloudflare deploy and the Amazon image refresh.

**Clicks and long visits (Google's click-validated quality):** titles must earn the click and the page must keep
the visit. seoTitle (max 60 characters) = exact keyword + year and/or a number + a shooter benefit ("Under 3 lb",
"Fits a Carry-On"); the description
answers the query; the first screen delivers the promise (short answer, top picks). Never buy links or ask for paid
links: links that searchers don't confirm with clicks are discounted, and spam-prone queries lean on clicks.

**Best Tripod Score (every product):** give each product `scores` {stability, portability (weight and folded
length), height (max/min working height; leave out for products where it doesn't apply, e.g. plates, clamps, bags),
build (materials, leg locks, head quality), value}, each 1-10 using the rubric on `/how-we-score/`, and a
one-line `scoreNote` with the reasons. The site computes the 1-5 score and the Product + Review schema. Never use or
copy Amazon (or any store's) star ratings or review counts.

**Voice and personal story (every post):** first person throughout (I, my, me, we, our, us; at least 10 uses),
plus one `> **From our notes:**` story block (60-120 words). Use a real owner story from `data/stories.json` if one
fits, otherwise a true research story (how we compared the products, what stood out in the manuals and specs), or a
clearly framed scenario ("Picture a landscape shooter with a full-frame body and a 70-200mm on a windy ridge…"). Never claim we bought, owned, installed or tested a product unless
`data/stories.json` says so (then set `ownerStory: true` in the frontmatter). The QA agent checks both.

**Photographer angle (every post):** write for someone choosing camera support for a real use case (travel,
landscape, astro, video, vlogging, phone). Information gain over other pages: real working height without the center
column, load capacity against actual camera-and-lens weight, leg-lock speed (twist vs flip, sections), packed length
with the head for a carry-on or daypack, and Arca-Swiss compatibility. Link the buying checklist
(`/tripod-buying-checklist/`) where it helps.

**Old-URL recovery (generic mechanism):** if this domain ever has indexed URLs that need new homes, add them to
`data/redirects.json` (`from`, `to`, optional `pendingSlug`) and queue the replacement keyword with
`restoresOldUrl`. Keep its `slug` exactly as queued; the old URL 302s to `to` until the `pendingSlug` post is live
and passes QA, then 301s to `/blog/<slug>/`.

**Owner-supplied keywords:** queue items with `source: "user"` came from the site owner. Write them as given:
they skip the volume cap and the cannibalization check, and `next` serves them first. Items marked
`duplicateOf` share intent with a live post, so they're queued last; give them a distinct angle from that post.

**Agents and models (saves tokens):** don't do every step yourself. Hand each step to its subagent in
`.claude/agents/` with the Agent tool (`subagent_type` = the agent's name), passing the slug, keyword item,
productCount and slot time it needs, and act on what it returns:
| Step | Agent | Model |
|---|---|---|
| 1, 2b keywords | `keyword-agent` | sonnet |
| 3 products | `product-agent` | sonnet |
| 4 brief + serpStructure | `brief-agent` | sonnet |
| 6-7 write + audit | `writer-agent` | opus |
| 7b fact check + QA, backlog re-check | `qa-agent` | sonnet |
| 8-9 finalize, build, push | `publisher-agent` | haiku |
**Live dashboard (optional):** if the owner has set up a runs dashboard artifact, use the ArtifactData tool to keep collection `runs` (doc id = slug: site, slug, title, url, pubDate, status
running|scheduled|live|failed, updatedAt ms, steps.{keyword,product,brief,writer,qa,publisher} = {state
running|done|failed, model, ms, note}) and `sites/<domain>` (quotaToday, publishedToday, pendingKeywords,
nextRun) up to date as each agent starts and finishes. Skip silently if the tool isn't available.
Run products and brief in parallel. You (the main session) only check status, pick the keyword and slot,
pass results between agents and write the final summary. If an agent fails, retry it once, then skip the post.

**Rules that always apply**
- Keep it natural, with something genuinely new for crawlers every day: a new post on most days
  (random times, quota 4-5), plus the daily QA backlog re-check of one older post. When the re-check
  changes the post's content, set `updatedDate` to now and `reviewedDate` to today; if nothing changed,
  set only `reviewedDate`. Never bump dates, reorder text or make cosmetic edits just to look fresh.
- Posts go live at random times of day: always use the `slots` times as pubDate, never the current time.
- Never publish more than the day's quota (`remainingToday`, at most 5 posts per day). The site owner does not want
  batches of posts going live at once, so never publish 5 (or several) posts in one go, even if asked by a scheduled prompt.
- Long-tail only: target keywords with ≤ 250 searches/month (Ahrefs). Never target short-tail head terms.
- No keyword cannibalization: before writing, run `node scripts/routine.mjs cannibal "<keyword>"`. If it reports
  a conflict, do not write a new post; add the keyword to that post's `secondaryKeywords` instead.
- Never invent product names, specs, prices, star ratings, review counts or testing
  claims. Only state what your web research supports. No prices at all.
- Never write secrets, API keys or tokens into any file.
- Never push a failing build. If something breaks and you can't fix it, stop and
  leave the repo unchanged (no commit).
- Work on the repository's default branch; push to it directly.

## 0. Setup
```bash
DEFAULT=$(git remote show origin | sed -n 's/.*HEAD branch: //p')
git fetch origin "$DEFAULT" && git checkout -B "$DEFAULT" "origin/$DEFAULT"
npm ci
node scripts/routine.mjs status
node scripts/qa.mjs --failing
```
If `--failing` lists posts, fix them first (they are blocked from going live). Then, as
QA backlog work, fact-check **one** older post whose QA report has a `LIVE POST, FIX` or
`facts not verified` warning: verify it against its sources, fix it, and run `factcheck` and `qa` for it.
If `remainingToday` is 0, stop here (no commit). Otherwise publish that many posts
(steps 2–8 per post).

## 1. Keyword research (only if `pendingKeywords` < 10)
Follow the rules in the `SYSTEM` prompt of `agents/keyword-agent.mjs`.
- Use **KGR-style long-tail** research (Keyword Golden Ratio). With the **Ahrefs**
  connector: `keywords-explorer-matching-terms` (country `us`, `terms: all`) with seeds
  from `data/seeds.json` (e.g. travel tripod, tripod for astrophotography, phone tripod, fluid head,
  ball head, monopod, arca swiss plate) and a `where` filter of
  `word_count ≥ 4`, `volume 10–250`, `difficulty ≤ 10`, `serp_domain_rating_top10_min ≤ 30`,
  excluding "rental", "repair" and "near me". Read the Ahrefs `doc` tool first for the schema.
- For the best 3–5 candidates run `serp-overview` (top 10 organic): count how many
  titles contain the exact phrase and note the weakest DR. Prefer keywords where few
  or no titles match exactly and low-DR sites, forums or Reddit rank (KGR-style win).
  Skip keywords where every result is a DR 70+ publisher.
- Pick ~10 winnable keywords with a clear photographer/tripod-buyer angle (travel, landscape, astro, video, vlogging, phone), each tagged `funnel: tofu|mofu|bofu` (see the funnel rule in the keyword agent prompt), that do not duplicate existing posts
  or queued keywords (same intent = duplicate). Merge variants that share a parent
  topic into `secondaryKeywords`.
- Write them to a temp JSON file as an array of
  `{keyword, category, articleType, intent, funnel, secondaryKeywords, questions, workingTitle, cluster, priority, rationale, ahrefs:{volume, kd, trafficPotential}}`
  and run `node scripts/routine.mjs add-keywords <file>`.
- If Ahrefs is unavailable, use web search for keyword ideas instead.

## 2. Pick the keyword
`node scripts/routine.mjs next` → use this item (it automatically parks keywords over 250 searches/month
and merges any keyword that would cannibalize an existing post). Its `slug` is the post slug. It already balances the
funnel (≈30% TOFU, 30% MOFU, 40% BOFU); follow the FUNNEL RULES in `WRITE_SYSTEM` for its `funnel` stage
and put `funnel: <stage>` in the frontmatter.

## 2b. Equivalent keywords from autocomplete
Search engines group "equivalent keywords" for a prefix and rank them by how often people search them
(the idea behind search-box autocomplete). Use that to make one post cover every way people phrase the
same need: run Ahrefs `keywords-explorer-search-suggestions` (or web search autocomplete) on the keyword
and on its first 2-3 words, keep suggestions with the SAME intent, and add the best 3-6 to
`secondaryKeywords` (they become H2/H3 wording, FAQ questions and meta keywords). Suggestions with a
different intent go to the queue as their own keywords instead, never into this post (no cannibalization).

## 3. Product research
**Pick products from the top 10 (required).** Search the post's primary keyword on Google (WebSearch;
also `best <product type>` if the keyword is a question). Take the top 10 organic pages, skipping Amazon,
shopping and video results, and list the products each page recommends (read the page with WebFetch when it
loads, otherwise search `"<site>" <keyword>` for its product list). Rank the products by how many of those
pages recommend them and choose from the top of that list: each product must be recommended by at least 2 of
the top-10 pages and be a popular, well-stocked Amazon US listing (searching its brand + model on Amazon
shows it at once, not a lone obscure listing). Never add a product that no top-10 page recommends; if too
few products qualify, lower `productCount` to the number that do (at least 3 for roundups). Record the
evidence in the brief as `serpProducts`: `[{"name": "...", "pages": ["url", ...]}]`. Then verify every spec
against the maker or retailer pages as usual.

Feature exactly `productCount` products (from `next`; a random number per post: roundups 3-18,
comparisons 2-6, guides 1-6), never the same count every day. Give every product its own
`### Product name: role` section (about 120-180 words each), so long lists make long, useful posts; set the
brief's `targetWords` to roughly 700 + 150 x productCount. Follow the `SYSTEM` prompt in `agents/product-agent.mjs`, using
web search. For each product: `name` (exact model), `brand`, `query` (what a
shopper types on Amazon), `badge`, `summary`, `renterNote` (shown as "Who it's for": the shooter and kit it
suits plus the key caveat), `pros`, `cons`, `specs` (max height with and without center column, min height,
folded length, weight, max load, leg sections, leg lock, material, head, plate), and
the source URLs you used. Name each product the way its Amazon listing names the same model (brand + model words Amazon uses, no extra kit/bundle words), or add a short `matchName` with those words; the Amazon refresh only attaches a photo when every distinctive word of the name is in the listing title, so over-specific names leave the product without a photo. Never point it at a different model or variant. Leave `asin` out: the Amazon refresh workflow adds the
real ASIN and product photo after you push.

## 3b. Owner reviews (required for every product)
For each product, read what real owners say before writing about it. Search `<brand model> review`,
`<brand model> problems`, `<brand model> reddit`, `<brand model> after a year` and read the owner posts you find:
Reddit and forum threads, retailer review pages (B&H, Best Buy, Adorama, Home Depot, Walmart), Trustpilot,
long-term owner write-ups. Count each distinct owner review or post you actually read; that count is
`owners.read`, and it must be honest (never estimate, never round up). Then add to the product:
`owners: { read, praise: [2-3 things owners repeatedly like], complaints: [1-3 things owners repeatedly
report going wrong], sources: [{ title, url }] }`. Summarize in your own words; no quotes from Amazon reviews,
no Amazon URLs, no star ratings or review counts from Amazon (Associates rules). A complaint that many owners
share should also appear in the product's cons and in the review text ("owners on Reddit report..."). The post
then shows a "How we picked these" box with the total reviews read and a "What owners say" block per product,
and lists every owner source at the end.

Also open each product's retailer review pages (REI, B&H, Best Buy, Adorama, Backcountry, Home Depot, Walmart,
Target) and review-summary sites (ShopSavvy and similar summaries of Amazon reviews): read the review themes and
give that source `reviews: <the number of reviews the page shows>`. Use that number only when you saw it on the
page or in its search result; never estimate it. Amazon reviews themselves may be read for research, but write
the findings in your own words and never quote them, show Amazon star ratings or Amazon review counts.

## 3c. Every product needs its own Amazon listing (ASIN)
A product that links to an Amazon search page instead of its own listing has no photo and is hard to buy, so it
must not ship. Only feature products you have seen on Amazon US as one clear listing. After a push the Amazon
refresh adds the ASIN and photo; if it can't match a product it writes the real Amazon candidates to
`data/amazon-unmatched.json` (`strictMatch: true` marks a certain match). Before writing each day's post, open that
file: for every product listed, either set `asin` to the candidate that is the SAME model (and add a short
`matchName` so the daily refresh keeps matching it), or replace the product with a similar, popular model Amazon does
sell (still recommended by the top-10 pages, step 3), and update the post's text to match. Never point a product at a
different model or variant just to get a photo.

## 4. Semantic brief
Follow `BRIEF_SYSTEM` in `agents/writer-agent.mjs` (search the live SERP for the
keyword). Save it as `data/briefs/<slug>.json` with exactly these fields:
`centralEntity, entityVariants[], entities[{name,type,relation}], attributes[],
ngrams[], skipgrams[] ("word1…word2"), nlpTerms[], questions[], contentGaps[],
outline[{h2,intent,h3[]}], targetWords, serpStructure`.

**Structure follows the top results.** Open the top 5-10 organic results for the keyword and fill
`serpStructure`: `analyzedUrls`, `productStyle` ("pros-cons", "paragraph" or "specs": how most of them
present each product) with `productStyleReason`, `avgWords`, `avgProducts`, `commonSections`,
`usesComparisonTable`, `usesFaq`, `usesBuyingGuide`. Then build the outline from the sections most of
them share, in a similar order, plus the content gaps; set `targetWords` 10-20% above `avgWords`; and set
`productStyle` in the post's frontmatter to the same value:
- `pros-cons`: each product shows What we like / What we don't like lists (fill `pros` and `cons`).
- `paragraph`: no lists are shown; write a 120-200 word review paragraph per product covering strengths
  and drawbacks (still fill `pros`/`cons` for the data, they just aren't displayed).
- `specs`: each product shows a spec table from `specs` (4-8 verified rows, e.g. "Folded length": "15.4 in").
  Only use numbers the manufacturer publishes.
The product count stays the random `productCount`.

## 5. Internal links
`node scripts/routine.mjs links <slug>` → choose the 3–5 that genuinely fit.

## 6. Write the post
Follow **every** rule in `WRITE_SYSTEM` in `agents/writer-agent.mjs` (semantic SEO,
layout-aware, E-E-A-T, factual, format). Save to `src/content/blog/<slug>.md`.
Frontmatter (copy the shape of an existing post once there is one; the fields are):

```yaml
title, seoTitle (≤60), description (140–160), pubDate (take the next unused time from `node scripts/routine.mjs slots`; posts go live at random times and the hourly Scheduled release workflow publishes each one when its time comes),
category, keyword, secondaryKeywords, entities, tags, articleType, readingTime,
tldr (2–4), productCount (from `next`), products [exactly productCount items: name, brand, query, badge, summary, renterNote, pros, cons, specs, scores {stability, portability, height?, build, value}, scoreNote],
sources [{title, url}] (manufacturer/standards pages you used, no Amazon URLs),
reviewedDate (today), faqs [{q, a}] (4–6), author: editorial-team
```
Body: intro paragraph, `##` sections each opening with a **bold** direct answer,
`### <exact product name>: <role>` per product in roundups, at least one list,
a comparison table for roundups/comparisons (with a lead-in sentence), product
links as `[Name](amzn:Product+Query)`, internal links as `/blog/<slug>/`.
No H1 and no FAQ section in the body.

## 7. Audit and fix
`node scripts/routine.mjs audit <slug>` → fix every issue it lists and re-run until
`score` ≥ 85 (at most 3 rounds).

## 7b. QA agent (must pass before the post can go live)
The site only publishes posts with a passing QA report (`data/qa/<slug>.json`).
1. **Fact check (you do this):** open every source and the manufacturer pages and verify each
   product name, model, spec (heights, folded length, weight, max load, plate standard), compatibility
   claim and safety statement in the post. Fix or
   remove anything you can't confirm. Then record it:
   `node scripts/routine.mjs factcheck <slug> "<what you verified, against which sources>"`
2. **Automatic checks:** `node scripts/routine.mjs qa <slug>` → it checks prices/star
   ratings/review counts/testing claims, required fields and lengths, FAQs, Amazon links for
   every product, product photo vs Amazon listing, internal links (must already be live),
   sources (https, not Amazon), SEO audit ≥ 85 and cannibalization.
   Fix every error (`✗`) and re-run until it says `"pass": true`. Warnings (`!`) are advisory.
   "No Amazon photo yet" is expected before the push; the Amazon refresh adds it and CI re-runs QA.
If QA can't pass after fixes, don't publish that post: leave it out of the commit.

## 8. Finalize
```bash
node scripts/routine.mjs finalize <slug>   # featured image, backlinks, queue/state, report
```

## 9. Validate and publish
```bash
npm run check:content && npm run build
git add -A src/content data public/images  # includes data/qa
git commit -m "content: <post title>"
git push origin HEAD:"$DEFAULT"
```
The push triggers **Deploy to Cloudflare Pages** (site + IndexNow) and
**Amazon product refresh** (real ASINs + product photos, then redeploy).

Finish with a short summary: posts published (title + URL
`https://best-tripod.com/blog/<slug>/`), audit scores, anything skipped and why.
