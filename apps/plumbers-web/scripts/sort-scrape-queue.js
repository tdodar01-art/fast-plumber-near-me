#!/usr/bin/env node

/**
 * Sort scrape queue by GSC impressions.
 *
 * Reads Firestore cities/<slug-state>.lastGSCImpressions (populated by
 * gsc-expansion.js earlier in the pipeline) and reorders pending entries
 * in scrape-queue.json so high-impression empties get scraped first.
 *
 * Runs daily inside daily-scrape.yml between gsc-prepend-queue and the
 * scrape itself. Non-pending entries keep their position.
 *
 * Usage:
 *   node scripts/sort-scrape-queue.js
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { COLLECTIONS } = require("./config/plumbing-directory.cjs");

const SCRAPE_QUEUE_PATH = path.join(__dirname, "scrape-queue.json");
const SA_PATH = path.join(__dirname, "..", "service-account.json");

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function docIdFor(city, state) {
  return `${slugify(city)}-${String(state).toLowerCase()}`;
}

async function main() {
  if (!fs.existsSync(SA_PATH)) {
    console.error("ERROR: service-account.json not found.");
    process.exit(1);
  }
  if (!fs.existsSync(SCRAPE_QUEUE_PATH)) {
    console.error(`ERROR: scrape-queue.json not found at ${SCRAPE_QUEUE_PATH}`);
    process.exit(1);
  }

  const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  const queueDoc = JSON.parse(fs.readFileSync(SCRAPE_QUEUE_PATH, "utf-8"));
  const queue = Array.isArray(queueDoc.queue) ? queueDoc.queue : [];
  const pending = queue.filter((c) => c.status === "pending");
  const nonPending = queue.filter((c) => c.status !== "pending");

  console.log(`Queue: ${queue.length} total, ${pending.length} pending, ${nonPending.length} non-pending`);

  // Pull every city doc that has lastGSCImpressions set. Avoids reading the
  // whole collection — only cities GSC has ever surfaced are candidates.
  const snap = await db
    .collection(COLLECTIONS.cities)
    .where("lastGSCImpressions", ">", 0)
    .get();

  const impMap = new Map();
  for (const d of snap.docs) {
    impMap.set(d.id, d.data().lastGSCImpressions || 0);
  }
  console.log(`Loaded GSC impressions for ${impMap.size} cities from Firestore`);

  function impFor(entry) {
    return impMap.get(docIdFor(entry.city, entry.state)) || 0;
  }

  // Stable sort: pending by impressions desc, ties broken by original index.
  const indexed = pending.map((entry, idx) => ({ entry, idx, imp: impFor(entry) }));
  indexed.sort((a, b) => (b.imp - a.imp) || (a.idx - b.idx));

  const sortedPending = indexed.map((x) => x.entry);
  queueDoc.queue = [...sortedPending, ...nonPending];

  fs.writeFileSync(SCRAPE_QUEUE_PATH, JSON.stringify(queueDoc, null, 2) + "\n");

  // Report movement: top 10 promotions vs. original
  const originalOrder = new Map(pending.map((e, i) => [docIdFor(e.city, e.state), i]));
  const movement = sortedPending.map((e, newIdx) => {
    const oldIdx = originalOrder.get(docIdFor(e.city, e.state)) ?? -1;
    return { entry: e, oldIdx, newIdx, delta: oldIdx - newIdx, imp: impFor(e) };
  });

  console.log("\nTop 15 after sort:");
  console.log(["rank", "imp", "delta", "state", "city"].join("\t"));
  for (let i = 0; i < Math.min(15, movement.length); i++) {
    const m = movement[i];
    console.log([i + 1, m.imp, (m.delta >= 0 ? "+" : "") + m.delta, m.entry.state, m.entry.city].join("\t"));
  }

  const withImp = movement.filter((m) => m.imp > 0).length;
  console.log(`\n${withImp} pending cities have GSC impressions; rest stay in original order at the bottom.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
