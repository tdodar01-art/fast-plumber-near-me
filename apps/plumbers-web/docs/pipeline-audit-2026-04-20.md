# Pipeline Audit — 2026-04-20

Scope: map the current fast-plumber-near-me plumber-data pipeline as it actually exists today.

This document does not propose fixes. It records:
- what runs
- what each part does
- how data moves
- where behavior, docs, and wiring diverge

Method:
- read all four live workflow files in `.github/workflows/`
- read the scripts those workflows invoke, plus their direct helper/orchestration paths
- read repo docs that describe the pipeline
- inspect last-30-day GitHub Actions history with `gh run list`
- inspect recent run step timings with `gh run view`
- inspect queue files and current derived-file/build wiring

## 1. Current Process Map

```text
Google Search Console
  |
  |  daily-scrape.yml @ 06:00 CT
  |  1. gsc-expansion.js
  |  2. gsc-prepend-queue.js
  v
data/gsc-expansion-queue.json
  |
  v
scripts/scrape-queue.json
  |
  |  daily-scrape.js
  v
Google Places Text Search + Place Details
  |
  +--> Firestore reviews            (initial Google review cache)
  +--> data/raw/plumbers-latest.json
  +--> data/raw/plumbers-with-synthesis.json   (staging only)
  +--> Firestore cities             (scraped=true, plumberCount)
  |
  |  upload-to-firestore.js
  v
Firestore plumbers
  |
  |  refresh-reviews.ts
  +--> Google Places API (New) place details with reviews
  |    +--> Firestore reviews
  |    +--> Firestore plumbers
  |    +--> Firestore ratingSnapshots
  |
  |  deep-review-pull.yml @ 07:00 CT
  |  1. find-deep-review-cities.js
  |  2. bbb-lookup.js
  |  3. outscraper-reviews.js --skip-synthesis
  v
Outscraper (Google + Yelp only in current code)
  |
  +--> Firestore reviews
  +--> Firestore plumbers (bbb, yelp aggregates, lastOutscraperPull)
  |
  |  score-plumbers.ts --pass all
  v
Firestore plumbers
  - scores
  - evidence_quotes
  - reviewSynthesis
  - city_rank
  - decision
  |
  |  export-firestore-to-json.js
  v
data/synthesized/plumbers-synthesized.json
data/synthesized/leaderboard.json
  |
  |  generate-city-coverage.js
  v
src/lib/city-coverage.ts
  |
  |  git commit/push from workflow
  v
GitHub repo main
  |
  v
Vercel rebuild
  |
  +--> Next build prebuild also runs generate-city-coverage.js
  +--> live site reads static JSON via src/lib/plumber-data.ts
  +--> city pages may also query Firestore via resolvePlumbersForCity()

Safety side path:
Firestore plumbers/reviews
  |
  |  rebuild-json.yml every 6 hours
  v
export-firestore-to-json.js --no-push
generate-city-coverage.js
git commit/push if changed

Current failure point:
score-plumbers.ts is the step timing out in both daily-scrape and deep-review-pull.
When that happens, export/commit/indexing in those workflows are skipped.
rebuild-json.yml is currently the compensating path that still moves Firestore truth back into repo JSON.
```

## 2. Cron Schedule Inventory

| Workflow | Cron | Local cadence | Timeout |
|---|---|---:|---:|
| `daily-scrape.yml` | `0 11 * * *` | daily, 06:00 CT | 45 min |
| `deep-review-pull.yml` | `0 12 * * *` | daily, 07:00 CT | 120 min |
| `rebuild-json.yml` | `0 0,6,12,18 * * *` | every 6 hours UTC | 10 min |
| `publish-experiment-metrics.yml` | `30 12 * * *` | daily, 07:30 CT | none set |

There are no other live GitHub Actions workflow files under `.github/workflows/`.

## 3. Workflow Audit

### 3.1 `daily-scrape.yml`

Supposed job: discover promising cities from GSC, scrape new plumbers, refresh existing review caches, score/synthesize, rebuild JSON, push, and request indexing.

Actual steps:
1. `npm install firebase firebase-admin typescript tsx googleapis`
2. gate Firestore-dependent steps on `FIREBASE_SERVICE_ACCOUNT`
3. run `gsc-expansion.js` with `continue-on-error: true`
4. run `gsc-prepend-queue.js` with `continue-on-error: true`
5. run `daily-scrape.js` with `continue-on-error: true`
6. run `upload-to-firestore.js` with `continue-on-error: true`
7. run `refresh-reviews.ts --max 20` with `continue-on-error: true`
8. run `score-plumbers.ts --pass all` with `continue-on-error: true`
9. run `export-firestore-to-json.js --no-push` with `continue-on-error: true`
10. run `generate-city-coverage.js` with `continue-on-error: true`
11. commit/push staged files from repo root
12. request indexing for URLs derived from that day’s `daily-result-YYYY-MM-DD.json`

Triggers:
- cron
- manual `workflow_dispatch`

