/**
 * Mock data for today's 6 AM daily-scrape.yml run.
 *
 * Mirrors the seven steps that survived the 2026-04-23 automation pivot
 * (GSC expansion → prepend → Places intake → Firestore upload → JSON
 * rebuild → coverage regen → commit & push). Every value here is
 * FABRICATED — there is no `daily-result-2026-04-24.json` in this
 * worktree yet. Phase 2 replaces this module with a live reader over
 * `apps/plumbers-web/data/logs/daily-result-*.json` + GitHub Actions
 * run metadata.
 */

import type { CronStep, DailyCronRun } from "./types";

export const IS_MOCK = true;

export const todayCronRun: DailyCronRun = {
  date: "2026-04-24",
  startedAt: "2026-04-24T11:00:00.000Z",
  durationSeconds: 412,
  commitSha: "a7f4c21",
  commitMessage:
    "Daily scrape: +28 plumbers from Lake Zurich, Barrington, Fox River Grove",
  steps: [
    {
      id: "gsc-expansion",
      name: "GSC Expansion Check",
      status: "success",
      summary:
        "3 new cities discovered with impressions in the last 90 days.",
      detail: "Lake Zurich (64), Barrington (41), Fox River Grove (12)",
      startedAt: "2026-04-24T11:00:02.000Z",
      durationSeconds: 31,
      blocks: [
        {
          kind: "paragraph",
          text:
            "Pulled 90-day query data from GSC for fastplumbernearme.com. Any city with ≥1 impression that isn't already in the plumbers collection gets a stub city doc with its gscTier recomputed. Three cities crossed the threshold this run.",
        },
        {
          kind: "table",
          columns: ["City", "State", "Impressions", "Clicks", "Tier"],
          rows: [
            ["Lake Zurich", "IL", "64", "3", "high"],
            ["Barrington", "IL", "41", "1", "medium"],
            ["Fox River Grove", "IL", "12", "0", "medium"],
          ],
        },
        {
          kind: "facts",
          rows: [
            { label: "Script", value: "scripts/gsc-expansion.js" },
            { label: "API", value: "Google Search Console (free)" },
            { label: "Firestore writes", value: "3 city stubs created" },
            { label: "Queue output", value: "data/gsc-expansion-queue.json" },
          ],
        },
      ],
    },
    {
      id: "gsc-prepend",
      name: "Prepend GSC Cities",
      status: "success",
      summary: "3 cities geocoded and queued for scrape.",
      detail: "Resolved via kelvins CSV (2) and OSM/Nominatim (1).",
      startedAt: "2026-04-24T11:00:33.000Z",
      durationSeconds: 8,
      blocks: [
        {
          kind: "paragraph",
          text:
            "Runs the 3-phase coord resolver on every queued city, updates city-coords-cache.json, then re-invokes generate-cities-data.mjs so cities-generated.ts + city-coords.ts stay in sync. Exits non-zero if any city still has no coord — no city got dropped this run.",
        },
        {
          kind: "table",
          columns: ["City", "Source", "Lat", "Lng"],
          rows: [
            ["Lake Zurich, IL", "kelvins CSV", "42.1970", "-88.0934"],
            ["Barrington, IL", "kelvins CSV", "42.1536", "-88.1358"],
            ["Fox River Grove, IL", "OSM/Nominatim", "42.1986", "-88.2150"],
          ],
        },
        {
          kind: "facts",
          rows: [
            { label: "Script", value: "scripts/gsc-prepend-queue.js" },
            { label: "Google Geocoding fallbacks", value: "0 (no paid calls)" },
            {
              label: "scrape-queue.json",
              value: "3 cities prepended to front of queue",
            },
          ],
        },
      ],
    },
    {
      id: "daily-scrape",
      name: "Run Daily Scrape",
      status: "success",
      summary: "28 new plumbers scraped across 3 cities.",
      detail: "Places API spend: $3.14 of $200 monthly cap.",
      startedAt: "2026-04-24T11:00:41.000Z",
      durationSeconds: 214,
      blocks: [
        {
          kind: "paragraph",
          text:
            "Google Places (New) textSearch for each queued city. Thin-city retry kicked in for Fox River Grove (first query returned 3; variant queries brought it to 7). Results are written to data/raw/plumbers-latest.json for the next step.",
        },
        {
          kind: "table",
          columns: [
            "City",
            "Primary",
            "Retry",
            "Deduped",
            "New",
            "API calls",
          ],
          rows: [
            ["Lake Zurich", "12", "—", "0", "12", "14"],
            ["Barrington", "9", "—", "0", "9", "11"],
            ["Fox River Grove", "3", "+4", "0", "7", "18"],
          ],
        },
        {
          kind: "facts",
          rows: [
            { label: "Script", value: "scripts/daily-scrape.js" },
            {
              label: "Budget guard",
              value: "$3.14 spent · $196.86 remaining (1.57% of cap)",
            },
            { label: "THIN_THRESHOLD", value: "5 (Fox River Grove retried)" },
            {
              label: "Staging artifact",
              value: "data/raw/plumbers-latest.json",
            },
          ],
        },
      ],
    },
    {
      id: "upload-firestore",
      name: "Upload to Firestore",
      status: "success",
      summary: "28 plumbers upserted. 0 duplicates.",
      startedAt: "2026-04-24T11:04:15.000Z",
      durationSeconds: 36,
      blocks: [
        {
          kind: "paragraph",
          text:
            "Writes to the plumbers collection keyed by placeId. Existing docs get their serviceCities array extended if the city slug isn't already there; new docs get full records including cached Google reviews.",
        },
        {
          kind: "facts",
          rows: [
            { label: "Script", value: "scripts/upload-to-firestore.js" },
            { label: "New documents", value: "28" },
            { label: "Updated documents", value: "0" },
            { label: "Duplicates skipped", value: "0" },
            {
              label: "Collection totals",
              value: "420 plumbers · 40 cities",
            },
          ],
        },
      ],
    },
    {
      id: "rebuild-json",
      name: "Rebuild JSON from Firestore",
      status: "success",
      summary: "plumbers-synthesized.json + leaderboard.json regenerated.",
      detail: "420 plumber rows · 40 cities covered.",
      startedAt: "2026-04-24T11:04:51.000Z",
      durationSeconds: 52,
      blocks: [
        {
          kind: "paragraph",
          text:
            "Sole writer to data/synthesized/plumbers-synthesized.json (CLAUDE.md invariant). Pulls the full plumbers collection, merges enrichment (BBB, Yelp, Angi, synthesis) from Firestore, and rewrites the JSON artifacts the website reads at build time.",
        },
        {
          kind: "facts",
          rows: [
            {
              label: "Script",
              value: "scripts/export-firestore-to-json.js --no-push",
            },
            { label: "Plumber rows", value: "420 (+28)" },
            { label: "Cities covered", value: "40 (+3)" },
            { label: "plumbers-synthesized.json", value: "1.87 MB" },
            { label: "leaderboard.json", value: "91 KB" },
          ],
        },
      ],
    },
    {
      id: "city-coverage",
      name: "Regenerate City Coverage",
      status: "success",
      summary: "Sitemap coverage map rebuilt. +3 cities now indexable.",
      startedAt: "2026-04-24T11:05:43.000Z",
      durationSeconds: 9,
      blocks: [
        {
          kind: "paragraph",
          text:
            "Rebuilds src/lib/city-coverage.ts so Next.js knows which city × service combinations should appear in the sitemap. Depends on the freshly-rebuilt plumbers-synthesized.json + city-coords.ts.",
        },
        {
          kind: "facts",
          rows: [
            { label: "Script", value: "scripts/generate-city-coverage.js" },
            { label: "Cities added", value: "3" },
            {
              label: "New indexable URLs",
              value: "15 (3 cities × 5 service slugs)",
            },
          ],
        },
      ],
    },
    {
      id: "commit-push",
      name: "Commit & Push",
      status: "success",
      summary: "Pushed to main — Vercel rebuild triggered.",
      startedAt: "2026-04-24T11:05:52.000Z",
      durationSeconds: 62,
      blocks: [
        {
          kind: "paragraph",
          text:
            "Single commit with scrape queue, city coords, cities registry, coverage map, GSC queue, and rebuilt JSON. Push triggers Vercel auto-deploy for the plumbers-web app.",
        },
        {
          kind: "facts",
          rows: [
            { label: "Commit SHA", value: "a7f4c21" },
            {
              label: "Message",
              value:
                "Daily scrape: +28 plumbers from Lake Zurich, Barrington, Fox River Grove",
            },
            { label: "Files changed", value: "7" },
            { label: "Vercel deploy", value: "queued (ETA ~3 min)" },
          ],
        },
        {
          kind: "list",
          label: "Files in this commit",
          items: [
            "apps/plumbers-web/data/synthesized/plumbers-synthesized.json",
            "apps/plumbers-web/data/synthesized/leaderboard.json",
            "apps/plumbers-web/data/raw/plumbers-latest.json",
            "apps/plumbers-web/scripts/scrape-queue.json",
            "apps/plumbers-web/data/gsc-expansion-queue.json",
            "apps/plumbers-web/src/lib/city-coords.ts",
            "apps/plumbers-web/src/lib/cities-generated.ts",
            "apps/plumbers-web/src/lib/city-coverage.ts",
          ],
        },
      ],
    },
  ],
};

export function getCronStepById(id: string): CronStep | undefined {
  return todayCronRun.steps.find((s) => s.id === id);
}
