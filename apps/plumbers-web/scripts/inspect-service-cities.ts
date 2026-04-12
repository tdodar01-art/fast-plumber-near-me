#!/usr/bin/env npx tsx
/**
 * Inspection script: scope the serviceCities convention mismatch.
 *
 * Answers four questions:
 *   1. How many plumber docs have serviceCities populated vs empty?
 *   2. For populated ones, what slug format is used? Is it consistent?
 *   3. What slug format does the cities/ collection use?
 *   4. Spot-check: does the plain-city form appear in plumber docs for the
 *      same cities that cities/ stores as {slug}-{state}?
 *
 * Read-only. Safe to run anytime.
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length) return admin.firestore();
  const saPath = path.join(__dirname, "..", "service-account.json");
  const sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

// A "state-suffixed" slug looks like "provo-ut" — ends in `-xx` where xx is
// two letters. A "plain" slug is anything else (e.g., "provo", "crystal-lake").
// This isn't perfect ("foo-ab" could be a real city name ending in ab) but
// good enough for scope counting.
function classifySlug(slug: string): "state_suffixed" | "plain" {
  return /-[a-z]{2}$/.test(slug) ? "state_suffixed" : "plain";
}

async function main() {
  const db = initFirebase();

  // --- Q1 + Q2: plumber docs ---
  const plumbersSnap = await db.collection("plumbers").get();
  console.log(`\nTotal plumber docs: ${plumbersSnap.size}`);

  let emptyOrMissing = 0;
  let populated = 0;
  const formatCounts = { state_suffixed: 0, plain: 0, mixed: 0 };
  const mixedExamples: Array<{ id: string; slugs: string[] }> = [];
  const sampleByFormat: Record<string, Array<{ id: string; slugs: string[] }>> = {
    state_suffixed: [],
    plain: [],
  };

  // Tracks format for each unique city slug (so we can diff against cities/)
  const plumberCitySlugs = new Set<string>();

  for (const doc of plumbersSnap.docs) {
    const data = doc.data();
    const sc = data.serviceCities;
    if (!Array.isArray(sc) || sc.length === 0) {
      emptyOrMissing++;
      continue;
    }
    populated++;
    const classes = new Set(sc.map(classifySlug));
    for (const s of sc) plumberCitySlugs.add(s);
    if (classes.size > 1) {
      formatCounts.mixed++;
      if (mixedExamples.length < 5)
        mixedExamples.push({ id: doc.id, slugs: sc });
    } else {
      const [only] = Array.from(classes);
      formatCounts[only as "state_suffixed" | "plain"]++;
      const bucket = sampleByFormat[only as string];
      if (bucket.length < 3) bucket.push({ id: doc.id, slugs: sc });
    }
  }

  console.log(`\n--- Q1: serviceCities population ---`);
  console.log(`  populated:        ${populated}`);
  console.log(`  empty or missing: ${emptyOrMissing}`);

  console.log(`\n--- Q2: slug format in populated plumber docs ---`);
  console.log(`  state_suffixed only (e.g. "provo-ut"): ${formatCounts.state_suffixed}`);
  console.log(`  plain only          (e.g. "provo"):    ${formatCounts.plain}`);
  console.log(`  mixed within doc:                      ${formatCounts.mixed}`);

  console.log(`\n  sample state_suffixed docs:`);
  for (const s of sampleByFormat.state_suffixed)
    console.log(`    ${s.id}: ${JSON.stringify(s.slugs)}`);
  console.log(`  sample plain docs:`);
  for (const s of sampleByFormat.plain)
    console.log(`    ${s.id}: ${JSON.stringify(s.slugs)}`);
  if (mixedExamples.length > 0) {
    console.log(`  sample mixed docs:`);
    for (const s of mixedExamples)
      console.log(`    ${s.id}: ${JSON.stringify(s.slugs)}`);
  }

  // --- Q3: cities/ collection ---
  const citiesSnap = await db.collection("cities").get();
  const cityFormats = { state_suffixed: 0, plain: 0 };
  const citySampleSuffixed: string[] = [];
  const citySamplePlain: string[] = [];
  const cityIds = new Set<string>();
  for (const doc of citiesSnap.docs) {
    cityIds.add(doc.id);
    const f = classifySlug(doc.id);
    cityFormats[f]++;
    if (f === "state_suffixed" && citySampleSuffixed.length < 5)
      citySampleSuffixed.push(doc.id);
    if (f === "plain" && citySamplePlain.length < 5)
      citySamplePlain.push(doc.id);
  }
  console.log(`\n--- Q3: cities/ collection ---`);
  console.log(`  total city docs: ${citiesSnap.size}`);
  console.log(`  state_suffixed:  ${cityFormats.state_suffixed}`);
  console.log(`  plain:           ${cityFormats.plain}`);
  console.log(`  sample suffixed: ${JSON.stringify(citySampleSuffixed)}`);
  if (citySamplePlain.length > 0)
    console.log(`  sample plain:    ${JSON.stringify(citySamplePlain)}`);

  // --- Q4: cross-reference — where do plumber slugs land in cities/? ---
  let matchDirect = 0;
  let matchOnlyAfterStateAppend = 0;
  let noMatchEither = 0;
  const noMatchSamples: string[] = [];
  const appendOnlySamples: string[] = [];

  for (const slug of plumberCitySlugs) {
    if (cityIds.has(slug)) {
      matchDirect++;
      continue;
    }
    // Try appending any 2-letter state suffix if the slug is plain
    if (classifySlug(slug) === "plain") {
      // Scan cities/ for anything that starts with `${slug}-`
      const candidate = [...cityIds].find((c) => c.startsWith(`${slug}-`));
      if (candidate) {
        matchOnlyAfterStateAppend++;
        if (appendOnlySamples.length < 5)
          appendOnlySamples.push(`${slug} -> ${candidate}`);
        continue;
      }
    }
    noMatchEither++;
    if (noMatchSamples.length < 5) noMatchSamples.push(slug);
  }
  console.log(`\n--- Q4: plumber slug vs cities/ collection ---`);
  console.log(`  unique plumber city slugs: ${plumberCitySlugs.size}`);
  console.log(`  direct match in cities/:                ${matchDirect}`);
  console.log(`  match only after appending -{state}:    ${matchOnlyAfterStateAppend}`);
  console.log(`  no match either way:                    ${noMatchEither}`);
  if (appendOnlySamples.length > 0) {
    console.log(`  sample plain -> suffixed matches:`);
    for (const s of appendOnlySamples) console.log(`    ${s}`);
  }
  if (noMatchSamples.length > 0) {
    console.log(`  sample no-match slugs: ${JSON.stringify(noMatchSamples)}`);
  }

  // --- Q5: provo specifically ---
  console.log(`\n--- Provo spot check ---`);
  const provoDirect = plumbersSnap.docs.filter((d) => {
    const sc = d.data().serviceCities;
    return Array.isArray(sc) && sc.includes("provo");
  }).length;
  const provoSuffixed = plumbersSnap.docs.filter((d) => {
    const sc = d.data().serviceCities;
    return Array.isArray(sc) && sc.includes("provo-ut");
  }).length;
  const provoCityDoc = await db.collection("cities").doc("provo-ut").get();
  const provoCityPlain = await db.collection("cities").doc("provo").get();
  console.log(`  plumbers with serviceCities.includes("provo"):    ${provoDirect}`);
  console.log(`  plumbers with serviceCities.includes("provo-ut"): ${provoSuffixed}`);
  console.log(`  cities/provo-ut exists:                           ${provoCityDoc.exists}`);
  console.log(`  cities/provo exists:                              ${provoCityPlain.exists}`);

  console.log(`\nDone.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