Depends on:
- secrets: `FIREBASE_SERVICE_ACCOUNT`, `GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`
- scripts: `gsc-expansion.js`, `gsc-prepend-queue.js`, `daily-scrape.js`, `upload-to-firestore.js`, `refresh-reviews.ts`, `score-plumbers.ts`, `export-firestore-to-json.js`, `generate-city-coverage.js`, `request-indexing.js`
- files: `data/gsc-expansion-queue.json`, `scripts/scrape-queue.json`, `data/raw/plumbers-latest.json`, `data/raw/plumbers-with-synthesis.json`, `src/lib/city-coords.ts`, `src/lib/cities-generated.ts`, `src/lib/city-coverage.ts`

Writes:
- Firestore: `cities`, `reviews`, `plumbers`, `ratingSnapshots`, `pipelineRuns`, `apiUsage`, `indexingRequests`
- repo files: `data/raw/plumbers-latest.json`, `data/synthesized/plumbers-synthesized.json`, `data/synthesized/leaderboard.json`, `data/gsc-expansion-queue.json`, `scripts/scrape-queue.json`, `src/lib/city-coords.ts`, `src/lib/cities-generated.ts`, `src/lib/city-coverage.ts`
- git commit/push when changes are staged

Current runtime and timeout:
- job timeout: 45 min
- last 30 days: 32 runs, 24 success, 6 failure, 2 cancelled
- failure rate over last 30 days: 25.0% including cancellations, 18.8% excluding cancellations
- median successful run time: 6.1 min
- average successful run time: 6.7 min
- p90 successful run time: 14.7 min
- latest successful run on 2026-04-19:
  - `gsc-expansion.js`: 1m13s
  - `gsc-prepend-queue.js`: <1s
  - `daily-scrape.js`: 13s
  - `upload-to-firestore.js`: 27s
  - `refresh-reviews.ts`: 25s
  - `score-plumbers.ts`: 5m21s
  - `export-firestore-to-json.js --no-push`: 8s
  - commit/push: 2s
  - request indexing: 2s
- latest run on 2026-04-20 cancelled at timeout:
  - `score-plumbers.ts` ran 41m10s before cancellation
  - all export/commit/indexing steps were skipped

Docs drift:
- `ROADMAP.md` says `daily-scrape.js` "scrapes new cities, synthesizes with Claude Sonnet, commits JSON to git." Current script no longer synthesizes and never writes committed JSON; the workflow delegates synthesis to `score-plumbers.ts` and JSON export to `export-firestore-to-json.js`.
- `ROADMAP.md` still describes a 5-phase pipeline that includes `synthesize-reviews.ts`; current workflow does not call that script.

### 3.2 `deep-review-pull.yml`

Supposed job: choose already-indexed/high-traction cities, enrich them with BBB and deeper multi-source reviews, rescore, export JSON, and request indexing.

Actual steps:
1. `npm install firebase-admin outscraper googleapis typescript tsx @anthropic-ai/sdk`
2. gate on both `FIREBASE_SERVICE_ACCOUNT` and `OUTSCRAPER_API_KEY`
3. run `find-deep-review-cities.js`
4. loop `bbb-lookup.js` across selected cities
5. run `outscraper-reviews.js "$SLUG" --skip-synthesis` for up to three cities in separate hard-coded steps
6. run `score-plumbers.ts --pass all`
7. repo-root `git pull --rebase`
8. run `export-firestore-to-json.js` and parse `__AFFECTED_CITIES__`
9. run `request-indexing.js` for affected emergency-city URLs

Triggers:
- cron
- manual `workflow_dispatch`

Depends on:
- secrets: `FIREBASE_SERVICE_ACCOUNT`, `OUTSCRAPER_API_KEY`, `ANTHROPIC_API_KEY`
- scripts: `find-deep-review-cities.js`, `bbb-lookup.js`, `outscraper-reviews.js`, `score-plumbers.ts`, `export-firestore-to-json.js`, `request-indexing.js`

Writes:
- Firestore: `plumbers`, `reviews`, `pipelineRuns`, `indexingRequests`
- repo files: `data/synthesized/plumbers-synthesized.json`, `data/synthesized/leaderboard.json`
- git push when export creates a commit

Current runtime and timeout:
- job timeout: 120 min
- last 30 days: 21 runs, 12 success, 3 failure, 6 cancelled
- failure rate over last 30 days: 42.9% including cancellations, 14.3% excluding cancellations
- median successful run time: 0.9 min
- average successful run time: 1.4 min
- those short successful runs are mostly "no cities selected" days
- latest run on 2026-04-20 cancelled at timeout:
  - `find-deep-review-cities.js`: 16s
  - `bbb-lookup.js`: 1m36s
  - `outscraper-reviews.js` city 1: 31m40s
  - `outscraper-reviews.js` city 2: 32m16s
  - `outscraper-reviews.js` city 3: 12s
  - `score-plumbers.ts`: 53m33s before cancellation
  - export/indexing never ran
- last 6 scheduled runs all ended `cancelled`

Docs drift:
- `ROADMAP.md` describes Outscraper as Google + Yelp + Angi. Current `outscraper-reviews.js` only pulls Google and Yelp.
- `bbb-lookup.js` source header says "Manual use only." It is currently invoked automatically by this workflow every day.

