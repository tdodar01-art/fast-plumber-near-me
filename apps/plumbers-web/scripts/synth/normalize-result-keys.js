#!/usr/bin/env node

/**
 * Normalize key-name drift in agent result files. Some Claude Code subagents
 * occasionally output camelCase variants of dimensionScores + specialtyStrength
 * keys instead of the strict snake_case the schema requires. This script
 * relabels them in place. No semantic change — just key rename.
 *
 * Usage:
 *   node scripts/synth/normalize-result-keys.js <runDir>            # all "failed" results
 *   node scripts/synth/normalize-result-keys.js <runDir> <jobId>    # one job
 */

const fs = require("fs");
const path = require("path");
const { readQueue } = require("./queue-state");
const { DIMENSION_KEYS, SPECIALTY_KEYS } = require("./lib/synthesis-schema");

const DIM_RENAMES = {
  responseSpeed: "responsiveness",
  pricingTransparency: "pricing_fairness",
  emergencyReadiness: "reliability", // closest semantic fit
};

const SPEC_RENAMES = {
  waterHeater: "water_heater",
  drainCleaning: "drain",
  waterLine: "water_line",
  slabLeak: "slab_leak",
  sumpPump: "sump_pump",
  gasLeak: "gas_line",
  faucetFixture: "fixture",
  burstPipe: "emergency",
  // No canonical equivalents — drop:
  flooding: null,
  garbageDisposal: null,
};

function renameKeys(obj, renames, validKeys) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    let target = renames[k];
    if (target === null) continue; // drop
    if (target === undefined) target = k;
    out[target] = v;
  }
  // Ensure all valid keys are present (specialty defaults to 0, dimension to null)
  for (const k of validKeys) {
    if (!(k in out)) out[k] = (validKeys === SPECIALTY_KEYS ? 0 : null);
  }
  // Strip any keys not in validKeys
  for (const k of Object.keys(out)) {
    if (!validKeys.includes(k)) delete out[k];
  }
  return out;
}

const VALID_DIMS = new Set([
  "reliability", "pricing_fairness", "workmanship", "responsiveness", "communication",
]);

function normalizeResultObject(r) {
  let changed = false;
  if (r.dimensionScores) {
    const before = JSON.stringify(r.dimensionScores);
    r.dimensionScores = renameKeys(r.dimensionScores, DIM_RENAMES, DIMENSION_KEYS);
    if (JSON.stringify(r.dimensionScores) !== before) changed = true;
  }
  if (r.specialtyStrength) {
    const before = JSON.stringify(r.specialtyStrength);
    r.specialtyStrength = renameKeys(r.specialtyStrength, SPEC_RENAMES, SPECIALTY_KEYS);
    // Coerce nulls in specialty to 0 (specialty is required to be 0..100 number)
    for (const k of SPECIALTY_KEYS) {
      if (r.specialtyStrength[k] === null) r.specialtyStrength[k] = 0;
    }
    if (JSON.stringify(r.specialtyStrength) !== before) changed = true;
  }
  // Coerce servicesMentioned values: ensure topQuote is a string ("" if missing/null)
  if (r.servicesMentioned && typeof r.servicesMentioned === "object") {
    for (const [slug, info] of Object.entries(r.servicesMentioned)) {
      if (info && typeof info === "object") {
        if (typeof info.topQuote !== "string") {
          info.topQuote = String(info.topQuote || "");
          changed = true;
        }
      }
    }
  }
  // Coerce evidenceQuotes: drop entries that aren't {dimension, quote} objects
  // OR have a dimension not in the canonical set.
  if (Array.isArray(r.evidenceQuotes)) {
    const before = r.evidenceQuotes.length;
    r.evidenceQuotes = r.evidenceQuotes.filter(
      (q) =>
        q && typeof q === "object" &&
        typeof q.quote === "string" &&
        typeof q.dimension === "string" &&
        VALID_DIMS.has(q.dimension),
    );
    if (r.evidenceQuotes.length !== before) changed = true;
  }

  // Trim oversized summaries to 320 chars (last-resort) so they don't fail the schema.
  if (typeof r.summary === "string" && r.summary.length > 320) {
    r.summary = r.summary.slice(0, 317).trimEnd() + "...";
    changed = true;
  }

  // Coerce non-empty array servicesMentioned to {} (agents sometimes return an array
  // instead of an object — semantic intent is "none mentioned").
  if (Array.isArray(r.servicesMentioned)) {
    r.servicesMentioned = {};
    changed = true;
  }

  return changed;
}

function normalizeFile(filePath, batchPath) {
  if (!fs.existsSync(filePath)) return { ok: false, reason: "missing" };
  let file;
  try {
    file = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    return { ok: false, reason: "parse-error: " + e.message };
  }
  if (!Array.isArray(file.results)) return { ok: false, reason: "no-results" };

  // Drop results whose placeId isn't in the batch input (hallucinated placeIds).
  let droppedHallucinated = 0;
  if (batchPath && fs.existsSync(batchPath)) {
    const batch = JSON.parse(fs.readFileSync(batchPath, "utf-8"));
    const validIds = new Set(batch.plumbers.map((p) => p.placeId));
    const before = file.results.length;
    file.results = file.results.filter((r) => r && validIds.has(r.placeId));
    droppedHallucinated = before - file.results.length;
  }

  let totalChanged = droppedHallucinated > 0 ? 1 : 0;
  for (const r of file.results) {
    if (normalizeResultObject(r)) totalChanged++;
  }
  if (totalChanged > 0) {
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2));
  }
  return { ok: true, totalChanged, totalResults: file.results.length, droppedHallucinated };
}

function main() {
  const [, , runDir, targetJobId] = process.argv;
  if (!runDir) {
    console.error("usage: node normalize-result-keys.js <runDir> [jobId]");
    process.exit(1);
  }
  const q = readQueue(runDir);
  const jobs = targetJobId
    ? q.jobs.filter((j) => j.jobId === targetJobId)
    : q.jobs.filter((j) => j.status === "failed");

  console.log(`Normalizing ${jobs.length} result file(s)...`);
  let totalFiles = 0;
  let totalChanged = 0;
  for (const job of jobs) {
    const r = normalizeFile(job.resultPath, job.batchPath);
    if (!r.ok) {
      console.log(`  ! ${job.jobId}: ${r.reason}`);
      continue;
    }
    const dropMsg = r.droppedHallucinated ? ` (-${r.droppedHallucinated} hallucinated)` : "";
    console.log(`  ${job.jobId}: ${r.totalChanged}/${r.totalResults} normalized${dropMsg}`);
    totalFiles++;
    totalChanged += r.totalChanged;
  }
  console.log(`\nDone: ${totalFiles} files processed, ${totalChanged} results normalized`);
}

if (require.main === module) main();
