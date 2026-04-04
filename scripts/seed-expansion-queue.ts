#!/usr/bin/env npx ts-node --esm
/**
 * Seed the Firestore expansion queue from existing city data + coordinates.
 * Prioritizes: Illinois first, then adjacent states, then by population.
 *
 * Usage:
 *   npx ts-node scripts/seed-expansion-queue.ts [--dry-run] [--reset]
 *
 * Flags:
 *   --dry-run   Log what would be created without writing to Firestore
 *   --reset     Clear existing queue and rebuild from scratch
 */

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, doc, setDoc, getDocs, deleteDoc,
  query, where, Timestamp, writeBatch,
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function initFirebase() {
  if (getApps().length) return getFirestore();
  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  return getFirestore(app);
}

// ---------------------------------------------------------------------------
// State priority rings (from Illinois outward)
// ---------------------------------------------------------------------------

const STATE_PRIORITY: Record<string, number> = {
  // Ring 0: Home turf
  IL: 100,
  // Ring 1: Adjacent states
  WI: 90, IN: 90, IA: 90, MO: 90, KY: 85,
  // Ring 2: Near-Midwest
  MI: 80, OH: 80, MN: 80, KS: 75, NE: 75,
  // Ring 3: Major population centers
  TX: 70, CA: 70, FL: 70, NY: 70, PA: 65, GA: 65,
  // Ring 4: Everything else defaults to 50
};

function getStatePriority(state: string): number {
  return STATE_PRIORITY[state] ?? 50;
}

// ---------------------------------------------------------------------------
// Parse city data from TypeScript source files
// ---------------------------------------------------------------------------

interface CityEntry {
  slug: string;
  name: string;
  state: string;
  county: string;
}

function parseCitiesFromTS(): CityEntry[] {
  const cities: CityEntry[] = [];
  const files = [
    path.join(__dirname, "..", "src", "lib", "cities-data.ts"),
    path.join(__dirname, "..", "src", "lib", "cities-generated.ts"),
  ];

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf-8");
    const cityRegex = /"([a-z0-9-]+)":\s*\{\s*name:\s*"([^"]+)",\s*state:\s*"([^"]+)",\s*county:\s*"([^"]+)"/g;
    let match;
    while ((match = cityRegex.exec(content)) !== null) {
      cities.push({ slug: match[1], name: match[2], state: match[3], county: match[4] });
    }
  }
  return cities;
}

// ---------------------------------------------------------------------------
// Parse coordinates from city-coords.ts
// ---------------------------------------------------------------------------

