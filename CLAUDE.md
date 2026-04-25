@ROADMAP.md

## Start Here
- **Strategy:** Read `docs/plans/STRATEGY-BRIEF.md` first — it defines the three active tracks, what's shipped, and what's next.
- **Cross-project status and session logs:** Live in `~/code/control-center/`, not here.
- **Archived plans:** `docs/plans/archive/` — superseded by the strategy brief.

## Automation pause — manual-first process improvement (active as of 2026-04-23)

We are DELIBERATELY running most of the pipeline manually right now. The goal
is to rebuild each step by hand inside the Operator Console (`apps/operator/`)
so we understand what each step does, what its outputs look like, and where
the quality bar is — then re-automate with better guardrails. **Do not
"helpfully" re-enable the cron schedules or stitch removed steps back into
the workflows.** That undoes the work in progress.

Current state of `.github/workflows/`:

- **`daily-scrape.yml`** — STILL AUTOMATED (6 AM Central). Eight steps:
  GSC expansion → GSC prepend queue → daily-scrape (Google Places) →
  upload-to-firestore → rebuild JSON from Firestore → regenerate city
  coverage → commit & push → request-indexing (Google Indexing API
  pings for newly-scraped city pages). Zero-dollar (GSC, Places, and
  Indexing are all free at our scale, guarded at 90% of $200/mo Places
  cap by `budget-guard.ts`).
- **`deep-review-pull.yml`** — CRON DISABLED. `workflow_dispatch` only.
  Outscraper multi-source review pull is a paid API; we're choosing cities
  by hand in the Operator Console before dispatching.
- **`rebuild-json.yml`** — CRON DISABLED. `workflow_dispatch` only. The
  6-hour safety rebuild is OFF. Any Firestore writes that happen outside
  the daily commit will not show up in JSON until `daily-scrape.yml` runs
  or a human dispatches rebuild-json.
- **`publish-experiment-metrics.yml`** — CRON DISABLED. `workflow_dispatch`
  only. Experiment metric publishing is manual until the console owns it.

Removed from `daily-scrape.yml` and now in the manual backlog:

- `score-plumbers.ts` (Sonnet scoring + synthesis) — paid Anthropic API,
  needs operator-paste-flow inside the console before re-automating.
- `refresh-reviews.ts` (Places review accumulation) — removed from cron
  2026-04-25 because Google Places API (New) returns at most 5 reviews
  per plumber sorted by relevance (not recency). For mature plumbers
  the same 5 are returned daily; the script burned API calls finding
  zero new reviews every run. Real review accumulation needs
  Outscraper (paid, sorted by recency, up to 100/plumber). To be
  re-wired through the operator console once `deep-review-pull.yml`
  is operationalized.

`request-indexing.js` was re-automated 2026-04-24 — free,
deterministic, no operator judgment needed.

These are not deleted — they still live in `scripts/` and can be invoked
from the Operator Console or `workflow_dispatch` runs. The plan is to
wire each one into the console's 6-state reducer (idle → pulling →
reviewing → synthesizing → publishing → published), watch it run end to
end, sharpen the prompts and guardrails, then decide what goes back into
cron. Until that work is done, treat scoring + enrichment + indexing as
human-gated.

## Monorepo Extensibility Principle

This app is the first of multiple directory sites planned under `~/code/directory-sites/`. Future directories include HVAC, electricians, handyman, and other local service verticals. All core architecture must be built with eventual extraction to shared packages in mind.

When building anything, classify it in your head:

- **SHARED** (future `packages/directory-core` or `packages/directory-ui`): city activation engine, scoring pipeline, template renderer, GSC activation watcher, admin panels, pipeline orchestration, internal linking logic, CityServicePage component. These are vertical-agnostic. Do not bake plumbing-specific assumptions into them.

- **VERTICAL** (stays in `apps/fast-plumber-near-me`): plumbing-specific Claude prompts, plumbing service list, plumbing FAQ content, plumbing cost ranges, plumbing brand copy.

- **CONFIG** (shared schema, per-app values): service registry entries, scoring dimension keys, schema.org types, template configs, industry vocabulary.

Guidelines:
- Do NOT extract to `packages/` prematurely. Build in the plumbing app first. The second directory reveals whether abstractions are right.
- DO avoid baking "plumber" into variable names, types, or file paths when the concept is generic. Use "business" or "listing" for generic concepts; reserve "plumber" for plumbing-specific code.
- DO keep plumbing-specific prompts, service lists, and config values in named config files that another directory could easily swap out.
- DO flag when you're about to build something that feels generic but is being built inside the plumbing app — note it in `docs/plans/monorepo-extraction-notes.md` so we have a map when extraction time comes.
- DO NOT refactor existing code just to make it generic. Only new code follows this principle.

