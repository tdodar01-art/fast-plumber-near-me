#!/usr/bin/env tsx
/**
 * Daily experiment metrics publisher cron.
 *
 * Pulls yesterday's GSC data for all tracked experiment slugs
 * and writes to Firestore experiment_metrics collection.
 *
 * Usage: npx tsx scripts/experiments/publish-metrics-cron.ts [--date YYYY-MM-DD]
 */

import { publishDailyMetrics } from "../../src/lib/experiments/publishMetrics.js";

async function main() {
  const args = process.argv.slice(2);
  const dateIdx = args.indexOf("--date");
  const targetDate = dateIdx >= 0 ? args[dateIdx + 1] : undefined;

  console.log("=== Experiment Metrics Publisher ===\n");

  try {
    const count = await publishDailyMetrics(targetDate);
    console.log(`\nDone. Published metrics for ${count} slugs.`);
  } catch (err) {
    console.error("Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