### 3.3 `rebuild-json.yml`

Supposed job: periodically force Firestore truth back into committed repo JSON.

Actual steps:
1. `npm install firebase-admin`
2. gate on `FIREBASE_SERVICE_ACCOUNT`
3. run `export-firestore-to-json.js --no-push`
4. run `generate-city-coverage.js`
5. commit/push if staged files changed

Triggers:
- cron
- manual `workflow_dispatch`

Depends on:
- secret: `FIREBASE_SERVICE_ACCOUNT`
- scripts: `export-firestore-to-json.js`, `generate-city-coverage.js`

Writes:
- repo files: `data/synthesized/plumbers-synthesized.json`, `data/synthesized/leaderboard.json`, `src/lib/city-coverage.ts`
- Firestore: `pipelineRuns` via export script
- git commit/push if changed

Current runtime and timeout:
- job timeout: 10 min
- last 30 days: 52 runs, 52 success
- failure rate over last 30 days: 0%
- median successful run time: 0.9 min
- latest successful run:
  - export: 4s
  - generate-city-coverage: <1s
  - commit/push: 2s

Docs drift:
- docs mention this as a safety net; that matches reality.
- its practical role today is bigger than docs imply: it is currently the compensating writer after upstream workflow timeouts.

### 3.4 `publish-experiment-metrics.yml`

Supposed job: publish daily GSC metrics for experiment slugs into Firestore for the control-center experiment brain.

Actual steps:
1. checkout and Node 20
2. gate on `FIREBASE_SERVICE_ACCOUNT`
3. write service account to `apps/service-account.json`
4. `npm install`
5. `npx tsx scripts/experiments/publish-metrics-cron.ts`

Triggers:
- cron
- manual `workflow_dispatch`

Depends on:
- secret: `FIREBASE_SERVICE_ACCOUNT`
- scripts: `scripts/experiments/publish-metrics-cron.ts`, `src/lib/experiments/publishMetrics.ts`
- GSC access via same service account

Writes:
- Firestore: `experiment_metrics/plumbers/{slug_encoded}/{date}`
- no repo writes

Current runtime and timeout:
- no explicit timeout in YAML
- last 30 days: 6 runs, 3 success, 3 failure
- failure rate over last 30 days: 50%
- median successful run time: 1.0 min
- latest successful run:
  - install: 41s
  - publish step: 7s

Docs drift:
- `EXPERIMENTS.md` matches the current path and workflow.
- This workflow touches pipeline-related data only for experiments, not core plumber ingestion/export.

## 4. Script Audit

Only scripts that are live in workflows, directly called by those scripts, or run automatically at build time are included here.

### 4.1 `gsc-expansion.js`

Supposed job: pull GSC page data and identify city pages with impressions but no scraped plumber data yet.

Actual behavior:
1. authenticates to Search Console with the service account
2. pulls 90 days of page-level data with no URL filter
3. parses both `/emergency-plumbers/{state}/{city}` and `/{service}/{state}/{city}` URLs
4. aggregates metrics per city/state slug
5. writes latest city metrics onto `cities/{city-state}`
6. writes `cities/{slug}/gscHistory/{date}`
7. writes `cities/{slug}/gscPageBreakdown/*` and `cities/{slug}/gscQueries/*`
8. zero-fills `gscPageBreakdown` for cities with no impressions on the target date
9. writes site-wide tables: `gscSiteQueries`, `gscSitePages`, `gscSearchAppearance`, `gscDailyTotals`
10. creates stub `cities` docs for newly discovered cities
11. writes `data/gsc-expansion-queue.json`

Trigger:
- only via `daily-scrape.yml`

Depends on:
- `service-account.json`
- `googleapis`
- Firestore `cities`

Writes:
- Firestore: `cities`, `cities/{slug}/gscHistory`, `cities/{slug}/gscPageBreakdown`, `cities/{slug}/gscQueries`, `gscSiteQueries`, `gscSitePages`, `gscSearchAppearance`, `gscDailyTotals`
- repo: `data/gsc-expansion-queue.json`

Runtime and timeout:
- no intrinsic script timeout
- latest successful workflow step: 1m13s
- bounded by daily workflow’s 45 min timeout

Docs drift:
- `city-activation-architecture.md` says this script only filters `/emergency-plumbers/` pages. Current parser already handles service-page URLs too.

### 4.2 `gsc-prepend-queue.js`

Supposed job: take discovered GSC cities, resolve coordinates, prepend them to the scrape queue, and regenerate city coord artifacts.

Actual behavior:
1. loads `data/gsc-expansion-queue.json`
2. sorts new cities by impressions descending
3. prepends unseen cities into `scripts/scrape-queue.json`
4. resolves coords via cache -> offline CSV -> OSM/Nominatim -> Google Geocoding
5. appends hits into `scripts/city-coords-cache.json`
6. if any coords were added, runs `generate-cities-data.mjs`
7. exits non-zero if any newly queued city still lacks coords

Trigger:
- only via `daily-scrape.yml`

