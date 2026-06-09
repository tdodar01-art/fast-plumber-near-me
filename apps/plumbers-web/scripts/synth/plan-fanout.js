#!/usr/bin/env node
/**
 * Plan the subagent fan-out for one synth run.
 *
 * generate-batches.js groups by city, so a run is usually MANY tiny batches
 * (1-3 plumbers each). Spawning one subagent per batch wastes orchestration.
 * This balances all pending jobs into `workers` groups of roughly equal
 * plumber count, marks each included job "running" (so validate-synthesis.js
 * picks it up), and writes the plan to <runDir>/fanout-plan.json.
 *
 * The orchestrator (local Claude Code session) then spawns ONE subagent per
 * group — each subagent runs print-job-prompt.js per jobId and writes results.
 *
 * Usage:
 *   node scripts/synth/plan-fanout.js <runDir> [workers=12]
 *
 * Output: prints the plan as JSON (also written to <runDir>/fanout-plan.json).
 */
const fs = require("fs");
const path = require("path");
const { readQueue, markJob } = require("./queue-state");

const runDir = process.argv[2];
const workers = Number(process.argv[3]) || 12;
if (!runDir) {
  console.error("usage: node plan-fanout.js <runDir> [workers=12]");
  process.exit(1);
}

const q = readQueue(runDir);
// Include jobs that still need synthesizing: pending, or running-without-result
// (crash recovery). Skip anything already validated/written/failed.
const jobs = q.jobs
  .filter((j) => j.status === "pending" || j.status === "running")
  .filter((j) => !fs.existsSync(j.resultPath))
  .map((j) => ({ id: j.jobId, n: j.plumberCount || 0 }))
  .sort((a, b) => b.n - a.n);

if (jobs.length === 0) {
  console.error("no pending jobs to plan (nothing to do)");
  process.exit(2);
}

const groupCount = Math.min(workers, jobs.length);
const groups = Array.from({ length: groupCount }, () => ({ ids: [], plumbers: 0 }));
// Greedy least-loaded bin packing by plumber count.
for (const job of jobs) {
  groups.sort((a, b) => a.plumbers - b.plumbers);
  groups[0].ids.push(job.id);
  groups[0].plumbers += job.n;
}

// Mark every planned job "running" so the validator will process it.
let marked = 0;
for (const g of groups) for (const id of g.ids) { markJob(runDir, id, "running"); marked++; }

const plan = {
  runDir,
  workers: groups.length,
  totalJobs: marked,
  totalPlumbers: groups.reduce((s, g) => s + g.plumbers, 0),
  groups: groups.map((g, i) => ({ worker: i, jobs: g.ids.length, plumbers: g.plumbers, ids: g.ids })),
};
fs.writeFileSync(path.join(runDir, "fanout-plan.json"), JSON.stringify(plan, null, 2));
process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
