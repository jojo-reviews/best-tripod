# SEO audit findings: best-tripod.com

Collected 2026-10-18, US market, English. Sources: Ahrefs API v3 (Keywords Explorer, SERP overview, Site Explorer, GSC, projects) and the repo (`src/content/blog/*.md`, `data/keywords.json`, `src/components/PostPage.astro`). About 7,157 Ahrefs units spent. Nothing here guarantees a ranking. "Unavailable" means Ahrefs returned no data, not zero searches.

Raw data: `ahrefs-keywords.json`, `serps.json`, `site-metrics.json`, `keyword-url-map.csv` in this folder.

## Key numbers
- Domain Rating 0.0; 0 organic keywords; 0 traffic (US and all countries); 0 live backlinks / referring domains (1 of each all-time).
- GSC: unavailable (no Ahrefs project for the site).
- 110 keywords checked: 26 with data, 15 with volume > 0, 84 not in Ahrefs' US database.
- Published main keywords with data: 1 of 8 ("best travel tripod for mirrorless camera": volume 50, KD 3, traffic potential 3,800).
- Queued main keywords with data: 1 of 18 ("best tripod for real estate photography": volume 150, KD 0, TP 100).
- best-tripod.com is in none of the 19 SERPs that returned results. Posts were published 2026-10-15 to 2026-10-18, so zero rankings is expected; indexing was not checked.

## 1. Confirmed issues
1. **Most target keywords have no Ahrefs data.** 7 of 8 published and 17 of 18 queued main keywords returned no data and no SERP. Demand can't be shown (this does not prove zero searches). Root cause in the agents: the keyword agent had no Ahrefs tools, so topics were picked from web search.
2. **Travel post: structured data covers 8 of its 15 picks.** Title, description and body list 15 picks; frontmatter `products` has 8, and `PostPage.astro` builds the ItemList and Top Picks from that list. Missing: Sirui 7A, Gitzo GT1555T, Leofoto LS-224CX, Vanguard VEO 3 GO, 3LT Punks Travis, K&F 64", Ulanzi F38.
3. **Travel post has no FAQs** (the other posts have 5–6). Its SERP shows People also ask ("What is the best tripod for a mirrorless camera?", "What is the best camera tripod for travel?").
4. **"tripod height without center column"** is a secondary keyword of both the tall-photographers post and the how-tall post.
5. **Many secondary keywords have 0 volume or no data.** Exactly 0: "geared head vs ball head", "desk tripod for webcam", "selfie stick tripod for vlogging", "travel tripod for fujifilm", "tripod for tall people". With volume: "tall tripod" 350, "iphone tripod with remote" 200, "tall tripod for camera" 70, "extra tall camera tripod" 30, "phone tripod with bluetooth remote" 20, "what height tripod do i need" 10.

## 2. Potential issues
1. Tall-photographers post: "tall tripod" (350/mo, KD 0) has a store-led SERP (Amazon, Best Buy, Adorama categories, a Glide Gear product page, Reddit, one Ulanzi guide). A roundup may struggle.
2. Phone vlogging post: proxy "phone tripod with remote" (100/mo, KD 1, TP 9,000) is 5 of 6 store category pages plus Wirecutter (DR 94). "iphone tripod with remote" data looks wrong (KD 98, brand-flagged).
3. Mini desk tripod post: proxy "desk tripod" (100/mo) is stores, products, Reddit, YouTube. "webcam tripod" (250/mo, KD 0) not checked.
4. Peak Design vs Befree post: both products are picks #1–3 in the travel roundup; proxy SERP shares only 1 URL with the travel SERP. Watch, not confirmed cannibalization. "vs" keywords have 0 volume.
5. Queued topics overlapping travel-post sections (no data to check against SERPs): carry-on luggage tripod; travel vs full-size for landscapes; twist vs flip lock and carbon vs aluminum (low risk); center column up or down (vs both height posts).
6. The travel SERP has an AI Overview, a Discussions block and shopping results, which likely lower organic clicks (inferred; no CTR data).