Depends on:
- `GOOGLE_PLACES_API_KEY` for Geocoding fallback
- `generate-cities-data.mjs`
- `scripts/data/us-cities.csv`

Writes:
- repo: `scripts/scrape-queue.json`, `scripts/city-coords-cache.json`
- indirectly regenerates `src/lib/city-coords.ts` and `src/lib/cities-generated.ts`
- shared error log via control-center CLI

Runtime and timeout:
- no intrinsic timeout
- latest successful workflow step: <1s because no new coords were resolved
- bounded by daily workflow timeout

Docs drift:
- docs say it patches `city-coords.ts`; current implementation treats `city-coords-cache.json` as the single write path and regenerates TS from that cache.

### 4.3 `generate-cities-data.mjs`

Supposed job: regenerate `cities-generated.ts` and `city-coords.ts` together from the raw city list plus coord cache.

Actual behavior relevant to pipeline:
1. reads `scripts/city-coords-cache.json`
2. resolves any missing coords via CSV, OSM, then Google Geocoding
3. rewrites the paired TS files
4. logs unresolved coord failures to the shared error log

Trigger:
- invoked by `gsc-prepend-queue.js`
- also run manually for coord backfills

Depends on:
- `scripts/data/us-cities.csv`
- optional Google Geocoding enablement

Writes:
- repo: `src/lib/city-coords.ts`, `src/lib/cities-generated.ts`, `scripts/city-coords-cache.json`
- shared error log

Runtime and timeout:
- no workflow-owned timeout directly; inherits from caller

Current observed state:
- shared error log on 2026-04-19 shows Google Geocoding `REQUEST_DENIED`
- same run logged `183 cities still missing coords after backfill`

### 4.4 `daily-scrape.js`

Supposed job: pick cities from queue and fetch new plumbers from Google Places.

Actual behavior:
1. loads `scripts/scrape-queue.json`
2. applies its own monthly/daily call math from queue fields
3. loads existing raw plumber data for dedup
4. loads existing synthesis from staging or canonical JSON
5. selects pending cities that fit the estimated daily budget
6. runs text search for `emergency plumber` plus widening retry queries if thin
7. calls Place Details per unseen place
8. immediately caches initial Google reviews into Firestore `reviews`
9. marks cities done/failed in queue and appends to `completed`
10. updates `cities/{slug}` with scrape metadata
11. rewrites `data/raw/plumbers-latest.json`
12. rewrites `data/raw/plumbers-with-synthesis.json` staging file
13. writes `data/logs/daily-result-YYYY-MM-DD.json`
14. logs `pipelineRuns`

Trigger:
- only via `daily-scrape.yml`

Depends on:
- env: `GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`
- queue files and prior raw/synth data files
- optional Firestore service account for review/city logging

Writes:
- Firestore: `reviews`, `cities`, `pipelineRuns`
- repo: `scripts/scrape-queue.json`, `data/raw/plumbers-latest.json`, `data/raw/plumbers-with-synthesis.json`, `data/logs/daily-result-*.json`, `data/logs/daily-scrape-*.log`

Runtime and timeout:
- no intrinsic timeout
- latest successful workflow step: 13s
- bounded by daily workflow timeout

Docs drift:
- file header still says "scrapes, synthesizes" and "updates all output files." Synthesis is explicitly skipped now.
- Anthropic key is still required even though current script does not make a synthesis call.

### 4.5 `upload-to-firestore.js`

Supposed job: upsert staged plumber records into Firestore.

Actual behavior:
1. prefers `data/raw/plumbers-with-synthesis.json`; falls back to canonical JSON
2. maps each plumber into the Firestore plumber schema
3. upserts into `plumbers/{placeId}` in batches of 500
4. preserves `createdAt` on existing docs by merge behavior
5. logs `pipelineRuns`

Trigger:
- only via `daily-scrape.yml`

Depends on:
- `service-account.json`
- staged or canonical JSON file

Writes:
- Firestore: `plumbers`, `pipelineRuns`

Runtime and timeout:
- no intrinsic timeout
- latest successful workflow step: 27s
- bounded by daily workflow timeout

Docs drift:
- header says "Upload synthesized plumber data" and old error text says "Run synthesize-reviews.js first." Current daily path feeds it the staging file from `daily-scrape.js`, not the old synthesis script.

### 4.6 `refresh-reviews.ts`

Supposed job: accumulate new Google reviews for existing plumbers and update freshness/reliability metadata.

Actual behavior:
1. loads all plumbers, all cached reviews, and all leads
2. builds a priority queue by review gap, staleness, and lead count
3. enforces its own monthly budget math
4. fetches `places.googleapis.com/v1/places/{placeId}` with `reviews,rating,userRatingCount,businessStatus`
5. deduplicates new reviews into Firestore
6. updates plumber freshness, cached counts, closure flags, review gap
7. checks `plumberReports` to auto-flag repeat negative reports
8. recalculates `reliabilityScore` and `verificationStatus`
9. writes `ratingSnapshots`
10. logs `pipelineRuns`

Trigger:
- only via `daily-scrape.yml` in automated path

