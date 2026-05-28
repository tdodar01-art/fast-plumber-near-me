#!/usr/bin/env node

/**
 * Atomic queue-state I/O for the synth pipeline.
 *
 * The queue file is the single source of truth for job state across the whole
 * pipeline (generate → orchestrate → validate → score → writeback). Every state
 * transition is one write of the entire file via tmp-file + rename. Concurrent
 * readers see only fully-written states.
 *
 * Callable as a CLI for the orchestrator to query:
 *   node queue-state.js init   <runDir>                       # create empty queue
 *   node queue-state.js next   <runDir> [N=8] [status=pending] # JSON list of next N
 *   node queue-state.js mark   <runDir> <jobId> <status> [errorMsg]
 *   node queue-state.js stats  <runDir>                       # counts by status
 *   node queue-state.js list   <runDir> [status]              # list jobIds
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VALID_STATUSES = [
  "pending", "running", "validated", "failed", "scored", "written",
];

function queueFilePath(runDir) {
  return path.join(runDir, "queue.json");
}

function readQueue(runDir) {
  const p = queueFilePath(runDir);
  if (!fs.existsSync(p)) throw new Error(`queue.json not found at ${p}`);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeQueueAtomic(runDir, q) {
  const target = queueFilePath(runDir);
  const tmp = `${target}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(q, null, 2) + "\n");
  fs.renameSync(tmp, target);
}

function initQueue(runDir, runId, concurrency = 8) {
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });
  const q = {
    runId,
    createdAt: new Date().toISOString(),
    concurrency,
    totalJobs: 0,
    jobs: [],
  };
  writeQueueAtomic(runDir, q);
  return q;
}

function addJob(runDir, job) {
  const q = readQueue(runDir);
  if (q.jobs.find((j) => j.jobId === job.jobId)) {
    throw new Error(`duplicate jobId: ${job.jobId}`);
  }
  q.jobs.push({
    jobId: job.jobId,
    city: job.city,
    plumberCount: job.plumberCount,
    batchPath: job.batchPath,
    resultPath: job.resultPath,
    status: "pending",
    attempts: 0,
    lastError: null,
    startedAt: null,
    completedAt: null,
    validation: null,
    rankComputed: false,
    written: false,
    // The orchestrator uses this for impression-priority ordering at fetch time.
    cityImpressions: job.cityImpressions || 0,
  });
  q.totalJobs = q.jobs.length;
  writeQueueAtomic(runDir, q);
}

function markJob(runDir, jobId, newStatus, opts = {}) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`invalid status: ${newStatus}`);
  }
  const q = readQueue(runDir);
  const job = q.jobs.find((j) => j.jobId === jobId);
  if (!job) throw new Error(`job not found: ${jobId}`);

  const prev = job.status;
  job.status = newStatus;
  if (newStatus === "running") {
    job.attempts = (job.attempts || 0) + 1;
    job.startedAt = new Date().toISOString();
    job.lastError = null;
  }
  if (newStatus === "failed") {
    job.lastError = opts.errorMsg || "(no message)";
    job.completedAt = new Date().toISOString();
  }
  if (newStatus === "validated" || newStatus === "scored" || newStatus === "written") {
    job.completedAt = new Date().toISOString();
  }
  if (opts.validation) job.validation = opts.validation;
  if (opts.rankComputed !== undefined) job.rankComputed = !!opts.rankComputed;
  if (opts.written !== undefined) job.written = !!opts.written;

  writeQueueAtomic(runDir, q);
  return { prev, next: newStatus };
}

function requeueIfRetriable(runDir, jobId, maxAttempts = 3) {
  const q = readQueue(runDir);
  const job = q.jobs.find((j) => j.jobId === jobId);
  if (!job) throw new Error(`job not found: ${jobId}`);
  if ((job.attempts || 0) >= maxAttempts) return false;
  job.status = "pending";
  writeQueueAtomic(runDir, q);
  return true;
}

/**
 * Get next N jobs in a given status, sorted by cityImpressions desc.
 */
function nextJobs(runDir, n = 8, status = "pending") {
  const q = readQueue(runDir);
  return q.jobs
    .filter((j) => j.status === status)
    .sort((a, b) => (b.cityImpressions || 0) - (a.cityImpressions || 0))
    .slice(0, n);
}

function jobStats(runDir) {
  const q = readQueue(runDir);
  const counts = {};
  for (const s of VALID_STATUSES) counts[s] = 0;
  for (const j of q.jobs) counts[j.status] = (counts[j.status] || 0) + 1;
  return { total: q.jobs.length, counts, runId: q.runId };
}

/**
 * Crash-recovery primitive. Walks all jobs in status "running" and resets any
 * whose result file is missing or empty back to "pending" so the next wave
 * can pick them up.
 *
 * Why: validate-synthesis.js only processes status=="running" and only
 * succeeds when the result file exists + parses. A subagent that crashed
 * mid-write (or a Claude Code session that was killed before subagents
 * returned) leaves the job stuck in "running" with no file — invisible to
 * both validate and any subsequent wave's "next pending" query.
 *
 * Safe to call repeatedly. Does NOT touch jobs that have a non-empty result
 * file (those should be handled by validate-synthesis instead).
 */
function resetStuckRunning(runDir, opts = {}) {
  const q = readQueue(runDir);
  const reset = [];
  for (const job of q.jobs) {
    if (job.status !== "running") continue;
    const exists = fs.existsSync(job.resultPath);
    let size = 0;
    if (exists) {
      try { size = fs.statSync(job.resultPath).size; } catch { size = 0; }
    }
    if (!exists || size === 0) {
      job.status = "pending";
      job.lastError = opts.errorMsg || "reset-stuck (no result file)";
      reset.push(job.jobId);
    }
  }
  if (reset.length > 0) writeQueueAtomic(runDir, q);
  return { reset, count: reset.length };
}

