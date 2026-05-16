#!/usr/bin/env node

/**
 * Entry point for one synth-pipeline run. Pulls plumbers needing re-synth
 * from Firestore, preprocesses each plumber's reviews into the signal block,
 * groups by primary city, splits into batches of 8-12, writes input files,
 * and seeds the queue.json with one job per batch.
 *
 * Selection rules — a plumber is "needs re-synth" if ANY of:
 *   - lastOutscraperPull > reviewSynthesis.synthesizedAt   (rich data arrived after last synth)
 *   - reviewSynthesis.summary missing/empty AND googleReviewCount > 0
 *   - reviewSynthesis.synthesizedAt older than --max-age-days (default 30)
 *
 * Usage:
 *   node scripts/synth/generate-batches.js [--max-age-days N] [--batch-size N]
 *                                          [--concurrency N] [--limit N]
 *                                          [--cities slug1,slug2,...]
 *
 * Outputs:
 *   apps/plumbers-web/data/synth-runs/<runId>/queue.json
 *   apps/plumbers-web/data/synth-runs/<runId>/batches/<jobId>.json (one per batch)
 *   stdout: the runDir path, so the orchestrator can chain.
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { COLLECTIONS } = require("../config/plumbing-directory.cjs");
const { preprocessPlumber } = require("./preprocess-reviews");
const { initQueue, addJob } = require("./queue-state");

const APP_ROOT = path.resolve(__dirname, "..", "..");
const SA_PATH = path.join(APP_ROOT, "service-account.json");
const RUNS_DIR = path.join(APP_ROOT, "data", "synth-runs");

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_MAX_AGE_DAYS = 30;
const MIN_BATCH_SIZE = 4;   // never emit batches smaller than this except for final remainder
const MAX_BATCH_SIZE = 12;

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (flag) => {
    const i = a.indexOf(flag);
    return i >= 0 && i + 1 < a.length ? a[i + 1] : undefined;
  };
  return {
    batchSize: Number(get("--batch-size")) || DEFAULT_BATCH_SIZE,
    concurrency: Number(get("--concurrency")) || DEFAULT_CONCURRENCY,
    maxAgeDays: Number(get("--max-age-days")) || DEFAULT_MAX_AGE_DAYS,
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    cities: get("--cities") ? get("--cities").split(",").map((s) => s.trim()) : undefined,
    dryRun: a.includes("--dry-run"),
  };
}

function initDb() {
  if (!fs.existsSync(SA_PATH)) {
    console.error("ERROR: service-account.json not found.");
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

function tsToMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof v === "object" && typeof v._seconds === "number") {
    return v._seconds * 1000;
  }
  return 0;
}

function plumberNeedsResynth(data, maxAgeMs) {
  if (!data) return false;
  if ((data.googleReviewCount || 0) === 0) return false; // no reviews → nothing to synthesize
  const lastPull = tsToMillis(data.lastOutscraperPull);
  const lastSynth = tsToMillis(data.reviewSynthesis?.synthesizedAt
                            ?? data.reviewSynthesis?.aiSynthesizedAt);
  const summary = data.reviewSynthesis?.summary;
  const hasSummary = typeof summary === "string" && summary.trim().length > 0;

  // (1) Outscraper pulled after the last synthesis ran.
  if (lastPull > 0 && lastPull > lastSynth) return true;
  // (2) No synthesis at all.
  if (!hasSummary) return true;
  // (3) Stale — synthesized longer ago than the configured TTL.
  if (lastSynth > 0 && Date.now() - lastSynth > maxAgeMs) return true;
  return false;
}

function primaryCity(data) {
  if (Array.isArray(data.serviceCities) && data.serviceCities.length > 0) {
    return String(data.serviceCities[0]).toLowerCase();
  }
  if (data.city) {
    return String(data.city).toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  return null;
}

async function loadReviewsFor(db, plumberId, cap = 100) {
  const snap = await db.collection(COLLECTIONS.reviews)
    .where("plumberId", "==", plumberId)
    .get();
  // Newest first, capped — we already preprocess down to ≤12 evidence quotes.
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))
    .slice(0, cap);
}

async function loadCityImpressions(db) {
  const snap = await db.collection(COLLECTIONS.cities).get();
  const map = new Map();
  for (const d of snap.docs) {
    const data = d.data();
    map.set(d.id, data.lastGSCImpressions || 0);
    // The plumber primaryCity slug is city-only; map both forms.
    const m = d.id.match(/^(.*)-[a-z]{2}$/);
    if (m && !map.has(m[1])) map.set(m[1], data.lastGSCImpressions || 0);
  }
  return map;
}

function chunkBy(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  // If the final chunk is below MIN_BATCH_SIZE, merge into the previous one.
  if (out.length >= 2 && out[out.length - 1].length < MIN_BATCH_SIZE) {
    const tail = out.pop();
    out[out.length - 1] = out[out.length - 1].concat(tail);
  }
  return out;
}

function runIdNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const args = parseArgs();
  const db = initDb();

  console.error(`[generate-batches] querying plumbers needing re-synth...`);
  const snap = await db.collection(COLLECTIONS.businesses).get();
  console.error(`[generate-batches] read ${snap.size} plumber docs`);

  const maxAgeMs = args.maxAgeDays * 24 * 60 * 60 * 1000;

  // Filter to plumbers needing re-synth.
  const candidates = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.isActive === false) continue;
    if (!plumberNeedsResynth(data, maxAgeMs)) continue;
    const city = primaryCity(data);
    if (!city) continue;
    if (args.cities && !args.cities.includes(city)) continue;
    candidates.push({ id: doc.id, data, city });
  }
  console.error(`[generate-batches] ${candidates.length} plumbers need re-synth`);

  const limited = args.limit ? candidates.slice(0, args.limit) : candidates;

  // Group by primary city.
  const byCity = new Map();
  for (const p of limited) {
    if (!byCity.has(p.city)) byCity.set(p.city, []);
    byCity.get(p.city).push(p);
  }

  // Sort cities by GSC impressions desc so big-impression cities run first.
  const cityImpressions = await loadCityImpressions(db);
  const orderedCities = [...byCity.keys()].sort(
    (a, b) => (cityImpressions.get(b) || 0) - (cityImpressions.get(a) || 0),
  );

  // Initialize run dir + queue.
  const runId = runIdNow();
  const runDir = path.join(RUNS_DIR, runId);
  const batchesDir = path.join(runDir, "batches");
  const resultsDir = path.join(runDir, "results");
  fs.mkdirSync(batchesDir, { recursive: true });
  fs.mkdirSync(resultsDir, { recursive: true });
  initQueue(runDir, runId, args.concurrency);

  let totalJobs = 0;
  let totalPlumbers = 0;
  let totalReviewsFetched = 0;

  for (const citySlug of orderedCities) {
    const plumbers = byCity.get(citySlug);
    const chunks = chunkBy(plumbers, args.batchSize);
    const cityImp = cityImpressions.get(citySlug) || 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const jobId = `${citySlug}-${String(i + 1).padStart(3, "0")}`;
      const batchPath = path.join(batchesDir, `${jobId}.json`);
      const resultPath = path.join(resultsDir, `${jobId}.json`);

      // Preprocess each plumber.
      const plumberBlocks = [];
      for (const p of chunk) {
        const reviews = await loadReviewsFor(db, p.id);
        totalReviewsFetched += reviews.length;
        const block = preprocessPlumber(
          { ...p.data, placeId: p.id, id: p.id },
          reviews,
        );
        plumberBlocks.push(block);
      }

      const batchPayload = {
        jobId,
        runId,
        city: citySlug,
        cityImpressions: cityImp,
        generatedAt: new Date().toISOString(),
        plumberCount: plumberBlocks.length,
        plumbers: plumberBlocks,
      };

      if (!args.dryRun) {
        fs.writeFileSync(batchPath, JSON.stringify(batchPayload, null, 2));
        addJob(runDir, {
          jobId,
          city: citySlug,
          plumberCount: plumberBlocks.length,
          batchPath,
          resultPath,
          cityImpressions: cityImp,
        });
      }

      totalJobs++;
      totalPlumbers += plumberBlocks.length;
      console.error(`  + ${jobId}: ${plumberBlocks.length} plumbers (city imp=${cityImp})`);
    }
  }

  console.error(`\n[generate-batches] DONE`);
  console.error(`  runDir:          ${runDir}`);
  console.error(`  jobs:            ${totalJobs}`);
  console.error(`  plumbers total:  ${totalPlumbers}`);
  console.error(`  reviews fetched: ${totalReviewsFetched}`);
  console.error(`  concurrency:     ${args.concurrency} (cap for orchestrator)`);
  console.error(`  batch size:      ${args.batchSize}`);

  // stdout: the runDir, so the orchestrator can chain.
  console.log(runDir);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[generate-batches] FATAL:", e?.stack || e);
    process.exit(1);
  });