Depends on:
- `GOOGLE_PLACES_API_KEY`
- `service-account.json`
- Firestore `plumbers`, `reviews`, `leads`, `plumberReports`

Writes:
- Firestore: `reviews`, `plumbers`, `ratingSnapshots`, `apiUsage`, `pipelineRuns`

Runtime and timeout:
- no intrinsic timeout
- latest successful workflow step: 25s
- bounded by daily workflow timeout

Docs drift:
- `ROADMAP.md` still notes Places API (New) is not enabled on the Firebase GCP project. The script does call Places API (New), but in the latest successful daily run the step itself completed successfully.
- `scripts/lib/budget-guard.ts` exists as a shared budget module, but this script still uses its own budget constants instead of that shared module.

### 4.7 `score-plumbers.ts`

Supposed job: run the unified scoring/synthesis pipeline and write decision-layer fields.

Actual behavior:
1. loads plumbers and all reviews for each plumber
2. skips recently scored plumbers unless review counts changed by 20%+
3. uses keyword fallback for plumbers with fewer than 3 reviews
4. batches reviews 15 at a time through Claude Sonnet extraction
5. aggregates dimension scores with recency weighting
6. builds `servicesMentioned`
7. makes a second Sonnet call for summary/weakness/red-flag synthesis
8. derives badges, pricing tier, emergency readiness deterministically
9. writes pass-1 data to plumber docs
10. pass 2 ranks plumbers per city and writes `city_rank`
11. pass 3 writes `decision`

Trigger:
- `daily-scrape.yml`
- `deep-review-pull.yml`
- also usable manually

Depends on:
- `ANTHROPIC_API_KEY`
- `service-account.json`
- Firestore `plumbers`, `reviews`, `cities`
- `src/lib/decision-engine.ts`

Writes:
- Firestore: `plumbers`

Runtime and timeout:
- no intrinsic script timeout
- latest successful daily step: 5m21s
- latest cancelled daily step: 41m10s before workflow timeout
- latest cancelled deep-review step: 53m33s before workflow timeout
- this is the current bottleneck in both data workflows

Docs drift:
- `ROADMAP.md` still presents `synthesize-reviews.ts` as the synthesis step; this script has effectively subsumed that role.
- `city-activation-architecture.md` still describes a different division of labor where daily scrape does basic synthesis and this script is a later forward-scoring pass.

### 4.8 `export-firestore-to-json.js`

Supposed job: make committed static JSON reflect Firestore truth.

Actual behavior:
1. reads canonical `data/synthesized/plumbers-synthesized.json`
2. loads all Firestore plumbers and all Firestore reviews
3. for each plumber, either builds a new JSON entry or merges Firestore enrichment into the existing one
4. always rewrites `plumbers-synthesized.json`
5. rebuilds `leaderboard.json`
6. optionally commits and pushes unless `--no-push`
7. logs `pipelineRuns`
8. prints `__AFFECTED_CITIES__:` marker for callers

Trigger:
- `daily-scrape.yml`
- `deep-review-pull.yml`
- `rebuild-json.yml`
- standalone tail from `outscraper-reviews.js` when run manually

Depends on:
- `service-account.json`
- Firestore `plumbers`, `reviews`
- existing canonical JSON file

Writes:
- repo: `data/synthesized/plumbers-synthesized.json`, `data/synthesized/leaderboard.json`
- Firestore: `pipelineRuns`
- optional git commit/push

Runtime and timeout:
- no intrinsic timeout
- latest successful daily step: 8s
- latest successful rebuild step: 4s
- bounded by parent workflow timeout

Docs drift:
- header says it only touches plumbers newer than JSON. Current implementation still checks freshness, but then always rewrites the whole JSON from Firestore truth.

### 4.9 `generate-city-coverage.js`

Supposed job: generate a city coverage map for UI/sitemap gating.

Actual behavior:
1. reads `plumbers-synthesized.json`
2. parses `city-coords.ts`
3. counts operational plumbers within 20 miles of each city
4. writes `src/lib/city-coverage.ts`

Trigger:
- `daily-scrape.yml`
- `rebuild-json.yml`
- app `prebuild`

Depends on:
- `data/synthesized/plumbers-synthesized.json`
- `src/lib/city-coords.ts`

Writes:
- repo/build artifact: `src/lib/city-coverage.ts`

Runtime and timeout:
- latest rebuild step: <1s
- no intrinsic timeout

### 4.10 `request-indexing.js`

Supposed job: submit sitemap and selected URLs to Google indexing endpoints and log the requests.

Actual behavior:
1. authenticates with service account for both Indexing API and Search Console
2. always submits the sitemap
3. if URLs were provided, checks Firestore `indexingRequests` count for the day
4. caps URL submissions at daily quota 200
5. logs each request to `indexingRequests`
6. logs a `pipelineRuns` summary

Trigger:
- called from `daily-scrape.yml`
- called from `deep-review-pull.yml`
- callable manually

Depends on:
- `service-account.json`
- `googleapis`
- optional Firestore logging

Writes:
- Firestore: `indexingRequests`, `pipelineRuns`

