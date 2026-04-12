# City Activation Architecture

**Date:** 2026-04-12
**Status:** Draft — awaiting Tim's review before implementation
**Read time:** ~25 minutes

---

## Core Rules

1. **Do NOT rescore existing plumbers.** Leave current `scores.specialty_strength` (5 keys) as-is. Flag them `scoringVersion: "legacy-5"` so we know they only have the original 5 service scores.
2. **All NEW plumbers entering the system score against every service in the service registry in a single synthesis pass.** One API call batch per plumber, all 12 specialty keys extracted.
3. **When GSC signals interest in a city (any slug, not just `/emergency-plumbers/`), trigger a "city activation" that builds out the full page footprint for that city in one batch.**

---

## 1. Service Registry

**File:** `apps/plumbers-web/src/lib/services-config.ts` (replaces current 5-entry `SERVICE_CONFIGS`)

### Data Model

```typescript
type PageType = "service" | "symptom" | "intent" | "cost-guide";

type ScoringStrategy =
  | { kind: "specialty"; key: SpecialtyKey }
  | { kind: "dimension"; sortBy: DimensionKey }
  | { kind: "signal"; field: string; value: unknown }
  | { kind: "mapped"; serviceKeys: SpecialtyKey[] };

interface PageConfig {
  id: string;                          // e.g. "drain-cleaning"
  slug: string;                        // URL slug: /drain-cleaning/[state]/[city]
  type: PageType;
  displayName: string;                 // "Drain Cleaning"
  heroHook: string;
  scoring: ScoringStrategy;
  serviceMentionedKeys: string[];      // bridge to outscraper servicesMentioned data
  minPlumbers: number;                 // default 3, configurable per service
  relatedServices: string[];           // IDs for cross-linking
  emergencyTypes: { title: string; description: string }[];
  faqTemplates: { question: string; answer: string }[];
}
```

### Specialty Key Expansion: 5 -> 12

| Key | Services sharing it |
|-----|-------------------|
| `drain` | drain-cleaning, hydro-jetting |
| `water_heater` | water-heater-repair |
| `emergency` | burst-pipe-repair |
| `repipe` | repiping |
| `remodel` | bathroom-remodel-plumbing, kitchen-remodel-plumbing |
| `sewer` | sewer-repair, sewer-line-replacement |
| `toilet` | toilet-repair |
| `fixture` | faucet-repair, garbage-disposal-repair |
| `sump_pump` | sump-pump-repair |
| `gas_line` | gas-line-repair |
| `slab_leak` | slab-leak-repair |
| `water_line` | water-line-repair |

27 page types, 12 specialty keys. Adding a new page = adding one config entry. If it shares an existing specialty key, zero pipeline changes.

### Full Registry (27 entries)

**16 Service Pages** (`type: "service"`)

| ID | Slug | Specialty Key | serviceMentionedKeys | Related Services |
|----|------|--------------|---------------------|-----------------|
| drain-cleaning | /drain-cleaning/ | drain | ["drain-cleaning"] | [hydro-jetting, sewer-repair] |
| water-heater-repair | /water-heater-repair/ | water_heater | ["water-heater"] | [gas-line-repair, repiping] |
| burst-pipe-repair | /burst-pipe-repair/ | emergency | ["burst-pipe", "flooding"] | [water-line-repair, repiping] |
| sewer-repair | /sewer-repair/ | sewer | ["sewer"] | [drain-cleaning, sewer-line-replacement] |
| sewer-line-replacement | /sewer-line-replacement/ | sewer | ["sewer"] | [sewer-repair, repiping] |
| toilet-repair | /toilet-repair/ | toilet | ["toilet"] | [drain-cleaning, bathroom-remodel-plumbing] |
| faucet-repair | /faucet-repair/ | fixture | ["faucet-fixture"] | [bathroom-remodel-plumbing, kitchen-remodel-plumbing] |
| garbage-disposal-repair | /garbage-disposal-repair/ | fixture | ["garbage-disposal"] | [drain-cleaning, kitchen-remodel-plumbing] |
| sump-pump-repair | /sump-pump-repair/ | sump_pump | ["sump-pump"] | [burst-pipe-repair, water-line-repair] |
| gas-line-repair | /gas-line-repair/ | gas_line | ["gas-leak"] | [water-heater-repair, repiping] |
| repiping | /repiping/ | repipe | ["repiping"] | [water-line-repair, slab-leak-repair] |
| slab-leak-repair | /slab-leak-repair/ | slab_leak | ["slab-leak"] | [repiping, water-line-repair] |
| water-line-repair | /water-line-repair/ | water_line | ["water-line"] | [repiping, burst-pipe-repair] |
| bathroom-remodel-plumbing | /bathroom-remodel-plumbing/ | remodel | ["bathroom-remodel"] | [toilet-repair, faucet-repair] |
| kitchen-remodel-plumbing | /kitchen-remodel-plumbing/ | remodel | ["bathroom-remodel"] | [faucet-repair, garbage-disposal-repair] |
| hydro-jetting | /hydro-jetting/ | drain | ["drain-cleaning"] | [drain-cleaning, sewer-repair] |

**5 Intent Pages** (`type: "intent"`)

| ID | Slug | Scoring Strategy | serviceMentionedKeys |
|----|------|-----------------|---------------------|
| 24-hour-plumber | /24-hour-plumber/ | `{ kind: "signal", field: "is24Hour", value: true }` | [] |
| same-day-plumber | /same-day-plumber/ | `{ kind: "dimension", sortBy: "responsiveness" }` | [] |
| cheap-plumber | /cheap-plumber/ | `{ kind: "dimension", sortBy: "pricing_fairness" }` | [] |
| licensed-plumber | /licensed-plumber/ | `{ kind: "signal", field: "bbbAccredited", value: true }` | [] |
| plumber-cost | /plumber-cost/ | `{ kind: "dimension", sortBy: "pricing_fairness" }` | [] |

**6 Symptom Pages** (`type: "symptom"`)

| ID | Slug | Mapped Service Keys | serviceMentionedKeys |
|----|------|-------------------|---------------------|
| clogged-drain | /clogged-drain/ | ["drain"] | ["drain-cleaning"] |
| no-hot-water | /no-hot-water/ | ["water_heater"] | ["water-heater"] |
| water-leak | /water-leak/ | ["emergency", "slab_leak", "water_line"] | ["burst-pipe", "slab-leak", "water-line"] |
| low-water-pressure | /low-water-pressure/ | ["water_line", "repipe"] | ["water-line", "repiping"] |
| frozen-pipes | /frozen-pipes/ | ["emergency"] | ["burst-pipe"] |
| sewage-backup | /sewage-backup/ | ["sewer", "drain"] | ["sewer", "drain-cleaning"] |

### How adding a new slug works

1. Add one entry to the `PAGE_CONFIGS` array in `services-config.ts`
2. If it uses an existing specialty key (e.g., `drain`): done. No pipeline changes.
3. If it needs a new specialty key: add the key to `SPECIALTY_KEYS` in `decision-engine.ts` and to the scoring prompt's coarse-to-fine mapping. This is a one-time schema expansion, not a per-slug cost.
4. The page route, sitemap, GSC indexing, and internal linking all consume the registry automatically.

---

## 2. Forward-Only Scoring

### Where new plumbers enter the system

