#!/usr/bin/env node
/**
 * Seed the Firestore expansion queue from existing city data + coordinates.
 * Uses firebase-admin SDK for reliable server-side writes.
 *
 * Usage:
 *   node scripts/seed-expansion-queue.js [--dry-run] [--reset]
 */

const fs = require("fs");
const path = require("path");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.log("service-account.json not found — cannot seed expansion queue.");
  process.exit(0);
}

let admin;
try { admin = require("firebase-admin"); } catch {
  console.error("firebase-admin not installed. Run: npm install firebase-admin");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

// State priority rings
const STATE_PRIORITY = {
  IL: 100, WI: 90, IN: 90, IA: 90, MO: 90, KY: 85,
  MI: 80, OH: 80, MN: 80, KS: 75, NE: 75,
  TX: 70, CA: 70, FL: 70, NY: 70, PA: 65, GA: 65,
};

function parseCities() {
  const cities = [];
  const files = [
    path.join(__dirname, "..", "src", "lib", "cities-data.ts"),
    path.join(__dirname, "..", "src", "lib", "cities-generated.ts"),
  ];
  for (const fp of files) {
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, "utf-8");
    const re = /"([a-z0-9-]+)":\s*\{\s*name:\s*"([^"]+)",\s*state:\s*"([^"]+)",\s*county:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      cities.push({ slug: m[1], name: m[2], state: m[3], county: m[4] });
    }
  }
  return cities;
}

function parseCoords() {
  const fp = path.join(__dirname, "..", "src", "lib", "city-coords.ts");
  if (!fs.existsSync(fp)) return {};
  const content = fs.readFileSync(fp, "utf-8");
  const coords = {};
  const re = /"([A-Z]{2}):([a-z0-9-]+)":\s*\[([0-9.-]+),\s*([0-9.-]+)\]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    coords[`${m[1]}:${m[2]}`] = [parseFloat(m[3]), parseFloat(m[4])];
  }
  return coords;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const reset = args.includes("--reset");

  if (dryRun) console.log("DRY RUN\n");

  const cities = parseCities();
  const coords = parseCoords();
  console.log(`Found ${cities.length} cities and ${Object.keys(coords).length} coordinate entries\n`);

  // Get already-scraped cities
  const plumbersSnap = await db.collection("plumbers").get();
  const scrapedCities = new Set();
  plumbersSnap.docs.forEach((d) => {
    const sc = d.data().serviceCities || [];
    sc.forEach((c) => scrapedCities.add(c.toLowerCase()));
  });
  console.log(`${scrapedCities.size} city slugs already have plumber data\n`);

  // Reset if requested
  if (reset && !dryRun) {
    console.log("Resetting expansion queue...");
    const existing = await db.collection("expansionQueue").get();
    const deleteBatch = db.batch();
    let dc = 0;
    for (const d of existing.docs) {
      deleteBatch.delete(d.ref);
      dc++;
      if (dc % 500 === 0) { await deleteBatch.commit(); }
    }
    if (dc % 500 !== 0) await deleteBatch.commit();
    console.log(`  Deleted ${dc} entries\n`);
  }

  // Check existing queue
  const existingSnap = await db.collection("expansionQueue").get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  // Build entries
  const entries = [];
  let noCoords = 0, alreadyInQueue = 0;

  for (const city of cities) {
    const coordKey = `${city.state}:${city.slug}`;
    const coord = coords[coordKey];
    if (!coord) { noCoords++; continue; }

    const docId = `${city.slug}-${city.state.toLowerCase()}`;
    if (existingIds.has(docId)) { alreadyInQueue++; continue; }

    const isScraped = scrapedCities.has(city.slug) || scrapedCities.has(docId);
    const priority = (STATE_PRIORITY[city.state] || 50) * 100;

    entries.push({
      docId, city: city.name, state: city.state, county: city.county,
      lat: coord[0], lng: coord[1],
      status: isScraped ? "complete" : "queued",
      priority, plumbersFound: 0,
    });
  }

  entries.sort((a, b) => b.priority - a.priority);
  const queued = entries.filter((e) => e.status === "queued");
  const complete = entries.filter((e) => e.status === "complete");

  console.log(`Queue breakdown:`);
  console.log(`  Queued (new): ${queued.length}`);
  console.log(`  Complete (already scraped): ${complete.length}`);
  console.log(`  Skipped (no coords): ${noCoords}`);
  console.log(`  Skipped (already in queue): ${alreadyInQueue}`);

  const stateBreak = {};
  queued.forEach((e) => { stateBreak[e.state] = (stateBreak[e.state] || 0) + 1; });
  const topStates = Object.entries(stateBreak).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`\n  Top states in queue:`);
  topStates.forEach(([s, c]) => console.log(`    ${s}: ${c} cities`));

  if (dryRun) {
    console.log(`\n[DRY RUN] Would write ${entries.length} entries`);
    return;
  }

  // Write in batches
  let written = 0;
  let batch = db.batch();
  let bc = 0;

  for (const e of entries) {
    const ref = db.collection("expansionQueue").doc(e.docId);
    batch.set(ref, {
      city: e.city, state: e.state, county: e.county,
      lat: e.lat, lng: e.lng, status: e.status,
      priority: e.priority,
      queuedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: e.status === "complete" ? admin.firestore.FieldValue.serverTimestamp() : null,
      plumbersFound: e.plumbersFound, attempts: 0, lastError: null,
    });
    bc++; written++;

    if (bc >= 500) {
      await batch.commit();
      console.log(`  Committed batch (${written} so far)`);
      batch = db.batch();
      bc = 0;
    }
  }
  if (bc > 0) await batch.commit();

  console.log(`\nExpansion queue seeded: ${written} entries (${queued.length} queued, ${complete.length} complete)`);
}

main().catch((err) => { console.error("Failed:", err); process.exit(1); });
