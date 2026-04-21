@ROADMAP.md

## Start Here
- **Strategy:** Read `docs/plans/STRATEGY-BRIEF.md` first — it defines the three active tracks, what's shipped, and what's next.
- **Cross-project status and session logs:** Live in `~/code/control-center/`, not here.
- **Archived plans:** `docs/plans/archive/` — superseded by the strategy brief.

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

Separately, two GitHub Actions workflows run daily and push JSON updates back to the repo, which triggers a fresh Vercel rebuild:
- **`daily-scrape.yml`** (6 AM Central) — GSC expansion → Places scrape → Firestore upload → review refresh → Claude synthesis → commit → Vercel rebuild
- **`deep-review-pull.yml`** (7 AM Central) — BBB lookup → Outscraper multi-source reviews (Google + Yelp + Angi) → Claude synthesis → JSON export → commit → Vercel rebuild

See ROADMAP.md → "Automated Pipeline Architecture" for the full flow and tier thresholds.

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

## Publishing vs. scoring (Phase 1 stabilization, 2026-04-20)

**`score-plumbers.ts` MUST NEVER block publishing.** In both `daily-scrape.yml`
and `deep-review-pull.yml`, the order is fixed: export → commit → request
indexing → **then** score. If you modify either workflow, ensure export
runs before scoring. `score-plumbers.ts` has a 30-minute per-step timeout and
`continue-on-error: true`; it is allowed to cancel. The export step is not
`continue-on-error` — if publishing fails, the workflow fails visibly.

Scoring is best-effort and asynchronous. Any scoring-only Firestore writes
that happen after the daily commit are exported to JSON by the next
`rebuild-json.yml` run (every 6 hours).

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
- [ ] Confirm the 6-hour safety rebuild GitHub Action (`rebuild-json.yml`) is still scheduled and its last 5 runs succeeded
- [ ] Confirm every Firestore-mutating workflow still ends with a rebuild step
- [ ] Spot-check 3 random plumbers: BBB fields, Yelp rating, and deep review data all present in JSON
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
