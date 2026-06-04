/**
 * One-off setup for exp-003 (SERP title/description CTR test).
 *
 * Pulls trailing-30d GSC data by page, keeps city pages
 * (/emergency-plumbers/{state}/{city}) with >= MIN_IMPRESSIONS impressions, and
 * writes the eligible-slug snapshot to data/experiments/exp-003-eligible-slugs.json.
 *
 * Committing the snapshot makes hash-bucket assignment stable & reproducible —
 * the experiment population is frozen at setup time, not recomputed on every build.
 *
 * Usage: npx tsx scripts/experiments/build-exp003-slugs.ts [--min N] [--dry-run]
 */
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { SITE_ORIGIN_WITH_WWW } from "../../src/config/plumbing-routes";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const APP_ROOT = path.join(__dirname, "..", "..");
const SA_PATH = path.join(APP_ROOT, "service-account.json");
const ENV_PATH = path.join(APP_ROOT, ".env.local");
const OUT_PATH = path.join(APP_ROOT, "data", "experiments", "exp-003-eligible-slugs.json");

const argv = process.argv.slice(2);
const MIN_IMPRESSIONS = argv.includes("--min") ? Number(argv[argv.indexOf("--min") + 1]) : 5;
const DRY_RUN = argv.includes("--dry-run");

// exp-003 round 1 arms. Round 2 will swap in "pain"/"speed" against the winner.
const ARMS = ["control", "urgency", "social_proof"] as const;

// A page belongs to at most one experiment. Exclude slugs already governed by an
// active experiment (exp-001 nearby-cities, exp-002 aberdeen title) so exp-003
// doesn't double-govern them — notably maryland/aberdeen, which exp-002 owns
// until 2026-06-20.
const EXCLUDE = new Set<string>([
  "texas/garland", "texas/mckinney", "texas/denton", "texas/round-rock", "texas/league-city",
  "texas/irving", "texas/mesquite", "texas/carrollton", "texas/richardson", "texas/grand-prairie",
  "maryland/aberdeen",
]);

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  loadEnv();
  if (!fs.existsSync(SA_PATH)) throw new Error(`service-account.json not found at ${SA_PATH}`);

  const credentials = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const siteUrl = process.env.GSC_SITE_URL || `${SITE_ORIGIN_WITH_WWW}/`;

  // Trailing 30d ending 3 days ago (GSC settles with ~2-3d lag).
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 30);

  console.log(`[exp-003] GSC ${siteUrl}  ${ymd(start)} → ${ymd(end)}  (min impressions ${MIN_IMPRESSIONS})`);

  const resp = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: ymd(start),
      endDate: ymd(end),
      dimensions: ["page"],
      rowLimit: 25000,
      type: "web",
    },
  });

  const rows = resp.data.rows || [];
  console.log(`[exp-003] GSC returned ${rows.length} page rows`);

  // Keep only city pages: /emergency-plumbers/{state}/{city} (exactly 2 segments).
  const cityRe = /\/emergency-plumbers\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/;
  const eligible: { slug: string; impressions: number; clicks: number; position: number }[] = [];
  for (const r of rows) {
    const url = r.keys?.[0] || "";
    const m = url.match(cityRe);
    if (!m) continue;
    const slug = `${m[1]}/${m[2]}`;
    if (EXCLUDE.has(slug)) continue;
    const impressions = r.impressions || 0;
    if (impressions < MIN_IMPRESSIONS) continue;
    eligible.push({
      slug: `${m[1]}/${m[2]}`,
      impressions,
      clicks: r.clicks || 0,
      position: Math.round((r.position || 0) * 10) / 10,
    });
  }
  eligible.sort((a, b) => b.impressions - a.impressions);

  // Distribution of ALL city pages (before the min filter) — helps size the experiment.
  const allCity = rows
    .map((r) => ({ url: r.keys?.[0] || "", impr: r.impressions || 0 }))
    .filter((r) => cityRe.test(r.url));
  for (const th of [1, 5, 10, 20, 30, 50, 100]) {
    console.log(`[exp-003] city pages with >=${th} impr/30d: ${allCity.filter((r) => r.impr >= th).length}`);
  }

  // Stratified assignment: walk pages high→low impressions, assign each to the
  // arm with the LEAST cumulative impressions so far. This balances total
  // impressions across arms despite heavy concentration (Nashville/Aberdeen land
  // in different arms) — far better than pure hash bucketing at this scale.
  const armImpr: Record<string, number> = Object.fromEntries(ARMS.map((a) => [a, 0]));
  const armCount: Record<string, number> = Object.fromEntries(ARMS.map((a) => [a, 0]));
  const assignment: Record<string, string> = {};
  for (const e of eligible) {
    const arm = ARMS.reduce((min, a) => (armImpr[a] < armImpr[min] ? a : min), ARMS[0]);
    assignment[e.slug] = arm;
    armImpr[arm] += e.impressions;
    armCount[arm] += 1;
  }

  const snapshot = {
    experiment: "exp-003-serp-ctr-structure",
    builtAt: new Date().toISOString(),
    window: { startDate: ymd(start), endDate: ymd(end) },
    minImpressions: MIN_IMPRESSIONS,
    arms: ARMS,
    count: eligible.length,
    armSummary: Object.fromEntries(ARMS.map((a) => [a, { pages: armCount[a], impressions30d: armImpr[a] }])),
    assignment, // slug → arm
    detail: eligible.map((e) => ({ ...e, arm: assignment[e.slug] })),
  };

  console.log(`[exp-003] eligible city pages: ${eligible.length}`);
  console.log(`[exp-003] arm balance:`, ARMS.map((a) => `${a}=${armCount[a]}pg/${armImpr[a]}impr`).join("  "));
  console.log(`[exp-003] top 8:`, eligible.slice(0, 8).map((e) => `${e.slug}(${e.impressions}→${assignment[e.slug]})`).join(", "));

  if (DRY_RUN) {
    console.log("[exp-003] --dry-run: not writing snapshot");
    return;
  }
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`[exp-003] wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error("[exp-003] FATAL:", e?.message || e);
  process.exit(1);
});
