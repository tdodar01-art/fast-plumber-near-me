#!/usr/bin/env node

/**
 * Look up Better Business Bureau data for plumbers in specified cities.
 *
 * For each plumber, searches BBB by name + city + state, fuzzy-matches,
 * then scrapes the profile page for complaint data and years in business.
 * Stores results on the plumber document under a "bbb" field.
 *
 * Manual use only.
 *
 * Usage:
 *   node scripts/bbb-lookup.js crystal-lake-il aberdeen-md
 *   node scripts/bbb-lookup.js crystal-lake-il --dry-run
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
const BBB_SEARCH_URL = "https://www.bbb.org/api/search";
const BBB_BASE_URL = "https://www.bbb.org";
const REQUEST_DELAY_MS = 1500; // polite delay between BBB requests
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalize a business name for fuzzy comparison.
 * Strips common suffixes (LLC, Inc, Corp, etc.), punctuation, and lowercases.
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/<\/?em>/g, "") // BBB wraps matches in <em>
    .replace(/\b(llc|inc|corp|corporation|co|company|plumbing|sewer|heating|cooling|services|service|and|&)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Simple similarity score: ratio of shared characters in sorted order.
 * Returns 0-1 where 1 is exact match.
 */
function similarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  // Jaccard on character bigrams
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

// ---------------------------------------------------------------------------
// BBB Search API
// ---------------------------------------------------------------------------

async function searchBBB(businessName, city, state) {
  const url = new URL(BBB_SEARCH_URL);
  url.searchParams.set("find_text", businessName);
  url.searchParams.set("find_loc", `${city} ${state}`);
  url.searchParams.set("find_type", "businesses");
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "5");

  const resp = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!resp.ok) {
    throw new Error(`BBB search returned ${resp.status}`);
  }

  const data = await resp.json();
  return data.results || [];
}

// ---------------------------------------------------------------------------
// BBB Profile Page Scrape (for complaint data + years in business)
// ---------------------------------------------------------------------------

async function scrapeProfile(reportUrl) {
  const fullUrl = `${BBB_BASE_URL}${reportUrl}`;
  const resp = await fetch(fullUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!resp.ok) {
    throw new Error(`BBB profile returned ${resp.status}`);
  }

  const html = await resp.text();

  const extract = (pattern) => {
    const m = html.match(pattern);
    return m ? parseInt(m[1], 10) : null;
  };

  return {
    complaintsTotal: extract(/"complaintsTotal":(\d+)/),
    complaintsPast3Years: extract(/"totalClosedComplaintsPastThreeYears":(\d+)/),
    complaintsPast12Months: extract(/"totalClosedComplaintsPastTwelveMonths":(\d+)/),
    yearsInBusiness: extract(/"yearsInBusiness":(\d+)/) || extract(/Years in Business[^0-9]*(\d+)/i),
  };
}

// ---------------------------------------------------------------------------
// Match & lookup a single plumber
// ---------------------------------------------------------------------------

