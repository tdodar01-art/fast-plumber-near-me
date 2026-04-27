# Synthesis Pipeline — Current State

**Last verified:** 2026-04-27 (against `main` at the time of this doc)
**Authoritative source for "what runs in production today."**

If you're reading this to debug or modify the synthesis pipeline, **start here, not in [unified-pipeline-spec.md](./unified-pipeline-spec.md)** — that doc was the proposal; this is what actually shipped (commit `71c38a6`, Apr 16 2026).

---

## TL;DR

There is **one synthesis writer**: `score-plumbers.ts` (Sonnet). The Haiku synthesis path inside `outscraper-reviews.js` is dead code — the workflow always passes `--skip-synthesis` to it. `synthesize-reviews.ts` is also dead. See "Dead code list" below before you touch anything.

---

## Triggers

```
06:00 CT  daily-scrape.yml       scrape new cities + refresh existing
07:00 CT  deep-review-pull.yml   Outscraper review pull for top GSC cities (max 3/day)
*/6h      rebuild-json.yml       safety-net re-export Firestore → JSON
```

## Step order — daily-scrape.yml

```
gsc-expansion.js              tag cities with gscTier from GSC impressions
gsc-prepend-queue.js          geocode new cities, prepend to scrape queue
daily-scrape.js               Google Places: text-search → details → write staging JSON
upload-to-firestore.js        upsert plumber docs (first writer for new plumbers)
refresh-reviews.ts            pull new Google reviews for ≤20 plumbers; recompute reliabilityScore
export-firestore-to-json.js   write derived JSON  ← MUST RUN BEFORE SCORING
generate-city-coverage.js     recompute CITY_COVERAGE radius map
git commit + push             triggers Vercel rebuild
request-indexing.js           ping Google indexing API
score-plumbers.ts --pass all  Sonnet rescoring (LAST, async, continue-on-error)
```

## Step order — deep-review-pull.yml

```
find-deep-review-cities.js    pick 3 medium/high gscTier cities not recently deep-pulled
bbb-lookup.js                 BBB API + scrape per plumber
outscraper-reviews.js         pull Google + Yelp + Angi reviews (review-pull only — no synthesis)
export-firestore-to-json.js   publish (must run before scoring)
request-indexing.js           re-index ALL serviceCities of updated plumbers
score-plumbers.ts --pass all  Sonnet synthesis + scoring (last)
```

---

## Live writers to `plumbers/{placeId}`

Five scripts touch plumber docs in production. Only one writes synthesis.

| Writer | When | Owns |
|---|---|---|
| `upload-to-firestore.js` | First time a plumber is scraped | placeId, name, phone, website, address, location, googleRating, googleReviewCount, reliabilityScore (init), verificationStatus, serviceCities[] |
| `refresh-reviews.ts` | Daily (≤20/run) | googleRating, googleReviewCount, **reliabilityScore (recomputed from heuristic)**, lastReviewRefreshAt; appends to reviews subcollection |
| `bbb-lookup.js` | Deep-review workflow | `bbb{}` (rating, accredited, complaintsPast3Years, yearsInBusiness) |
| `outscraper-reviews.js` (review-pull only) | Deep-review workflow | reviews subcollection (Google deep + Yelp + Angi); top-level `yelpRating`, `yelpReviewCount` |
| `score-plumbers.ts` (Sonnet, max_tokens=4096) | LAST step of both workflows | `scores{}`, `evidence_quotes[]`, `decision{}`, `city_rank{}`, and the entire `reviewSynthesis.*` namespace: summary, strengths, weaknesses, redFlags, badges, emergencyReadiness, emergencyNotes, emergencySignals, pricingTier, bestFor, platformDiscrepancy, reviewCount, servicesMentioned (when non-empty), synthesisVersion="unified-sonnet-v2" |

No two live writers compete for the same field. The conflict map from the previous draft of this blueprint was wrong — it described the pre-consolidation state.

---

## What `score-plumbers.ts` does NOT write

