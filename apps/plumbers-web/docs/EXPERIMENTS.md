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
