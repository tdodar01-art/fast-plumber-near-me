# Diagnosis: Marble Falls showing 0 plumbers

*Task: fpnm-001 | Date: 2026-04-09 | Migrated to real repo: 2026-04-10*

> **Migration note:** Original investigation was performed in a stale iCloud clone at `~/Desktop/My Apps/Directory Website/Fast Plumber Near Me`. That clone had `page.tsx` and `loading.tsx` staged for deletion in its working tree, which led to a misdiagnosis. This document reflects the **corrected** analysis after verifying state in the real repo at `~/code/directory-sites/fastplumbernearme.com`.

---

## Symptom

Marble Falls city page at `/emergency-plumbers/texas/marble-falls` displays "0 plumbers available" despite the daily activity log reporting 14 new plumbers scraped and uploaded to Firestore.

---

## What the Stale Clone Showed (Phantom Issues)

The original investigation in the iCloud clone reported these as bugs. **None of these are real production issues** — they were artifacts of an out-of-sync working tree:

| "Issue" | Reality |
|---|---|
| `page.tsx` and `loading.tsx` deleted from `[state]/[city]/` | EXISTS in real repo at HEAD — file is 18,625 bytes |
| Marble Falls coordinates missing from `city-coords.ts` | EXISTS in real repo |
| 14 plumbers missing from `plumbers-synthesized.json` | EXISTS in real repo (verified: 14 hits for "Marble" in JSON) |

The iCloud clone had been abandoned and never pulled the daily-scrape commits that landed in the real repo (e.g., `7449825 Daily scrape: +14 plumbers from Marble Falls`).

---

## Real Root Cause (still present in production)

**Marble Falls is missing from `cities-data.ts`** — the curated city registry that the page actually imports from.

| Data source | Has Marble Falls? | Used by city page? |
|---|---|---|
| `cities-generated.ts` | YES (slug: marble-falls, state: TX, county: Burnet) | NO |
| `cities-data.ts` | NO | YES — `getCityData()` and `getAllCityParams()` import from here |
| `city-coords.ts` | YES | YES |
| `plumbers-synthesized.json` | YES (14 plumbers) | YES |
| Firestore | YES | Runtime only |

**What happens on page load:**
1. Next.js looks for the route via `getAllCityParams()` → returns Texas city slugs from `cities-data.ts` → Marble Falls not in list → page is not pre-rendered
2. If accessed directly: `getCityData("texas", "marble-falls")` → `null` → page calls `notFound()` → 404

The 14 plumbers are sitting in the JSON and Firestore with nowhere to render.

---

## Why This Happens (Systemic Issue)

`cities-generated.ts` and `cities-data.ts` are two separate files that have diverged:

- `cities-generated.ts` — output of `scripts/generate-cities-data.mjs`, contains 2250+ cities including Marble Falls
- `cities-data.ts` — curated city registry, contains only ~16 cities per state, used by all the page components

When a new city gets scraped via the GSC expansion pipeline (e.g., Marble Falls), it gets added to:
- ✅ Firestore `cities` collection
- ✅ `cities-generated.ts` (next time the generator runs)
- ✅ `city-coords.ts` (geocoding step)
- ✅ `plumbers-synthesized.json` (export step)
- ❌ NOT `cities-data.ts` — no automated step adds it here

This means **every new city added via GSC expansion is invisible to the page renderer** until someone manually adds it to `cities-data.ts`.

---

## Recommended Fix

Two options, both require Tim's input on direction:

### Option A: Make the page import from `cities-generated.ts` (fastest, may need shape adapter)
Swap the imports in `[state]/[city]/page.tsx` and `[state]/page.tsx`:
```ts
// Before
import { getAllCityParams, getCityData } from "@/lib/cities-data";
// After
import { getAllCityParams, getCityData } from "@/lib/cities-generated";
```
Risk: data shapes may differ — `cities-generated.ts` might not have `getCityData()` or `getAllCityParams()` exported, may need a shim.

### Option B: Add an export step that syncs `cities-data.ts` from Firestore (cleanest long-term)
Create `scripts/sync-cities-data.js` that reads the `cities` Firestore collection and writes a fresh `cities-data.ts`. Wire it into the daily-scrape workflow as the final step. This makes Firestore the single source of truth (consistent with existing data pipeline invariants).

### Option C: One-shot patch for Marble Falls
Manually add Marble Falls to `cities-data.ts` to unblock the immediate page. Doesn't fix the systemic issue, but gets the 14 plumbers showing up TODAY.

**Recommendation:** Option C as an immediate hotfix, then Option B as the durable solution. Option A is risky if the data shapes don't line up.

---

## Status

- [x] Diagnosis written
- [x] Migrated to real repo (`~/code/directory-sites/fastplumbernearme.com`)
- [ ] Fix not applied — requires Tim's decision on Option A/B/C
- [ ] Review item: `~/code/control-center/reviews/2026-04-09-fpnm-001.md` (needs update with corrected analysis)
