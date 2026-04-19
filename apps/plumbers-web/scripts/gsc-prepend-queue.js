#!/usr/bin/env node

/**
 * GSC Prepend Queue — take cities from the GSC expansion queue,
 * geocode them, add coordinates to city-coords.ts, and prepend
 * them to the daily scrape queue.
 *
 * Usage:
 *   node scripts/gsc-prepend-queue.js
 *
 * Reads:  data/gsc-expansion-queue.json
 * Writes: scripts/scrape-queue.json (prepends new cities)
 *         src/lib/city-coords.ts (adds coordinates for new cities)
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const EXPANSION_QUEUE_PATH = path.join(__dirname, "..", "data", "gsc-expansion-queue.json");
const SCRAPE_QUEUE_PATH = path.join(__dirname, "scrape-queue.json");
const CITY_COORDS_PATH = path.join(__dirname, "..", "src", "lib", "city-coords.ts");
const CITY_COORDS_CACHE_PATH = path.join(__dirname, "city-coords-cache.json");
const US_CITIES_CSV_PATH = path.join(__dirname, "data", "us-cities.csv");
const GENERATOR_SCRIPT = path.join(__dirname, "generate-cities-data.mjs");
const LOG_ERROR_CLI =
  process.env.CONTROL_CENTER_LOG_ERROR_CLI ||
  path.resolve(__dirname, "..", "..", "..", "..", "..", "control-center", "scripts", "log-error.mjs");

// ---------------------------------------------------------------------------
// Load env
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

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// ---------------------------------------------------------------------------
// State abbreviation to comment label (matches city-coords.ts format)
// ---------------------------------------------------------------------------

const STATE_COMMENTS = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "DC", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text) {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Error logging — append-only JSONL via control-center log-error.mjs.
// Surfaced in the /admin error-log UI.
// ---------------------------------------------------------------------------

function logErrorCLI({ entity, severity = "error", message, context }) {
  if (!fs.existsSync(LOG_ERROR_CLI)) {
    console.error(`  [log-error] CLI not found at ${LOG_ERROR_CLI}`);
    return;
  }
  const args = [
    LOG_ERROR_CLI,
    "--project", "plumber",
    "--entity", entity,
    "--severity", severity,
    "--source", "gsc-prepend-queue",
    "--message", message,
  ];
  if (context) {
    args.push("--context", JSON.stringify(context));
  }
  const res = spawnSync("node", args, { encoding: "utf-8" });
  if (res.status !== 0) {
    console.error(`  [log-error] CLI exited ${res.status}: ${res.stderr || res.stdout}`);
  }
}

// ---------------------------------------------------------------------------
// Coord resolution chain: cache → CSV (offline, ~30k US cities) → Nominatim
// (OSM, free, 1 req/sec) → Google Geocoding (if API key works).
// Writes every successful lookup to scripts/city-coords-cache.json so the
// next run of generate-cities-data.mjs rebuilds city-coords.ts with the
// new entry.
// ---------------------------------------------------------------------------

function parseCsvLine(line) {
  const out = [];
  let field = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') inQuote = false;
      else field += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ",") { out.push(field); field = ""; }
      else field += c;
    }
  }
  out.push(field);
  return out;
}

let _csvIndex = null;
function csvLookup(state, slug) {
  if (_csvIndex === null) {
    _csvIndex = new Map();
    if (fs.existsSync(US_CITIES_CSV_PATH)) {
      const lines = fs.readFileSync(US_CITIES_CSV_PATH, "utf-8").split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const cols = parseCsvLine(line);
        const st = cols[1];
        const city = cols[3];
        const lat = parseFloat(cols[5]);
        const lng = parseFloat(cols[6]);
        if (!st || !city || Number.isNaN(lat) || Number.isNaN(lng)) continue;
        const key = `${st}:${slugify(city)}`;
        if (!_csvIndex.has(key)) {
          _csvIndex.set(key, [parseFloat(lat.toFixed(4)), parseFloat(lng.toFixed(4))]);
        }
      }
    }
  }
  return _csvIndex.get(`${state}:${slug}`) || null;
}

async function geocodeOsm(city, state) {
  const q = `${city}, ${state}, USA`;
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "fast-plumber-near-me/gsc-prepend-queue (contact: tim@fastplumbernearme.com)",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)) };
  } catch (err) {
    console.log(`  [osm] fetch error: ${err.message}`);
    return null;
  }
}

async function geocodeGoogle(city, state) {
  if (!GOOGLE_API_KEY) return null;
  const address = `${city}, ${state}, USA`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
      console.log(`  [google] ${data.status} — Geocoding API not usable`);
      return null;
    }
    if (data.status !== "OK" || !data.results || data.results.length === 0) return null;
    const loc = data.results[0].geometry.location;
    return { lat: parseFloat(loc.lat.toFixed(2)), lng: parseFloat(loc.lng.toFixed(2)) };
  } catch (err) {
    console.log(`  [google] fetch error: ${err.message}`);
    return null;
  }
}

// Public: resolve coords for a city using the whole fallback chain.
async function resolveCoords(city, state, slug) {
  // CSV — offline, instant
  const csvHit = csvLookup(state, slug);
  if (csvHit) return { lat: csvHit[0], lng: csvHit[1], source: "csv" };

  // OSM — rate-limited
  const osmHit = await geocodeOsm(city, state);
  if (osmHit) {
    await sleep(1100); // Nominatim policy: ≤1 req/sec
    return { ...osmHit, source: "osm" };
  }

  // Google — if the API is actually enabled on the project
  const googHit = await geocodeGoogle(city, state);
  if (googHit) return { ...googHit, source: "google" };

  return null;
}

// ---------------------------------------------------------------------------
// Coord cache — single source of truth for city-coords.ts. This script only
// appends to the cache; running generate-cities-data.mjs rebuilds the TS
// file from the cache + RAW_CITIES. Keeping one write path prevents the
// drift class of bugs where cities-generated.ts had pages but city-coords.ts
// had no coord entry (radius fallback breaks → 0 plumbers).
// ---------------------------------------------------------------------------

function loadCoordsCache() {
  if (!fs.existsSync(CITY_COORDS_CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CITY_COORDS_CACHE_PATH, "utf-8"));
  } catch (err) {
    console.error(`  [cache] parse failed: ${err.message}`);
    return {};
  }
}

function saveCoordsCache(map) {
  const sorted = {};
  for (const key of Object.keys(map).sort()) sorted[key] = map[key];
  fs.writeFileSync(CITY_COORDS_CACHE_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

// Read existing city-coords.ts once so we can detect "already has coords"
// without parsing the TS AST.
function existingCoordKeys() {
  if (!fs.existsSync(CITY_COORDS_PATH)) return new Set();
  const text = fs.readFileSync(CITY_COORDS_PATH, "utf-8");
  const set = new Set();
  const re = /"([A-Z]{2}:[a-z0-9-]+)":\s*\[/g;
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return set;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== GSC Prepend Queue ===\n");

  // Load expansion queue
  if (!fs.existsSync(EXPANSION_QUEUE_PATH)) {
    console.log("No expansion queue found. Run gsc-expansion.js first.");
    process.exit(0);
  }

  const expansion = JSON.parse(fs.readFileSync(EXPANSION_QUEUE_PATH, "utf-8"));
  const newCities = expansion.cities || [];

  if (newCities.length === 0) {
    console.log("Expansion queue is empty — no new cities to add.");
    process.exit(0);
  }

  // Sort new cities by impressions (highest first) so high-value cities
  // get scraped before low-value ones
  newCities.sort((a, b) => (b.impressions || 0) - (a.impressions || 0));

  console.log(`Found ${newCities.length} cities in expansion queue (sorted by impressions)\n`);

  // Load scrape queue
  const scrapeQueue = JSON.parse(fs.readFileSync(SCRAPE_QUEUE_PATH, "utf-8"));
  const existingSlugs = new Set([
    ...scrapeQueue.queue.map((c) => `${c.city}|${c.state}`),
    ...(scrapeQueue.completed || []).map((c) => `${c.city}|${c.state}`),
  ]);

  const knownCoordKeys = existingCoordKeys();
  const coordsCache = loadCoordsCache();
  const citiesMissingCoords = [];

  let added = 0;
  let skipped = 0;
  let geocoded = 0;
  let geocodeFailed = 0;

  for (const city of newCities) {
    const key = `${city.city}|${city.state}`;
    const citySlug = slugify(city.city);
    const coordKey = `${city.state}:${citySlug}`;

    if (existingSlugs.has(key)) {
      console.log(`  Skipping ${city.city}, ${city.state} — already in scrape queue`);
      skipped++;
      continue;
    }

    console.log(`  Adding: ${city.city}, ${city.state} (${city.impressions} impressions, pos ${city.avgPosition})`);

    // Prepend to scrape queue
    scrapeQueue.queue.unshift({
      city: city.city,
      state: city.state,
      county: "",
      region: "",
      status: "pending",
      estCalls: 18,
      source: "gsc",
    });
    added++;

    // Coord lookup: cache → CSV → OSM → Google. Any hit goes into the cache,
    // and generate-cities-data.mjs will pick it up at end-of-run.
    if (knownCoordKeys.has(coordKey) || coordsCache[coordKey]) {
      console.log(`    coords present: ${coordKey}`);
      continue;
    }

    const resolved = await resolveCoords(city.city, city.state, citySlug);
    if (resolved) {
      coordsCache[coordKey] = [resolved.lat, resolved.lng];
      console.log(`    coords resolved (${resolved.source}): ${coordKey} = [${resolved.lat}, ${resolved.lng}]`);
      geocoded++;
    } else {
      geocodeFailed++;
      citiesMissingCoords.push({ state: city.state, slug: citySlug, city: city.city });
      console.error(`    ⚠️  COORDS UNRESOLVED: ${coordKey}`);
      logErrorCLI({
        entity: "coord-resolution",
        message: `Unable to resolve coords for ${city.city}, ${city.state} via CSV/OSM/Google — city page will show 0 plumbers until resolved`,
        context: { city: city.city, state: city.state, slug: citySlug, impressions: city.impressions },
      });
    }
  }

  // Persist cache additions so the next generator run regenerates city-coords.ts
  saveCoordsCache(coordsCache);

  // Re-sort the entire pending queue by impressions (from GSC expansion data).
  // Cities with GSC impression data get sorted highest-first; cities without
  // impressions data (e.g. manually added) go to the end in original order.
  const expansionLookup = new Map();
  for (const city of newCities) {
    expansionLookup.set(`${city.city}|${city.state}`, city.impressions || 0);
  }
  // Also check existing queue items that might have impression data from a
  // previous run stored in the expansion queue
  for (const city of expansion.cities || []) {
    const key = `${city.city}|${city.state}`;
    if (!expansionLookup.has(key)) {
      expansionLookup.set(key, city.impressions || 0);
    }
  }

  scrapeQueue.queue.sort((a, b) => {
    const aImpr = expansionLookup.get(`${a.city}|${a.state}`) || 0;
    const bImpr = expansionLookup.get(`${b.city}|${b.state}`) || 0;
    return bImpr - aImpr;
  });

  // Save scrape queue
  fs.writeFileSync(SCRAPE_QUEUE_PATH, JSON.stringify(scrapeQueue, null, 2));

  // If we resolved any new coords, regen city-coords.ts from the cache so
  // the two TS outputs stay in sync. The generator is idempotent and fast
  // when the cache already has everything it needs (no network calls).
  if (geocoded > 0) {
    console.log(`\nRegenerating city-coords.ts from cache...`);
    const genRes = spawnSync("node", [GENERATOR_SCRIPT], { stdio: "inherit" });
    if (genRes.status !== 0) {
      logErrorCLI({
        entity: "coord-resolution",
        message: `generate-cities-data.mjs exited ${genRes.status} after coord-cache update — city-coords.ts may be stale`,
        context: { exitCode: genRes.status },
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Added to scrape queue: ${added}`);
  console.log(`  Skipped (already in queue): ${skipped}`);
  console.log(`  Coords resolved: ${geocoded}`);
  console.log(`  Queue re-sorted by GSC impressions (highest first)`);
  console.log(`  Total queue size: ${scrapeQueue.queue.length}`);

  if (added > 0) {
    console.log(`\nNext step: run 'node scripts/daily-scrape.js' to scrape these cities`);
  }

  // Hard contract: fail non-zero if any newly-queued city is missing coords.
  // Previous behavior (exit 0 with a warning) let this class of bug slip into
  // production — city pages then rendered 0 plumbers for days.
  if (citiesMissingCoords.length > 0) {
    console.error(`\n⚠️  ${citiesMissingCoords.length} cities added to scrape queue without coords:`);
    for (const c of citiesMissingCoords) {
      console.error(`  - ${c.state}:${c.slug} (${c.city})`);
    }
    console.error(`Without coords the 20-mi radius fallback cannot run, so these city pages will show 0 plumbers until resolved.`);
    logErrorCLI({
      entity: "coord-resolution",
      message: `gsc-prepend-queue added ${citiesMissingCoords.length} cities without coords — pipeline exit non-zero`,
      context: { missing: citiesMissingCoords },
    });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  logErrorCLI({
    entity: "gsc-prepend-queue",
    message: `Unhandled error in gsc-prepend-queue: ${err.message}`,
    context: { stack: err.stack },
  });
  process.exit(1);
});
