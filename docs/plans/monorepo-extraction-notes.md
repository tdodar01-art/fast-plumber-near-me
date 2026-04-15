# Monorepo Extraction Notes — Scouting Doc

**Date:** 2026-04-12
**Purpose:** Map what should eventually move to shared packages vs stay in the plumbing app, so we have a plan when the second directory starts.
**Status:** Scouting only — no refactoring yet.

---

## Classification Key

- **SHARED** — should live in `packages/directory-core` or `packages/directory-ui` eventually. Core logic is vertical-agnostic.
- **VERTICAL** — plumbing-specific, stays in `apps/fast-plumber-near-me` forever.
- **CONFIG** — shared schema, per-app config values. The schema lives in shared packages; the values live in the vertical app.

---

## Service Registry (`src/lib/services-config.ts`)

**Classification: CONFIG**

The `PageConfig` interface and `ScoringStrategy` types are generic — any directory can define service pages, intent pages, and symptom pages. The actual entries (drain-cleaning, water-heater-repair, etc.) are plumbing-specific.

**Config shape for another vertical:**
```typescript
// apps/fast-hvac-near-me/src/config/pages.ts
const PAGE_CONFIGS: PageConfig[] = [
  { slug: "ac-repair", type: "service", scoring: { kind: "specialty", key: "ac_repair" }, ... },
  { slug: "furnace-repair", type: "service", scoring: { kind: "specialty", key: "furnace" }, ... },
  { slug: "no-ac", type: "symptom", scoring: { kind: "mapped", serviceKeys: ["ac_repair"] }, ... },
];
```

**Plumbing assumptions baked in:** None in the types. All plumbing specifics are in the config values.
**Extraction effort:** Low — move types to `packages/directory-core/src/types/page-config.ts`, keep values in app.

---

## Scoring Pipeline (`scripts/score-plumbers.ts`, `scripts/score-plumber-services.ts`)

**Classification: SHARED (pipeline logic) + CONFIG (prompts, specialty keys)**

The 3-pass scoring architecture (extract → rank → decide) is generic:
- Pass 1: Extract dimension scores from reviews via Claude
- Pass 2: Rank within a geographic area
- Pass 3: Compute verdicts

**Plumbing assumptions baked in:**
- Prompt text references "plumbing company" and plumbing-specific `service_category` values
- `SPECIALTY_KEYS` array is plumbing-specific (drain, sewer, etc.)
- Job type taxonomy (water_heater, drain_sewer, pipe_repair, etc.) is plumbing-specific

**Config shape for another vertical:**
```typescript
// Shared: ScoringPipelineConfig
{ dimensionKeys: string[], specialtyKeys: string[], extractionPrompt: string, batchSize: number, rateLimit: number }
// Per-vertical: prompt text, specialty keys, coarse-to-fine mapping
```

**Extraction effort:** Medium — the pipeline logic is interleaved with plumbing-specific prompts. Would need to factor prompts into a config parameter.
**Extract now or later?** After current build completes. The scoring pipeline is still evolving.

---

## Decision Engine (`src/lib/decision-engine.ts`)

**Classification: SHARED (engine) + CONFIG (dimension keys, phrases, thresholds)**

The verdict computation (percentile → strong_hire/conditional_hire/caution/avoid), `computeBestFor`, `computeAvoidIf`, `computeHireIf`, `computeCautionIf` are all generic pattern-matching on scores. The phrases and thresholds are config.

**Plumbing assumptions baked in:**
- `STRENGTH_PHRASES` and `WEAKNESS_PHRASES` reference plumbing scenarios
- `SPECIALTY_DISPLAY_NAMES` maps keys to plumbing service names
- Verdict thresholds (80/60/40 percentile cutoffs) are universal

**Extraction effort:** Low — separate engine from phrases/display names.

---

## Template Renderer / CityServicePage Component

**Classification: SHARED (component) + CONFIG (template definitions)**

The `CityServicePage` component (planned) renders a page from a `PageTemplate` config. The rendering logic (hero → top picks → plumber list → scenarios → FAQ → cross-links) is generic to any directory. The template content (emergency types, FAQ text, cost ranges) is vertical-specific.

**Plumbing assumptions that would need extraction:**
- Currently the `[service]/[state]/[city]/page.tsx` is a single large component with plumbing references in the JSX. The planned refactor to a template-driven `CityServicePage` would already be extraction-ready.
- Plumber-specific UI (PlumberCard, PlumberListWithSort) → rename to `ListingCard`, `ListingListWithSort`

**Extraction effort:** Medium-High — the component doesn't exist yet as a shared abstraction. Building it template-driven from the start makes extraction easy later.
**Extract now or later?** Build it right during Phase 3 (template system). Don't extract to a package yet, but structure it so extraction is a move, not a rewrite.

---

## GSC Activation Watcher (`scripts/gsc-expansion.js`)

**Classification: SHARED**

The logic is vertical-agnostic: pull GSC data → parse URLs → check against page registry → queue cities for activation. The only app-specific part is the base URL and the slug patterns (which come from the registry).

**Plumbing assumptions baked in:**
- Hardcoded `fastplumbernearme.com` site URL
- Currently filters by `/emergency-plumbers/` (being expanded)