Runtime and timeout:
- latest successful daily step: 2s
- no intrinsic timeout

### 4.11 `find-deep-review-cities.js`

Supposed job: select up to three cities worth a deep review pull.

Actual behavior:
1. prints full city-tier debug info to stderr
2. queries `cities` with `gscTier in ["medium","high"]`
3. applies a position-aware qualification rule
4. loads matching active plumbers by `serviceCities` or state fallback
5. filters out cities where all plumbers have fresh `lastOutscraperPull`
6. sorts by priority and impressions
7. prints space-separated city slugs to stdout

Trigger:
- only via `deep-review-pull.yml`

Depends on:
- `service-account.json`
- Firestore `cities`, `plumbers`

Writes:
- no repo or Firestore writes

Runtime and timeout:
- latest successful workflow step: 16s
- no intrinsic timeout

### 4.12 `bbb-lookup.js`

Supposed job: enrich plumbers in selected cities with BBB data.

Actual behavior:
1. loads active plumbers for each city slug
2. BBB search API query per plumber
3. fuzzy-match candidate names
4. scrape BBB profile page for complaints and years in business
5. update `plumbers/{id}.bbb` and `updatedAt`
6. log `pipelineRuns`

Trigger:
- automated in `deep-review-pull.yml`
- also callable manually

Depends on:
- `service-account.json`
- public BBB endpoints

Writes:
- Firestore: `plumbers`, `pipelineRuns`

Runtime and timeout:
- latest successful workflow step: 1m36s
- no intrinsic timeout

Docs drift:
- header says "Manual use only." Current workflow uses it every day.

### 4.13 `outscraper-reviews.js`

Supposed job: pull deeper cross-platform reviews for selected cities.

Actual behavior:
1. loads active plumbers for each city slug
2. per plumber, pulls Google reviews from Outscraper `/maps/reviews-v3`
3. optionally pulls Yelp reviews via constructed Yelp URL or Google-search fallback
4. stores deduped reviews into Firestore
5. updates cached review counts and Yelp aggregates on plumber docs
6. if not `--skip-synthesis`, can still run its own legacy Haiku synthesis
7. logs `pipelineRuns`
8. when run standalone, it also auto-runs `export-firestore-to-json.js` and `request-indexing.js` afterward

Trigger:
- `deep-review-pull.yml` calls it with `--skip-synthesis`
- also callable manually

Depends on:
- `OUTSCRAPER_API_KEY`
- optional `ANTHROPIC_API_KEY` for its legacy synthesis path
- `service-account.json`

Writes:
- Firestore: `reviews`, `plumbers`, `pipelineRuns`
- standalone-only side effect: may trigger JSON export and indexing

Runtime and timeout:
- no intrinsic timeout
- latest cancelled workflow:
  - city 1 step: 31m40s
  - city 2 step: 32m16s
  - city 3 step: 12s
- bounded by deep-review workflow timeout

Docs drift:
- docs say Google + Yelp + Angi. Current code only implements Google and Yelp.
- the workflow disables this script’s synthesis path with `--skip-synthesis`, so the embedded Haiku synthesis path is live code but dead in the automated path.

### 4.14 `scripts/experiments/publish-metrics-cron.ts` and `src/lib/experiments/publishMetrics.ts`

Supposed job: publish experiment slug GSC metrics into Firestore.

Actual behavior:
1. determine target date, default yesterday
2. load tracked slugs from `activeExperiments.ts`
3. query Search Console for page rows on that date
4. map matching `/emergency-plumbers/{state}/{city}` URLs to slugs
5. write zero-filled or matched metrics under `experiment_metrics`

Trigger:
- `publish-experiment-metrics.yml`

Depends on:
- `service-account.json`
- GSC service account access

Writes:
- Firestore: `experiment_metrics`

Runtime and timeout:
- latest successful workflow step: 7s
- no intrinsic timeout

## 5. Build-Time and Render-Time Handoffs

How the site consumes pipeline output:

1. `src/lib/plumber-data.ts` reads `data/synthesized/plumbers-synthesized.json` from disk.
2. `getPlumbersNearCity()` does static 20-mile fallback from that JSON.
3. `src/lib/firestore.ts` `resolvePlumbersForCity()` tries Firestore first:
   - direct `serviceCities` match
   - then state-level 20-mile radius sweep
4. city pages and service pages use that shared Firestore resolver, then fall back to static JSON when Firestore is unavailable or empty.
5. `src/lib/city-coverage.ts` gates:
   - `CitySearch`
   - sitemap service-page entries
   - parts of page rendering logic
6. `apps/plumbers-web/package.json` runs `node scripts/generate-city-coverage.js` in `prebuild`, so Vercel also regenerates coverage on every app build.

This means the live site is fed by both:
- committed JSON at build time
- Firestore at request/render time when configured

## 6. Budget and Rate-Limit Guardrails

### Live guardrails in current automated path

