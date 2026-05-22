#!/usr/bin/env node
/**
 * Print the agent prompt for one queued job. Used by the orchestrator
 * (Claude Code session) when fanning out subagents — each subagent receives
 * the prompt printed here.
 *
 * Usage: node scripts/synth/print-job-prompt.js <runDir> <jobId>
 */
const path = require("path");
const { readQueue } = require("./queue-state");
const { buildBatchPrompt } = require("./agent-prompt");

const [, , runDir, jobId] = process.argv;
if (!runDir || !jobId) {
  console.error("usage: node print-job-prompt.js <runDir> <jobId>");
  process.exit(1);
}

const q = readQueue(runDir);
const job = q.jobs.find((j) => j.jobId === jobId);
if (!job) {
  console.error(`job ${jobId} not found in ${runDir}/queue.json`);
  process.exit(1);
}

const prompt = buildBatchPrompt({
  runDir,
  jobId: job.jobId,
  batchPath: job.batchPath,
  resultPath: job.resultPath,
  count: job.plumberCount,
});

process.stdout.write(prompt);
