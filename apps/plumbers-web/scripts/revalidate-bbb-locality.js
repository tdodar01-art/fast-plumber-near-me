#!/usr/bin/env node

/**
 * Targeted re-validation of stored BBB records against the locality logic
 * in bbb-lookup.js (state match + 30mi haversine).
 *
 * The rerun pass on 2026-05-07 re-pulled BBB for every active plumber but
 * only UPDATED records when a local match was found — when none was, the
 * old (potentially-wrong) record was preserved. This script closes that
 * gap by re-running the BBB search per plumber-with-bbb-data and nulling
 * the bbb field when the new locality logic finds no local match.
 *
 * Net effect: any plumber whose stored bbbUrl points to a profile that
 * fails the new state+distance check loses its bbb data, falling back to
 * the "no BBB info" rendering path until a future BBB lookup populates a
 * valid local record.
 *
 * Usage:
 *   node scripts/revalidate-bbb-locality.js --dry-run
 *   node scripts/revalidate-bbb-locality.js
 */

const fs = require("fs");
const path = require("path");
const { COLLECTIONS } = require("./config/plumbing-directory.cjs");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
const BBB_SEARCH_URL = "https://www.bbb.org/api/search";
const REQUEST_DELAY_MS = 1500;
const LOCALITY_RADIUS_MILES = 30;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("ERROR: service-account.json not found.");
  process.exit(1);
}

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parseBbbLocation(loc) {
  if (!loc || typeof loc !== "string") return null;
  const parts = loc.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts;
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/<\/?em>/g, "")
    .replace(/\b(llc|inc|corp|corporation|co|company|plumbing|sewer|heating|cooling|services|service|and|&)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function similarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const bigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const setA = bigrams(na);
  const setB = bigrams(nb);
  let intersection = 0;
  for (const b of setA) if (setB.has(b)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

async function searchBBB(businessName, city, state) {
  const url = new URL(BBB_SEARCH_URL);
  url.searchParams.set("find_text", businessName);
  url.searchParams.set("find_loc", `${city} ${state}`);
  url.searchParams.set("find_type", "businesses");
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "5");
  const resp = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } });
  if (!resp.ok) throw new Error(`BBB search returned ${resp.status}`);
  const data = await resp.json();
  return data.results || [];
}

/**
 * Run the new locality logic against fresh BBB API results.
 * Returns:
 *   { ok: true,  hasLocalMatch: true }   — has a valid local match
 *   { ok: true,  hasLocalMatch: false }  — no local match (record should be scrubbed)
 *   { ok: false, error: string }         — search failed; leave record alone
 */
async function hasLocalMatch(businessName, plumberCity, plumberState, plumberLat, plumberLng) {
  let results;
  try {
    results = await searchBBB(businessName, plumberCity, plumberState);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const ps = (plumberState || "").toUpperCase();
  for (const r of results) {
    const rs = (r.state || "").toUpperCase();
    if (!rs || rs !== ps) continue;
    const bbbLoc = parseBbbLocation(r.location);
    if (
      bbbLoc &&
      Number.isFinite(plumberLat) &&
      Number.isFinite(plumberLng)
    ) {
      const distMi = haversineMiles(plumberLat, plumberLng, bbbLoc[0], bbbLoc[1]);
      if (distMi > LOCALITY_RADIUS_MILES) continue;
    }
    const cleanName = (r.businessName || "").replace(/<\/?em>/g, "");
    const score = similarity(businessName, cleanName);
    const isPlumber = (r.categories || []).some((c) =>
      /plumb|sewer|drain|pipe|water/i.test(c.name)
    );
    const adjusted = isPlumber ? score + 0.1 : score;
    if (adjusted >= 0.3) return { ok: true, hasLocalMatch: true };
  }
  return { ok: true, hasLocalMatch: false };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log("=== BBB Locality Re-validation ===");
  if (dryRun) console.log("DRY RUN — no Firestore writes\n");

  const snap = await db
    .collection("plumbers")
    .where("isActive", "==", true)
    .get();

  const candidates = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (d.bbb && d.bbb.bbbUrl) candidates.push({ id: doc.id, data: d });
  });

  console.log(`Re-validating ${candidates.length} plumbers with stored BBB data...\n`);

  let kept = 0;
  let scrubbed = 0;
  let searchErrors = 0;
  let skipped = 0;
  const samples = [];

  for (let i = 0; i < candidates.length; i++) {
    const { id, data } = candidates[i];
    const city = data.address?.city || "";
    const state = data.address?.state || "";
    const lat = data.address?.lat;
    const lng = data.address?.lng;

    if (!city || !state) {
      skipped++;
      continue;
    }

    if (i > 0) await sleep(REQUEST_DELAY_MS);
    if ((i + 1) % 25 === 0) {
      console.log(`  ${i + 1}/${candidates.length} — kept=${kept} scrubbed=${scrubbed} errors=${searchErrors}`);
    }

    const result = await hasLocalMatch(data.businessName, city, state, lat, lng);

    if (!result.ok) {
      searchErrors++;
      continue;
    }

    if (result.hasLocalMatch) {
      kept++;
    } else {
      samples.push({
        name: data.businessName,
        plumberCity: city,
        plumberState: state,
        url: data.bbb.bbbUrl,
        complaints: data.bbb.complaintsPast3Years,
      });
      if (!dryRun) {
        await db.collection(COLLECTIONS.businesses).doc(id).update({
          bbb: admin.firestore.FieldValue.delete(),
        });
      }
      scrubbed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`  Plumbers re-validated: ${candidates.length}`);
  console.log(`  Kept (still has local match): ${kept}`);
  console.log(`  Scrubbed (no local match):    ${scrubbed}`);
  console.log(`  Search errors (left alone):   ${searchErrors}`);
  console.log(`  Skipped (no city/state):      ${skipped}`);
  console.log();
  if (samples.length > 0) {
    console.log("Scrubbed samples:");
    console.log("─".repeat(60));
    for (const s of samples.slice(0, 20)) {
      console.log(`  ${(s.name || "?").padEnd(45).slice(0, 45)} ${s.plumberCity}, ${s.plumberState}  c3y=${s.complaints ?? "-"}`);
      console.log(`    was: ${s.url}`);
    }
    if (samples.length > 20) console.log(`  ... and ${samples.length - 20} more`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
