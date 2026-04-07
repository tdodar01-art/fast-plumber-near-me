#!/usr/bin/env node

/**
 * Scrape plumbers from Google Places API (New) for Chicago suburbs.
 *
 * Usage:
 *   node scripts/scrape-plumbers.js --region "Northwest Suburbs"
 *   node scripts/scrape-plumbers.js                # all regions
 *
 * Output: data/raw/plumbers-latest.json
 *
 * Requires GOOGLE_PLACES_API_KEY in environment or .env.local
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CITIES_PATH = path.join(__dirname, "cities.json");
const OUTPUT_DIR = path.join(__dirname, "..", "data", "raw");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "plumbers-latest.json");
const PROGRESS_PATH = path.join(OUTPUT_DIR, ".scrape-progress.json");
const RATE_LIMIT_MS = 300; // ms between API calls
const MAX_RESULTS_PER_CITY = 20; // Google Places returns max 20 per text search

// ---------------------------------------------------------------------------
// Load env from .env.local if not already set
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
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

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error("ERROR: GOOGLE_PLACES_API_KEY is missing. Set it in .env.local or environment.");
  console.error("Stop and tell Tim. Don't proceed without valid data.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let targetRegion = null;
let targetCities = null;
const regionIdx = args.indexOf("--region");
if (regionIdx !== -1 && args[regionIdx + 1]) {
  targetRegion = args[regionIdx + 1];
}
const citiesIdx = args.indexOf("--cities");
if (citiesIdx !== -1) {
  targetCities = [];
  for (let i = citiesIdx + 1; i < args.length; i++) {
    if (args[i].startsWith("--")) break;
    targetCities.push(args[i]);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatPhone(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Google Places API (Legacy) — Text Search + Place Details
// ---------------------------------------------------------------------------

async function textSearch(query) {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json"
  );
  url.searchParams.set("query", query);
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("type", "plumber");

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error(`  API error: ${data.status} — ${data.error_message || ""}`);
    return [];
  }

  return data.results || [];
}

async function getPlaceDetails(placeId) {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json"
  );
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", API_KEY);
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,geometry,rating,user_ratings_total,formatted_phone_number,international_phone_number,website,opening_hours,business_status,types,reviews,price_level,editorial_summary"
  );

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") {
    console.error(`  Details error for ${placeId}: ${data.status}`);
    return null;
  }

  return data.result || null;
}

// ---------------------------------------------------------------------------
// Transform a Places API result into our schema
// ---------------------------------------------------------------------------

async function transformPlace(searchResult, city, region) {
  // Get full details (includes reviews, phone, hours)
  await sleep(RATE_LIMIT_MS);
  const place = await getPlaceDetails(searchResult.place_id);
  if (!place) return null;

  const name = place.name || "Unknown";
  const phone =
    place.formatted_phone_number ||
    place.international_phone_number ||
    "";
  const address = place.formatted_address || "";

  // Extract reviews
  const reviews = (place.reviews || []).map((r) => ({
    author: r.author_name || "Anonymous",
    rating: r.rating || 0,
    text: r.text || "",
    time: r.time ? new Date(r.time * 1000).toISOString() : "",
    relativeTime: r.relative_time_description || "",
  }));

  const hours = place.opening_hours?.weekday_text || null;

  return {
    placeId: place.place_id,
    name,
    slug: slugify(name),
    phone: formatPhone(phone),
    website: place.website || null,
    address,
    city,
    state: "IL",
    region,
    location: place.geometry?.location
      ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
      : null,
    googleRating: place.rating || null,
    googleReviewCount: place.user_ratings_total || 0,
    businessStatus: place.business_status || "OPERATIONAL",
    types: place.types || [],
    priceLevel: place.price_level ?? null,
    editorialSummary: place.editorial_summary?.overview || null,
    reviews,
    is24Hour: hours
      ? hours.some((h) => h.toLowerCase().includes("open 24 hours"))
      : false,
    workingHours: hours,
    scrapedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Progress tracking — safe to interrupt and resume
// ---------------------------------------------------------------------------

function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
  }
  return { completedCities: [], plumbers: {} };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const citiesConfig = JSON.parse(fs.readFileSync(CITIES_PATH, "utf-8"));
  const regions = citiesConfig.regions;

  // If --cities is used, build a custom single-region map
  let workingRegions;
  if (targetCities && targetCities.length > 0) {
    workingRegions = { "Custom": targetCities };
  } else {
    // Filter to target region if specified
    const regionNames = targetRegion
      ? Object.keys(regions).filter(
          (r) => r.toLowerCase() === targetRegion.toLowerCase()
        )
      : Object.keys(regions);

    if (targetRegion && regionNames.length === 0) {
      console.error(`Region "${targetRegion}" not found. Available regions:`);
      Object.keys(regions).forEach((r) => console.error(`  - ${r}`));
      process.exit(1);
    }

    workingRegions = {};
    for (const r of regionNames) workingRegions[r] = regions[r];
  }

  const regionNames = Object.keys(workingRegions);

  // Count total cities
  let totalCities = 0;
  for (const r of regionNames) totalCities += workingRegions[r].length;

  console.log(`\n🔧 Plumber Scraper — Google Places API`);
  console.log(`   Regions: ${regionNames.join(", ")}`);
  console.log(`   Cities: ${totalCities}`);
  console.log(`   Output: ${OUTPUT_PATH}\n`);

  // Load progress (resume support)
  const progress = loadProgress();
  const allPlumbers = progress.plumbers; // keyed by placeId for dedup
  let citiesDone = 0;
  let citiesSkipped = 0;
  let newPlumbers = 0;
  const failedRegions = [];

  for (const regionName of regionNames) {
    const cities = workingRegions[regionName];
    console.log(`\n📍 Region: ${regionName} (${cities.length} cities)`);

    for (const city of cities) {
      // Skip if already scraped in a previous run
      if (progress.completedCities.includes(city)) {
        console.log(`  ✓ ${city} — already scraped, skipping`);
        citiesSkipped++;
        continue;
      }

      const query = `emergency plumber in ${city}, Illinois`;
      console.log(`  🔍 ${city} — searching...`);

      try {
        await sleep(RATE_LIMIT_MS);
        const places = await textSearch(query);
        console.log(`     Found ${places.length} results`);

        let cityNew = 0;
        for (const searchResult of places) {
          const plumber = await transformPlace(searchResult, city, regionName);

          if (!plumber) continue;
          if (!plumber.phone) {
            console.log(`     Skipping ${plumber.name} — no phone`);
            continue;
          }

          if (!allPlumbers[plumber.placeId]) {
            cityNew++;
            newPlumbers++;
          }
          // Always update (latest data wins for dupes across cities)
          allPlumbers[plumber.placeId] = plumber;
        }

        console.log(`     +${cityNew} new plumbers`);

        // Mark city complete and save progress
        progress.completedCities.push(city);
        progress.plumbers = allPlumbers;
        saveProgress(progress);
        citiesDone++;
      } catch (err) {
        console.error(`     ❌ Failed: ${err.message}`);
        failedRegions.push({ region: regionName, city, error: err.message });
        // Continue with other cities
      }
    }
  }

  // Write final output
  const plumbersList = Object.values(allPlumbers);
  plumbersList.sort((a, b) => (b.googleReviewCount || 0) - (a.googleReviewCount || 0));

  const output = {
    meta: {
      scrapedAt: new Date().toISOString(),
      totalPlumbers: plumbersList.length,
      regions: regionNames,
      citiesScraped: progress.completedCities.length,
    },
    plumbers: plumbersList,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  // Clean up progress file on successful completion of all requested regions
  if (failedRegions.length === 0 && !targetRegion) {
    fs.unlinkSync(PROGRESS_PATH);
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Scrape complete`);
  console.log(`   Cities processed: ${citiesDone}`);
  console.log(`   Cities skipped (already done): ${citiesSkipped}`);
  console.log(`   Total unique plumbers: ${plumbersList.length}`);
  console.log(`   New this run: ${newPlumbers}`);
  console.log(`   Output: ${OUTPUT_PATH}`);

  if (failedRegions.length > 0) {
    console.log(`\n⚠️  Failed cities (${failedRegions.length}):`);
    failedRegions.forEach((f) =>
      console.log(`   - ${f.city} (${f.region}): ${f.error}`)
    );
  }

  console.log();
}

main().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});
