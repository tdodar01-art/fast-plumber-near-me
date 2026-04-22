# Phase 2 Check-in — 2026-04-27 (Monday)

Status doc for the "Run Phase 2 — score-plumbers optimization" calendar event.
Pick up here. All context you need is in this file + the links below.

## TL;DR

Phase 2 may already be ~done. Don't build it blind — look at Apr 22–26 workflow
runs first. If they're green and under the soft budgets below, close out the
queue and move on. If not, the remaining levers are documented at the bottom.

## Background (how we got here)

The daily pipeline has one expensive step, `score-plumbers.ts` (Sonnet scoring
+ synthesis for ~712 plumbers). Until Apr 20, scoring ran BEFORE
export/commit/indexing in both daily workflows. When scoring hit its 30-min
per-step cap, the workflow cancelled and the live site missed its daily
update.

Two-phase fix was planned:

- **Phase 1 (shipped 2026-04-20, commit `1471802`)** — reorder both workflows
  so export → commit → indexing run BEFORE `score-plumbers.ts`. Scoring is now
  best-effort and async. If it times out, today's publish is still committed,
  and `rebuild-json.yml` (every 6h) picks up any scoring-only Firestore writes.

- **Phase 2 (planned — this check-in)** — fix the scoring runtime itself. The
  original queue/today.md listed two items:
  1. Add `--max N` to `score-plumbers.ts`
  2. Reduce rescore trigger sensitivity (raise the 20% review-delta threshold)

## What landed 2026-04-21 (commit `f7157da`)

Most of Phase 2 actually shipped a day early under a different framing:

1. **Ordered iteration** — `loadPlumbers()` now sorts client-side: unscored
   first, then by `scores.last_scored_at` ascending. Drains the stale tail
   monotonically across days instead of re-examining the same prefix.
2. **`REVIEW_CAP = 75`** — sort reviews by `publishedAt` desc, feed Claude the
   top 75. Recency weighting already discounts >24mo reviews to 0.25×, so this
   is near-free. Collapses the 200+ review bucket from 14+ batches to 3.
3. **`REVIEWS_PER_BATCH` 15 → 30** — halves call count on heavy plumbers.
4. **`RATE_LIMIT_MS` 2000 → 500** — the 2s default was safety-mode, not
   optimum. `callClaude` already handles 429s via retry-after.
5. **`review_count_used` override** — writes TOTAL review count (not capped),
   so the 20%-delta skip check stays apples-to-apples as caches grow.
6. **`last_scored_at` stamped on fallback paths** — keyword-fallback and
   no-reviews plumbers now write `last_scored_at` + `scores.method` marker
   (`"sonnet" | "keyword_fallback" | "no_reviews"`). Previously these ~18+
   docs looked unscored to the cursor forever.

## Observed run data (as of 2026-04-22 AM)

Confirming `f7157da` did what it was supposed to:

**daily-scrape.yml** (45-min timeout, historical median ~6 min):
- Apr 18: ✅ 11 min
- Apr 19: ✅ 9 min
- Apr 20: ❌ cancelled at 45 min (scoring stuck)
- Apr 21: ✅ 34 min (first run after `f7157da`)
- Apr 22: ✅ 34 min

**deep-review-pull.yml** (120-min timeout, historical median ~1 min when
cities skipped):
- Apr 18: ❌ cancelled 31 min
- Apr 19: ❌ cancelled 120 min
- Apr 20: ❌ cancelled 120 min
- Apr 21: ✅ 80 min (first green in a week)
- Apr 22: was in-progress at time of writing

So both workflows are back to green but running hotter than pre-Apr-20
baselines. Question for Monday: is that the new normal or still decaying?

## What to do Monday (2026-04-27)

### Step 1 — Look at 5 days of run data

```
gh run list --workflow=daily-scrape.yml --limit 7 --json \
  databaseId,conclusion,createdAt,updatedAt,status
gh run list --workflow=deep-review-pull.yml --limit 7 --json \
  databaseId,conclusion,createdAt,updatedAt,status
```

Compute durations (`updatedAt - createdAt`). Soft budgets to compare against:

| Workflow | Timeout | Target | Trigger action if over |
|---|---|---|---|
| daily-scrape | 45 min | <25 min | >35 min two days running |
| deep-review | 120 min | <90 min | >100 min two days running, or any cancel |

### Step 2 — Decide which branch you're on

**Branch A: All green, under targets.** Phase 2 is effectively done.
- Update `queue/today.md` to mark Phase 2 shipped, reference this doc and
  commit `f7157da`.
- Optional cheap insurance: wire the existing `--limit N` flag (already in
  `score-plumbers.ts:137`) into `daily-scrape.yml` as an explicit safety
  ceiling (e.g. `--limit 500`). Never trips under normal operation. Prevents
  a future review-cache blowup from running the step past 30 min.
- Close the loop. Move on.

**Branch B: Still slow / cancelling.** Open up the remaining Phase 2 levers:

1. **Raise the review-delta rescore threshold.** `score-plumbers.ts:903`
   currently rescores any plumber whose review count changed ≥20%. Moving
   this to 30–40% cuts the "already scored but slightly grew" rescore class.
   Safe — the 30-day `SKIP_IF_SCORED_WITHIN_MS` timer still forces a floor.

2. **Wire `--limit N` as a hard cap.** Different from Branch A's insurance —
   here you're using it to deliberately defer work. Pair with ordered
   iteration (already in place) so each day drains the oldest N.

3. **Split scoring into its own workflow.** Already allowed-for by the
   Phase 1 reordering — nothing in daily-scrape or deep-review depends on
   scoring completing. A dedicated `score-plumbers.yml` on its own cron
   with its own 60-min or 120-min timeout removes the coupling entirely.
   Biggest lift of the three; consider only if 1 + 2 aren't enough.

4. **Skip `--pass 2/3` on deep-review.** Passes 2 (city rank) and 3
   (decision) don't change when a single city's plumbers get new reviews,
   only pass 1 does. Running `--pass 1` from deep-review-pull and leaving
   `--pass 2,3` to daily-scrape would halve the scoring work in the
   deep-review workflow.

## Key file references

- `apps/plumbers-web/scripts/score-plumbers.ts` — scoring pipeline
  - Line 126–146: CLI arg parsing (`--limit N` exists, not used in workflows)
  - Line 890–914: 20% review-delta skip check
  - Line 916–925: `REVIEW_CAP` logic
- `.github/workflows/daily-scrape.yml` — daily scrape workflow
- `.github/workflows/deep-review-pull.yml` — deep review workflow
- `.github/workflows/rebuild-json.yml` — 6-hour safety net
- `apps/plumbers-web/docs/pipeline-audit-2026-04-20.md` — full pipeline audit
  (the input to Phase 1)
- `queue/today.md` — original Phase 2 note

## Key commits

- `1471802` (2026-04-20) — Phase 1: publish before score
- `f7157da` (2026-04-21) — Phase 2 runtime fixes (ordered iteration, review
  cap, batch size, pacing, fallback stamping)

## Invariants (do not violate)

From CLAUDE.md "Publishing vs. scoring":

- `score-plumbers.ts` MUST NEVER block publishing. The order is fixed: export
  → commit → request indexing → THEN score.
- The export step is not `continue-on-error`. If publishing fails, the
  workflow fails visibly.
- Scoring is best-effort with 30-min per-step timeout and
  `continue-on-error: true`. It is allowed to cancel.
- Any scoring-only Firestore writes that land after the daily commit are
  exported by the next `rebuild-json.yml` run.

If a Phase 2 change tempts you to reorder scoring above publishing, stop.