| Area | Location | Current rule |
|---|---|---|
| Daily scrape queue budget | `scripts/daily-scrape.js` + `scripts/scrape-queue.json` | queue file says `monthlyBudget: 1000`, `usedThisMonth: 560`; script keeps `MONTHLY_BUFFER = 50`, clamps daily budget between 20 and 50 calls, uses `estCalls = 18` per city |
| Thin-city widening | `scripts/daily-scrape.js` | retry broader queries until `THIN_THRESHOLD = 5` candidates or queries exhausted |
| Google Places scrape pacing | `scripts/daily-scrape.js` | `RATE_LIMIT_MS = 300` |
| Review refresh budget | `scripts/refresh-reviews.ts` | `MONTHLY_BUDGET = 200`, `REFRESH_BUDGET_PCT = 0.4`, hard stop at 90% of budget |
| Review refresh saturation | `scripts/refresh-reviews.ts` | deprioritize after 5 zero-new refreshes, but still refresh every 14 days |
| Scoring pacing | `scripts/score-plumbers.ts` | 15 reviews per batch, 2s sleep, 3 retries |
| Outscraper pacing | `scripts/outscraper-reviews.js` | 2s between Outscraper calls, 150s async poll timeout, max 100 reviews/source |
| BBB pacing | `scripts/bbb-lookup.js` | 1.5s delay between BBB requests |
| OSM/Nominatim pacing | `scripts/gsc-prepend-queue.js` and `generate-cities-data.mjs` | 1.1s between requests |
| Indexing quota | `scripts/request-indexing.js` | 200 URL requests/day, checked in Firestore |
| GSC row cap | `scripts/gsc-expansion.js` | `rowLimit = 5000`, warns on truncation |

### Guardrails defined but not on the live path

- `scripts/lib/budget-guard.ts` defines a shared `apiUsage` model:
  - default monthly budget `$200`
  - hard stop at `90%`
  - phase allocation `expansion 60 / refresh 30 / reserve 10`
- no current workflow-invoked script imports this module
- current live budget enforcement is split across:
  - `daily-scrape.js` queue math
  - `refresh-reviews.ts` inline budget math
  - `request-indexing.js` inline quota math

## 7. Firestore Collections Used by the Pipeline

### Top-level collections written by the active pipeline

| Collection | Writers | Readers |
|---|---|---|
| `plumbers` | `upload-to-firestore.js`, `refresh-reviews.ts`, `score-plumbers.ts`, `bbb-lookup.js`, `outscraper-reviews.js` | `export-firestore-to-json.js`, `find-deep-review-cities.js`, frontend `firestore.ts` |
| `reviews` | `daily-scrape.js`, `refresh-reviews.ts`, `outscraper-reviews.js` | `score-plumbers.ts`, `export-firestore-to-json.js`, diagnostics |
| `cities` | `gsc-expansion.js`, `daily-scrape.js`, one-time seeders | `find-deep-review-cities.js`, frontend `firestore.ts`, admin |
| `pipelineRuns` | `daily-scrape.js`, `upload-to-firestore.js`, `refresh-reviews.ts`, `bbb-lookup.js`, `outscraper-reviews.js`, `export-firestore-to-json.js`, `request-indexing.js` | admin Activity page |
| `apiUsage` | `refresh-reviews.ts` today, legacy/shared budget code also targets it | budget checks and audits |
| `ratingSnapshots` | `refresh-reviews.ts` | admin/analysis only |
| `indexingRequests` | `request-indexing.js` | `request-indexing.js`, admin/analysis |
| `experiment_metrics` | experiment metrics publisher | control-center and experiment analysis |
| `gscSiteQueries` | `gsc-expansion.js` | analysis only |
| `gscSitePages` | `gsc-expansion.js` | analysis only |
| `gscSearchAppearance` | `gsc-expansion.js` | analysis only |
| `gscDailyTotals` | `gsc-expansion.js` | analysis only |

### Subcollections written by the active pipeline

| Path | Writer |
|---|---|
| `cities/{slug}/gscHistory/{date}` | `gsc-expansion.js` |
| `cities/{slug}/gscPageBreakdown/{row}` | `gsc-expansion.js` |
| `cities/{slug}/gscQueries/{row}` | `gsc-expansion.js` |

### Read-only collections that still affect pipeline behavior

| Collection | Reader | Why it matters |
|---|---|---|
| `leads` | `refresh-reviews.ts` | influences review refresh priority |
| `plumberReports` | `refresh-reviews.ts` | can auto-flag plumbers during refresh |

## 8. Current Queue and State Snapshot

Snapshot from repo files on 2026-04-20:

- `data/gsc-expansion-queue.json`
  - generated: `2026-04-19T11:37:43.122Z`
  - `needsScraping`: 108
- `scripts/scrape-queue.json`
  - pending: 114
  - completed: 22
  - queue monthly budget: 1000
  - queue used this month: 560
- `scripts/city-coords-cache.json`
  - keys: 2266
- top pending queue cities at file read:
  - Salt Lake City, UT
  - Hanover Park, IL
  - Reston, VA
  - Cicero, IL
  - Bartlett, IL
  - Cedar Park, TX
  - Arlington Heights, IL
  - Dallas, TX
  - Murfreesboro, TN
  - Lakewood, CO

