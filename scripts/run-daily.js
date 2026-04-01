#!/usr/bin/env node

/**
 * Daily pipeline orchestrator — scrape then publish.
 *
 * Usage:
 *   node scripts/run-daily.js
 */

const { execSync } = require("child_process");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");

function run(script) {
  const cmd = `node ${path.join(__dirname, script)}`;
  console.log(`\n>>> Running: ${cmd}\n`);
  try {
    execSync(cmd, { cwd: PROJECT_ROOT, stdio: "inherit", timeout: 600000 });
    return true;
  } catch (err) {
    console.error(`\n${script} failed with exit code ${err.status}`);
    return false;
  }
}

const scrapeOk = run("daily-scrape.js");

if (scrapeOk) {
  run("daily-publish.js");
} else {
  console.error("\nScrape failed — skipping publish.");
  process.exit(1);
}
