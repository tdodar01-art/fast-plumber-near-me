# Diagnosis: Marble Falls showing 0 plumbers

*Task: fpnm-001 | Date: 2026-04-09 | Migrated to real repo: 2026-04-10 | Fixed: 2026-04-10*

> **History:** Original investigation was performed in a stale iCloud clone at `~/Desktop/My Apps/Directory Website/Fast Plumber Near Me`. That clone had `page.tsx` and `loading.tsx` staged for deletion in its working tree, which led to a misdiagnosis. A second-pass diagnosis (the migrated version of this doc) then incorrectly fingered `cities-data.ts` as the missing piece. **This is the third and final pass against the real repo at `~/code/directory-sites/fastplumbernearme.com` (monorepo path: `apps/plumbers-web`).**

---

## Symptom

Marble Falls city page at `/emergency-plumbers/texas/marble-falls` displays "0 plumbers available" despite the daily activity log reporting 14 new plumbers scraped and uploaded to Firestore.

---

## False leads (ruled out)

| Hypothesis | Reality |
|---|---|
| `page.tsx` and `loading.tsx` deleted from `[state]/[city]/` | EXISTS in real repo at HEAD |
| Marble Falls missing from `plumbers-synthesized.json` | EXISTS — 14 plumbers, all with `serviceCities: ["marble-falls"]` and lat/lng around (30.58, -98.24) |
| Marble Falls missing from `cities-data.ts` | EXISTS — `cities-data.ts:511-512` calls `registerGeneratedCities(CITY_DATA)`, and `cities-generated.ts:2011` defines `marble-falls` under TX. So `getCityData("texas","marble-falls")` returns a valid `CityInfo` and the route renders. |

The page renders. The plumber list inside it is what's empty.

---

## Real root cause

**`apps/plumbers-web/src/lib/city-coords.ts` is missing `TX:marble-falls`** (and also `CO:northglenn`).

`city-coords.ts` is a hand-curated map of `"<STATE>:<citySlug>"` → `[lat, lng]`. It is the **only** lookup the build-time fallback path uses to compute distance to plumbers.

### What happens on page load

`apps/plumbers-web/src/app/emergency-plumbers/[state]/[city]/page.tsx` runs two paths in sequence:

**Path A — Firestore (lines 82–122):**
1. `getPlumbersByCity("marble-falls-tx")` then `getPlumbersByCity("marble-falls")`
2. If Firebase isn't configured at build time, the entire `try` block is swallowed by the `catch` and `plumbers` stays `[]`.

**Path B — static JSON fallback (lines 127–129):**
```ts
if (plumbers.length === 0) {
  plumbers = getPlumbersNearCity(city.state, citySlug);
}
```
And in `lib/plumber-data.ts:218`:
```ts
export function getPlumbersNearCity(stateAbbr, citySlug, radius=20) {
  const coord = getCityCoordBySlug(stateAbbr, citySlug);
  if (!coord) return [];   // ← WE EXIT HERE FOR MARBLE FALLS
  ...
}
```

`getCityCoordBySlug("TX","marble-falls")` looks up `COORDS["TX:marble-falls"]`, which doesn't exist, so it returns `null`. The function bails immediately and returns `[]`. The page renders "0 plumbers available."

The 14 plumbers are sitting in the JSON with valid coordinates — the page just has no anchor point to measure from.

---

## Scope (the "and possibly other cities" question)

Scanned `plumbers-synthesized.json` for every unique `serviceCities[]` entry and cross-checked against `city-coords.ts`. Two cities are missing:

| Slug | State | Plumbers in JSON | Approx. center |
|---|---|---|---|
| `marble-falls` | TX | 14 | 30.58, -98.27 |
| `northglenn` | CO | 10 | 39.89, -104.98 |

Both were added by the GSC expansion pipeline (commits `7449825 Daily scrape: +14 plumbers from Marble Falls` and `e683f4d Daily scrape: +16 plumbers from Northglenn`). All other cities in the JSON have an entry in `city-coords.ts`.

**No other cities are affected today.** But the systemic issue (below) means new GSC-discovered cities will keep slipping through unless `gsc-prepend-queue.js` is verified to be running its `city-coords.ts` patch step on every scrape.

---

## Why this slipped through the pipeline

`scripts/gsc-prepend-queue.js` is supposed to geocode every new GSC-discovered city and inject a coord entry into `city-coords.ts` (see `CITY_COORDS_PATH` on line 25 and the `writeFileSync` on line 182). It does the work by finding a `// <StateName>` comment line and inserting a new entry just below.

Two ways this can silently fail:
1. **Section header mismatch.** The script searches for the string `// ${stateName}` in `city-coords.ts`. If a state is missing that exact comment, the script logs a warning and skips — but the pipeline does not fail.
2. **Step skipped entirely.** If the daily-scrape workflow ran the scrape phase but skipped or crashed during `gsc-prepend-queue.js` (e.g., Geocoding API quota exhausted, transient error), the new cities would be in `cities` Firestore + `plumbers-synthesized.json` but not in `city-coords.ts`.

Either way, this is silent: the pipeline reports success and the next morning the city page is empty.

---

## Fix applied

**Immediate (this commit):** added two entries to `apps/plumbers-web/src/lib/city-coords.ts`:

```ts
// Colorado section
"CO:northglenn": [39.89, -104.98],

// Texas section
"TX:marble-falls": [30.58, -98.27],
```

Verified locally with a Haversine simulation: Marble Falls now resolves to 13 plumbers within 20 miles, Northglenn to 31 (its own 10 + nearby Denver/Thornton/Westminster).

**Not in this commit (follow-up backlog):**
- Audit `gsc-prepend-queue.js` to make the `city-coords.ts` patch step **fail loudly** (non-zero exit) when the section header isn't found. Silent skips are how this happened.
- Consider sourcing coords from Firestore `cities` collection instead of a hand-curated TypeScript file. The geocode results already live in Firestore — `city-coords.ts` is just a stale snapshot of that data and a single point of failure for build-time fallback rendering.
- Add a CI assertion: every unique `serviceCities[]` value in `plumbers-synthesized.json` must have a matching entry in `city-coords.ts`. This would have caught both Marble Falls and Northglenn the morning after they were scraped.

---

## Status

- [x] Real root cause identified (third pass)
- [x] Scope confirmed: 2 cities affected (Marble Falls, Northglenn)
- [x] Fix applied to `city-coords.ts`
- [x] Verified locally — 13 / 31 plumbers respectively now resolve within 20 miles
- [ ] Pipeline hardening (loud-fail in `gsc-prepend-queue.js`, CI assertion) — left as backlog item
