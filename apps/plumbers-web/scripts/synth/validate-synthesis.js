#!/usr/bin/env node

/**
 * Validate one or more job result files against the synthesis schema +
 * anti-hallucination grounding. Updates queue.json status per job:
 *   - all results valid + count matches batch → status="validated"
 *   - any errors                              → status="failed" (with lastError)
 *
 * Usage:
 *   node scripts/synth/validate-synthesis.js <runDir>              # validates all "running" jobs
 *   node scripts/synth/validate-synthesis.js <runDir> <jobId>      # validates one job
 */

const fs = require("fs");
const path = require("path");
const { validateSynthesisResult } = require("./lib/synthesis-schema");
const { readQueue, markJob } = require("./queue-state");

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function validateJob(runDir, job) {
  const errors = [];
  if (!fs.existsSync(job.resultPath)) {
    return { ok: false, errors: [`result file missing: ${job.resultPath}`] };
  }
  let resultFile;
  try {
    resultFile = loadJSON(job.resultPath);
  } catch (e) {
    return { ok: false, errors: [`result JSON parse failed: ${e.message}`] };
  }
  if (!resultFile || !Array.isArray(resultFile.results)) {
    return { ok: false, errors: ["result file has no .results array"] };
  }
  const batch = loadJSON(job.batchPath);
  const batchByPlaceId = new Map(batch.plumbers.map((p) => [p.placeId, p]));

  if (resultFile.results.length !== job.plumberCount) {
    errors.push(
      `result count mismatch: expected ${job.plumberCount}, got ${resultFile.results.length}`,
    );
  }

  let perPlumberOk = 0;
  for (let i = 0; i < resultFile.results.length; i++) {
    const r = resultFile.results[i];
    const batchPlumber = batchByPlaceId.get(r?.placeId);
    if (!batchPlumber) {
      errors.push(`results[${i}].placeId not present in batch input: ${r?.placeId}`);
      continue;
    }
    const { ok, errors: errs } = validateSynthesisResult(r, batchPlumber);
    if (ok) perPlumberOk++;
    else errors.push(`results[${i}] (${r.placeId}): ${errs.join("; ")}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: { totalResults: resultFile.results.length, validResults: perPlumberOk },
  };
}

function main() {
  const [, , runDir, targetJobId] = process.argv;
  if (!runDir) {
    console.error("usage: node validate-synthesis.js <runDir> [jobId]");
    process.exit(1);
  }
  const q = readQueue(runDir);
  const jobs = targetJobId
    ? q.jobs.filter((j) => j.jobId === targetJobId)
    : q.jobs.filter((j) => j.status === "running");

  if (jobs.length === 0) {
    console.log("No jobs to validate.");
    return;
  }

  let okCount = 0;
  let failCount = 0;
  for (const job of jobs) {
    const v = validateJob(runDir, job);
    if (v.ok) {
      markJob(runDir, job.jobId, "validated", { validation: { ok: true, summary: v.summary } });
      console.log(`  ✓ ${job.jobId} (${v.summary.validResults}/${v.summary.totalResults})`);
      okCount++;
    } else {
      const errMsg = v.errors.slice(0, 5).join(" | ");
      markJob(runDir, job.jobId, "failed", {
        errorMsg: errMsg,
        validation: { ok: false, errors: v.errors },
      });
      console.error(`  ✗ ${job.jobId}: ${errMsg}`);
      failCount++;
    }
  }
  console.log(`\nValidation: ${okCount} validated, ${failCount} failed`);
}

if (require.main === module) main();

module.exports = { validateJob };