Cannibalization method: main keyword, parent topic and shared top-10 URLs per pair; flagged at ≥3 shared URLs or the same parent topic. Nothing flagged. The only 3-URL overlap is the travel keyword with "best travel tripod" (same post). 7 of 8 posts used proxy SERPs, so overlap on the true long-tail SERPs can't be ruled out.

## 3. Optional improvements
- Travel: add "best travel tripod" (1,300/mo, KD 6, TP 3,900) as a secondary (shares 3 top-10 URLs; listicle SERP matches the post). Complete products to 15; add FAQs.
- Fluid head: proxy "best fluid head tripod" (60/mo) SERP is mostly forums with weak articles. Consider "best fluid head tripod" and "fluid head tripod" (900/mo, KD 0) as secondaries.
- Ball head: all "vs" variants 0/no data. Consider "best tripod head for landscape photography" (200/mo, KD 0; weak SERP, median DR 24; TP only 10).
- How-tall: guide format matches the SERP but demand ≈10/mo. Use as a supporting page linking to the tall post, and give it "tripod height without center column".

## 4. Not verifiable
- GSC data and indexing (no Ahrefs project; `gsc-keywords` errored).
- Real SERPs for 7/8 published and 17/18 queued main keywords (Ahrefs returned none).
- Volume for 84 of 110 keywords (not in Ahrefs' database).
- Content quality vs competitors (competitor pages not crawled; page types inferred from URL/title).
- SERPs not pulled to save budget: "webcam tripod", "fluid head tripod", "tall tripod", "peak design travel tripod".

## 5. Per-post recommendation (recommendations only, nothing changed)
- Travel: improve (8-vs-15 products, FAQs, "best travel tripod").
- Tall photographers: keep, light improvement; uncertain on store-led SERPs.
- How-tall: keep as a supporting page; owns "tripod height without center column".
- Fluid-head beginners: keep and improve (forum-heavy SERP may leave room).
- Ball head vs pan tilt: keep and improve.
- Peak Design vs Befree: keep and watch; consolidate only if GSC later shows it swapping with the travel post.
- Phone vlogging: keep, low expectations.
- Mini desk tripod: keep, low expectations; consider "webcam tripod".
- No post is a confirmed consolidation candidate.

## 6. Queued keywords
- Strong: "best tripod for real estate photography" (150/mo, KD 0; SERP Reddit, Facebook, DR-27 blogs, YouTube, TechGearLab).
- Moderate (proxy-based): carbon fiber vs aluminum for hiking (proxy 60/mo); monopod with feet for wildlife (proxy 150/mo); monopod vs tripod for sports (proxy 350/mo, forum-dominated); gimbal head for 150–600mm (proxy 50/mo).
- Weak or unverified: astrophotography under 3 pounds (forum-heavy, telescope mounts); carry-on luggage tripod (SERP is "can I fly with a tripod", overlaps travel post); Arca-Swiss plate explainer (product/category SERP); iPhone night-mode tripod (Wirecutter/Amazon/Best Buy dominate); center column up or down (overlaps height posts); travel vs full-size (duplicates a travel-post H2); no measurable demand: best L bracket, twist vs flip lock, flexible vs mini tripod, stop tripod shake in wind, tripod for heavy telephoto, cheap tripods worth it, bowl size 75 vs 100mm.
- Research seeds with real data: fluid head tripod (900), best travel tripod (1,300), monopod vs tripod (350), tall tripod (350), webcam tripod (250), best tripod head for landscape photography (200).

## Data anomalies
- "best mini tripod": parent topic "chipotle crispy tacos" (Ahrefs error; ignored).
- "iphone tripod with remote": KD 98, brand-flagged, parent "selfie stick" (low confidence).
- Travel keyword TP 3,800 is the #1 page's traffic (Pack Hacker, ranking mainly for "best travel tripod"), not demand for the exact phrase.
