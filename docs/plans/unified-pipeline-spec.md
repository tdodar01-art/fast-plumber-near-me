# Unified Pipeline Spec — Single Brain Architecture

**Goal:** Replace 6 separate scripts with 3 phases under one orchestrator. Preserve every piece of intelligence we've built.

---

## Current State (what we're replacing)

6 separate scripts running in sequence across 2 workflows:

**daily-scrape.yml (6 AM):**
1. `gsc-expansion.js` — find cities with GSC impressions
2. `gsc-prepend-queue.js` — geocode + add to scrape queue
3. `daily-scrape.js` — scrape new plumbers from Google Places API
4. `upload-to-firestore.js` — push plumber docs to Firestore
5. `refresh-reviews.ts` — fetch new reviews for existing plumbers
6. `score-plumbers.ts` — score + synthesize (UNIFIED TODAY)
7. `export-firestore-to-json.js` — export to static JSON

**deep-review-pull.yml (7 AM):**
1. `find-deep-review-cities.js` — pick cities for deep pull
2. `bbb-lookup.js` — scrape BBB profiles
3. `outscraper-reviews.js` — pull 100 reviews/source + Haiku synthesize (REDUNDANT)
4. `score-plumbers.ts` — score + synthesize (overwrites Haiku)
5. `export-firestore-to-json.js` — export

**Problems:**
- Duplicate synthesis (Haiku in Outscraper, Sonnet in scoring)
- BBB / Outscraper / Scoring all enrich the same doc as separate steps
- 30-day skip in scoring means recently-Outscraper'd plumbers aren't re-scored on richer data
- GSC threshold is impression-only, ignores position (10 impressions @ pos 50 = same priority as 10 @ pos 5)

---

## Proposed Architecture: 3 Phases, One Brain

```
┌────────────────────────────────────────────────────┐
│                  PHASE 1: DECIDE                   │
│  Determine what needs work today, in what order    │
└────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────┐
│                  PHASE 2: INGEST                   │
│  Pure data fetching — no AI calls, no synthesis    │
│  Pull from Google / Outscraper / BBB → Firestore   │
└────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────┐
│                  PHASE 3: SCORE                    │
│  THE SINGLE BRAIN — Sonnet 4.6                     │
│  Reads all cached data, produces everything        │
└────────────────────────────────────────────────────┘
                         │
                         ▼
                   Export → Push
```

---

## Phase 1: DECIDE

**One script: `pipeline-decide.ts`**

Combines: `gsc-expansion.js`, `gsc-prepend-queue.js`, `find-deep-review-cities.js`

**Outputs a single plan for the day:**
```typescript
type DailyPlan = {
  scrapeQueue: City[];           // new cities to scrape (from GSC + manual)
  refreshTargets: Plumber[];     // existing plumbers due for Google review refresh
  outscraperTargets: City[];     // cities qualifying for deep review pull
  bbbTargets: Plumber[];         // plumbers needing BBB lookup
  scoringTargets: Plumber[];     // plumbers needing (re-)scoring
};
```

### Trigger Thresholds (preserved + improved)

**For scrape queue:**
- GSC discovery: any city with impressions AND no plumber data → add to queue
- Sort by: impressions descending (already built today)
- Cap: respects daily/monthly Places API budget

**For Outscraper deep pull:**
- Replaces simple `gscTier in (medium, high)` filter with **position-aware tiers**:

```
PRIORITY 1 (always pull):
  impressions >= 50 (any position)
  OR impressions >= 10 AND position <= 15

PRIORITY 2 (pull if budget allows):
  impressions >= 10 AND position <= 30

SKIP:
  impressions < 10
  OR position > 30 regardless of impressions
```

Position-aware logic: 10 impressions at position 6 means people are seeing you on page 1 and probably clicking through. 10 impressions at position 50 means Google is barely testing you. Spend Outscraper credits on the first, skip the second.

- Cap: 3 cities per day (preserved)
- Freshness gate: skip if all plumbers Outscraper'd in last 30 days (preserved)

**For BBB lookup:**
- Trigger when a plumber is selected for Outscraper pull AND doesn't have BBB data yet
- No separate scheduling — it's a sub-task of the Outscraper pull

**For Google review refresh:**
- Existing logic preserved: priority queue by review gap, lead count, staleness
- Budget cap: 40% of monthly Places API budget (preserved)

**For scoring:**
- **NEW trigger logic:** trigger when EITHER:
  - 30 days since last score (existing)
  - OR review count has changed by 20%+ since last score (new — handles the "Outscraper just added 100 reviews" case)
  - OR plumber has never been scored

---

## Phase 2: INGEST

**Three scripts (kept separate — they hit different APIs and can run in parallel):**

### `ingest-google-scrape.ts` (was `daily-scrape.js` + `upload-to-firestore.js`)
- Scrape Google Places API for new plumbers in queued cities
- Store plumber doc in Firestore
- Store the 5 initial reviews in Firestore `reviews` collection (tagged `source: "google-places-initial"`)
- **NO synthesis call** — already removed today
- Just data ingestion

