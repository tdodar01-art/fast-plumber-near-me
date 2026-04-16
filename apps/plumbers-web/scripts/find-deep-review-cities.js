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

  // Position-aware qualification (NEW):
  //   PRIORITY 1: impressions >= 50 (any position) OR impressions >= 10 AND position <= 15
  //   PRIORITY 2: impressions >= 10 AND position <= 30
  //   SKIP:       impressions < 10 OR position > 30
  // Replaces simple gscTier filter that didn't account for position.
  const snap = await db.collection("cities")
    .where("gscTier", "in", ["medium", "high"])
    .get();

  if (snap.empty) {
    console.error("No medium/high tier cities found.");
    process.exit(0);
  }

  function qualifyTier(impressions, position) {
    if (impressions <= 0) return null;
    // PRIORITY 1: high-value cities — clicks are likely
    if (impressions >= 50) return 1;
    if (impressions >= 10 && position > 0 && position <= 15) return 1;
    // PRIORITY 2: worth pulling if budget allows
    if (impressions >= 10 && position > 0 && position <= 30) return 2;
    // SKIP: deep-page or too few impressions
    return null;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const candidates = [];
  for (const cityDoc of snap.docs) {
    const cityData = cityDoc.data();
    const fullSlug = cityDoc.id; // e.g. 'crystal-lake-il'

    const impressions = cityData.lastGSCImpressions || 0;
    const position = cityData.lastGSCPosition || 999;
    const priority = qualifyTier(impressions, position);

    if (priority === null) {
      console.error(
        "  SKIP " + fullSlug + " — impressions=" + impressions +
        ", position=" + position + " (not click-worthy)"
      );
      continue;
    }

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
        impressions,
        position,
        priority,
        tier: cityData.gscTier,
        plumbers: plumberSnap.size,
      });
    }
  }

  // Sort by priority (1 first), then impressions desc, cap at 3
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.impressions - a.impressions;
  });
  const selected = candidates.slice(0, 3);

  if (selected.length === 0) {
    console.error("All qualifying cities have fresh Outscraper data.");
    process.exit(0);
  }

  for (const c of selected) {
    console.error(
      "Selected: " + c.slug + " (priority " + c.priority + ", " +
      c.impressions + " impressions @ pos " + c.position +
      ", " + c.plumbers + " plumbers)"
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