/**
 * Operator-facing summary. More readable than jobStats() — shows top pending
 * cities, oldest running, attempt distribution. Stdout-friendly.
 */
function jobSummary(runDir) {
  const q = readQueue(runDir);
  const counts = {};
  for (const s of VALID_STATUSES) counts[s] = 0;
  for (const j of q.jobs) counts[j.status] = (counts[j.status] || 0) + 1;

  let plumbersTotal = 0;
  let plumbersWritten = 0;
  let plumbersValidated = 0;
  let plumbersPending = 0;
  let plumbersFailed = 0;
  const cityCounts = {};
  let oldestRunningTs = null;
  let oldestRunningId = null;
  const failedJobs = [];

  for (const j of q.jobs) {
    plumbersTotal += j.plumberCount || 0;
    if (j.status === "written") plumbersWritten += j.plumberCount || 0;
    if (j.status === "validated") plumbersValidated += j.plumberCount || 0;
    if (j.status === "pending") plumbersPending += j.plumberCount || 0;
    if (j.status === "failed") {
      plumbersFailed += j.plumberCount || 0;
      failedJobs.push({ jobId: j.jobId, lastError: (j.lastError || "").slice(0, 200) });
    }
    if (j.status === "pending") {
      cityCounts[j.city] = (cityCounts[j.city] || 0) + 1;
    }
    if (j.status === "running" && j.startedAt) {
      const ts = Date.parse(j.startedAt);
      if (!Number.isNaN(ts) && (oldestRunningTs === null || ts < oldestRunningTs)) {
        oldestRunningTs = ts;
        oldestRunningId = j.jobId;
      }
    }
  }

  const topPendingCities = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([city, count]) => ({ city, batches: count }));

  return {
    runId: q.runId,
    runDir,
    concurrency: q.concurrency,
    totalJobs: q.jobs.length,
    counts,
    plumbers: {
      total: plumbersTotal,
      written: plumbersWritten,
      validated: plumbersValidated,
      pending: plumbersPending,
      failed: plumbersFailed,
    },
    progressPct: plumbersTotal > 0
      ? Math.round((100 * (plumbersWritten + plumbersValidated)) / plumbersTotal)
      : 0,
    oldestRunning: oldestRunningId
      ? { jobId: oldestRunningId, startedAt: new Date(oldestRunningTs).toISOString(), ageSec: Math.round((Date.now() - oldestRunningTs) / 1000) }
      : null,
    topPendingCities,
    failedSample: failedJobs.slice(0, 10),
  };
}

// ---------- CLI -------------------------------------------------------------

function cliMain() {
  const [, , cmd, runDir, ...rest] = process.argv;
  if (!cmd || !runDir) {
    console.error("usage: node queue-state.js <init|next|mark|stats|summary|list|reset-stuck> <runDir> ...");
    process.exit(1);
  }
  if (cmd === "init") {
    const q = initQueue(runDir, path.basename(runDir));
    console.log(JSON.stringify(q));
    return;
  }
  if (cmd === "next") {
    const n = Number(rest[0] || 8);
    const status = rest[1] || "pending";
    console.log(JSON.stringify(nextJobs(runDir, n, status), null, 2));
    return;
  }
  if (cmd === "mark") {
    const [jobId, newStatus, errorMsg] = rest;
    const r = markJob(runDir, jobId, newStatus, errorMsg ? { errorMsg } : {});
    console.log(JSON.stringify(r));
    return;
  }
  if (cmd === "stats") {
    console.log(JSON.stringify(jobStats(runDir), null, 2));
    return;
  }
  if (cmd === "summary") {
    const s = jobSummary(runDir);
    console.log(`run ${s.runId}  total=${s.totalJobs}  progress=${s.progressPct}%`);
    console.log(`  status counts:    ${JSON.stringify(s.counts)}`);
    console.log(`  plumber counts:   total=${s.plumbers.total} written=${s.plumbers.written} validated=${s.plumbers.validated} pending=${s.plumbers.pending} failed=${s.plumbers.failed}`);
    if (s.oldestRunning) {
      console.log(`  oldest running:  ${s.oldestRunning.jobId} (age ${s.oldestRunning.ageSec}s)`);
    }
    if (s.topPendingCities.length > 0) {
      console.log(`  top pending cities:`);
      for (const c of s.topPendingCities) console.log(`    ${c.city.padEnd(30)} ${c.batches} batches`);
    }
    if (s.failedSample.length > 0) {
      console.log(`  failed (sample):`);
      for (const f of s.failedSample) console.log(`    ${f.jobId}: ${f.lastError}`);
    }
    return;
  }
  if (cmd === "list") {
    const status = rest[0];
    const q = readQueue(runDir);
    const ids = q.jobs.filter((j) => !status || j.status === status).map((j) => j.jobId);
    for (const id of ids) console.log(id);
    return;
  }
  if (cmd === "reset-stuck") {
    const r = resetStuckRunning(runDir);
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}

if (require.main === module) cliMain();

module.exports = {
  VALID_STATUSES,
  queueFilePath, readQueue, writeQueueAtomic,
  initQueue, addJob, markJob, requeueIfRetriable, nextJobs, jobStats,
  resetStuckRunning, jobSummary,
};