function parseCoords(): Record<string, [number, number]> {
  const coordPath = path.join(__dirname, "..", "src", "lib", "city-coords.ts");
  if (!fs.existsSync(coordPath)) return {};
  const content = fs.readFileSync(coordPath, "utf-8");
  const coords: Record<string, [number, number]> = {};
  const regex = /"([A-Z]{2}):([a-z0-9-]+)":\s*\[([0-9.-]+),\s*([0-9.-]+)\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    coords[`${match[1]}:${match[2]}`] = [parseFloat(match[3]), parseFloat(match[4])];
  }
  return coords;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const reset = args.includes("--reset");

  const db = initFirebase();

  if (dryRun) console.log("🔍 DRY RUN — no Firestore writes\n");

  // Parse source data
  const cities = parseCitiesFromTS();
  const coords = parseCoords();
  console.log(`📋 Found ${cities.length} cities and ${Object.keys(coords).length} coordinate entries\n`);

  // Get already-scraped cities from plumber serviceCities
  const plumbersSnap = await getDocs(collection(db, "plumbers"));
  const scrapedCities = new Set<string>();
  for (const plumberDoc of plumbersSnap.docs) {
    const serviceCities = plumberDoc.data().serviceCities as string[] | undefined;
    if (serviceCities) {
      for (const sc of serviceCities) scrapedCities.add(sc.toLowerCase());
    }
  }
  console.log(`✅ ${scrapedCities.size} city slugs already have plumber data\n`);

  // Reset if requested
  if (reset && !dryRun) {
    console.log("🗑️  Resetting expansion queue...");
    const existingSnap = await getDocs(collection(db, "expansionQueue"));
    let deleted = 0;
    for (const d of existingSnap.docs) {
      await deleteDoc(d.ref);
      deleted++;
    }
    console.log(`  Deleted ${deleted} entries\n`);
  }

  // Check existing queue entries to avoid duplicates
  const existingQueueSnap = await getDocs(collection(db, "expansionQueue"));
  const existingInQueue = new Set<string>();
  for (const d of existingQueueSnap.docs) {
    existingInQueue.add(d.id);
  }

  // Build queue entries
  interface QueueEntry {
    docId: string;
    city: string;
    state: string;
    county: string;
    lat: number;
    lng: number;
    status: "queued" | "complete";
    priority: number;
    plumbersFound: number;
  }

  const entries: QueueEntry[] = [];
  let skippedNoCoords = 0;
  let skippedAlreadyInQueue = 0;

  for (const city of cities) {
    const coordKey = `${city.state}:${city.slug}`;
    const coord = coords[coordKey];
    if (!coord) { skippedNoCoords++; continue; }

    const docId = `${city.slug}-${city.state.toLowerCase()}`;
    if (existingInQueue.has(docId)) { skippedAlreadyInQueue++; continue; }

    const isAlreadyScraped = scrapedCities.has(city.slug) || scrapedCities.has(docId);

    // Priority: state ring × 100 + alphabetical tiebreak
    const statePriority = getStatePriority(city.state);
    const priority = statePriority * 100;

    entries.push({
      docId,
      city: city.name,
      state: city.state,
      county: city.county,
      lat: coord[0],
      lng: coord[1],
      status: isAlreadyScraped ? "complete" : "queued",
      priority,
      plumbersFound: 0,
    });
  }

  // Sort by priority descending
  entries.sort((a, b) => b.priority - a.priority);

  const queued = entries.filter((e) => e.status === "queued");
  const complete = entries.filter((e) => e.status === "complete");

  console.log(`📊 Queue breakdown:`);
  console.log(`  Queued (new): ${queued.length}`);
  console.log(`  Complete (already scraped): ${complete.length}`);
  console.log(`  Skipped (no coords): ${skippedNoCoords}`);
  console.log(`  Skipped (already in queue): ${skippedAlreadyInQueue}`);

  // State breakdown for queued
  const stateBreakdown: Record<string, number> = {};
  for (const e of queued) {
    stateBreakdown[e.state] = (stateBreakdown[e.state] || 0) + 1;
  }
  const topStates = Object.entries(stateBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`\n  Top states in queue:`);
  for (const [state, count] of topStates) {
    console.log(`    ${state}: ${count} cities`);
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] Would write ${entries.length} entries to expansionQueue`);
    return { queued: queued.length, complete: complete.length, total: entries.length };
  }

  // Write to Firestore in batches
  const BATCH_SIZE = 500;
  let written = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const entry of entries) {
    const docRef = doc(db, "expansionQueue", entry.docId);
    batch.set(docRef, {
      city: entry.city,
      state: entry.state,
      county: entry.county,
      lat: entry.lat,
      lng: entry.lng,
      status: entry.status,
      priority: entry.priority,
      queuedAt: Timestamp.now(),
      completedAt: entry.status === "complete" ? Timestamp.now() : null,
      plumbersFound: entry.plumbersFound,
      attempts: 0,
      lastError: null,
    });
    batchCount++;
    written++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch (${written} so far)`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n✅ Expansion queue seeded: ${written} entries`);
  return { queued: queued.length, complete: complete.length, total: written };
}

main()
  .then((result) => {
    console.log(`\nDone. ${result?.queued ?? 0} cities queued for expansion.`);
  })
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
