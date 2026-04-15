#!/usr/bin/env node

/**
 * Find cities qualifying for Outscraper deep review pull.
 *
 * Queries Firestore for cities with gscTier 'medium' or 'high' (10+ impressions),
 * checks plumber freshness, outputs space-separated city slugs to stdout.
 *
 * All diagnostic output goes to stderr so stdout is clean for the workflow.
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const SA_PATH = path.join(__dirname, "..", "service-account.json");
if (!fs.existsSync(SA_PATH)) {
  console.error("ERROR: service-account.json not found.");
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  // Debug: log all cities and their gscTier values
  const allCities = await db.collection("cities").get();
  console.error("DEBUG: Total cities in Firestore: " + allCities.size);

  const tierCounts = {};
  for (const d of allCities.docs) {
    const tier = d.data().gscTier || "(missing)";
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    if (tier === "medium" || tier === "high") {
      console.error(
        "  " + d.id + " -> gscTier=" + tier +
        ", impressions=" + (d.data().lastGSCImpressions || 0)
      );
    }
  }
  console.error("DEBUG: gscTier distribution: " + JSON.stringify(tierCounts));

  // Get cities with medium or high GSC tier (10+ impressions)
  const snap = await db.collection("cities")
    .where("gscTier", "in", ["medium", "high"])
    .get();

  if (snap.empty) {
    console.error("No medium/high tier cities found.");
    process.exit(0);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const candidates = [];
  for (const cityDoc of snap.docs) {
    const cityData = cityDoc.data();
    const fullSlug = cityDoc.id; // e.g. 'crystal-lake-il'

    // serviceCities stores city-only slugs (e.g. 'crystal-lake'), not 'crystal-lake-il'
    const stateMatch = fullSlug.match(/-([a-z]{2})$/);
    const cityOnlySlug = stateMatch ? fullSlug.slice(0, -3) : fullSlug;
    const stateAbbr = stateMatch ? stateMatch[1].toUpperCase() : "";

    // Try serviceCities match first
    let plumberSnap = await db.collection("plumbers")
      .where("serviceCities", "array-contains", cityOnlySlug)
      .where("isActive", "==", true)
      .get();

    // Fallback: query by state if no serviceCities match
    if (plumberSnap.empty && stateAbbr) {
      const stateSnap = await db.collection("plumbers")
        .where("address.state", "==", stateAbbr)
        .where("isActive", "==", true)
        .get();
      plumberSnap = stateSnap;
      if (!stateSnap.empty) {
        console.error(
          "  " + fullSlug + ": 0 serviceCities matches, using " +
          stateSnap.size + " state-level plumbers"
        );
      }
    }

    if (plumberSnap.empty) continue;

    let allFresh = true;
    for (const p of plumberSnap.docs) {
      const lastPull = p.data().lastOutscraperPull;
      if (!lastPull || lastPull.toDate() < thirtyDaysAgo) {
        allFresh = false;
        break;
      }
    }

    if (!allFresh) {
      candidates.push({
        slug: fullSlug,
        impressions: cityData.lastGSCImpressions || 0,
        tier: cityData.gscTier,
        plumbers: plumberSnap.size,
      });
    }
  }

  // Sort by impressions desc, cap at 3
  candidates.sort((a, b) => b.impressions - a.impressions);
  const selected = candidates.slice(0, 3);

  if (selected.length === 0) {
    console.error("All qualifying cities have fresh Outscraper data.");
    process.exit(0);
  }

  for (const c of selected) {
    console.error(
      "Selected: " + c.slug + " (" + c.tier + ", " +
      c.impressions + " impressions, " + c.plumbers + " plumbers)"
    );
  }

  // Output space-separated slugs to stdout
  console.log(selected.map((c) => c.slug).join(" "));
}

main().catch((e) => {
  console.error("FATAL: " + e.message);
  console.error(e.stack);
  process.exit(1);
});
