#!/usr/bin/env node

/**
 * Cross-reference the 30 empty cities from the GSC audit against the
 * current scrape queue (gsc-expansion-queue.json).
 *
 * Answers: which empty-indexed cities are queued, which are orphaned?
 */

const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "..", "data", "gsc-empty-pages-audit.csv");
const QUEUE_PATH = path.join(__dirname, "..", "data", "gsc-expansion-queue.json");

if (!fs.existsSync(CSV_PATH)) {
  console.error(`Run gsc-empty-pages-audit.js --csv first (${CSV_PATH} missing)`);
  process.exit(1);
}

// Parse empty cities out of the audit CSV
const csvLines = fs.readFileSync(CSV_PATH, "utf-8").trim().split("\n").slice(1);
const emptyCities = csvLines
  .map((l) => {
    const parts = l.split(",");
    return {
      citySlug: parts[0],
      stateAbbr: parts[1],
      status: parts[2],
      pageCount: parseInt(parts[4], 10),
      impressions: parseInt(parts[5], 10),
      clicks: parseInt(parts[6], 10),
    };
  })
  .filter((c) => c.status === "empty");

// Load queue
const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf-8"));
const queueSet = new Map();
for (const c of queue.cities) {
  queueSet.set(`${c.state}:${c.citySlug}`, c);
}

console.log(`Audit empty cities: ${emptyCities.length}`);
console.log(`Queue size:        ${queue.cities.length} (generated ${queue.generatedAt})\n`);

const inQueue = [];
const notInQueue = [];
for (const c of emptyCities) {
  const key = `${c.stateAbbr}:${c.citySlug}`;
  if (queueSet.has(key)) inQueue.push({ ...c, queued: queueSet.get(key) });
  else notInQueue.push(c);
}

console.log(`=== EMPTY CITIES IN QUEUE (${inQueue.length}/${emptyCities.length}) ===\n`);
if (inQueue.length) {
  const header = ["City-Slug".padEnd(30), "St".padEnd(3), "Audit_Impr".padStart(10), "Queue_Impr".padStart(10), "Pages".padStart(6)].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));
  inQueue.sort((a, b) => b.impressions - a.impressions);
  for (const c of inQueue) {
    console.log([
      c.citySlug.padEnd(30),
      c.stateAbbr.padEnd(3),
      String(c.impressions).padStart(10),
      String(c.queued.impressions).padStart(10),
      String(c.pageCount).padStart(6),
    ].join(" | "));
  }
}

console.log(`\n=== EMPTY CITIES NOT IN QUEUE (${notInQueue.length}/${emptyCities.length}) ===\n`);
if (notInQueue.length) {
  const header = ["City-Slug".padEnd(30), "St".padEnd(3), "Impr".padStart(6), "Clicks".padStart(7), "Pages".padStart(6)].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));
  notInQueue.sort((a, b) => b.impressions - a.impressions);
  for (const c of notInQueue) {
    console.log([
      c.citySlug.padEnd(30),
      c.stateAbbr.padEnd(3),
      String(c.impressions).padStart(6),
      String(c.clicks).padStart(7),
      String(c.pageCount).padStart(6),
    ].join(" | "));
  }
}

console.log(`\nSummary: ${inQueue.length} of ${emptyCities.length} empty cities are queued; ${notInQueue.length} are orphaned.`);