When in doubt: would this logic work identically for HVAC or electrical directories? If yes, it's SHARED — name and structure it accordingly. If no, it's VERTICAL.

See `docs/plans/monorepo-extraction-notes.md` for the full scouting doc classifying each major component.

## Experiments

This repo is the **body** in the brain/body experiments system. Control-center (brain) owns the ledger and judging; this repo owns variant rendering and metrics publishing. See `apps/plumbers-web/docs/EXPERIMENTS.md` for the full file map and active experiments.

Key files:
- `apps/plumbers-web/src/lib/experiments/activeExperiments.ts` — hardcoded experiment registry
- `apps/plumbers-web/src/lib/experiments/publishMetrics.ts` — daily GSC metrics → Firestore
- `.github/workflows/publish-experiment-metrics.yml` — 7:30 AM CT cron

When adding experiment support to a page template, follow the pattern in `emergency-plumbers/[state]/[city]/page.tsx`: check `getExperimentNearbyCityCount()`, branch on result, render accordingly.

## SEO Doctrine

All SEO decisions must follow the standing doctrine at `~/code/control-center/doctrines/seo.md`. Read it before building any new page type, changing metadata, or modifying URL structure. Do not reinvent SEO patterns per page — consult the doctrine and apply.

## Deploys To
- **Platform:** Vercel
- **Production URL:** https://fastplumbernearme.com
- **Auto-deploy branch:** `main` (assumed Vercel default — needs Tim to confirm if different)
- **Vercel root directory:** `apps/plumbers-web/` (this is a monorepo; `vercel.json` at `apps/plumbers-web/vercel.json` is a minimal `{"framework": "nextjs"}`)
- **Admin panel:** `/admin` — Firebase Auth with Google login (the canonical pattern being ported to `geteasyexit.com/admin`)

One GitHub Actions workflow is currently on cron; the others are manual.
See the "Automation pause" section above for the full current state.

- **`daily-scrape.yml`** (6 AM Central, ACTIVE) — GSC expansion → GSC
  prepend → Places intake → Firestore upload → JSON rebuild → city
  coverage regen → commit → **request indexing** → Vercel rebuild.
  Scoring/synthesis and review refresh remain manual.
- **`deep-review-pull.yml`** / **`rebuild-json.yml`** /
  **`publish-experiment-metrics.yml`** — `workflow_dispatch` only as of
  2026-04-23. Run by hand from the Operator Console or the Actions UI.

ROADMAP.md → "Automated Pipeline Architecture" describes the pre-pivot
fully-automated flow; treat it as historical reference, not current truth.

## Known Issues / Gotchas

**Pre-launch gaps (as of ROADMAP April 6, 2026):**
- Mobile QA pass not done
- Favicon / PWA icons missing (`/icon-192.png`, `/icon-512.png`)
- Firestore security rules not deployed (`firebase deploy --only firestore:rules`)
- GA4 firing not yet verified
- Places API (New) not yet enabled on the Firebase GCP project — required for `refresh-reviews` to call Google directly

**Structural risks (from ROADMAP "Known Risks"):**
- **Google dependency is the biggest existential risk.** All review/rating data flows from Google Places API. Mitigation is the Firestore cache: once a plumber is scraped, their record + reviews are cached permanently. Firestore is the source of truth; Google is the intake pipe. Never build logic that assumes Google will still answer tomorrow.
- **Review synthesis quality bar is hard.** Generic copy like "reliable and professional" is banned. Synthesized blurbs must be specific and punchy — "Multiple reviewers mention surprise fees after the initial quote" not "Customers say they are professional." See ROADMAP → "Review Synthesis Can Become Generic Fast".
- **Yelp coverage gap:** Outscraper returns 0 reviews for businesses with <20 Yelp reviews. Needs an alternative scraping path.
- **SEO is a grind.** Emergency plumbing is one of the most competitive local SEO verticals — our edge must be speed, UX, trust signals (we show weaknesses, not just stars), and honest review synthesis.

## Publishing vs. scoring (superseded 2026-04-23)

The earlier Phase 1 stabilization (2026-04-20) enforced a "publish BEFORE
score" ordering inside `daily-scrape.yml` so that `score-plumbers.ts`
couldn't block the daily site update. That invariant still matters in
spirit, but it no longer applies to the current workflow: scoring has been
REMOVED from `daily-scrape.yml` entirely as part of the manual-first pivot.
`score-plumbers.ts` is now invoked by hand (or via `workflow_dispatch`)
while we rebuild scoring inside the Operator Console.

The 6-hour `rebuild-json.yml` safety net that used to catch scoring-only
Firestore writes is also disabled. If you run `score-plumbers.ts` manually,
remember to run `export-firestore-to-json.js` afterward — nothing will do
it for you on a schedule.

The core rule still holds: **the export step in `daily-scrape.yml` is not
`continue-on-error`.** If publishing fails, the workflow fails visibly.