These were on the old Haiku schema but are **not in the current Sonnet pipeline**:

- `topQuote` — the hero positive pull-quote. UI consumer at [plumber/[slug]/page.tsx:526](../../apps/plumbers-web/src/app/plumber/[slug]/page.tsx:526) is gated by `{s?.topQuote && ...}` so the card just doesn't render.
- `worstQuote` — same. UI at line 527 gated the same way.

These are not bugs; they are design omissions. If you want them, add to `score-plumbers.ts`'s prompt schema, not `outscraper-reviews.js`.

---

## Where the displayed score comes from

The `synthesis.score` shown on plumber cards is **NOT** from `score-plumbers.ts`'s rich `scores{}` object (5 dimensions: reliability, pricing_fairness, workmanship, responsiveness, communication).

It's from `reliabilityScore`, computed by `refresh-reviews.ts:360-375` using a hand-coded heuristic:

```
+20 phone present
+10 website present
+20 googleRating ≥ 4.0  (or +10 for 3.0–3.9)
+20 ≥10 cached reviews   (or +10 for 5–9)
+15 zero red flags
+15 refreshed in last 60 days
```

`export-firestore-to-json.js:451` reads `fd.reliabilityScore` directly. The Sonnet `scores{}` object is written but never projected into the JSON. It is not visible to the user.

---

## Dead code cleanup (completed 2026-04-27)

The following were deleted in this cleanup pass to prevent future confusion:

| File | What it was | Why removed |
|---|---|---|
| `scripts/synthesize-reviews.ts` | Old standalone Haiku synthesis script | Not referenced by any live workflow. Replaced by `score-plumbers.ts`. |
| `scripts/synthesize-reviews.js` | JS predecessor of the above | Same. |
| `scripts/daily-scrape-workflow-v2.yml` | Draft workflow file misplaced in `scripts/` (not in `.github/workflows/`) | Never picked up by GitHub Actions. The only thing that referenced `synthesize-reviews.ts`. |
| `outscraper-reviews.js` synthesis block (`buildPrompt`, `callClaude`, `parseAIResponse`, `synthesizePlumber`) | Haiku synthesis path inside the Outscraper script | Workflow always passed `--skip-synthesis`, so this block never ran in production. |
| `--skip-synthesis` flag in `deep-review-pull.yml` and `outscraper-reviews.js` | Flag that bypassed the now-deleted synthesis block | No longer needed. |

`scripts/resynthesize-emergency.js` was kept — it was a manual one-shot backfill (last run 2026-04-07 per ROADMAP) and may be useful again. Not on any workflow.

**Lesson learned:** before claiming "this script does X in production," `grep` it against `.github/workflows/` and check the flags being passed.

---

## Synthesis version coexistence

Three values of `synthesisVersion` exist in Firestore:

- `"keyword-fallback"` — old plumbers from deprecated `synthesize-reviews.ts`
- `"ai-v2-services"` — Outscraper Haiku output (only present on plumbers from before consolidation)
- `"unified-sonnet-v2"` — current `score-plumbers.ts` Sonnet output

Any plumber with the first two values is on stale synthesis until `score-plumbers.ts --pass all` runs over them. There's no auto-migration; the field updates whenever score-plumbers next touches that plumber.

---

## How to safely modify synthesis

1. Open `scripts/score-plumbers.ts`. That's the only live synthesis writer.
2. Find the prompt at the `buildSynthesisPrompt` (or equivalent — search "Unified synthesis" comment near line 575).
3. Edit the schema there. Add corresponding field write in the `updateData` object near line 1045.
4. If adding a field the website should display, also update `export-firestore-to-json.js:buildSynthesis()` at line 446 to project it through.
5. Backfill by running `npx tsx scripts/score-plumbers.ts --pass all` (or scope with city flags — see `--help`).

Do **not** edit `outscraper-reviews.js`, `synthesize-reviews.ts`, or `synthesize-reviews.js` to change live synthesis behavior. Those don't run.
