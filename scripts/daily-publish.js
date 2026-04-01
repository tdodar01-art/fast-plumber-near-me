#!/usr/bin/env node

/**
 * Daily publish — if new plumbers were added, git commit & push to trigger Vercel deploy.
 *
 * Usage:
 *   node scripts/daily-publish.js
 *
 * Reads the daily result log to determine if anything new was scraped.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.join(__dirname, "..");
const LOG_DIR = path.join(PROJECT_ROOT, "data", "logs");
const today = new Date().toISOString().slice(0, 10);
const RESULT_PATH = path.join(LOG_DIR, `daily-result-${today}.json`);
const LOG_PATH = path.join(LOG_DIR, `daily-scrape-${today}.log`);

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [publish] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd) {
  return execSync(cmd, { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 60000 }).trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  log("=== Daily Publish Starting ===");

  // Check if there's a result from today's scrape
  if (!fs.existsSync(RESULT_PATH)) {
    log("No scrape result found for today. Nothing to publish.");
    return;
  }

  const result = JSON.parse(fs.readFileSync(RESULT_PATH, "utf-8"));

  if (result.newPlumbers === 0) {
    log("No new plumbers found today. Skipping publish.");
    return;
  }

  const cities = result.citiesProcessed.map((c) => c.city).join(", ");
  log(`New plumbers: ${result.newPlumbers} from ${cities}`);
  log(`Total plumbers: ${result.totalPlumbers}`);

  // Check for uncommitted changes
  try {
    const status = run("git status --porcelain data/ src/");
    if (!status) {
      log("No file changes detected. Skipping publish.");
      return;
    }
    log(`Changed files:\n${status}`);
  } catch (err) {
    log(`Git status failed: ${err.message}`);
    return;
  }

  // Stage data files
  try {
    run("git add data/raw/plumbers-latest.json data/synthesized/plumbers-synthesized.json data/synthesized/leaderboard.json scripts/scrape-queue.json");
    log("Staged data files.");
  } catch (err) {
    log(`Git add failed: ${err.message}`);
    return;
  }

  // Commit
  const commitMsg = `Daily scrape: +${result.newPlumbers} plumbers from ${cities}`;
  try {
    run(`git commit -m "${commitMsg}"`);
    log(`Committed: ${commitMsg}`);
  } catch (err) {
    log(`Git commit failed: ${err.message}`);
    return;
  }

  // Push
  try {
    run("git push origin main");
    log("Pushed to origin/main. Vercel deploy triggered.");
  } catch (err) {
    log(`Git push failed: ${err.message}`);
    log("Changes are committed locally. Push manually with: git push origin main");
    return;
  }

  log("=== Publish Complete ===");
}

try {
  main();
} catch (err) {
  log(`FATAL: ${err.message}`);
} finally {
  logStream.end();
}
