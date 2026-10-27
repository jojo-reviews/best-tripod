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
- LIGHT MODE (2026-10-22, Claude usage limit): exactly 1 new English post per day per site, one agent per post;
  translations, trim backlog, pre-research and backfills are paused until the owner says otherwise.
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
- Dashboards are light-themed: Search Performance https://claude.ai/artifact/LgNhY4KAh6FfnSxKs7AfpF (daily refresh)
  and Site Agent Flow https://claude.ai/artifact/PZPgFBgSVi37DphrWH2nDJ.
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
- No new repos, gists, forks, mass issues/PRs or automated comments. Never push to repos that aren't ours.
- Keep a fresh `git bundle` backup of each repo in rentersmarthome.us/backups/ (not committed) after big changes.
