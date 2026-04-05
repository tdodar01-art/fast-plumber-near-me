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

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const EXPANSION_QUEUE_PATH = path.join(__dirname, "..", "data", "gsc-expansion-queue.json");
const SCRAPE_QUEUE_PATH = path.join(__dirname, "scrape-queue.json");
const CITY_COORDS_PATH = path.join(__dirname, "..", "src", "lib", "city-coords.ts");

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
// Geocoding
// ---------------------------------------------------------------------------

async function geocodeCity(city, state) {
  if (!GOOGLE_API_KEY) {
    console.log(`  Warning: No GOOGLE_PLACES_API_KEY — skipping geocode for ${city}, ${state}`);
    return null;
  }

  const address = `${city}, ${state}, USA`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "REQUEST_DENIED") {
      console.log(`  Warning: Geocoding API not enabled or key invalid — skipping coords`);
      console.log(`  Enable at: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com?project=fast-plumber-near-me`);
      return null;
    }

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.log(`  Warning: Geocoding returned ${data.status} for ${city}, ${state} — skipping coords`);
      return null;
    }

    const loc = data.results[0].geometry.location;
    return {
      lat: parseFloat(loc.lat.toFixed(2)),
      lng: parseFloat(loc.lng.toFixed(2)),
    };
  } catch (err) {
    console.log(`  Warning: Geocoding failed for ${city}, ${state}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// city-coords.ts manipulation
// ---------------------------------------------------------------------------

function addCoordsToFile(stateAbbr, citySlug, lat, lng) {
  const content = fs.readFileSync(CITY_COORDS_PATH, "utf-8");
  const key = `"${stateAbbr}:${citySlug}"`;

  // Already exists?
  if (content.includes(key)) {
    console.log(`  Coords already exist for ${key} — skipping`);
    return;
  }

  const entry = `${key}: [${lat}, ${lng}]`;
  const stateName = STATE_COMMENTS[stateAbbr];
  if (!stateName) {
    console.log(`  Warning: Unknown state ${stateAbbr} — skipping coords`);
    return;
  }

  // Find the state comment line
  const stateComment = `  // ${stateName}`;
  const lines = content.split("\n");
  let stateLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === stateComment) {
      stateLineIdx = i;
      break;
    }
  }

  if (stateLineIdx === -1) {
    console.log(`  Warning: Could not find "// ${stateName}" section in city-coords.ts — skipping`);
    return;
  }

  // Find the last line of this state's entries (lines after comment that start with "  "STATE_ABBR:")
  // State entries are on lines after the comment, before the next comment or closing brace
  let insertLineIdx = stateLineIdx + 1;
  const statePrefix = `"${stateAbbr}:`;

  // Find all lines belonging to this state section
  for (let i = stateLineIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith(statePrefix)) {
      insertLineIdx = i + 1;
    } else if (trimmed.startsWith("//") || trimmed === "}" || trimmed === "};") {
      break;
    }
  }

  // Find the last entry on the last line of this state section to append after it
  const lastStateLine = lines[insertLineIdx - 1];

  // Append to the end of the last line of this state's entries
  if (lastStateLine.trim().endsWith(",")) {
    // Line already ends with comma — add new entry with leading space
    lines[insertLineIdx - 1] = lastStateLine + ` ${entry},`;
  } else {
    // Line doesn't end with comma (shouldn't happen, but handle it)
    lines[insertLineIdx - 1] = lastStateLine + `, ${entry},`;
  }

  fs.writeFileSync(CITY_COORDS_PATH, lines.join("\n"));
  console.log(`  Added coords: ${key}: [${lat}, ${lng}]`);
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

  console.log(`Found ${newCities.length} cities in expansion queue\n`);

  // Load scrape queue
  const scrapeQueue = JSON.parse(fs.readFileSync(SCRAPE_QUEUE_PATH, "utf-8"));
  const existingSlugs = new Set([
    ...scrapeQueue.queue.map((c) => `${c.city}|${c.state}`),
    ...(scrapeQueue.completed || []).map((c) => `${c.city}|${c.state}`),
  ]);

  // Read city-coords.ts content once to check existing entries
  const coordsContent = fs.readFileSync(CITY_COORDS_PATH, "utf-8");

  let added = 0;
  let skipped = 0;
  let geocoded = 0;

  for (const city of newCities) {
    const key = `${city.city}|${city.state}`;
    const citySlug = slugify(city.city);

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

    // Geocode and add coordinates
    const coordKey = `"${city.state}:${citySlug}"`;
    if (coordsContent.includes(coordKey)) {
      console.log(`  Coords already exist for ${city.state}:${citySlug}`);
    } else {
      await sleep(200); // rate limit
      const coords = await geocodeCity(city.city, city.state);
      if (coords) {
        addCoordsToFile(city.state, citySlug, coords.lat, coords.lng);
        geocoded++;
      }
    }
  }

  // Save scrape queue
  fs.writeFileSync(SCRAPE_QUEUE_PATH, JSON.stringify(scrapeQueue, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`  Added to scrape queue: ${added}`);
  console.log(`  Skipped (already in queue): ${skipped}`);
  console.log(`  Geocoded + coords added: ${geocoded}`);
  console.log(`  Total queue size: ${scrapeQueue.queue.length}`);

  if (added > 0) {
    console.log(`\nNext step: run 'node scripts/daily-scrape.js' to scrape these cities`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
