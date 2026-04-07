#!/usr/bin/env node

/**
 * Seed Firestore `cities` collection from plumbers-synthesized.json.
 *
 * Extracts every unique city/state combo, creates a doc for each with
 * scraped: true so the GSC expansion system doesn't re-scrape them.
 *
 * Usage:
 *   node scripts/seed-cities-collection.js
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
const SYNTH_PATH = path.join(__dirname, "..", "data", "synthesized", "plumbers-synthesized.json");
const QUEUE_PATH = path.join(__dirname, "scrape-queue.json");

// ---------------------------------------------------------------------------
// Check prerequisites
// ---------------------------------------------------------------------------

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("ERROR: service-account.json not found.");
  console.error(`  Expected at: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(SYNTH_PATH)) {
  console.error("ERROR: plumbers-synthesized.json not found.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

let admin;
try {
  admin = require("firebase-admin");
} catch {
  console.error("ERROR: firebase-admin not installed. Run: npm install firebase-admin");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text) {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Seeding Firestore cities collection ===\n");

  // Load plumber data
  const synthData = JSON.parse(fs.readFileSync(SYNTH_PATH, "utf-8"));
  const plumbers = synthData.plumbers;
  console.log(`Loaded ${plumbers.length} plumbers from synthesized data\n`);

  // Extract unique city/state combos with plumber counts
  const cities = new Map();
  for (const p of plumbers) {
    const state = p.state || "";
    if (!state) continue;
    const key = `${p.city}|${state}`;
    if (!cities.has(key)) {
      cities.set(key, { city: p.city, state, count: 0 });
    }
    cities.get(key).count++;
  }

  // Load scrape queue for completion dates
  const scrapeDates = new Map();
  if (fs.existsSync(QUEUE_PATH)) {
    const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf-8"));
    for (const c of queue.completed || []) {
      const state = c.state || "IL";
      const key = `${c.city}|${state}`;
      scrapeDates.set(key, c.completedAt);
    }
  }

  // Out-of-state cities that were manually triggered (not from cron)
  const manualCities = new Set([
    "Alameda|CA", "Yukon|OK", "Nashville|TN", "Acworth|GA", "Aiken|SC", "Mundelein|IL",
  ]);

  console.log(`Found ${cities.size} unique city/state combos\n`);

  // Write to Firestore in batches
  const BATCH_SIZE = 400; // Firestore limit is 500
  let batch = db.batch();
  let batchCount = 0;
  let totalWritten = 0;

  for (const [key, data] of cities) {
    const docId = `${slugify(data.city)}-${data.state.toLowerCase()}`;
    const scrapedAt = scrapeDates.get(key) || new Date().toISOString().slice(0, 10);

    let source = "cron";
    if (manualCities.has(key)) source = "manual";
    else if (data.state !== "IL") source = "manual";

    const doc = {
      slug: docId,
      city: data.city,
      state: data.state,
      source,
      firstSeenGSC: null,
      impressionsAtDiscovery: null,
      scraped: true,
      scrapedAt: scrapedAt + (scrapedAt.includes("T") ? "" : "T00:00:00Z"),
      scrapeSource: "google-places",
      plumberCount: data.count,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = db.collection("cities").doc(docId);
    batch.set(ref, doc, { merge: true });
    batchCount++;
    totalWritten++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount} docs`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} docs`);
  }

  console.log(`\nSeeded ${totalWritten} cities to Firestore 'cities' collection.`);

  // Print what was seeded
  console.log("\nCities seeded:");
  for (const [, data] of [...cities].sort((a, b) => a[1].state.localeCompare(b[1].state) || a[1].city.localeCompare(b[1].city))) {
    const source = manualCities.has(`${data.city}|${data.state}`) || data.state !== "IL" ? "manual" : "cron";
    console.log(`  ${data.city}, ${data.state} — ${data.count} plumbers (${source})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
