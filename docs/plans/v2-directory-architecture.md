# v2 Directory Architecture — Open Issues

**Status:** Capture-only. Not a finished plan. Started 2026-05-13 from a
conversation about page-coverage gaps and rescoring drift. Goal: park the
known structural problems so we don't lose them before a proper audit.

## Guiding philosophy (carried forward from v1)

- **Follow Google's indexing with scraping.** Every page Google tries to index
  is a free keyword-research signal. We never `noindex` pages that Google is
  testing — we chase them with content. (2026-05-13: removed the last
  `noindex` gate from `[service]/[state]/[city]/page.tsx`.)
- **Firestore is the single source of truth.** JSON is a derived artifact.
- **Cache everything for plumbers in our system.** Once a plumber enters
  Firestore, their record + reviews stay forever.

## The core v2 problems

### 1. Rescoring + ranking propagation is broken

When a city is scored, `city_rank` is written onto every plumber in that
city. When new plumbers are added later (via daily-scrape) within the
20-mile radius, **the old city's rankings don't update.** The new plumber
gets ranked, but existing plumbers in that city keep their old `city_rank`
entry — based on a smaller cohort.

Consequence: page rendering shows stale rank order. Plumbers who should
have dropped after a stronger neighbor was added stay at the top. Trust
signals degrade silently.

**Fix direction (v2):** any plumber insert/update inside a 20-mile radius
of a scored city should mark that city dirty. A "rerank dirty cities" pass
should run after every daily-scrape, cheaper than full rescoring because
it only invokes Pass 2 + Pass 3 (no Sonnet calls).

### 2. Neighbor propagation — strong cities lift surrounding cities

When City A is rich with synthesized plumbers, City B 18 miles away
inherits A's plumbers via the 20-mile radius resolver. **B's page benefits
from A's content depth**, but B's quality score isn't recomputed when A is
re-scored. Same drift problem, one level out.

**Fix direction (v2):** maintain a per-city dependency graph
(A within 20mi of B). When A's plumbers change, mark all cities within
20 miles of A as rerank-dirty. Then run Pass 2 across the dirty set.

### 3. Synthesis is one-shot, not continuous

`reviewSynthesis.synthesizedAt` is stamped once. New reviews arriving via
`refresh-reviews.ts` or the Outscraper workflow don't automatically trigger
re-synthesis. Currently `score-plumbers.ts` checks `last_scored_at` and
skips anything <30 days, even if review count changed massively.

The dry-run output today showed plumbers like "Defense Plumbing: recently
scored but review count changed 100% (0 → 94) — re-scoring" — so the
script DOES detect drift, but only when invoked. Nothing invokes it
automatically.

**Fix direction (v2):** trigger re-synthesis as a side effect of any
review-count change of N% (config). Could be a Firestore trigger / Cloud
Function, or a daily "find dirty plumbers" pass.

### 4. Service-page Tier 1/2 needs richer synthesis

`[service]/[state]/[city]/page.tsx` tiers plumbers by `specialty_strength`
and `servicesMentioned`. Cities without rich synthesis fall entirely to
Tier 3 (generic radius-matched, no service-specific ranking) — page still
renders, but no "Top picks for [service]" featured section. This is
likely why service-page CTR and rankings lag emergency-plumbers.

**Fix direction (v2):** make Tier 1/2 less brittle — fall back to
`reviewSynthesis.bestFor` keywords, or build a lightweight rule-based
classifier when synthesis is absent. Don't leave service pages
content-empty just because synthesis hasn't run.

### 5. Empty-radius cities — render fallback strategy

Some indexed cities have 0 plumbers in a 20mi radius. Current behavior:
empty page renders. We chose NOT to `noindex` (2026-05-13 decision). So
how do we render them?

Options to evaluate in v2:
- **Expand radius** to 30 or 40mi when 20mi returns 0
- **Regional fallback** — show plumbers from the same county or metro
- **Editorial fallback** — render an empty-but-helpful state with "We're
  still finding emergency plumbers in [city]. Try [adjacent cities]."
  with links to known-populated neighbors
- **Hybrid** — expand radius progressively until N plumbers found

### 6. Workflow fragmentation

Per CLAUDE.md, after the 2026-04-23 manual-first pivot:
- daily-scrape: automated
- score-plumbers: manual
- deep-review-pull: manual
- rebuild-json: manual
- publish-experiment-metrics: manual

The v1 fully-automated pipeline was simpler but had no quality gate. The
v2 architecture needs **gated automation** — automated steps that produce
clear "needs review" artifacts before they auto-publish, with the
Operator Console as the human-in-the-loop checkpoint.

### 7. GSC → content latency (1-3 days currently)

GSC discovery → scrape → publish → re-indexing today takes 1-3 days. The
slowest step is waiting for the cron. With MAX_DAILY_CALLS bumped to 150
(2026-05-13), the queue drains faster, but discovery latency is still
~24 hours.

**Fix direction (v2):** real-time GSC ingest via Pub/Sub or webhook
(GSC doesn't push, so this means polling more aggressively). Or accept
the 24hr cycle and just optimize for it.

### 8. Auditability + dirty-state visibility

The admin dashboard's Activity tab logs pipelineRuns but doesn't surface:
- Which cities are rerank-dirty (have new plumbers since last score)
- Which plumbers have synthesis drift (review count changed since last
  synthesis)
- Which service pages have no Tier 1/2 inventory (synthesis gaps)
- URL inspection drift (Google last crawled vs. content last changed)

**v2 dashboard requirement:** every "dirty" state surfaced as a count,
clickable, with a one-button manual trigger to clean.

## Crawl-state ingestion (added 2026-05-13)

To support v2 rescoring decisions, the daily pipeline now ingests:
- **URL Inspection API** — `lastCrawlTime`, `coverageState`, canonical,
  robots state per indexed URL. Daily, capped at 1500 URLs/run. Written
  to Firestore `urlInspection/<urlHash>`.
- **Sitemap status** — submitted/indexed counts, errors/warnings, last
  downloaded. Daily. Written to Firestore `sitemapStatus/<sitemapHash>`.

Open question for v2: Vercel Pro log drains could give us **real-time
Googlebot crawl rate** per URL (vs. URL Inspection's daily snapshot).
Probably worth adding once we've run URL Inspection for 4-6 weeks and
seen what gaps remain.

## Out-of-scope for this doc (handled elsewhere)

- Monorepo extraction → `monorepo-extraction-notes.md`
- City activation pipeline → `city-activation-architecture.md`
- Synthesis pipeline as it stands today → `synthesis-pipeline-current-state.md`

## Suggested first audit (when v2 work starts)

1. Diff the rendering paths of `emergency-plumbers/[state]/[city]` vs.
   `[service]/[state]/[city]` for inventory selection + ordering. Confirm
   the Tier 3 fallback always renders.
2. Count plumbers per city marked "rerank-dirty" (new plumber added
   inside 20mi since last `city_rank` write). Quantify the drift.
3. Audit `reviewSynthesis.synthesizedAt` vs. plumber's most recent review
   timestamp. Quantify the synthesis-drift backlog.
4. Build a per-city `coverage-quality` score: how many of the 28 service
   pages render Tier 1+2 vs. Tier 3 only.
