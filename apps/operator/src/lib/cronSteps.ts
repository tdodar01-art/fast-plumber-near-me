/**
 * Static catalog of the 7 surviving daily-scrape.yml steps.
 *
 * Client-safe (no Node APIs, no fetch). Used by:
 * - TopNav to resolve breadcrumb labels from stepId
 * - dailyCronReader to map GitHub Actions step names → our stepId
 * - generateStaticParams in the detail page
 *
 * Keep this in sync with `.github/workflows/daily-scrape.yml` on main.
 */

export interface CronStepDef {
  id: string;
  name: string;
  /** Substrings that match this step's `name` field in the GitHub jobs API. */
  ghStepMatchers: string[];
  /** One-line description rendered as the first paragraph on the detail page. */
  description: string;
}

export const CRON_STEPS: readonly CronStepDef[] = [
  {
    id: "gsc-expansion",
    name: "GSC Expansion Check",
    ghStepMatchers: ["GSC Expansion"],
    description:
      "Pulls 90-day query data from Google Search Console for fastplumbernearme.com. Any city with ≥1 impression that isn't already in the plumbers collection gets a stub city doc with its gscTier recomputed (high 50+, medium 10–49, low 1–9).",
  },
  {
    id: "gsc-prepend",
    name: "Prepend GSC Cities",
    ghStepMatchers: ["Prepend GSC", "Prepend GSC cities"],
    description:
      "Runs the 3-phase coord resolver (kelvins CSV → OSM/Nominatim → Google Geocoding) on every queued city, updates city-coords-cache.json, then re-invokes generate-cities-data.mjs so cities-generated.ts + city-coords.ts stay in sync. Exits non-zero if any city still has no coord.",
  },
  {
    id: "daily-scrape",
    name: "Run Daily Scrape",
    ghStepMatchers: ["Run daily scrape", "daily scrape (expansion)"],
    description:
      "Google Places (New) textSearch for each queued city. Thin-city retry variants kick in below the 5-plumber threshold. Results are written to data/raw/plumbers-latest.json for the upload step.",
  },
  {
    id: "upload-firestore",
    name: "Upload to Firestore",
    ghStepMatchers: ["Upload to Firestore"],
    description:
      "Writes to the plumbers collection keyed by placeId. Existing docs get their serviceCities array extended if the city slug isn't already there; new docs get full records including cached Google reviews.",
  },
  {
    id: "rebuild-json",
    name: "Rebuild JSON from Firestore",
    ghStepMatchers: ["Rebuild JSON", "Rebuild JSON from Firestore"],
    description:
      "Sole writer to data/synthesized/plumbers-synthesized.json (CLAUDE.md invariant). Pulls the full plumbers collection, merges enrichment from Firestore, and rewrites the JSON artifacts the website reads at build time.",
  },
  {
    id: "city-coverage",
    name: "Regenerate City Coverage",
    ghStepMatchers: ["Regenerate city coverage"],
    description:
      "Rebuilds src/lib/city-coverage.ts so Next.js knows which city × service combinations should appear in the sitemap. Depends on the freshly-rebuilt plumbers-synthesized.json + city-coords.ts.",
  },
  {
    id: "commit-push",
    name: "Commit & Push",
    ghStepMatchers: ["Commit and push", "Commit & push"],
    description:
      "Single commit with scrape queue, city coords, cities registry, coverage map, GSC queue, and rebuilt JSON. Push triggers Vercel auto-deploy for the plumbers-web app.",
  },
] as const;

export function getStepDefById(id: string): CronStepDef | undefined {
  return CRON_STEPS.find((s) => s.id === id);
}

export function getStepIdByGhName(ghStepName: string): string | undefined {
  const match = CRON_STEPS.find((s) =>
    s.ghStepMatchers.some((m) =>
      ghStepName.toLowerCase().includes(m.toLowerCase()),
    ),
  );
  return match?.id;
}
