#!/usr/bin/env node

/**
 * Export plumber data from Firestore back to the static JSON the Next.js site reads.
 *
 * Merges Firestore review synthesis, BBB data, Yelp/Angi ratings, and cached
 * review counts into the existing plumbers-synthesized.json. Only touches
 * plumbers whose Firestore updatedAt is newer than the JSON's synthesizedAt.
 *
 * After writing, optionally commits + pushes to trigger a Vercel rebuild.
 *
 * Usage:
 *   node scripts/export-firestore-to-json.js              # export + commit + push
 *   node scripts/export-firestore-to-json.js --no-push    # export only, no git
 *   node scripts/export-firestore-to-json.js --dry-run    # show what would change
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
const JSON_PATH = path.join(__dirname, "..", "data", "synthesized", "plumbers-synthesized.json");

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
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

loadEnv();

// ---------------------------------------------------------------------------
// Prerequisites
// ---------------------------------------------------------------------------

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("ERROR: service-account.json not found.");
  process.exit(1);
}

if (!fs.existsSync(JSON_PATH)) {
  console.error("ERROR: plumbers-synthesized.json not found at:", JSON_PATH);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const noPush = args.includes("--no-push");

  console.log("=== Export Firestore → Static JSON ===\n");

  // Load existing JSON
  const jsonData = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  const plumbers = jsonData.plumbers;
  const plumbersByPlaceId = new Map(plumbers.map((p) => [p.placeId, p]));

  // Load all Firestore plumber docs
  const firestoreSnap = await db.collection("plumbers").get();
  console.log(`Firestore: ${firestoreSnap.size} plumbers | JSON: ${plumbers.length} plumbers\n`);

  let updated = 0;
  let unchanged = 0;
  let added = 0;
  const affectedCities = new Set();

  for (const doc of firestoreSnap.docs) {
    const fd = doc.data();
    const placeId = fd.googlePlaceId || doc.id;
    const existing = plumbersByPlaceId.get(placeId);

    if (!existing) {
      // Plumber in Firestore but not in JSON — could be from a different scrape source
      // Only add if it has minimum required fields
      if (!fd.businessName || !fd.address?.city) continue;

      const newEntry = buildJsonEntry(fd, placeId);
      plumbers.push(newEntry);
      plumbersByPlaceId.set(placeId, newEntry);
      added++;
      (fd.serviceCities || []).forEach((c) => affectedCities.add(c));
      console.log(`  + ${fd.businessName} (new — not in JSON)`);
      continue;
    }

    // Check if Firestore data is newer
    const fsUpdated = fd.updatedAt?.toDate?.() || new Date(0);
    const jsonSynthAt = existing.synthesis?.synthesizedAt
      ? new Date(existing.synthesis.synthesizedAt)
      : new Date(jsonData.meta.synthesizedAt || 0);

    // Also merge if Firestore has fields the JSON doesn't
    const hasBBB = fd.bbb && !existing.bbb;
    const hasNewSynthesis = fd.reviewSynthesis?.aiSynthesizedAt;
    const isNewer = fsUpdated > jsonSynthAt;

    if (!isNewer && !hasBBB && !hasNewSynthesis) {
      unchanged++;
      continue;
    }

    // Merge Firestore enrichment into existing JSON entry
    mergeFirestoreData(existing, fd);
    updated++;
    (fd.serviceCities || []).forEach((c) => affectedCities.add(c));

    const changes = [];
    if (fd.reviewSynthesis?.aiSynthesizedAt) changes.push("synthesis");
    if (fd.bbb) changes.push("bbb");
    if (fd.yelpRating) changes.push("yelp");
    if (fd.angiRating) changes.push("angi");
    console.log(`  ↻ ${fd.businessName} (${changes.join(", ") || "updated"})`);
  }

  console.log(`\nResults: ${updated} updated, ${added} added, ${unchanged} unchanged`);
  console.log(`Affected cities: ${affectedCities.size > 0 ? [...affectedCities].join(", ") : "none"}`);

  if (updated === 0 && added === 0) {
    console.log("\nNo changes to write.");
    return { updated, added, affectedCities: [...affectedCities] };
  }

  // Update meta
  jsonData.meta.synthesizedAt = new Date().toISOString();
  jsonData.meta.totalPlumbers = plumbers.length;
  jsonData.plumbers = plumbers;

  if (dryRun) {
    console.log("\n[DRY RUN] Would write changes to plumbers-synthesized.json");
    return { updated, added, affectedCities: [...affectedCities] };
  }

  // Write JSON
  fs.writeFileSync(JSON_PATH, JSON.stringify(jsonData, null, 2));
  console.log(`\nWrote ${JSON_PATH}`);

  // Git commit + push
  if (!noPush) {
    try {
      const root = path.join(__dirname, "..");
      execSync("git add data/synthesized/plumbers-synthesized.json", { cwd: root, stdio: "pipe" });

      const diff = execSync("git diff --cached --stat", { cwd: root, encoding: "utf-8" });
      if (!diff.trim()) {
        console.log("No git changes detected.");
      } else {
        const msg = `data: export Firestore enrichment (${updated} updated, ${added} added)`;
        execSync(`git commit -m "${msg}"`, { cwd: root, stdio: "pipe" });
        execSync("git push", { cwd: root, stdio: "pipe" });
        console.log(`Committed and pushed: "${msg}"`);
      }
    } catch (err) {
      console.error("Git commit/push failed:", err.message);
      // Non-fatal — data is still written locally
    }
  }

  return { updated, added, affectedCities: [...affectedCities] };
}

// ---------------------------------------------------------------------------
// Build a new JSON entry from Firestore data
// ---------------------------------------------------------------------------

function buildJsonEntry(fd, placeId) {
  return {
    placeId,
    name: fd.businessName,
    slug: slugify(fd.businessName),
    phone: fd.phone || "",
    website: fd.website || null,
    address: fd.address?.full || `${fd.address?.city || ""}, ${fd.address?.state || ""}`,
    city: fd.address?.city || "",
    state: fd.address?.state || "",
    region: fd.region || "",
    location: (fd.address?.lat && fd.address?.lng) ? { lat: fd.address.lat, lng: fd.address.lng } : null,
    googleRating: fd.googleRating || null,
    googleReviewCount: fd.googleReviewCount || 0,
    businessStatus: fd.businessStatus || "OPERATIONAL",
    types: ["plumber"],
    priceLevel: null,
    editorialSummary: null,
    reviews: [],
    is24Hour: fd.is24Hour || false,
    workingHours: fd.workingHours || null,
    scrapedAt: fd.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    synthesis: buildSynthesis(fd),
    serviceCities: fd.serviceCities || [],
    ...(fd.bbb && { bbb: cleanBBB(fd.bbb) }),
  };
}

// ---------------------------------------------------------------------------
// Merge Firestore enrichment fields into existing JSON entry
// ---------------------------------------------------------------------------

function mergeFirestoreData(existing, fd) {
  // Update Google rating if Firestore has fresher data
  if (fd.googleRating) existing.googleRating = fd.googleRating;
  if (fd.googleReviewCount) existing.googleReviewCount = fd.googleReviewCount;

  // Merge AI synthesis from Firestore if it exists
  if (fd.reviewSynthesis?.aiSynthesizedAt || fd.reviewSynthesis?.synthesisVersion?.includes("outscraper")) {
    existing.synthesis = buildSynthesis(fd);
  }

  // BBB data
  if (fd.bbb) {
    existing.bbb = cleanBBB(fd.bbb);
  }

  // Yelp/Angi aggregate ratings
  if (fd.yelpRating) existing.yelpRating = fd.yelpRating;
  if (fd.yelpReviewCount) existing.yelpReviewCount = fd.yelpReviewCount;
  if (fd.angiRating) existing.angiRating = fd.angiRating;
  if (fd.angiReviewCount) existing.angiReviewCount = fd.angiReviewCount;

  // Update scrapedAt
  if (fd.updatedAt?.toDate) {
    existing.scrapedAt = fd.updatedAt.toDate().toISOString();
  }
}

// ---------------------------------------------------------------------------
// Convert Firestore reviewSynthesis → static JSON synthesis format
// ---------------------------------------------------------------------------

function buildSynthesis(fd) {
  const rs = fd.reviewSynthesis;
  if (!rs) return fd.synthesis || null;

  return {
    score: fd.reliabilityScore || 0,
    trustLevel: fd.reliabilityScore >= 70 ? "high" : fd.reliabilityScore >= 40 ? "moderate" : "low",
    summary: rs.summary || "",
    strengths: rs.strengths || [],
    weaknesses: rs.weaknesses || [],
    bestFor: rs.bestFor || [],
    redFlags: rs.redFlags || [],
    priceSignal: rs.pricingTier || "unknown",
    topQuote: rs.topQuote || null,
    worstQuote: rs.worstQuote || null,
    ...(rs.platformDiscrepancy && { platformDiscrepancy: rs.platformDiscrepancy }),
  };
}

// ---------------------------------------------------------------------------
// Clean BBB data for JSON (strip Firestore-specific fields)
// ---------------------------------------------------------------------------

function cleanBBB(bbb) {
  return {
    accredited: bbb.accredited || false,
    rating: bbb.rating || null,
    complaintsTotal: bbb.complaintsTotal ?? null,
    complaintsPast3Years: bbb.complaintsPast3Years ?? null,
    yearsInBusiness: bbb.yearsInBusiness ?? null,
    bbbUrl: bbb.bbbUrl || null,
  };
}

function slugify(text) {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main()
  .then((result) => {
    // Output affected cities as JSON for callers to parse
    if (result.affectedCities.length > 0) {
      console.log(`\n__AFFECTED_CITIES__:${JSON.stringify(result.affectedCities)}`);
    }
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
