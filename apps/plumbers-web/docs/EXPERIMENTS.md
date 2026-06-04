# Experiments — Fast Plumber Near Me

## How experiments work in this repo

This repo is the **body** in the brain/body experiments architecture. It:
1. Defines which experiments are active and which slugs are test vs control (`src/lib/experiments/activeExperiments.ts`)
2. Renders variants on page templates based on experiment config
3. Publishes daily GSC metrics to Firestore for the brain to judge

The **brain** (control-center repo) owns the experiment ledger, judging logic, and notifications.

## Active experiments

| ID | Hypothesis | Test Slugs | Status |
|----|-----------|------------|--------|
| exp-001-nearby-cities-expansion | More nearby city links → better GSC metrics | garland, mckinney, denton, round-rock, league-city | active |
| exp-002-aberdeen-title-urgency | Urgency-led meta title ("24/7 — Fast, Local & Available Now") beats catalog-style title on GSC CTR | maryland/aberdeen | active (started 2026-04-21, ends 2026-06-20) |
| exp-003-serp-ctr-structure | Title+description **structure** drives CTR controlling for position. 3 arms (control / urgency / social-proof) across 77 trafficked city pages, stratified by impressions. Round 2 adds pain & speed vs winner. | 77-slug snapshot in `data/experiments/exp-003-eligible-slugs.json` | active (started 2026-06-04, ends 2026-07-04; report → tim@aokchemdry.net on 2026-07-07) |

### exp-003 notes
- **Assignment:** frozen, committed snapshot (`data/experiments/exp-003-eligible-slugs.json`),
  stratified greedy-balance by impressions so high-traffic pages (Nashville etc.) spread across arms.
- **Arms / copy:** `src/lib/experiments/serpVariants.ts`. Control = current copy (holdout). Only title + meta
  description vary; OG/canonical/schema held constant.
- **Resolution:** `getSerpArm()` (`serpExperiment.ts`) → `getExperimentMetaTitle` / `getExperimentMetaDescription`
  in the city-page `generateMetadata`.
- **Metrics:** the report pulls the full **settled** GSC window directly at analysis time
  (`dimensions:[page,date]`) — reliable despite GSC's 2-3d lag. The daily
  `publish-experiment-metrics.yml` cron is NOT used (its "yesterday" docs capture unsettled
  zeros); it stays dispatch-only.
- **Analysis + email:** `scripts/experiments/analyze-serp-ctr.js` (position-binned CTR, two-proportion
  z-test) → `exp-003-report.yml` fires it 2026-07-07 (end +3d for GSC lag). For a mid-experiment
  read, run that workflow via `workflow_dispatch` any time.
- **Revert:** delete the exp-003 snapshot or remove its tracked slugs → pages fall back to default copy instantly.

## File map

| File | Purpose |
|------|---------|
| `src/lib/experiments/activeExperiments.ts` | Hardcoded experiment registry — test/control slugs and variant configs |
| `src/lib/experiments/getNearbyCityCount.ts` | Helper to get experiment-determined nearby city count for a slug |
| `src/lib/experiments/expandNearbyCities.ts` | Expands nearby cities list beyond hardcoded data using proximity |
| `src/lib/experiments/publishMetrics.ts` | Pulls GSC data and writes to Firestore |
| `scripts/experiments/publish-metrics-cron.ts` | Entry point for the daily metrics cron |
| `.github/workflows/publish-experiment-metrics.yml` | GitHub Action — runs daily at 7:30 AM CT |

## Pages with experiment support

- `src/app/emergency-plumbers/[state]/[city]/page.tsx` — nearby cities section
- `src/app/[service]/[state]/[city]/page.tsx` — nearby cities section

Both use the same pattern: check `getExperimentNearbyCityCount()`, if in experiment call `getExpandedNearbyCities()`, otherwise render default `city.nearbyCities`.

## Adding a new experiment

1. Add the experiment config to `activeExperiments.ts`
2. Create or modify a helper (like `getNearbyCityCount.ts`) for the specific change
3. Apply variant rendering in the relevant page template(s)
4. Create the experiment .md file in control-center: `pnpm exp:new plumbers <slug>`
5. Commit both repos

## Firestore path

Metrics are written to:
```
experiment_metrics/plumbers/{slug_encoded}/{date}
```

Where `slug_encoded` replaces `/` with `__` (e.g., `texas/garland` → `texas__garland`).

## Environment

- `GSC_SITE_URL` — set in the GitHub Action (`https://www.fastplumbernearme.com/`)
- `FIREBASE_SERVICE_ACCOUNT` — GitHub Secret (same SA used for other Firebase operations)