async function lookupPlumber(businessName, city, state) {
  const results = await searchBBB(businessName, city, state);

  if (results.length === 0) {
    return null;
  }

  // Find best fuzzy match
  let bestMatch = null;
  let bestScore = 0;

  for (const r of results) {
    const cleanName = (r.businessName || "").replace(/<\/?em>/g, "");
    const score = similarity(businessName, cleanName);

    // Also check if it's in the right category (plumber-related)
    const isPlumber = (r.categories || []).some((c) =>
      /plumb|sewer|drain|pipe|water/i.test(c.name)
    );

    // Boost score for plumber category match
    const adjusted = isPlumber ? score + 0.1 : score;

    if (adjusted > bestScore) {
      bestScore = adjusted;
      bestMatch = r;
    }
  }

  // Require minimum similarity
  if (bestScore < 0.3) {
    return null;
  }

  const cleanName = (bestMatch.businessName || "").replace(/<\/?em>/g, "");

  // Scrape profile page for complaint data
  let profileData = {
    complaintsTotal: null,
    complaintsPast3Years: null,
    complaintsPast12Months: null,
    yearsInBusiness: null,
  };

  const profileUrl = bestMatch.reportUrl || bestMatch.localReportUrl;
  if (profileUrl) {
    try {
      await sleep(REQUEST_DELAY_MS);
      profileData = await scrapeProfile(profileUrl);
    } catch (err) {
      console.error(`      Profile scrape failed: ${err.message}`);
    }
  }

  return {
    accredited: bestMatch.bbbMember === true,
    rating: bestMatch.rating || null,
    ratingScore: bestMatch.ratingScore || null,
    complaintsTotal: profileData.complaintsTotal,
    complaintsPast3Years: profileData.complaintsPast3Years,
    complaintsPast12Months: profileData.complaintsPast12Months,
    yearsInBusiness: profileData.yearsInBusiness,
    bbbUrl: profileUrl ? `${BBB_BASE_URL}${profileUrl}` : null,
    bbbBusinessName: cleanName,
    matchScore: Math.round(bestScore * 100) / 100,
    lastBBBPull: admin.firestore.Timestamp.now(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const citySlugs = args.filter((a) => !a.startsWith("--"));

  if (citySlugs.length === 0) {
    console.error("Usage: node scripts/bbb-lookup.js <city-slug> [city-slug...] [--dry-run]");
    console.error("Example: node scripts/bbb-lookup.js crystal-lake-il aberdeen-md");
    process.exit(1);
  }

  if (dryRun) console.log("DRY RUN — no Firestore writes\n");

  console.log("=== BBB Lookup ===\n");

  let totalPlumbers = 0;
  let totalMatched = 0;
  let totalNotFound = 0;
  let totalErrors = 0;
  let totalAccredited = 0;
  const startedAt = new Date();

  const plumberDetails = [];

  for (const citySlug of citySlugs) {
    console.log(`\n📍 City: ${citySlug}`);

    // Try slug as-is, then without state suffix (e.g. "crystal-lake-il" -> "crystal-lake")
    let snap = await db.collection("plumbers")
      .where("serviceCities", "array-contains", citySlug)
      .where("isActive", "==", true)
      .get();

    if (snap.empty) {
      const shortSlug = citySlug.replace(/-[a-z]{2}$/, "");
      if (shortSlug !== citySlug) {
        snap = await db.collection("plumbers")
          .where("serviceCities", "array-contains", shortSlug)
          .where("isActive", "==", true)
          .get();
        if (!snap.empty) console.log(`  (matched on "${shortSlug}")`);
      }
    }

    if (snap.empty) {
      console.log(`  No active plumbers found for ${citySlug}. Skipping.`);
      continue;
    }

    console.log(`  Found ${snap.size} plumber(s)\n`);

    for (const doc of snap.docs) {
      const data = doc.data();
      const city = data.address?.city || "";
      const state = data.address?.state || "";
      totalPlumbers++;

      console.log(`  🔧 ${data.businessName} (${city}, ${state})`);

      if (!city || !state) {
        console.log(`    Skipping — no city/state data.`);
        totalNotFound++;
        continue;
      }

      try {
        await sleep(REQUEST_DELAY_MS);
        const bbbData = await lookupPlumber(data.businessName, city, state);

        if (!bbbData) {
          console.log(`    Not found on BBB.`);
          totalNotFound++;
          plumberDetails.push({ name: data.businessName, id: doc.id, matched: false });
          continue;
        }

        totalMatched++;
        if (bbbData.accredited) totalAccredited++;

        const complaints = bbbData.complaintsPast3Years ?? bbbData.complaintsTotal ?? 0;
        console.log(`    ✓ BBB: ${bbbData.rating} | ${bbbData.accredited ? "Accredited" : "Not Accredited"} | ${complaints} complaints (3yr) | ${bbbData.yearsInBusiness ?? "?"} yrs | match: ${bbbData.matchScore}`);

        plumberDetails.push({ name: data.businessName, id: doc.id, matched: true, rating: bbbData.rating, accredited: bbbData.accredited, complaints3yr: bbbData.complaintsPast3Years, yearsInBusiness: bbbData.yearsInBusiness });

        if (!dryRun) {
          await db.collection("plumbers").doc(doc.id).update({
            bbb: bbbData,
            updatedAt: admin.firestore.Timestamp.now(),
          });
        }
      } catch (err) {
        console.error(`    ERROR: ${err.message}`);
        totalErrors++;
        plumberDetails.push({ name: data.businessName, id: doc.id, error: err.message });
      }
    }
  }

  // Summary
  const elapsed = Math.round((Date.now() - startedAt.getTime()) / 1000);

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`  Cities processed: ${citySlugs.length}`);
  console.log(`  Plumbers looked up: ${totalPlumbers}`);
  console.log(`  Matched on BBB: ${totalMatched}`);
  console.log(`  Not found on BBB: ${totalNotFound}`);
  console.log(`  BBB Accredited: ${totalAccredited}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`  Duration: ${elapsed}s`);

  // Log to pipelineRuns
  if (!dryRun) {
    try {
      await db.collection("pipelineRuns").add({
        script: "bbb-lookup",
        startedAt: admin.firestore.Timestamp.fromDate(startedAt),
        completedAt: admin.firestore.Timestamp.now(),
        durationSeconds: elapsed,
        status: totalErrors > 0 ? "partial" : "success",
        summary: {
          citySlugs,
          plumbersLookedUp: totalPlumbers,
          matchedOnBBB: totalMatched,
          notFoundOnBBB: totalNotFound,
          accredited: totalAccredited,
          errors: totalErrors,
          plumberDetails,
        },
        triggeredBy: "manual",
      });
    } catch { /* */ }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