## Data pipeline invariants

These rules are non-negotiable. If you feel the urge to violate them, the architecture is being misused.

1. **Firestore is the single source of truth for plumber data.** All enrichment (BBB, Yelp, Angi, Outscraper deep reviews, AI synthesis) lives in Firestore. Local JSON files are derived artifacts.

2. **`plumbers-synthesized.json` has exactly one writer: `export-firestore-to-json.js`.** No other script may write to this file. The same applies to `leaderboard.json`. If you need to add a new derived JSON file that the website reads at build time, it must follow the same pattern: one export script, Firestore as source.

3. **Every Firestore-mutating workflow ends with a JSON rebuild.** The daily-scrape workflow, deep-review-pull workflow, and the 6-hour safety net all call `export-firestore-to-json.js` as their final data step. This ensures the committed JSON always reflects Firestore truth.

4. **Never add merge logic to ingestion scripts to "preserve" enrichment fields.** If daily-scrape or any other ingestion script appears to be wiping enrichment data from the JSON, the fix is NOT to make that script "merge-aware." The fix is to ensure the JSON rebuild step runs after it. The single-writer invariant prevents the class of bug where two scripts fight over the same file.

5. **Ingestion scripts write to Firestore or to staging files in `data/raw/`.** They never write to `data/synthesized/`. The staging file `data/raw/plumbers-with-synthesis.json` is an intermediate working file used by `upload-to-firestore.js` — it is gitignored and never committed.

6. **Coord contract: `cities-generated.ts` ↔ `city-coords.ts` are regenerated together.** `scripts/generate-cities-data.mjs` is the single source of truth for both files. It reads from `scripts/city-coords-cache.json` (populated by the 3-phase resolver: kelvins CSV → OSM/Nominatim → Google Geocoding) and exits non-zero if any `targetCities` entry is still missing coords. Do NOT hand-edit `city-coords.ts`. Do NOT add a RAW_CITIES entry without its coords — the daily pipeline depends on this pair staying in sync for radius-fallback rendering during the 1–3 day GSC→scrape→rebuild race window.

7. **`gsc-prepend-queue.js` resolves coords before queueing.** New cities discovered via GSC are geocoded via the same 3-phase chain, written to the cache, then `generate-cities-data.mjs` is re-invoked to rebuild the TS files. Coord misses are logged to `errors.jsonl` (severity: error) and the script exits non-zero — this is intentional. Never relax the exit code to make CI green; fix the coord gap instead.

8. **Service pages and city pages share one plumber resolver.** Both `/emergency-plumbers/[state]/[city]` and `/[service]/[state]/[city]` call `resolvePlumbersForCity()` in `src/lib/firestore.ts`. Do not duplicate the fetch logic or drift the radius/threshold constants. If you need to add a third route that lists plumbers by city, extend the shared resolver.

## Recheck data pipeline integrity

Verify periodically (weekly or after pipeline changes):

- [ ] Grep the repo for writes to `plumbers-synthesized.json` — confirm only `export-firestore-to-json.js` appears
- [ ] Confirm Firestore plumber count matches JSON row count
- [ ] Confirm `daily-scrape.yml` still ends with export → city-coverage regen → commit. (The 6-hour `rebuild-json.yml` safety net is disabled during the manual-first pivot — do NOT re-enable it without reading the "Automation pause" section above.)
- [ ] Spot-check 3 random plumbers: BBB fields, Yelp rating, and deep review data all present in JSON. Staleness is expected during the pivot — enrichment is manual.
- [ ] Confirm `RAW_CITIES` count in `cities-generated.ts` equals coord-key count in `city-coords.ts` (coord contract)
- [ ] Scan `errors.jsonl` for recent `severity: error` entries from sources `gsc-prepend-queue`, `daily-scrape`, `export-firestore` — triage via the error-log UI (`preview_start error-log` → http://localhost:4330)
- [ ] Check `/admin/activity` for recent `status: "error"` pipelineRuns

---

## Error logging (shared control-center log)

Every project — this repo included — logs errors to ONE shared file: `~/code/control-center/logs/errors.jsonl`. **Do not create a new error log for this repo.**

Use the shared CLI:

```
node ~/code/control-center/scripts/log-error.mjs \
  --project <project-key> \
  --message "<text>" \
  [--severity error|warn|info] \
  [--entity <component>] \
  [--context '<json>' | --context-file <path>]
```

- `--project` must match this repo's `key` in `~/code/control-center/projects/projects.json` (this repo: `plumber`).
- CLI prints the new error id; resolve/dismiss later with `--resolve <id>` / `--dismiss <id>`.
- The file is append-only. Never edit past lines.
- UI: from `~/code/control-center`, `preview_start error-log` → http://localhost:4330.

Full reference: `~/code/control-center/CLAUDE.md` and `STRUCTURE.md`.