| Entry point | Script | Current behavior | Change needed |
|-------------|--------|-----------------|---------------|
| Daily scrape | `scripts/daily-scrape.js` | Calls Claude Sonnet for basic synthesis (score, summary, badges). Does NOT run the 3-pass decision engine. | After synthesis, queue for full forward scoring. |
| Manual scrape | Same script, manual trigger | Same as above | Same |
| Outscraper deep pull | `scripts/outscraper-reviews.js` | Multi-source synthesis via Claude Haiku. Extracts `servicesMentioned` (16 categories). Does NOT run decision engine. | After synthesis, queue for full forward scoring. |
| Upload to Firestore | `scripts/upload-to-firestore.js` | Upserts plumber docs. No scoring. | No change — scoring is a separate step. |

### New multi-service scoring hook

Create `scripts/score-plumber-services.ts` — a forward-only scoring script that:

1. **Reads the service registry** from `services-config.ts` to get the current list of 12 specialty keys
2. **Queries Firestore** for plumbers where `scoringVersion` is null or absent (new plumbers that haven't been scored yet)
3. **For each new plumber**, runs a single Claude Sonnet extraction pass:

**Updated extraction prompt** (replaces the 7-value `job_type` with 8 coarse types + fine-grained mapping):

```
You are analyzing reviews for a plumbing company. For EACH review, return JSON with:
- scores 0-100 for: reliability, pricing_fairness, workmanship, responsiveness, communication (null if review doesn't address a dimension)
- service_category: one of water_heater | drain_sewer | pipe_repair | emergency | remodel | fixture | gas | general
- service_detail: free text describing the specific service (e.g. "tankless water heater install", "main sewer line replacement", "toilet repair", "sump pump replacement")
- evidence_quote: ONE short quote (under 15 words) if the review strongly supports any dimension

Output: { reviews: [{ review_id, scores{}, service_category, service_detail, evidence_quote, dimension_quoted }] }
```

4. **Aggregation** maps coarse categories to fine-grained specialty keys using keyword matching on `service_detail`:

| Coarse category | service_detail keywords | Fine-grained key |
|----------------|----------------------|------------------|
| `drain_sewer` | "sewer", "sewer line" | `sewer` |
| `drain_sewer` | "drain", "clog", "rooter", "hydro" | `drain` |
| `pipe_repair` | "repipe", "pipe replacement", "old pipes" | `repipe` |
| `pipe_repair` | "slab leak", "leak detection" | `slab_leak` |
| `pipe_repair` | "water line", "water supply", "main line" | `water_line` |
| `fixture` | "toilet" | `toilet` |
| `fixture` | "faucet", "sink", "shower valve" | `fixture` |
| `fixture` | "garbage disposal" | `fixture` |
| `fixture` | "sump pump", "ejector pump" | `sump_pump` |
| `gas` | * | `gas_line` |
| `water_heater` | * | `water_heater` |
| `emergency` | * | `emergency` |
| `remodel` | * | `remodel` |
| `general` | * | no specialty key (skipped) |

5. **Stores expanded `specialty_strength`** with all 12 keys (0 if no reviews matched that service)
6. **Sets `scoringVersion: "v2-12key"`** on the plumber doc so we can distinguish from legacy

### What happens to partial data

- If a plumber has no review mentions of hydro-jetting: `specialty_strength.drain` gets whatever score the drain reviews produce (hydro-jetting shares the `drain` key). If zero drain reviews exist at all: `specialty_strength.drain = 0`.
- A score of `0` means "no data" not "bad at this service." The page rendering layer treats `0` as "no specialty data — use fallback."
- We do NOT store `null` — always store `0` for missing services. This simplifies queries and avoids null-checking everywhere.

### Storage shape

```typescript
// Firestore plumber doc
{
  // ... existing fields ...
  scores: {
    reliability: 85,
    pricing_fairness: 72,
    workmanship: 88,
    responsiveness: 90,
    communication: 80,
    specialty_strength: {
      water_heater: 0,
      drain: 90,
      repipe: 0,
      emergency: 85,
      remodel: 0,
      sewer: 78,        // NEW
      toilet: 0,         // NEW
      fixture: 65,       // NEW
      sump_pump: 0,      // NEW
      gas_line: 0,       // NEW
      slab_leak: 0,      // NEW
      water_line: 72,    // NEW
    },
    variance: 12,
    review_count_used: 47,
    last_scored_at: "2026-04-12T...",
  },
  scoringVersion: "v2-12key",   // NEW — "legacy-5" for existing plumbers
  // ... decision fields unchanged ...
}
```

### Pipeline integration

The daily scrape workflow gains a new step between "synthesize reviews" and "export JSON":

```
Step 6.5: Score new plumbers (forward-only)
  npx tsx scripts/score-plumber-services.ts --new-only
```

This step:
- Queries plumbers where `scoringVersion` is null
- Runs the 12-key extraction for each
- Writes scores + sets `scoringVersion: "v2-12key"`
- Logs to `pipelineRuns` collection with `script: "score-plumber-services"`

Existing plumbers (`scoringVersion: "legacy-5"` or no version) are skipped entirely.

---

## 3. City Activation Trigger

### Current GSC monitoring

`scripts/gsc-expansion.js` (line 168) filters GSC pages by `/emergency-plumbers/` only. It misses impressions on service pages entirely.

### Change: Watch all registered slug patterns

Update `gsc-expansion.js` to:

1. **Remove the `/emergency-plumbers/` filter.** Instead, pull ALL pages with impressions for the site.
2. **Parse URLs against the service registry.** For any URL matching `/{slug}/{state}/{city}`, extract the city regardless of which slug generated the impression.
3. **Store per-slug impression data** on the city doc:

```typescript
// Firestore cities collection — new field
{
  // ... existing fields ...
  gscSlugImpressions: {
    "emergency-plumbers": 45,
    "drain-cleaning": 3,
    "clogged-drain": 1,
    // ... per-slug impression counts over the last 90 days
  },
  activationStatus: "not-activated" | "queued" | "activated" | "dormant",
  activatedAt: Timestamp | null,
  activationTrigger: "gsc-drain-cleaning" | "gsc-emergency-plumbers" | "manual" | null,
}
```

### Activation threshold

A city becomes "queued" for activation when:

- **Total impressions across all slugs >= 5** in the last 90 days (not 1 — avoids wasting effort on random bot hits or one-off queries)
- **OR** any single slug gets >= 3 impressions (signals focused interest in a specific service for that city)
- **OR** manual override via admin panel or CLI flag

**Why 5 total / 3 per slug:** A single impression could be a Googlebot probe or a one-off query. 5 total means Google is testing multiple pages for the city. 3 on a specific slug means focused search demand exists.

### Activation queue

**Storage:** New Firestore collection `cityActivationQueue`

```typescript
{
  citySlug: "aberdeen-md",
  state: "MD",
  city: "Aberdeen",
  status: "queued" | "in_progress" | "completed" | "failed",
  queuedAt: Timestamp,
  startedAt: Timestamp | null,
  completedAt: Timestamp | null,
  trigger: "gsc-automatic" | "manual",
  triggerDetail: "drain-cleaning: 3 impressions",
  steps: {
    scrape: "pending" | "skipped" | "done" | "failed",
    outscraper: "pending" | "skipped" | "done" | "failed",
    scoring: "pending" | "skipped" | "done" | "failed",
    pageGen: "pending" | "done" | "failed",
    blogGen: "pending" | "done" | "failed",
    indexing: "pending" | "done" | "failed",
  },
  error: string | null,
}
```

### Throttling

- **Max 2 city activations per day.** Each activation involves scraping + Outscraper + scoring + content gen — expensive in API credits and time.
- If more than 2 cities qualify on the same day, they stay queued and process over subsequent days (FIFO by impression count descending — highest demand first).
- The daily scrape workflow checks the queue and processes the top 2.

### Script changes

`gsc-expansion.js`:
- Remove `/emergency-plumbers/` URL filter (line 168)
- Add URL parsing for all registered slugs using the service registry
- Add `gscSlugImpressions` field to city doc writes
- Add activation threshold check after updating city metrics
- Write to `cityActivationQueue` when threshold met and `activationStatus !== "activated"`

---

## 4. City Activation Execution

When a city is picked from the queue, the following steps run **sequentially** (each depends on the prior step's output):

### Step sequence

```
┌──────────────────────────────────────────────────────────┐
│ City Activation: Aberdeen, MD                            │
├──────┬───────────────────────────────────┬───────────────┤
│ Step │ Action                            │ Parallelizable│
├──────┼───────────────────────────────────┼───────────────┤
│ 1    │ Check: already scraped?           │ —             │
│ 2a   │ IF NOT: Run daily-scrape for city │ Sequential    │
│ 2b   │ Upload to Firestore              │ Sequential    │
│ 3    │ Run Outscraper deep pull          │ Sequential    │
│      │ (Google 100 + Yelp + Angi + BBB) │ (after scrape)│
│ 4    │ Score new plumbers (forward-only) │ Sequential    │
│      │ 12-key extraction for plumbers    │ (after pull)  │
│      │ without scoringVersion            │               │
│ 5    │ Export Firestore → JSON           │ Sequential    │
│      │ (triggers Vercel rebuild)         │ (after score) │
│ 6    │ Generate blog posts for city      │ Parallel with │
│      │ (award + symptom posts)           │ step 7        │
│ 7    │ Run internal linking pass         │ Parallel with │
│      │ (inject cross-links)             │ step 6        │
│ 8    │ Commit + push all changes         │ Sequential    │
│      │ (triggers Vercel rebuild)         │ (after 6+7)   │
│ 9    │ Request GSC indexing for all      │ Sequential    │
│      │ new pages in this city            │ (after push)  │
└──────┴───────────────────────────────────┴───────────────┘
```

### Step details

**Step 1 — Check scrape status:**
Query Firestore `cities` collection for `citySlug`. If `scraped: true` and plumbers exist, skip step 2.

**Step 2a — Scrape (if needed):**
Run `daily-scrape.js --city aberdeen-md` (targeted single-city mode). This calls Google Places API `"emergency plumber in Aberdeen, MD"`, fetches details, runs basic Claude Sonnet synthesis.

**Step 2b — Upload:**
Run `upload-to-firestore.js` to push scraped data to Firestore.

**Step 3 — Outscraper deep pull:**
Run `outscraper-reviews.js aberdeen-md`. This pulls:
- Google: 100 reviews per plumber (vs 5 from Places API)
- Yelp: via constructed URL
- Angi: via Google search
- BBB: accreditation, complaints, years in business
- Claude Haiku synthesis with `servicesMentioned` extraction (16 categories)

This is where `servicesMentioned` data gets populated — critical for bridge scoring.

**Step 4 — Forward-only scoring:**
Run `score-plumber-services.ts --city aberdeen-md --new-only`. For each plumber in the city without `scoringVersion`:
- Load their cached reviews from Firestore
- Run the 12-key extraction prompt (batched 15 reviews per call)
- Aggregate and store `specialty_strength` with all 12 keys
- Run Pass 2 (city ranking) and Pass 3 (verdict with expanded `computeBestFor`)
- Set `scoringVersion: "v2-12key"`

Existing legacy-scored plumbers in the city are NOT touched.

**Step 5 — Export:**
Run `export-firestore-to-json.js`. Single-writer invariant: this is the only script that writes `plumbers-synthesized.json`. Commits + pushes to trigger Vercel rebuild.

**Step 6 — Blog post generation:**
Run `generate-blog-posts.js --city aberdeen-md` extended to include:
- One award post per qualifying service ("Top 3 Drain Cleaning in Aberdeen, MD (2026)")
- Qualifying = 3+ plumbers with specialty_strength[key] > 0 for that service
- Optional symptom posts if GSC shows symptom queries for the city
- All posts link to `/blog/how-we-rank-plumbers` for methodology credibility

**Step 7 — Internal linking pass:**
Run a new script `scripts/build-city-links.js --city aberdeen-md` that:
- Reads the service registry
- For each page in the city, generates the cross-link section
- Writes link data to a build-time JSON file consumed by page components (not hardcoded)

**Step 8 — Commit and push:**
Stage all changes (JSON data, blog posts, link data). Commit with message `[city-activation] aberdeen-md — full buildout`. Push triggers Vercel rebuild.

**Step 9 — Request indexing:**
Run `request-indexing.js` with ALL URLs generated for this city:
- `/emergency-plumbers/maryland/aberdeen`
- `/drain-cleaning/maryland/aberdeen`
- `/water-heater-repair/maryland/aberdeen`
- ... (all 27 slug × city combos where data exists)
- Blog post URLs

**Estimated time per city activation:** ~15-30 minutes (dominated by Outscraper async polling and Claude scoring calls).

### Orchestrator script

Create `scripts/activate-city.ts` that runs the full sequence. Called from the daily workflow or manually:

```bash
npx tsx scripts/activate-city.ts --city aberdeen-md          # manual
npx tsx scripts/activate-city.ts --from-queue --max 2         # daily workflow
```

The script:
- Updates `cityActivationQueue` doc status at each step
- Logs each step to `pipelineRuns` collection (visible in admin Activity panel)
- On failure, marks the step as failed and stops (can be resumed)
- On success, sets `cities` doc `activationStatus: "activated"`

---

## 5. Internal Linking Strategy

### Link map per page type

**Each service page** (`/drain-cleaning/maryland/aberdeen`) links to:
- The general city page: `/emergency-plumbers/maryland/aberdeen`
- Related service pages in the same city (from `relatedServices` in registry): `/hydro-jetting/maryland/aberdeen`, `/sewer-repair/maryland/aberdeen`
- The award post for that service in that city: `/blog/top-3-drain-cleaning-aberdeen-md-2026`
- Nearby cities for the same service (from `nearbyCities`): `/drain-cleaning/maryland/bel-air`

**Each award post** (`/blog/top-3-drain-cleaning-aberdeen-md-2026`) links to:
- The service page: `/drain-cleaning/maryland/aberdeen`
- The general city page: `/emergency-plumbers/maryland/aberdeen`
- Runner-up plumber profile pages: `/plumber/smith-plumbing-aberdeen`
- The methodology page: `/blog/how-we-rank-plumbers`

**The general city page** (`/emergency-plumbers/maryland/aberdeen`) links to:
- All service pages for that city (rendered from registry, only shows services with data)
- Top-performing plumber profiles
- Award posts for the city
- Nearby cities (existing `nearbyCities` pattern)

**State-level pages** (`/emergency-plumbers/maryland`, `/drain-cleaning/maryland`) link to:
- Top cities in the state by plumber count or GSC impressions
- State-level stats (total plumbers, services covered)

### How links are generated

**Build-time, from registry + city data.** Not hand-coded.

Create `src/lib/city-links.ts` that at build time:
1. Reads `PAGE_CONFIGS` from the registry
2. Reads `CITY_COVERAGE` to know which cities have data
3. For each (city, service) pair, computes:
   - Related services available in the same city
   - Award posts that exist for this city
   - Nearby cities with data for this service

The page component imports this and renders the "Related" section. When a new city activates and new pages go live, the links auto-populate on the next build.

### Existing content: inject or append?

**Append to a dedicated "Related" section.** Do NOT rewrite existing content when new pages go live. Each page has a "Other Services in {city}" section (already exists in the service page template at line 356 of `[service]/[state]/[city]/page.tsx`). This section is already driven by the registry — when the registry expands from 5 to 27 entries, the cross-links expand automatically.

For the general city page, add a new "Service-Specific Pages" section below the plumber list that renders links to available service pages. This section only appears when the city has been activated and has service-specific data.

---

## 6. Blog Post Generation Per City Activation

### What generates on activation

**Award posts (one per qualifying service):**
- Title: `"Top 3 {Service} in {City}, {State} ({Year})"`
- Slug: `top-3-{service-slug}-{city-slug}-{state}-{year}`
- Content: Rankings-style post (data-driven, not AI-generated) with:
  - Top 3 plumbers ranked by `specialty_strength[key]`
  - Per-plumber: name, score, verdict badge, evidence quote, phone CTA
  - "How We Ranked" section linking to `/blog/how-we-rank-plumbers`
  - City-specific grounding: county name, nearby cities, regional context
- **Qualifying threshold:** 3+ plumbers with `specialty_strength[key] > 0` for that service in the city's 20mi radius
- Template lives in `scripts/generate-blog-posts.js` as a new post type alongside existing 5 types

**Symptom posts (conditional, driven by GSC data):**
- Only generated if `gscSlugImpressions` shows symptom slug queries for this city
- Title: `"What to Do About a {Symptom} in {City}, {State}"`
- Content: AI-generated (Claude Haiku) with:
  - Emergency steps (templated per symptom)
  - Local plumber recommendations (top 3 for the mapped service)
  - Cost estimate ranges
  - When to call a plumber vs DIY
- Template: new post type in `generate-blog-posts.js`

### What's templated vs AI-generated vs city-specific

| Component | Source | City-specific? |
|-----------|--------|---------------|
| Award post structure | Template (data-driven) | Yes — plumber names, scores, evidence quotes |
| Award post "How We Ranked" | Static copy linking to methodology | No |
| Symptom post emergency steps | Template per symptom type | No |
| Symptom post local recommendations | Data-driven from scores | Yes |
| Symptom post narrative | Claude Haiku | Yes — uses city name, county, region tags |
| FAQ content | Templates from registry with {city}/{state}/{county} substitution | Yes |

### Blog post storage change

Currently blog posts are hardcoded in `src/lib/blog-data.ts`. Generated posts output to `data/blog-posts/` as JSON files but aren't auto-included.

**Change:** Modify `blog-data.ts` to:
1. Export the 8 hand-written posts as before
2. At build time, also load all JSON files from `data/blog-posts/` and merge into the array
3. `getAllBlogSlugs()` returns both hand-written and generated slugs
4. `generateStaticParams()` in `blog/[slug]/page.tsx` automatically picks up new posts

---

## 7. GSC Indexing Pipeline

### Change to `request-indexing.js`

**Current:** Takes CLI args, submits specific URLs. Called from workflows with hardcoded `/emergency-plumbers/` paths.

**New behavior:** Accept `--city` flag that auto-generates all URLs for that city from the service registry:

```bash
# Current: manual URL list
node scripts/request-indexing.js /emergency-plumbers/maryland/aberdeen

# New: city-based auto-generation
node scripts/request-indexing.js --city aberdeen-md
```

When `--city` is passed:
1. Load service registry
2. Generate URLs for all page types where the city has plumber data:
   - `/emergency-plumbers/{state}/{city}`
   - `/{service-slug}/{state}/{city}` for each service in registry
   - `/blog/top-3-{service}-{city}-{state}-{year}` for each award post
3. Submit all URLs (respect 200/day quota)
4. If a single city generates more URLs than remaining daily quota, submit what fits and queue the rest

### Batch submission per city activation

During city activation (step 9), the activation orchestrator calls:
```bash
node scripts/request-indexing.js --city aberdeen-md --source city-activation
```

The `--source` flag is logged to `pipelineRuns` so the admin panel shows which indexing requests came from city activations vs daily pipeline.

### Quota management

- 27 page types + 1 emergency page + ~5 blog posts = ~33 URLs per activated city
- At 200/day quota: ~6 city activations per day before hitting the limit
- With 2 activations/day throttle: ~66 URLs, well under quota
- Reserve 50/day for the regular daily pipeline's indexing needs
- Budget: 150/day for city activations, 50/day for daily pipeline

---

## 8. Migration Path

### Existing plumbers (legacy-scored)

- **Leave scores as-is.** Current `specialty_strength` has 5 keys. Do not rescore.
- **Add `scoringVersion: "legacy-5"` flag** via a one-time migration script that stamps all existing plumber docs with this field. Non-destructive, additive only.
- **When a legacy-scored plumber appears on a new service page** (e.g., `/sewer-repair/`):
  - If they have `servicesMentioned.sewer` data (from Outscraper): show them with bridge scoring in Tier 2
  - If they have no service-specific data: show them in Tier 3 (general fallback, sorted by quality score)
  - **Do NOT show them in the ranked top 3** unless they have a real specialty score or bridge score for that service
  - Top 3 section is reserved for plumbers with actual service-specific data (Tier 1 or Tier 2)

### Page rendering tiers (recap)

| Tier | Data source | Top 3 eligible? | Badge shown |
|------|------------|-----------------|-------------|
| 1 — Specialty scored | `scores.specialty_strength[key] >= 70` | Yes | "{Service}: 85/100" |
| 2 — Service mentioned | `servicesMentioned[key]` with count >= 1 | Yes | "Reviewed for {service}" |
| 3 — General fallback | Within 20mi, no service data | No | none |

All three tiers contribute to the plumber list. The page always shows plumbers if any tier has results. The "Coverage Coming Soon" empty state only appears if zero plumbers exist within 20 miles (which means the city shouldn't have been activated in the first place).

### Optional future: opportunistic rescore

When a legacy plumber gets fresh Outscraper data (via the daily deep-review-pull workflow), we could opportunistically rescore them with the 12-key extraction since we're already processing their reviews. This is **not** part of this architecture — it's a future enhancement. Document it as a possible Phase 2 addition.

---

## 9. Open Questions

### Activation threshold: 1 impression or 5-10?

**Recommendation: 5 total or 3 per slug.** A single impression could be a bot probe. At our current scale (~150 cities with data), a threshold of 5 gives Google enough time to validate interest before we invest in a full activation. If this turns out to be too conservative, lower to 3 total after reviewing the first month of activation data.

**Risk of 1:** We activate cities for phantom demand, burning API credits on scraping/scoring/content for cities nobody searches for. At ~$1-3 per city activation (Places API + Outscraper + Claude), 100 false activations = $100-300 wasted.

### Cost per city activation (API spend estimate)

| Step | API | Estimated cost |
|------|-----|---------------|
| Scrape (10-15 plumbers) | Google Places API | $0 (free tier) |
| Outscraper deep pull | Outscraper API | $0.10-0.30 |
| BBB lookup | BBB (free scrape) | $0 |
| Forward scoring (12-key extraction) | Anthropic Claude Sonnet | $0.50-1.50 (depends on review count) |
| Blog post generation | Anthropic Claude Haiku | $0.05-0.10 |
| GSC indexing | Google Indexing API | $0 (free) |
| **Total per city** | | **~$0.65-1.90** |

At 2 activations/day: ~$1.30-3.80/day = ~$40-115/month.

### What stays separate from this flywheel

- **Cost guides** (`/cost-guide/[service]`, `/cost-guide/[service]/[state]/[city]`): These are content-heavy pages with pricing data, not plumber listings. They use the same registry for slug definitions but have their own route and content generation pipeline. Ship separately.
- **National-level pages** (`/drain-cleaning/` without state/city): Aggregation pages, not city-specific. Ship separately.
- **Pros subdomain** (`pros.fastplumbernearme.com`): Entirely separate app. Already planned in `docs/plans/pros-subdomain-monetization.md`.
- **State-level service pages** (`/drain-cleaning/maryland`): These list cities, not plumbers. Can use the same registry but have their own route component. Ship as a follow-up.

### Kill criteria for dormant cities

If an activated city gets **zero additional impressions across ALL its pages after 60 days**:

1. Set `activationStatus: "dormant"` on the city doc
2. **Do NOT delete pages or data.** The pages still serve anyone who searches. The data is cached permanently (Firestore is source of truth).
3. **Stop running Outscraper refreshes** for the city (saves $0.10-0.30/month per city)
4. **Stop submitting indexing requests** for the city's URLs
5. If impressions resume at any point, flip status back to "activated" and resume refresh cycle

Dormancy is a cost-saving measure, not a content removal measure. Pages stay live.

### Admin panel visibility

All city activation activity must be visible in the admin Activity panel at `/admin`. This means:

1. **City activation orchestrator** logs to `pipelineRuns` with `script: "city-activation"` and a summary containing:
   - City name and state
   - Trigger reason (e.g., "drain-cleaning: 3 impressions")
   - Step-by-step status (scrape: done, outscraper: done, scoring: done, etc.)
   - Number of plumbers scored, pages generated, blog posts created
   - URLs submitted for indexing
   - Total duration and API cost estimate

2. **New admin panel section** (or extension of Activity tab): "City Activations" view showing:
   - Queue: cities waiting for activation with trigger reason
   - In progress: current activation with step status
   - Completed: recently activated cities with stats
   - Dormant: cities that went dormant with last-impression date

3. **Forward scoring logs** to `pipelineRuns` with `script: "score-plumber-services"` showing:
   - Plumber name, review count, scoring version set
   - Specialty keys with non-zero scores
   - Duration per plumber

---

## Immediate Fix: Vercel Build Failure

Before any of this architecture ships, the Vercel build must be unbroken.

**Root cause:** `generateStaticParams()` in `[service]/[state]/[city]/page.tsx` generates 5 × 2,266 = 11,330 pages. Most are empty shells for cities with no plumber data. Total output exceeds Vercel's 80MB deploy limit.

**Fix:** Import `CITY_COVERAGE` and filter `generateStaticParams` to only emit pages for cities in the coverage map. Same filter in `sitemap.ts`. Result: ~750 service pages instead of 11,330.

**This fix is independent of the architecture above and should ship immediately.**

---

## 8. Page Templates

Every slug pattern in the service registry needs a content template. Templates are structured configs — the shared `CityServicePage` component reads the config and renders accordingly. Adding a new slug = adding a registry entry + a template config. No new components.

### Template directory

```
apps/plumbers-web/src/lib/templates/
├── index.ts                    # re-exports all template types + getTemplate()
├── types.ts                    # shared template interfaces
├── service.ts                  # 16 service page templates
├── symptom.ts                  # 6 symptom page templates
├── intent.ts                   # 5 intent page templates
├── cost-guide.ts               # cost guide templates
├── state-service.ts            # state-level service templates
├── award-post.ts               # award blog post template
└── symptom-post.ts             # symptom blog post template
```

### Shared template interface

```typescript
// types.ts

interface TemplateSection {
  id: string;                    // "hero" | "top-picks" | "plumber-list" | "scenarios" | "faq" | etc.
  purpose: string;               // human-readable, for documentation
  dataSource: "static" | "templated" | "decision-engine" | "ai-generated";
}

interface PageTemplate {
  id: string;                    // matches PageConfig.id from registry
  templateType: "service" | "symptom" | "intent" | "cost-guide" | "state-service" | "award-post" | "symptom-post";
  sections: TemplateSection[];   // ordered list of sections to render
  schema: SchemaType[];          // ["BreadcrumbList", "FAQPage", "ItemList", "Service"]
  wordCountTarget: { min: number; max: number };
  fallbackBehavior: FallbackBehavior;
  hero: HeroConfig;
  scenarios: ScenarioConfig[];
  faqs: FaqTemplate[];
  internalLinkSlots: LinkSlot[];
  differentiator?: string;       // how this page differs from related pages (for symptom/service pairs)
}

interface HeroConfig {
  titleTemplate: string;         // "{service} in {city}, {state}"
  hookTemplate: string;          // "Clogged drain? Here are the top-rated..."
  showQualifiedCount: boolean;
  showCountyBadge: boolean;
}

interface FallbackBehavior {
  tier1Empty: "show-tier2" | "show-tier3" | "show-coming-soon";
  allTiersEmpty: "show-radius-fallback" | "show-coming-soon" | "noindex";
  thinContentThreshold: number;  // below this plumber count, add noindex
}

interface LinkSlot {
  position: "after-hero" | "after-plumber-list" | "after-faq" | "footer";
  linkType: "related-services" | "nearby-cities" | "award-post" | "general-city-page" | "state-page" | "methodology";
}

type SchemaType = "BreadcrumbList" | "FAQPage" | "ItemList" | "Service" | "Article" | "HowTo";
```

### Template Type 1: Service Page

**Route:** `/[service]/[state]/[city]` (e.g., `/drain-cleaning/georgia/acworth`)

| # | Section | Purpose | Data Source | Static / Templated / Dynamic |
|---|---------|---------|-------------|------------------------------|
| 1 | JSON-LD | SEO structured data | BreadcrumbList + FAQPage + ItemList + Service | Templated (dynamic values inserted into schema structure) |
| 2 | Hero | Title, location, qualified count | `config.displayName`, `city.name`, `city.state`, `city.county`, qualified count | Templated: `"{displayName} in {city}, {state}"` |
| 3 | Top 3 Picks | Best plumbers for this service | `specialty_strength[key]` sort, verdict badge, evidence quote, specialty score badge, phone CTA | Decision engine (Tier 1 plumbers, or Tier 2 bridge-scored if no Tier 1) |
| 4 | All Plumbers | Full directory with sort | PlumberListWithSort, sorted by specialty score in "best-match" mode | Decision engine + fallback tiers |
| 5 | Service Scenarios | Common situations for this service | 4 scenarios per template, title + description | Static per service (same across all cities) |
| 6 | FAQ | City-specific Q&A | 4 questions with `{city}`, `{state}`, `{county}` substitution | Templated (static questions, dynamic city values) |
| 7 | Cross-links: Related Services | Navigate to sibling service pages | `relatedServices` from registry, filtered to services with data in this city | Dynamic (registry-driven) |
| 8 | Cross-links: Nearby Cities | Same service in nearby cities | `city.nearbyCities` filtered to cities with data for this service | Dynamic |
| 9 | Cross-link: Award Post | Link to the award post for this service + city | `/blog/top-3-{service}-{city}-{state}-{year}` (only if post exists) | Dynamic (conditional) |
| 10 | Cross-link: General City Page | "All plumbers in {city}" | `/emergency-plumbers/{state}/{city}` | Static link |
| 11 | Emergency CTA | Call top plumber now | Top-ranked plumber phone | Dynamic |
| 12 | Footer CTA | "Are You a Plumber?" signup | Hardcoded CallToAction component | Static |

**Schema markup:** BreadcrumbList, FAQPage, ItemList (with Plumber items + geo + AggregateRating), Service (serviceType from registry)

**Internal link slots:**
- After plumber list: Related services in same city + nearby cities for same service
- After FAQ: Link to award post (if exists) + general city page + methodology page
- Footer: State-level service page link

**Fallback state:** If zero Tier 1 plumbers, show Tier 2 (bridge-scored from servicesMentioned). If zero Tier 2, show Tier 3 (radius fallback sorted by general quality). Top 3 section only renders for Tier 1 + Tier 2 plumbers. Tier 3 plumbers appear in "All Plumbers" only. If total plumbers < 3 across all tiers: render FAQ + scenarios + cross-links but replace plumber sections with "We're building {service} ratings for {city}. In the meantime, see our general directory." Add `<meta name="robots" content="noindex">` if < 3 plumbers.

**Word count target:** 800-1,200 words (FAQ + scenarios + cross-links provide bulk; plumber cards are additional)

---

### Template Type 2: Symptom Page

**Route:** `/[symptom]/[state]/[city]` (e.g., `/clogged-drain/georgia/acworth`)

| # | Section | Purpose | Data Source | Static / Templated / Dynamic |
|---|---------|---------|-------------|------------------------------|
| 1 | JSON-LD | SEO structured data | BreadcrumbList + FAQPage + HowTo | Templated |
| 2 | Hero | Symptom-focused title, urgency framing | `"{symptom} in {city}, {state} — What to Do"` | Templated |
| 3 | Emergency Steps | What to do RIGHT NOW (before calling) | 3-5 steps per symptom, ordered | **Static per symptom** (same across all cities) |
| 4 | When to Call a Pro | Decision tree: DIY vs call | Threshold guidance specific to the symptom | Static per symptom |
| 5 | Recommended Plumbers | Top plumbers for the mapped service(s) | `specialty_strength[mappedKeys]`, best score across mapped services | Decision engine (same tiers as service page) |
| 6 | Cost Estimate | What this typically costs | Price range per symptom, `{city}`-grounded | Templated (static ranges + city name) |
| 7 | FAQ | Symptom-specific Q&A | 4 questions with city substitution, focused on the symptom not the service | Templated |
| 8 | Cross-link: Service Page | "Looking for {service} pros?" | Link to the underlying service page(s) | Dynamic |
| 9 | Cross-links: Related Symptoms | Other symptoms that might apply | From registry `relatedServices` mapped to symptom pages | Dynamic |
| 10 | Footer CTA | Signup | Static | Static |

**Schema markup:** BreadcrumbList, FAQPage, HowTo (for emergency steps)

**Differentiator vs service page (anti-cannibalization):**

The symptom page answers **"I have this problem, what do I do?"** — it leads with emergency steps, cost context, and a decision tree before showing plumbers. The service page answers **"I need this service, who's best?"** — it leads with ranked plumbers and expertise signals.

| Aspect | Service Page (`/drain-cleaning/`) | Symptom Page (`/clogged-drain/`) |
|--------|----------------------------------|----------------------------------|
| User intent | "I know I need drain cleaning" | "My drain is clogged, what do I do?" |
| Lead section | Top 3 ranked plumbers | Emergency steps (shut off water, etc.) |
| Content focus | Plumber expertise comparison | Problem diagnosis + when to call a pro |
| FAQ topics | Cost of service, how long it takes, permits | Is this an emergency?, DIY fixes, what causes this |
| Schema | Service + ItemList | HowTo + FAQPage |
| Plumber section | Primary (above fold) | Secondary (after education content) |
| Title pattern | "{Service} in {City}" | "{Symptom} in {City} — What to Do" |

The two pages link to each other: the symptom page has a "Looking for drain cleaning pros?" cross-link, and the service page has a "Dealing with a clogged drain?" cross-link. Google understands this as complementary content, not duplicate.

**Word count target:** 1,000-1,500 words (emergency steps + decision tree + cost section add length beyond what the service page has)

**Fallback state:** Same three-tier system as service pages. Symptom pages use `mapped` scoring strategy — take the best score across all mapped specialty keys. If plumber scores 85 on `drain` and 0 on `sewer`, they qualify for `/clogged-drain/` (which maps to `drain`).

---

### Template Type 3: Intent Page

**Route:** `/[intent]/[state]/[city]` (e.g., `/24-hour-plumber/georgia/acworth`, `/same-day-plumber/georgia/acworth`)

| # | Section | Purpose | Data Source | Static / Templated / Dynamic |
|---|---------|---------|-------------|------------------------------|
| 1 | JSON-LD | SEO structured data | BreadcrumbList + FAQPage + ItemList | Templated |
| 2 | Hero | Intent-focused title | `"{intent} in {city}, {state}"` | Templated |
| 3 | Intent Qualifier | What this means + who qualifies | E.g., "24-hour plumbers answer calls outside business hours and dispatch same-day." | Static per intent |
| 4 | Qualified Plumbers | Plumbers matching the intent signal | Filtered/sorted by signal field (is24Hour, responsiveness score, pricing_fairness, bbbAccredited) | Decision engine dimensions + plumber fields |
| 5 | What to Expect | Pricing/timing context for this intent | E.g., "After-hours calls typically cost 1.5-2x standard rates" | Static per intent |
| 6 | FAQ | Intent-specific Q&A | 4 questions, city-grounded | Templated |
| 7 | Cross-links: Services | "Need a specific service?" | Links to all service pages in this city | Dynamic |
| 8 | Cross-link: General City Page | All plumbers | Static link | Static |
| 9 | Footer CTA | Signup | Static | Static |

**Schema markup:** BreadcrumbList, FAQPage, ItemList

**Scoring strategy differences by intent:**

| Intent | Filter / Sort | Data field |
|--------|--------------|-----------|
| 24-hour-plumber | Filter: `is24Hour === true` OR `emergencyReadiness === "high"`, sort by responsiveness | `plumber.is24Hour`, `synthesis.emergencyReadiness` |
| same-day-plumber | Sort by `scores.responsiveness` descending | `scores.responsiveness` |
| cheap-plumber | Sort by `scores.pricing_fairness` descending, flag plumbers with "budget" pricingTier | `scores.pricing_fairness`, `synthesis.pricingTier` |
| licensed-plumber | Filter: `bbb.accredited === true`, sort by quality | `bbb.accredited` |
| plumber-cost | Sort by `scores.pricing_fairness`, show pricing tier badges | `scores.pricing_fairness`, `synthesis.pricingTier` |

**Differentiator vs service/symptom:** Intent pages don't filter by what the plumber does (service), they filter by how the plumber operates (hours, pricing, credentials). A plumber can appear on `/24-hour-plumber/` AND `/drain-cleaning/` — different angles, same business.

**Word count target:** 600-900 words (thinner content — the value is in the filtered plumber list, not educational content)

**Fallback state:** If the filter returns < 3 plumbers (e.g., < 3 confirmed 24-hour plumbers in a city), show all plumbers sorted by the intent dimension with a note: "We couldn't confirm 24-hour availability for all plumbers below. Plumbers marked '24/7 Verified' have confirmed after-hours service."

---

### Template Type 4: Cost Guide Page

**Route:** `/cost-guide/[service]` (national) and `/cost-guide/[service]/[state]/[city]` (local)

| # | Section | Purpose | Data Source | Static / Templated / Dynamic |
|---|---------|---------|-------------|------------------------------|
| 1 | JSON-LD | SEO structured data | BreadcrumbList + FAQPage + Article | Templated |
| 2 | Hero | Pricing-focused title | `"How Much Does {Service} Cost in {City}?"` (local) or `"{Service} Cost Guide"` (national) | Templated |
| 3 | Price Range Table | National/regional ranges | Tabular: service type → low/mid/high price | Static per service (updated periodically) |
| 4 | Cost Factors | What drives price up/down | 4-6 factors (e.g., "pipe accessibility", "time of day", "materials") | Static per service |
| 5 | Local Pricing Context | City-specific pricing signals | Plumber pricingTier distribution for this city (% budget/mid/premium) | Dynamic (from plumber data) |
| 6 | Get Quotes | Top-rated plumbers for this service in this city | Same plumber list as service page, abbreviated (top 5 only) | Decision engine |
| 7 | FAQ | Cost-focused Q&A | "Is it cheaper to...", "Does insurance cover...", "Why do plumbers charge..." | Templated |
| 8 | Cross-link: Service Page | Full rankings | `/drain-cleaning/{state}/{city}` | Dynamic |
| 9 | Footer CTA | Signup | Static | Static |

**Schema markup:** BreadcrumbList, FAQPage, Article

**Word count target:** 1,200-1,800 words (pricing content is naturally long-form and high-value for SEO)

**Fallback state:** National page always renders (no city-specific data needed). Local page renders if city has plumbers; otherwise redirects to national page.

---

### Template Type 5: State-Level Service Page

**Route:** `/[service]/[state]` (e.g., `/drain-cleaning/maryland`)

| # | Section | Purpose | Data Source | Static / Templated / Dynamic |
|---|---------|---------|-------------|------------------------------|
| 1 | JSON-LD | SEO structured data | BreadcrumbList | Templated |
| 2 | Hero | State service overview | `"{Service} in {State} — Find Local Pros"` | Templated |
| 3 | Cities Grid | All cities in state with plumber counts for this service | Grouped by county, each city shows qualified plumber count | Dynamic (from CITY_COVERAGE + specialty data) |
| 4 | State Stats | Aggregate stats | Total plumbers, average rating, cities covered | Dynamic |
| 5 | FAQ | State-level Q&A | "Do I need a license for {service} in {state}?", "What's the average cost..." | Templated |
| 6 | Cross-links: Other Services | State-level pages for other services | Registry-driven | Dynamic |
| 7 | Footer CTA | Signup | Static | Static |

**Schema markup:** BreadcrumbList, FAQPage

**Word count target:** 400-700 words (primarily a navigation page, not a content page)

**Fallback state:** Only generate if state has ≥ 1 city with plumber data. No noindex needed — these are lightweight navigation pages.

---

### Template Type 6: Award Blog Post

**Route:** `/blog/top-3-[service]-[city]-[state]-[year]`

| # | Section | Purpose | Data Source | Static / Templated / Dynamic |
|---|---------|---------|-------------|------------------------------|
| 1 | JSON-LD | SEO structured data | Article + BreadcrumbList | Templated |
| 2 | Title + Meta | Award headline | `"Top 3 {Service} in {City}, {State} ({Year})"` | Templated |
| 3 | Intro Paragraph | Context + methodology link | "We analyzed {reviewCount} reviews across {plumberCount} plumbers..." Links to `/blog/how-we-rank-plumbers` | Templated + dynamic counts |
| 4 | Winner #1 | Gold winner card | Name, score, verdict, evidence quotes (2-3), strengths, phone CTA, link to profile | Decision engine |
| 5 | Winner #2 | Silver card | Same structure as #1 | Decision engine |
| 6 | Winner #3 | Bronze card | Same structure as #1 | Decision engine |
| 7 | Honorable Mentions | #4-5 if they exist | Abbreviated: name, score, one-line summary | Decision engine |
| 8 | Methodology | How we ranked | Summary + link to `/blog/how-we-rank-plumbers` | Static |
| 9 | Cross-links | Service page + city page | `/drain-cleaning/{state}/{city}` + `/emergency-plumbers/{state}/{city}` | Dynamic |

**Schema markup:** Article (with author, datePublished, dateModified), BreadcrumbList

**Word count target:** 600-900 words

**Qualifying threshold:** Only generate when 3+ plumbers have Tier 1 or Tier 2 scores for this service in this city. Do not generate award posts from Tier 3 (fallback) plumbers — an award from unscored plumbers has no credibility.

---

### Template Type 7: Symptom Blog Post

**Route:** `/blog/what-to-do-about-[symptom]-in-[city]-[state]`

| # | Section | Purpose | Data Source | Static / Templated / Dynamic |
|---|---------|---------|-------------|------------------------------|
| 1 | JSON-LD | SEO structured data | Article + HowTo + BreadcrumbList | Templated |
| 2 | Title + Meta | Symptom headline | `"What to Do About a {Symptom} in {City}, {State}"` | Templated |
| 3 | Emergency Steps | Immediate actions | Same 3-5 steps as symptom page template | Static per symptom |
| 4 | When It's an Emergency | Urgency guidance | Threshold description | Static per symptom |
| 5 | Local Pro Recommendations | Top 3 plumbers | Same as award post winner cards but for mapped service | Decision engine |
| 6 | Cost Context | What to expect to pay | Price ranges from cost guide template | Static per symptom |
| 7 | Prevention Tips | How to avoid this problem | 3-4 tips | AI-generated (Claude Haiku, city-grounded with region tags) |
| 8 | Cross-links | Symptom page + service page + city page | Dynamic | Dynamic |

**Schema markup:** Article, HowTo, BreadcrumbList

**Word count target:** 800-1,200 words

**Generation trigger:** Only generated during city activation if GSC shows impression data for symptom queries in that city. Not generated during backfill unless explicitly requested.

---

## 9. Backfill Phase for Existing Cities

### Current data landscape (as of 2026-04-12)

| Category | Cities | Plumbers | Decision verdicts | Specialty scores (5-key) | servicesMentioned |
|----------|--------|----------|-------------------|--------------------------|-------------------|
| Complete decision engine | 3 (Acworth GA, Aberdeen MD, Bethesda MD) | 43 | 43 | 43 | ~0 |
| Partial scoring (scored, some verdicts) | 7 (Nashville, Worcester, Aiken, Abilene, San Leandro, Alameda, Provo) | 32 scored / ~130 total | 1 (Provo) | 32 | ~0 |
| Plumbers but no scoring | ~39 cities | ~400 | 0 | 0 | ~1 |
| **Total** | **49 cities** | **572** | **44** | **75** | **~1** |

Note: `servicesMentioned` data is nearly absent (only 1 plumber). The Outscraper deep pull has only run for a few cities so far. This means Tier 2 (bridge scoring) will be thin during backfill — most existing cities will rely on Tier 1 (specialty scores) or Tier 3 (general fallback).

### Selection criteria

**Backfill = generate template pages for every city in `CITY_COVERAGE` (the 150 cities with ≥ 1 plumber within 20 miles).** Not just the 49 cities with plumbers attached by `serviceCities` — the radius-matching system means plumbers in one city serve nearby cities too. CITY_COVERAGE already accounts for this.

### What each city gets

For each of the 150 cities in CITY_COVERAGE:
- **All 16 service page templates** where ≥ 1 plumber qualifies (any tier)
- **All 6 symptom page templates** (same qualifying logic — symptoms map to services)
- **All 5 intent page templates** (intent pages filter by plumber signals, not services)
- **Award posts** only for Phase 1 cities with Tier 1 data
- **Sitemap entries** for all generated pages
- **Internal links** injected on existing city pages pointing to new siblings

### Legacy-scored plumber handling

Plumbers with `scoringVersion: "legacy-5"` (or no version) have `specialty_strength` for 5 keys only: `water_heater`, `drain`, `repipe`, `emergency`, `remodel`.

| Service page | Legacy plumber behavior |
|-------------|----------------------|
| drain-cleaning, water-heater-repair, burst-pipe-repair, repiping, bathroom-remodel-plumbing | **Tier 1** — legacy scores exist for these 5 services. Show in Top 3 if score ≥ 70. |
| sewer-repair, toilet-repair, faucet-repair, garbage-disposal-repair, sump-pump-repair, gas-line-repair, slab-leak-repair, water-line-repair, kitchen-remodel-plumbing, hydro-jetting | **Tier 3 only** — no legacy score for these services. Show in "All Plumbers" sorted by general quality. NOT eligible for Top 3. |
| hydro-jetting | **Tier 1** — shares `drain` key with drain-cleaning. Legacy plumbers with drain scores qualify. |
| kitchen-remodel-plumbing | **Tier 1** — shares `remodel` key with bathroom-remodel-plumbing. Legacy plumbers with remodel scores qualify. |

### Phased backfill

#### Phase 1: Cities with complete decision engine data

**Cities:** Acworth GA (19 plumbers, 19 decided), Aberdeen MD (16 plumbers, 16 decided), Bethesda MD (15 plumbers, 8 decided)

**What gets generated:**
- All 27 page templates × 3 cities = **81 service/symptom/intent pages**
- For the original 5 services + hydro-jetting + kitchen-remodel: plumbers ranked by Tier 1 specialty scores with verdict badges and evidence quotes in Top 3
- For the 9 new services without legacy scores: plumbers shown in Tier 3 fallback (general quality sort, no Top 3 rankings)
- Award posts for services where 3+ plumbers have Tier 1 scores ≥ 70: drain-cleaning (Acworth: 10+ qualify), water-heater-repair (Acworth: 12+ qualify), emergency (Acworth: 12+ qualify), etc.
- ~15-20 award posts across the 3 cities
- Sitemap updated with all new URLs
- Internal links injected on existing emergency plumber pages for these 3 cities

**GSC indexing:** Submit all ~81 page URLs + ~15-20 blog URLs ≈ ~100 URLs. Fits in one day's 200 quota.

**Success criteria before Phase 2:**
- All 81 pages build without errors
- Vercel deploy succeeds (under 80MB limit)
- Acworth drain-cleaning page shows real Top 3 with specialty scores
- Acworth sewer-repair page shows Tier 3 fallback (plumbers listed by quality, no Top 3)
- Award posts render with real winner data
- Internal links work (click from city page to service page and back)
- No thin-content pages (every page has ≥ 3 plumbers across tiers)
- Google indexes ≥ 50% of submitted URLs within 14 days

**Timeline:** 1-2 days of work. Manual verification of all 3 cities.

#### Phase 2: Cities with partial scoring + enough plumbers for fallback

**Cities:** Nashville TN (19 plumbers, 11 scored), Worcester MA (18 plumbers, 5 scored), Aiken SC (10 plumbers, 5 scored), Abilene TX (17 plumbers, 4 scored), San Leandro CA (16 plumbers, 3 scored), Alameda CA (12 plumbers, 3 scored), Provo UT (20 plumbers, 1 scored)

**What gets generated:**
- All 27 page templates × 7 cities = **189 service/symptom/intent pages**
- For services with legacy scores: mix of Tier 1 (scored plumbers in Top 3) and Tier 3 (unscored plumbers in list below)
- For new services: all Tier 3 fallback
- Award posts only for services where 3+ plumbers have Tier 1 scores in a city (likely only Nashville and possibly Worcester for the original 5 services)
- Estimate: ~5-10 award posts

**Success criteria before Phase 3:**
- All 189 pages build
- Nashville drain-cleaning shows mix of scored + fallback plumbers
- Pages with < 3 total plumbers across all tiers get `noindex` tag
- GSC shows impressions on at least some new pages within 21 days
- No city has more than 50% thin-content pages

**Timeline:** 1 day of work. Spot-check 2 cities manually.

#### Phase 3: Cities with plumbers but no decision engine data

**Cities:** ~36 remaining cities (Huntsville AL, Stow OH, Edmond OK, Yukon OK, Westminster CO, all IL cities, etc.)

**What gets generated:**
- All 27 page templates × ~36 cities = **~970 service/symptom/intent pages**
- All pages use Tier 3 fallback only (general quality sort, no Top 3 rankings, no verdict badges)
- No award posts (no scored data to rank winners)
- Intent pages still work (is24Hour, pricingTier, bbbAccredited are from basic synthesis, not scoring)

**Success criteria:**
- All pages build
- Total page count stays under Vercel build limits (current pages + ~970 new ≈ ~4,000 total)
- Fallback pages show plumber lists sorted by quality score
- `noindex` applied to pages with < 3 radius-matched plumbers

**Timeline:** 1 day of work. Automated validation only (build success + page count check).

### Batch sizing

- **Phase 1:** 3 cities, ~100 URLs. Single batch. No throttling needed.
- **Phase 2:** 7 cities, ~200 URLs. Single batch for page generation. GSC indexing over 2 days (100/day from activation budget).
- **Phase 3:** ~36 cities, ~1,000 URLs. Run in batches of 10 cities per build to verify build time stays under Vercel limits. GSC indexing over 6 days.

### Sitemap updates

New URLs are added to the sitemap in the same commit as the page generation. The sitemap generator already reads the registry and CITY_COVERAGE — once we gate `generateStaticParams` properly, the sitemap auto-includes all pages that get built.

GSC submission via `request-indexing.js --city {slug}` after each batch. Prioritize Phase 1 cities (with real scored data) for first-day submission.

### Internal linking during backfill

**Inject, don't rewrite.** Each existing emergency plumber city page gets a new "Service-Specific Pages" section appended (after the plumber list, before FAQ). This section renders links to all service/symptom pages that exist for the city, driven by the registry:

```
Other Services in Acworth, GA:
[Drain Cleaning] [Water Heater Repair] [Burst Pipe Repair] [Sewer Repair] ...
[Clogged Drain?] [No Hot Water?] [Water Leak?] ...
[24-Hour Plumber] [Same-Day Plumber] [Licensed Plumber] ...
```

This section is rendered at build time from the registry + CITY_COVERAGE data. No hand-coding. When a new service is added to the registry, it auto-appears on every city page that has data.

The service pages already have cross-link sections (lines 356-395 in the current `[service]/[state]/[city]/page.tsx`). These will auto-expand when the registry grows from 5 to 27 entries.

### Blog post backfill

**Award posts: Phase 1 only.** Only generate award posts for cities with complete decision engine data (Acworth, Aberdeen, Bethesda). Award posts that rank plumbers by score require real scored data — generating them from fallback data would undermine credibility.

Phase 2 cities get award posts only for services where 3+ plumbers have real Tier 1 scores. Phase 3 cities get zero award posts during backfill — award posts come later via city activation when those cities get scored.

**Symptom blog posts: skip during backfill.** These are triggered by GSC symptom query data, which we don't have yet for most cities. They'll generate naturally through the city activation flywheel.

### Rollback plan

If backfill generates thin or broken pages at scale:

1. **Detection:** After each phase, check:
   - Build errors (immediate stop)
   - Pages with < 3 plumbers and missing `noindex` tag (bug)
   - Pages rendering with broken data (spot-check 5 random pages per city)
   - Vercel deploy size approaching 80MB limit

2. **Soft rollback:** Add `noindex` to problematic pages without removing them. They stop appearing in Google but remain navigable for users who land on them via internal links.

3. **Hard rollback:** If a phase is fundamentally broken:
   - Revert the `generateStaticParams` change to exclude the bad batch of cities
   - The pages stop building entirely
   - Git revert the template data for affected cities
   - GSC will naturally de-index pages that return 404

4. **Per-phase isolation:** Each phase is a separate commit. Phase 2 doesn't ship until Phase 1 is verified. Phase 3 doesn't ship until Phase 2 is verified. If Phase 2 fails, Phase 1 pages remain live.

### Admin panel visibility

Each backfill phase logs to `pipelineRuns` with `script: "backfill-phase-N"` and summary:
- Cities processed
- Pages generated per template type
- Award posts generated
- URLs submitted for indexing
- Build time
- Errors (if any)

Visible in the Activity tab alongside daily pipeline runs.