Shared error log signals relevant to pipeline:
- 2026-04-19 `generate-cities-data` logged Google Geocoding `REQUEST_DENIED`
- same run logged `183 cities still missing coords after backfill`

## 9. Documentation Drift

The main drifts between docs and code today:

1. `ROADMAP.md` says `daily-scrape.js` synthesizes and commits JSON.
   Actual: it writes raw/staging files only; synthesis/export happen in later workflow steps.

2. `ROADMAP.md` and several docs say deep review pull is Google + Yelp + Angi.
   Actual: `outscraper-reviews.js` implements Google + Yelp only.

3. `bbb-lookup.js` header says manual-only.
   Actual: scheduled workflow runs it daily.

4. `upload-to-firestore.js` still tells callers to run `synthesize-reviews.js` first.
   Actual: scheduled path uses `daily-scrape.js` staging output.

5. `city-activation-architecture.md` says `gsc-expansion.js` only sees emergency-plumber URLs.
   Actual: parser already supports service-page URLs too.

6. `unified-pipeline-spec.md` is partly aspirational.
   Actual live workflows do not use any `ingest-*` or `activate-city.ts` orchestrators described there.

7. `scripts/lib/budget-guard.ts` exists as the intended shared budget guard.
   Actual live scripts do not import it.

## 10. Duplication, Leftovers, and Orphans

### Overlapping active responsibilities

1. Synthesis logic exists in more than one place.
   - active automated path: `score-plumbers.ts`
   - legacy still on disk: `synthesize-reviews.ts`, `synthesize-reviews.js`
   - embedded but disabled in workflow: `outscraper-reviews.js` synthesis path

2. Export/indexing responsibility exists in more than one place.
   - automated path: workflows call `export-firestore-to-json.js` and `request-indexing.js`
   - standalone side effect path: `outscraper-reviews.js` also calls both after it finishes

3. Budget enforcement is duplicated.
   - `daily-scrape.js`
   - `refresh-reviews.ts`
   - `request-indexing.js`
   - unused shared module `scripts/lib/budget-guard.ts`

### Unwired or leftover pipeline files

| File | Status | Notes |
|---|---|---|
| `scripts/daily-scrape-workflow-v2.yml` | orphan | lives under `scripts/`, not `.github/workflows/` |
| `scripts/run-daily.js` | orphan orchestration | not called by any workflow |
| `scripts/daily-publish.js` | orphan orchestration | only referenced by `run-daily.js` |
| `scripts/fetch-plumbers-v2.ts` | superseded | still documented in places, not used by live workflows |
| `scripts/fetch-plumbers.ts` | legacy fetcher | not used by live workflows |
| `scripts/scrape-plumbers.js` | legacy fetcher | not used by live workflows |
| `scripts/synthesize-reviews.ts` | legacy synthesis | not used by live workflows |
| `scripts/synthesize-reviews.js` | older legacy synthesis | not used by live workflows |
| `scripts/seed-expansion-queue.js` and `.ts` | one-time/manual seeders | not scheduled |
| `scripts/gsc-pull-test.js` | diagnostic | not scheduled |
| `scripts/inspect-*`, `dump-scored-plumbers.ts`, `test-*` | diagnostic/test | not scheduled |
| `scripts/check-empty-in-queue.js`, `gsc-empty-pages-audit.js` | ad hoc audit helpers | not scheduled |

## 11. Where the Rot Is Today

This section is descriptive only.

1. Failure masking is built into both main workflows.
   - most data steps use `continue-on-error: true`
   - workflow-level red status mostly appears only when the whole job times out
   - partial pipeline work can land in Firestore without a corresponding JSON export in the same workflow

2. `score-plumbers.ts` is on the critical path twice.
   - once in daily scrape
   - once in deep review pull
   - both workflows currently stall there

3. `rebuild-json.yml` is not just a backup.
   - it is currently the mechanism that often gets Firestore truth back into committed JSON after upstream cancellations

4. Shared budget architecture is only partially adopted.
   - `apiUsage` exists
   - `budget-guard.ts` exists
   - live workflow scripts do not share one budget module

5. Multi-source review docs overstate current coverage.
   - code currently does not pull Angi despite docs claiming it does

6. The coord contract is stronger in docs than in current state.
   - the contract is implemented
   - but the latest shared log still shows 183 unresolved coords after a backfill run

## 12. Bottom Line

The live plumber-data pipeline today is not one script or one workflow. It is a chain of:
- GSC discovery
- queueing and coord regeneration
- Google Places scrape
- Firestore upsert
- review accumulation
- BBB and Outscraper enrichment
- scoring/synthesis
- Firestore-to-JSON export
- city-coverage regeneration
- git push
- Vercel rebuild
- indexing requests

The key reality of April 20, 2026:
- Firestore is the operational source of truth
- `export-firestore-to-json.js` is the single committed JSON writer
- `score-plumbers.ts` is the current bottleneck
- `rebuild-json.yml` is the compensating workflow keeping repo JSON in sync when the two main workflows time out
- docs are directionally right about the architecture, but several details now lag the actual code path