### `ingest-google-refresh.ts` (was `refresh-reviews.ts`)
- For existing plumbers in priority order
- Call Google Places API → get 5 reviews
- Dedupe by hash, store new ones in Firestore
- Update `lastReviewRefreshAt`, `cachedReviewCount`
- **No synthesis** — just ingestion

### `ingest-outscraper-bbb.ts` (was `outscraper-reviews.js` + `bbb-lookup.js`)
For each city in the Outscraper target list:
- Run BBB lookup for each plumber → store BBB data on plumber doc
- Pull 100 reviews/source from Outscraper (Google, Yelp, Angi)
- Dedupe by source-prefixed hash, store in Firestore `reviews` collection
- Store Yelp/Angi aggregate ratings on plumber doc
- **NO synthesis call — REMOVED**
- **NO platform discrepancy detection — moved to scoring**

**Key invariant:** No script in Phase 2 calls Claude. Pure ingestion only.

---

## Phase 3: SCORE (The Single Brain)

**One script: `score-plumbers.ts`** (already exists, expanded)

For each plumber in `scoringTargets`:

### Pass 1: Score + Synthesize (Sonnet 4.6)

**Reads:**
- All cached reviews from Firestore `reviews` collection (Google + Yelp + Angi)
- BBB data from plumber doc
- Aggregate ratings (Google, Yelp, Angi)

**Step A: Batch extraction**
- Batches of 15 reviews → Claude Sonnet 4.6
- Per review: 5 dimension scores + job_type tag + evidence quote
- Aggregates with recency weighting (preserved)
- Computes specialty_strength per job type (preserved)
- Builds servicesMentioned (preserved — added today)

**Step B: Synthesis call** (1 per plumber)
- Sonnet 4.6 receives:
  - All review texts (sample of 30 by recency)
  - Aggregated dimension scores
  - Evidence quotes already extracted
  - **NEW:** Yelp/Angi aggregate ratings (for platform discrepancy)
  - **NEW:** BBB rating + complaints
- Returns:
  - summary (one-liner)
  - strengths[]
  - weaknesses[]
  - redFlags[]
  - emergencyNotes
  - **NEW:** platformDiscrepancy (replaces what Outscraper did)

**Step C: Derivation (no AI)**
- badges (from dimension thresholds, cross-checked against redFlags) — preserved
- emergencyReadiness (from emergency specialty + responsiveness) — preserved
- pricingTier (from pricing_fairness + workmanship) — preserved
- bestFor (from decision engine) — preserved

**Writes to Firestore (one doc update):**
```
scores: { reliability, pricing_fairness, workmanship, responsiveness, communication,
          specialty_strength, variance, review_count_used, last_scored_at }
evidence_quotes: [...]
reviewSynthesis: {
  summary, strengths, weaknesses, redFlags, badges,
  emergencyReadiness, emergencyNotes, emergencySignals,
  pricingTier, bestFor, servicesMentioned, platformDiscrepancy,
  reviewCount, aiSynthesizedAt, synthesisVersion: "unified-sonnet-v2"
}
```

### Pass 2: Rank (no AI, preserved)
- Sort plumbers per city by overall score
- Compute percentiles, best/worst dimensions
- Write `city_rank` per plumber

### Pass 3: Decide (no AI, preserved)
- Run decision engine → verdict (strong_hire / conditional_hire / caution / avoid)
- Compute best_for, avoid_if, hire_if, caution_if (preserved)
- Apply absolute floor (preserved — no plumber with composite >= 65 gets "avoid")
- Write `decision`

---

## Workflow Files (simplified)

### `daily-pipeline.yml` (replaces both current workflows)

```yaml
name: Daily Pipeline
on:
  schedule:
    - cron: '0 11 * * *'  # 6 AM Central
  workflow_dispatch:

jobs:
  pipeline:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - checkout
      - setup node + install deps
      - setup service account

      # Phase 1: Decide
      - name: Decide today's work
        run: npx tsx scripts/pipeline-decide.ts
        # Outputs daily-plan.json

      # Phase 2: Ingest (parallel where possible)
      - name: Scrape new plumbers
        run: npx tsx scripts/ingest-google-scrape.ts

      - name: Refresh existing reviews
        run: npx tsx scripts/ingest-google-refresh.ts

      - name: Pull Outscraper + BBB
        run: npx tsx scripts/ingest-outscraper-bbb.ts

      # Phase 3: Score (single brain)
      - name: Score and synthesize
        run: npx tsx scripts/score-plumbers.ts

      # Export + push
      - name: Export to JSON
        run: node scripts/export-firestore-to-json.js

      - name: Commit and push
        run: git add ... && git commit && git push

      - name: Request indexing
        run: node scripts/request-indexing.js
```

One workflow. One cron. One pipeline.

---

