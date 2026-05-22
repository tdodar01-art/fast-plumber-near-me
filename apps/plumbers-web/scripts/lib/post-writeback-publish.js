/**
 * Shared post-writeback publish hook: export Firestore → static JSON, parse
 * the affected-cities marker, and ping GSC indexing for each affected city
 * page.
 *
 * Lifted out of the inline block in scripts/outscraper-reviews.js (2026-05-22)
 * so other pipelines that mutate plumber state — synth/writeback.js, manual
 * one-off scripts — can wire the same "publish + index" tail without
 * duplicating the wiring (and forgetting to update it when the pattern
 * changes, as happened with synth/writeback originally).
 *
 * Usage:
 *
 *   const { publishAfterWriteback } = require("./lib/post-writeback-publish");
 *   await publishAfterWriteback({ dryRun: false, label: "synth-writeback" });
 *
 * Returns { exported: boolean, indexed: number, affectedCities: string[] }.
 * Never throws — logs failures and continues so a bad indexing request can't
 * unwind already-committed Firestore writes.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { cityPath } = require("../config/plumbing-directory.cjs");

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

const APP_ROOT = path.resolve(__dirname, "..", "..");

async function publishAfterWriteback(opts = {}) {
  const { dryRun = false, label = "publish" } = opts;
  const noPush = dryRun ? "--no-push" : "";

  console.log(`\n=== [${label}] Exporting Firestore → Static JSON ===\n`);
  let exportOut = "";
  try {
    exportOut = execSync(
      `node scripts/export-firestore-to-json.js ${noPush}`,
      { cwd: APP_ROOT, encoding: "utf-8", timeout: 120000 },
    );
    console.log(exportOut);
  } catch (err) {
    console.error(`[${label}] Export failed:`, err.message);
    return { exported: false, indexed: 0, affectedCities: [] };
  }

  const citiesMatch = exportOut.match(/__AFFECTED_CITIES__:(.+)/);
  if (!citiesMatch) {
    console.log(`[${label}] No affected-cities marker in export output — skipping indexing.`);
    return { exported: true, indexed: 0, affectedCities: [] };
  }

  let cities = [];
  try {
    cities = JSON.parse(citiesMatch[1]);
  } catch (err) {
    console.error(`[${label}] Could not parse affected cities:`, err.message);
    return { exported: true, indexed: 0, affectedCities: [] };
  }

  if (cities.length === 0 || dryRun) {
    if (dryRun && cities.length > 0) {
      console.log(`[${label}] [dry-run] would request indexing for ${cities.length} cities`);
    }
    return { exported: true, indexed: 0, affectedCities: cities };
  }

  console.log(`\n=== [${label}] Requesting GSC indexing for ${cities.length} affected city page(s) ===\n`);

  // Build city → state map from the just-exported JSON (slug is plain city,
  // state lives on each plumber doc — first hit wins).
  const jsonPath = path.join(APP_ROOT, "data", "synthesized", "plumbers-synthesized.json");
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const cityStateMap = new Map();
  for (const p of jsonData.plumbers || jsonData) {
    for (const sc of p.serviceCities || []) {
      if (!cityStateMap.has(sc)) cityStateMap.set(sc, p.state);
    }
  }

  const urls = cities
    .map((c) => {
      const state = cityStateMap.get(c);
      if (!state) return null;
      const stateSlug = STATE_ABBR_TO_SLUG[state] || String(state).toLowerCase();
      return cityPath(stateSlug, c);
    })
    .filter(Boolean);

  if (urls.length === 0) {
    console.log(`[${label}] No URLs to index (no city → state mappings found).`);
    return { exported: true, indexed: 0, affectedCities: cities };
  }

  try {
    execSync(
      `node scripts/request-indexing.js ${urls.join(" ")}`,
      { cwd: APP_ROOT, stdio: "inherit", timeout: 120000 },
    );
  } catch (e) {
    // request-indexing.js exits non-zero when quota is hit — that's expected
    // behavior and not a fatal error here.
    console.error(`[${label}] Indexing request returned non-zero (often quota-related, check logs):`, e.message);
  }

  return { exported: true, indexed: urls.length, affectedCities: cities };
}

module.exports = { publishAfterWriteback };
