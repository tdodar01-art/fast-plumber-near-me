#!/usr/bin/env node

/**
 * Writeback validated batch results to Firestore. Mirrors score-plumbers.ts
 * Pass 1's exact Firestore field shape so:
 *   - reviewSynthesis.* is consumed by export-firestore-to-json.js
 *   - scores.* is consumed by score-plumbers.ts --pass 2 (rank) + --pass 3 (verdict)
 *
 * Only jobs in status "validated" are written. After write, status → "written".
 *
 * Usage:
 *   node scripts/synth/writeback.js <runDir>             # writes all validated jobs
 *   node scripts/synth/writeback.js <runDir> --dry-run   # logs what would be written
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { COLLECTIONS } = require("../config/plumbing-directory.cjs");
// NOTE: decision-engine.ts cannot be required from plain Node here — it's a TS
// source file and we removed tsx from the local synth pipeline. We re-derive
// the parts we need (badges, emergencyReadiness, pricingTier, bestFor) in
// pure JS in ./lib/derive-fields.js. Cross-platform adjustment is deferred
// to a later pipeline iteration; score-plumbers Pass 2 still ranks correctly
// from the un-adjusted scores we write.
const {
  deriveBadges,
  deriveEmergencyReadiness,
  derivePricingTier,
  approximateVariance,
  computeBestFor,
} = require("./lib/derive-fields");
const { readQueue, markJob } = require("./queue-state");
const { DIMENSION_KEYS, SPECIALTY_KEYS } = require("./lib/synthesis-schema");

const APP_ROOT = path.resolve(__dirname, "..", "..");
const SA_PATH = path.join(APP_ROOT, "service-account.json");

const SYNTHESIS_VERSION = "claude-code-local-v2";

function initDb() {
  if (!fs.existsSync(SA_PATH)) {
    console.error("ERROR: service-account.json not found.");
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

/**
 * Normalize dimension scores: null → 50 (neutral) so downstream math works.
 * Pass 1 does the same (treats missing dims as 50).
 */
function normalizeDimensions(dimensionScores) {
  const out = {};
  for (const k of DIMENSION_KEYS) {
    const v = dimensionScores?.[k];
    out[k] = typeof v === "number" ? v : 50;
  }
  return out;
}

function normalizeSpecialty(specialtyStrength) {
  const out = {};
  for (const k of SPECIALTY_KEYS) {
    const v = specialtyStrength?.[k];
    out[k] = typeof v === "number" ? v : 0;
  }
  return out;
}

/**
 * Build the rawScores object that decision-engine.applyAdjustment expects.
 */
function buildRawScores(result, batchPlumber) {
  const dims = normalizeDimensions(result.dimensionScores);
  const specialty = normalizeSpecialty(result.specialtyStrength);
  const consistency = batchPlumber?.signals?.reviewConsistency;
  return {
    ...dims,
    specialty_strength: specialty,
    variance: approximateVariance(consistency),
  };
}

/**
 * Apply Pass-1-equivalent adjustments + derivations and return the Firestore
 * update payload for one plumber.
 */