**Extraction effort:** Low — parameterize site URL and pass registry in.

---

## City Activation Queue / Orchestrator (`scripts/activate-city.ts`, planned)

**Classification: SHARED**

The activation flow (check scrape → scrape → deep pull → score → export → blog → link → index) is the same for any local service directory. Steps are sequential and each step is a pluggable function.

**Plumbing assumptions that would need extraction:**
- Scrape query templates ("emergency plumber in {city}")
- Outscraper configuration (review sources)
- Blog post templates

**Config shape:**
```typescript
interface ActivationConfig {
  scrapeQuery: (city: string) => string,  // "emergency plumber in {city}" vs "hvac near {city}"
  outscrapeConfig: OutscraperConfig,
  blogTemplates: BlogTemplate[],
  indexingBaseUrl: string,
}
```

**Extraction effort:** Medium — not built yet, so we can build it config-driven from the start.
**Extract now or later?** Build config-driven in the plumbing app. Extract when second directory needs it.

---

## Internal Linking Logic (`src/lib/city-links.ts`, planned)

**Classification: SHARED**

The algorithm (read registry → read city coverage → compute related pages → generate link sections) is generic. The link text and section titles are config.

**Plumbing assumptions:** None if built against the PageConfig interface.
**Extraction effort:** Low.

---

## Admin Panels (`src/app/admin/`)

**Classification: SHARED (layout, Activity panel, pipeline viewer) + VERTICAL (plumber-specific fields, submission forms)**

The admin layout, authentication, pagination, Activity tab (reads `pipelineRuns`), and pipeline viewer are generic. Plumber-specific: the plumber detail editor, plumber submission form, plumber-specific filters.

**Plumbing assumptions baked in:**
- "Plumber" terminology throughout
- PlumberCard used in admin listing
- Plumber-specific fields (emergencyReadiness, serviceCities, etc.)

**Extraction effort:** High — admin is deeply intertwined with plumber-specific data models. Better to extract after we see what HVAC admin needs look like.

---

## Award Post Generator (`scripts/generate-blog-posts.js`)

**Classification: SHARED (generator logic) + CONFIG (post templates, qualifying thresholds)**

The generator reads registry → finds qualifying businesses → applies template → outputs JSON. Generic. The templates ("Top 3 Drain Cleaning in {city}") are vertical-specific.

**Extraction effort:** Low-Medium — need to parameterize templates and qualifying criteria.

---

## Data Pipeline Scripts

| Script | Classification | Notes |
|--------|---------------|-------|
| `daily-scrape.js` | SHARED + CONFIG | Scrape logic is generic; query templates and field mappings are vertical |
| `outscraper-reviews.js` | SHARED | Multi-source review pull is vertical-agnostic |
| `export-firestore-to-json.js` | SHARED | Single-writer pattern is reusable |
| `upload-to-firestore.js` | SHARED + CONFIG | Collection names and field mappings are config |
| `refresh-reviews.ts` | SHARED | Review accumulation logic is generic |
| `synthesize-reviews.ts` | SHARED + CONFIG | Synthesis prompt is vertical-specific |
| `request-indexing.js` | SHARED | Parameterize site URL |
| `bbb-lookup.js` | SHARED | BBB lookup works for any business type |
| `generate-city-coverage.js` | SHARED | Coverage map generation is generic |

---

## Recommendation

**c) Extract when we actually start the second directory (YAGNI).**

Rationale:
1. We don't know what the second directory is yet. Extracting now means guessing at abstractions.
2. The current build is still evolving (scoring pipeline, template system, activation engine are all in flux).
3. The cost of extraction later is low for most pieces (registry types, decision engine, GSC watcher, linking logic = all Low effort).
4. The cost of premature extraction is high (wrong abstractions, maintaining two packages while only one app uses them, slower iteration).

---

## Experiments System (`src/lib/experiments/`)

**Classification: SHARED (engine in control-center) + CONFIG (per-site registry in each app)**

The experiments system is already split brain/body across repos. The engine (judging, metrics pulling, notifications) lives in control-center and is fully vertical-agnostic. Per-site code lives in each site repo:
- `activeExperiments.ts` — hardcoded registry (VERTICAL — experiment configs are site-specific)
- `publishMetrics.ts` — metrics publisher (SHARED — same GSC→Firestore pattern for any site)
- Variant helpers (e.g., `getNearbyCityCount.ts`, `expandNearbyCities.ts`) — CONFIG (shared pattern, per-experiment values)

**Plumbing assumptions baked in:** None in the engine. The `activeExperiments.ts` and variant helpers are plumbing-specific by content, not by structure.

**Extraction effort:** Already extraction-ready. Adding a second site means: (1) add entry to `sites.ts` in control-center, (2) create `activeExperiments.ts` + `publishMetrics.ts` in the new site's repo, (3) add a GitHub Action for the metrics cron.

---

**However:** Follow the Monorepo Extensibility Principle — avoid baking "plumber" into generic concepts, keep vertical-specific prompts/config in named files, and flag items for this doc as they're built. When the second directory arrives, this doc is the extraction map.