## What's Preserved (Every Piece of Intelligence)

| Feature | Where it lives in new design |
|---|---|
| **Top 3 winners per page** | UI (already built, reads from `decision.verdict` + `city_rank`) |
| **5 dimension scoring** | Phase 3 Pass 1 (Sonnet 4.6) |
| **Recency weighting** (12mo=1.0, 24mo=0.5, old=0.25) | Phase 3 aggregation |
| **specialty_strength per job type** | Phase 3 Pass 1 |
| **Evidence quotes per dimension** | Phase 3 Pass 1 |
| **Verdict thresholds** (strong_hire/conditional/caution/avoid) | Phase 3 Pass 3 (decision engine) |
| **Absolute floor** (composite >=65 can't be "avoid") | Phase 3 Pass 3 |
| **City percentile ranking** | Phase 3 Pass 2 |
| **Badges from score thresholds** | Phase 3 Pass 1 (derive) |
| **Badges can't contradict redFlags** | Phase 3 Pass 1 (derive logic) |
| **Emergency readiness logic** | Phase 3 Pass 1 (derive) |
| **Pricing tier logic** | Phase 3 Pass 1 (derive) |
| **bestFor from decision engine** | Phase 3 Pass 1 (derive) |
| **servicesMentioned bridge** | Phase 3 Pass 1 (built today) |
| **Platform discrepancy detection** | Phase 3 Pass 1 synthesis (moved from Outscraper) |
| **Strict red flag detection** (<25 reviews = stricter) | Phase 3 Pass 1 synthesis prompt |
| **Sample size warnings** | Phase 3 Pass 1 synthesis prompt |
| **Keyword fallback for <3 reviews** | Phase 3 (already moved today) |
| **Review dedup by hash** | Phase 2 (preserved per-script) |
| **Review source tagging** (google-initial/refresh/outscraper-google/yelp/angi) | Phase 2 (preserved) |
| **20-mile radius matching** | UI (preserved in city page) |
| **Distance weighting in sort** | UI (preserved) |
| **GSC impression discovery** | Phase 1 |
| **GSC position threshold** (NEW) | Phase 1 |
| **Position-aware Outscraper tiers** (NEW) | Phase 1 |
| **Smart re-score trigger** (review count delta, NEW) | Phase 1 |
| **30-day freshness skip** | Phase 1 (preserved as fallback) |
| **Monthly API budget guards** | Phase 1 + Phase 2 (preserved) |
| **First-party signals** (clicks, leads, engagement) | Frontend (untouched) |
| **Outscraper 3 cities/day cap** | Phase 1 (preserved) |
| **City coords + radius fallback** | UI (preserved) |
| **Internal linking** (city → service pages) | UI (built today) |

---

## Migration Plan (When You're Ready)

### Step 1 — Build (~3 hours)
1. Create `pipeline-decide.ts` with position-aware thresholds
2. Create `ingest-outscraper-bbb.ts` (Outscraper without Haiku synthesis + BBB merged in)
3. Update `score-plumbers.ts` to handle platform discrepancy + smart re-score trigger
4. Create new `daily-pipeline.yml` workflow

### Step 2 — Test on one city
- Run end-to-end on Nashville (already data-rich)
- Compare before/after on Top 3, badges, verdicts
- Verify nothing was lost

### Step 3 — Migrate
- Disable old workflows (daily-scrape.yml + deep-review-pull.yml)
- Enable new workflow
- Watch first 3-5 daily runs
- Mark old scripts deprecated (don't delete yet)

### Step 4 — Clean up (after 2 weeks of stable runs)
- Delete old scripts: `synthesize-reviews.ts`, the inline synthesis in `daily-scrape.js`, the synthesis half of `outscraper-reviews.js`
- Update CLAUDE.md and ROADMAP

---

## Cost Estimate

**Per daily run (typical):**
- Phase 1: 0 API calls (Firestore reads only)
- Phase 2: ~5-10 Places API calls + ~3 Outscraper city pulls
- Phase 3: 
  - ~20 plumbers needing re-score
  - ~$0.33 per plumber (extraction + synthesis)
  - ~$6.60/day in Claude API costs

**Per month:** ~$200 in Claude (Sonnet) + $0 in Google Places (free tier) + ~$15-20 in Outscraper.

Compared to current setup which has duplicate Haiku calls — net cost is roughly the same or lower.

---

## What This Solves

1. **One source of truth** — scoring pipeline is the single brain. No more 4 systems contradicting each other.
2. **No wasted API calls** — Outscraper pulls reviews, scoring synthesizes once. Haiku eliminated entirely from this pipeline.
3. **Smart triggers** — re-score when review data changes meaningfully, not just on a 30-day timer.
4. **Position-aware GSC** — spend Outscraper credits where clicks are likely.
5. **Single pipeline** — one workflow, one cron, easier to monitor and debug.
6. **All intelligence preserved** — every threshold, every rule, every UI feature stays.
