# Instructions for Claude (owner rules)

**Standing rule (owner, 2026-10-23):** whenever the owner gives a guideline, a decision or a preference in chat,
write the durable part into the file the matching agent reads, in the same session, before the work is reported done:
- writing, voice, titles, length, media → `.claude/agents/writer-agent.md` + ROUTINE.md
- fact checks and quality gates → `.claude/agents/qa-agent.md` (+ `agents/qa-agent.mjs` if it can be checked automatically)
- keywords and topics → `.claude/agents/keyword-agent.md` / `competitor-gap-agent.md` + ROUTINE.md
- products, ASINs → `.claude/agents/product-agent.md`
- briefs and SERP structure → `.claude/agents/brief-agent.md`
- old-post updates from Search Console → `.claude/agents/improve-agent.md`
- translations → `.claude/agents/translator-agent.md`
- schedules, posts per day, indexing, deploys → this file + the scheduled task prompt
- rules for every site → the same change in all three repos (rentersmarthome.us, best-tripod.com, best-safe.com)
Label it "owner rule YYYY-MM-DD", keep the owner's intent, never weaken an older rule silently (if a new rule
conflicts with an old one, ask the owner which wins and record the answer). Commit and push the change.

## Owner rules not covered by an agent file (kept here)

- Talk to the owner in Roman Urdu. Agent prompts and files stay in English.
- Owner rule 2026-10-27: keep answers to the owner short and to the point (a few lines, bullets, no long explanations).
- Owner rule 2026-10-28: links inside articles (internal and external) are dark blue (#0b3a8c) and bold (src/styles/global.css `.prose a`).
- Owner rule 2026-10-29 ("Ajj sa 5 blog daily post karna start kar do with indexing"): 5 new English posts per day per site
  (site.config.json schedule: randomPhase 5, maxPostsPerRun 5; replaces the 2/day rule of 2026-10-27). All posts of a
  site go live in ONE deploy (pubDates close together, one go-live check after the last one) to keep GitHub runs low,
  and every go-live deploy sends the new URLs to Google (google-indexing.mjs --notify-recent, needs the gsc-reader JSON key).
- LIGHT MODE (2026-10-22, Claude usage limit; posts per day raised to 2 on 2026-10-27 and to 5 on 2026-10-29): one agent per post;
  translations, trim backlog, pre-research and backfills are paused until the owner says otherwise.
- Owner rule 2026-11-01 ("tripod site pa difrent laguages pa blog post karny"): best-tripod.com de/es/nl localized pages are back on: every new English post gets localizer-agent (local brief) + 3 versions (de/es/nl), plus the backlog at backlogPerDay 1. This meets the 2026-10-20 rule (localized, not translated) via the new localizer-agent; it lifts the LIGHT MODE translation pause for this site.
- Deploy a post only after its pubDate. Go-live: first `node scripts/apply-inlinks.mjs <slug>` (patent rule 2026-10-24: 2 in-body links
  from related live posts), commit + push, then deploy; check = 200 + product photos, then a phone notification "Live: <title> – <url>".
- Never change a live post's URL, slug, keyword or pubDate (rankings drop). Old URLs get 301s, never 404s.
- Old posts are improved daily from the last 24 hours of Search Console (2026-10-23): 1 post per site per day,
  `scripts/gsc-opportunities.mjs <repo> <site> 1 --last24h` in the rentersmarthome.us repo, then improve-agent.
- Google indexing (2026-10-23, owner chose the Indexing API knowing Google only allows it for job/livestream
  pages and may ignore it): every deploy sends the last 26 hours' new/updated blog URLs (`google-indexing.mjs
  --notify-recent`); `google-indexing.yml` action=notify sends named URLs or TARGETS="*" (all, 190/day).
  URL Inspection index checks run only for the keywords/URLs the owner names, never the whole site, unless asked.
- The service account gsc-reader@abiding-hull-512408-a7.iam.gserviceaccount.com is an Owner of all three
  Search Console properties (secret GSC_SERVICE_ACCOUNT_JSON in the rentersmarthome.us repo).
- www.<domain> 301s to the bare domain (functions/_middleware.js); /search/ stays noindex, follow.
- Products are written in first person (I, my, me, we, our, us), never with fake testing or ownership claims.
- Older posts are converted to first-person product write-ups gradually (owner decision 2026-10-23): only when the
  daily improve-agent picks a post, never as a bulk rewrite. QA only warns on posts that went live before 2026-10-24.
- Max 3 outside links in an article body; "best X for Y" keywords first; no fabricated prices, ratings or tests.
- Google patent research (owner rule 2026-10-23): rentersmarthome.us/.claude/agents/patent-research-agent.md runs daily;
  its safe rule proposals are applied to this repo's agent files too ("patent rule YYYY-MM-DD (<id>)").
- Backlinks: white-hat only (no paid links, PBNs, exchanges); the off-page agent prompt is
  rentersmarthome.us/docs/offpage-agent-prompt.md.
- Owner rule 2026-10-29: TextRazor entity extraction is used in every new post (rentersmarthome.us/scripts/textrazor-entities.mjs; key only in the TEXTRAZOR_API_KEY environment variable).
- Owner rule 2026-10-29 ("old content b optimize karo jaldi"): every live English post gets one TextRazor semantic pass (rentersmarthome.us/scripts/semantic-queue.mjs), 10 posts per site per day until done.
- Owner rule 2026-10-30 ("Top priority tripod site"): best-tripod.com goes first whenever work competes for time or usage: its daily posts, go-live checks, semantic passes, fixes and image work run before the other two sites, and when the Claude usage limit is near, tripod work is finished first.
- Owner rule 2026-11-04 (schema entities): every TextRazor entity of a post goes into its BlogPosting schema as a Thing with name, description and sameAs [Wikipedia, Google kgmid search URL, Wikidata] (`about` = top entities, `mentions` = the rest). Source: data/briefs/<slug>.entities.json; scripts/entity-cache.mjs (runs before `astro build`) fills descriptions/Q-ids/kgmids from Wikidata into data/entity-cache.json (committed; www.wikidata.org is in the environment's allowed domains; it honours Wikimedia's 429 Retry-After, never route around a block). `lastReviewed` is not a BlogPosting property, so it is not in BlogPosting schema. Schema only names entities the post really covers.
- Owner rule 2026-11-04 ("stop rsh site pa abhi koi pages post ni karny next just work kon tripod and safe site"; replaces the 2026-10-29 5/day and the 2026-10-27 translation rules for RSH until the owner says otherwise): rentersmarthome.us is PAUSED: no new posts, no translations, no semantic passes, no old-post improvements; the 4 Nov posts and translations not yet live are kept as `draft: true`. Work only on best-tripod.com and best-safe.com.
- Owner rule 2026-11-04 ("dialy patent pa tum na research karni but forna apply ni karna"): the daily patent research still runs and logs, but its rule proposals are NOT applied automatically any more; they are sent to the owner as a short list and applied only after the owner says yes (replaces the auto-apply part of the 2026-10-23 rule).
- Owner rule 2026-11-04 ("Random number kar do kisi din 1 sa 5 ma sa koi b rendom number pa kam karo daily 5 nhi post karni"; replaces the fixed 5/day of 2026-10-29): each site publishes a random 1-5 new English posts per day (site.config.json schedule.randomPhase min 1, max 5, seeded by date + domain; `routine.mjs status` remainingToday is the number). Still one deploy per site per day.
- Owner rule 2026-11-04 ("difrent laguage pages pa make sure 1 post lazmi publish ho different languages ma"): best-tripod.com publishes at least 1 localized post in EACH of de, es and nl every day (the day's new posts' versions plus the backlog; if today's new posts give none for a language, take the backlog/translate-queue post for it).
- Owner rule 2026-11-12 ("haan safe site pause kar do"): best-safe.com is PAUSED: no new posts, no semantic/story passes, no old-post improvements; its live posts stay online and its daily task is disabled. Review again with Search Console data in 4-6 weeks (end of December). Work only on best-tripod.com.
- Owner rule 2026-11-13 ("kabhi b same time pa posting nhi karni"; replaces the fixed "20 min apart, same afternoon" timing): never publish at the same clock time two days running. The day's English posts still go live in ONE deploy, with pubDates from `node scripts/routine.mjs golive-slots <n>` (agents/lib/schedule.mjs goliveTimes: random start 13:00-20:00 UTC seeded by date + domain, random 11-43 min gaps, never on :00/:15/:30/:45) and one go-live wake at its goliveAt. Translations keep their random translate-slots times.
- Owner rule 2026-11-13 ("Masle thek karo sab ... ranking improve honi chye down nhi", after the best-tripod.com audit): audit fixes on best-tripod.com: (1) first body paragraph = direct answer with the exact keyword, Ned Diary story hook in paragraph 2 (QA warns); (2) QA warns at 3+ sales words; (3) keyword-agent content mix (informational >= 35%, deepen clusters) and product-agent variety rules; (4) live roundups with <5 products are topped up 2/day (data/roundup-topup.json); (5) audit-agent (.claude/agents/audit-agent.md) runs every Monday inside the daily story task and only reports; (6) quality over volume: schedule.randomPhase 1-2 new English posts/day (inside the 2026-11-04 random 1-5 rule; owner can say "wapas 1-5") and translations.backlogPerDay 0 (new posts still get de/es/nl, so the 1-per-language-per-day rule holds on posting days). Every change must help rankings: no URL/slug/keyword/pubDate changes, no bulk rewrites beyond these passes.
- Owner rule 2026-11-13 ("Backlink many nhi bnye. Raftar kam karo and fix karna start karo"): the owner did NOT build best-tripod.com's backlinks (spam .xyz network + off-topic injected "/post/" pages): docs/disavow-best-tripod.txt in the rentersmarthome.us repo is the disavow list (owner uploads it in Search Console; refresh it when the Monday audit finds new spam domains); we never build such links. Pace stays slow: 1-2 new English posts/day on best-tripod.com (owner confirmed), fixes first (roundup top-up, story pass, audit findings) before new content when usage is short.
- Owner rule 2026-11-13 (pillar clusters, "har best for post k around informational post ... primary blog ko support kary ... haan shuru karo, top 10 pillars tum khud chuno"): best-tripod.com data/clusters.json names 10 pillar posts; each gets 3-5 supporting informational posts (owner agreed: not 200-300 word filler, length as the question needs, about 300-900 words). The first new post of each day is a supporting post for the first pillar still under its target. Topic = one real reader question or pain point, sources in order: data/pain-points.json (Reddit/Quora/forums), Ahrefs matching-terms questions for the pillar keyword, the pillar SERP People-also-ask and competitor pages, Search Console queries when access is back; it needs measured volume or 3+ independent threads and no same-intent live post (routine.mjs cannibal). Queue it with supports: <pillar slug>; the post links to its pillar in the body and the pillar links back at go-live.
- Dashboards are light-themed: Search Performance https://claude.ai/artifact/LgNhY4KAh6FfnSxKs7AfpF (daily refresh)
  and Site Agent Flow https://claude.ai/artifact/PZPgFBgSVi37DphrWH2nDJ.
- Owner rule 2026-11-11 (author): "Best Tripod Editorial Team" removed; all posts are by Ned Diary (/authors/ned-diary/, Person schema); /authors/editorial-team/ 301s there. Owner update 2026-11-12: sameAs = Instagram (ned.diary.photography), Flickr (photos/205153348@N06), Ugly Hedgehog (usernum=116377), Real Photographers Forum (ned-diary.2590); LinkedIn later; email ned.diary@outlook.com on the author page and in Person schema.
- Owner rule 2026-11-11 ("har blog ma ... same author ki personal story"): every post has Ned Diary's first-person angle from data/author-stories.json only; never invented stories/tests (keeps the older no-fake-experience rule). The owner adds real stories to that file. Owner rule 2026-11-11 (later): old posts too, every post told as a first-person story (story pass, 10/day oldest first, data/story-pass.json; replaces the gradual-only 2026-10-23 decision for this site). Author photo /images/authors/ned-diary.jpg (owner-supplied).
- Owner rule 2026-11-13 ("I did not test ya remove kar do site ma kahi b ... first person tone"): no page, template or post says the author or site did not test, use or own the products; the first-person-agent (.claude/agents/first-person-agent.md) removes such statements and keeps Ned Diary's first-person voice. The older rule still stands: never ADD a testing, hands-on, ownership or purchase claim that is not in data/author-stories.json (QA errors on those).
- Owner rule 2026-11-12: Reddit-keyword topical-bridge trial on this site (resource page -> ~5 bridge pages from its own GSC 'reddit' queries -> money page); see ROUTINE.md.
- best-tripod.com: keyword queue was replaced by the owner's list on 2026-10-22 (no cannibalization with live posts); never add reviewedBy.

- Repos (2026-10-27, old rankandrent account suspended): jojo-reviews/rentersmarthome (branch main), jojo-reviews/best-tripod (main), jojo-reviews/Best-Safe (main). This site is deployed by launch-site.yml in jojo-reviews/rentersmarthome.

## GitHub safety (owner rule 2026-10-27, after the old GitHub account was suspended)

Keep GitHub activity low and human-like so the account is never flagged again:
- Scheduled workflows: at most ~6 runs per day across all three repos (rentersmarthome.us: gsc-snapshot,
  amazon-refresh, ai-images daily; scheduled-release once a day in each repo; unsplash weekly). Never add an
  hourly or every-few-hours cron. publish.yml runs by hand only.
- Commits: batch the day's work. One commit per post (post + its data files) and one per improvement; no
  separate commits for small data files; at most ~10 commits per repo per day. Bot data commits use [skip ci].
- Manual workflow runs (deploy, launch-site, google-indexing): only when needed, at most ~6 per day in total;
  never re-run a failing workflow in a loop. If a workflow fails twice in a row, stop and fix or disable it.
- A workflow that keeps failing (e.g. a missing secret) gets its schedule removed until it is fixed.
- Owner rule 2026-10-29 ("mujay ya mail nhi ani chye"): every bot workflow that commits rebases, retries the push 3 times and ends with a warning instead of failing, so a push race never sends a "Run failed" email. Keep this pattern in any new workflow.
- No new repos, gists, forks, mass issues/PRs or automated comments. Never push to repos that aren't ours.
- Keep a fresh `git bundle` backup of each repo in rentersmarthome.us/backups/ (not committed) after big changes.