function buildUpdatePayload(result, batchPlumber, nowTs) {
  const rawScores = buildRawScores(result, batchPlumber);

  // v1: cross-platform adjustment deferred — write agent's raw scores directly.
  // Pass 2 (rank) reads from `scores.*` exactly the same way regardless.
  const adjusted = rawScores;

  // Derive display fields from adjusted scores.
  const badges = deriveBadges(adjusted, result.redFlags || []);
  const { readiness: emergencyReadiness, signals: emergencySignals } =
    deriveEmergencyReadiness(adjusted, result.emergencyNotes || "");
  const pricingTier = derivePricingTier(adjusted);
  const bestFor = computeBestFor(adjusted);

  // servicesMentioned shape used by service pages
  const servicesMentioned = result.servicesMentioned || {};

  const update = {
    scores: {
      ...adjusted,
      review_text_only: rawScores,
      method: "claude-code-local-v2",
      last_scored_at: new Date().toISOString(),
      review_count_used: batchPlumber.signals?.totalReviewsAnalyzed ?? 0,
    },
    evidence_quotes: (result.evidenceQuotes || []).map((q) => ({
      dimension: q.dimension,
      quote: q.quote,
    })),
    "reviewSynthesis.summary": result.summary,
    "reviewSynthesis.strengths": result.strengths,
    "reviewSynthesis.weaknesses": result.weaknesses,
    "reviewSynthesis.redFlags": result.redFlags,
    "reviewSynthesis.badges": badges,
    "reviewSynthesis.emergencyReadiness": emergencyReadiness,
    "reviewSynthesis.emergencyNotes": result.emergencyNotes,
    "reviewSynthesis.emergencySignals": emergencySignals,
    "reviewSynthesis.pricingTier": pricingTier,
    "reviewSynthesis.bestFor": bestFor,
    "reviewSynthesis.platformDiscrepancy": result.platformDiscrepancy ?? null,
    "reviewSynthesis.reviewCount": batchPlumber.signals?.totalReviewsAnalyzed ?? 0,
    "reviewSynthesis.aiSynthesizedAt": nowTs,
    "reviewSynthesis.synthesisVersion": SYNTHESIS_VERSION,
    updatedAt: nowTs,
  };
  if (Object.keys(servicesMentioned).length > 0) {
    update["reviewSynthesis.servicesMentioned"] = servicesMentioned;
  }
  return update;
}

async function writebackJob(db, runDir, job, opts) {
  const batch = loadJSON(job.batchPath);
  const results = loadJSON(job.resultPath).results;
  const byPlaceId = new Map(batch.plumbers.map((p) => [p.placeId, p]));
  const nowTs = admin.firestore.Timestamp.now();

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    const batchPlumber = byPlaceId.get(r.placeId);
    if (!batchPlumber) {
      console.error(`  ! ${job.jobId}/${r.placeId}: no matching batch plumber, skipping`);
      failed++;
      continue;
    }
    try {
      const payload = buildUpdatePayload(r, batchPlumber, nowTs);
      if (opts.dryRun) {
        console.log(`  [dry-run] ${r.placeId}: ${Object.keys(payload).length} fields, badges=[${(payload["reviewSynthesis.badges"] || []).join(",")}]`);
      } else {
        await db.collection(COLLECTIONS.businesses).doc(r.placeId).update(payload);
      }
      ok++;
    } catch (e) {
      console.error(`  ! ${job.jobId}/${r.placeId}: ${e.message}`);
      failed++;
    }
  }
  if (!opts.dryRun && failed === 0) {
    markJob(runDir, job.jobId, "written", { written: true });
  }
  return { ok, failed };
}

async function main() {
  const argv = process.argv.slice(2);
  const runDir = argv[0];
  const dryRun = argv.includes("--dry-run");
  if (!runDir) {
    console.error("usage: node writeback.js <runDir> [--dry-run]");
    process.exit(1);
  }

  const db = dryRun ? null : initDb();
  const q = readQueue(runDir);
  const jobs = q.jobs.filter((j) => j.status === "validated");
  if (jobs.length === 0) {
    console.log("No validated jobs to write.");
    return;
  }

  let totalOk = 0;
  let totalFailed = 0;
  for (const job of jobs) {
    console.log(`\nWriting ${job.jobId} (${job.plumberCount} plumbers)${dryRun ? " [dry-run]" : ""}`);
    const r = await writebackJob(db, runDir, job, { dryRun });
    totalOk += r.ok;
    totalFailed += r.failed;
  }
  console.log(`\nWriteback: ${totalOk} ok, ${totalFailed} failed across ${jobs.length} jobs`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[writeback] FATAL:", e?.stack || e);
      process.exit(1);
    });
}
