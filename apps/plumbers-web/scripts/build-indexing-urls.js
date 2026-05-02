#!/usr/bin/env node
/**
 * Build a deduplicated list of indexing-worthy URL paths for a set of cities.
 *
 * For each city, reads `gscPageTypes` from the Firestore `cities` collection
 * and outputs `/{pageType}/{stateSlug}/{citySlug}` for every page-type variant
 * Google has actually indexed for that city (i.e. the URLs earning impressions
 * in GSC). Always also outputs `/emergency-plumbers/{stateSlug}/{citySlug}` as
 * a discovery signal for the canonical city page even when it isn't yet in
 * GSC.
 *
 * The bug this fixes: prior workflows pinged only `/emergency-plumbers/...`,
 * which Google has often never crawled, while ignoring the service-prefixed
 * URLs (`/24-hour-plumber/...`, `/clogged-drain/...`, etc.) that *are*
 * indexed and just got fresh plumber content from the daily scrape.
 *
 * Usage:
 *   node scripts/build-indexing-urls.js pflugerville:TX irving:TX
 *   node scripts/build-indexing-urls.js -   # read pairs from stdin
 *
 * Each argument is `citySlug:stateAbbr` (e.g. `mount-prospect:IL`).
 * Output: one URL path per line on stdout. Diagnostics go to stderr.
 *
 * Falls back to `/emergency-plumbers/...` only if Firestore is unavailable —
 * never crashes the indexing step.
 */

const fs = require("fs");
const path = require("path");

const STATE_ABBR_TO_SLUG = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi",
  MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada", NH: "new-hampshire",
  NJ: "new-jersey", NM: "new-mexico", NY: "new-york", NC: "north-carolina",
  ND: "north-dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
  RI: "rhode-island", SC: "south-carolina", SD: "south-dakota", TN: "tennessee",
  TX: "texas", UT: "utah", VT: "vermont", VA: "virginia", WA: "washington",
  WV: "west-virginia", WI: "wisconsin", WY: "wyoming", DC: "district-of-columbia",
};

function parsePair(raw) {
  const [citySlug, stateAbbr] = (raw || "").split(":");
  if (!citySlug || !stateAbbr) return null;
  const upper = stateAbbr.toUpperCase();
  const stateSlug = STATE_ABBR_TO_SLUG[upper];
  if (!stateSlug) return null;
  return {
    citySlug: citySlug.toLowerCase(),
    stateAbbr: upper,
    stateSlug,
    docId: `${citySlug.toLowerCase()}-${upper.toLowerCase()}`,
  };
}

function readStdinPairs() {
  const raw = fs.readFileSync(0, "utf-8").trim();
  if (!raw) return [];
  return raw.split(/\s+/).filter(Boolean);
}

function loadFirestore() {
  const saPath = path.join(__dirname, "..", "service-account.json");
  if (!fs.existsSync(saPath)) {
    return null;
  }
  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, "utf-8"))),
      });
    }
    return admin.firestore();
  } catch (err) {
    process.stderr.write(`firebase-admin unavailable (${err.message}) — falling back to emergency-plumbers URLs only\n`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const rawPairs = (args.length === 0 || args[0] === "-") ? readStdinPairs() : args;

  if (rawPairs.length === 0) {
    process.stderr.write("No city pairs provided. Expected `citySlug:stateAbbr` arguments.\n");
    return;
  }

  const cities = rawPairs.map(parsePair).filter(Boolean);
  const skipped = rawPairs.length - cities.length;
  if (skipped > 0) {
    process.stderr.write(`Skipped ${skipped} unparseable pair(s).\n`);
  }
  if (cities.length === 0) return;

  const db = loadFirestore();

  const urls = new Set();
  for (const c of cities) {
    // Always include the canonical emergency-plumbers URL as a discovery signal.
    urls.add(`/emergency-plumbers/${c.stateSlug}/${c.citySlug}`);

    if (!db) continue;

    try {
      const snap = await db.collection("cities").doc(c.docId).get();
      const data = snap.exists ? snap.data() : null;
      const pageTypes = (data && Array.isArray(data.gscPageTypes)) ? data.gscPageTypes : [];
      let added = 0;
      for (const pt of pageTypes) {
        if (!pt || pt === "emergency-plumbers") continue;
        urls.add(`/${pt}/${c.stateSlug}/${c.citySlug}`);
        added++;
      }
      process.stderr.write(`  ${c.docId}: +${added} GSC-indexed variant(s) [${pageTypes.join(", ") || "none"}]\n`);
    } catch (err) {
      process.stderr.write(`  ${c.docId}: Firestore read failed (${err.message}) — emergency-plumbers fallback only\n`);
    }
  }

  for (const u of [...urls].sort()) {
    process.stdout.write(`${u}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    process.stderr.write(`build-indexing-urls fatal: ${err.message}\n`);
    process.exit(1);
  });
