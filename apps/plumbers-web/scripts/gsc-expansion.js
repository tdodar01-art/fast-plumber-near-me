#!/usr/bin/env node

/**
 * GSC Expansion — find cities with Google impressions that need plumber data.
 *
 * Pulls page-level GSC data, extracts city/state from URLs, checks Firestore
 * cities collection, and outputs a list of new cities needing scrapes.
 *
 * Usage:
 *   node scripts/gsc-expansion.js
 *
 * Output: data/gsc-expansion-queue.json
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { google } = require("googleapis");

// ---------------------------------------------------------------------------
// Paths & Config
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "gsc-expansion-queue.json");

// US state slugs to abbreviations
const STATE_SLUG_TO_ABBR = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new-hampshire": "NH", "new-jersey": "NJ", "new-mexico": "NM", "new-york": "NY",
  "north-carolina": "NC", "north-dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode-island": "RI", "south-carolina": "SC",
  "south-dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west-virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district-of-columbia": "DC",
};

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

const SITE_URL = process.env.GSC_SITE_URL || "https://fastplumbernearme.com/";

// ---------------------------------------------------------------------------
// Check prerequisites
// ---------------------------------------------------------------------------

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("ERROR: service-account.json not found.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

let admin;
try {
  admin = require("firebase-admin");
} catch {
  console.error("ERROR: firebase-admin not installed. Run: npm install firebase-admin");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text) {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sha1Short(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function deslugify(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Parse a city page URL path into { stateSlug, stateAbbr, citySlug, cityName }.
 * Returns null if the URL doesn't match the expected pattern.
 */
function parseCityUrl(url) {
  // Handle both full URLs and paths
  const pathStr = url.replace(/https?:\/\/[^/]+/, "").replace(/\/$/, "");
  const match = pathStr.match(/^\/emergency-plumbers\/([^/]+)\/([^/]+)$/);
  if (!match) return null;

  const stateSlug = match[1];
  const citySlug = match[2];
  const stateAbbr = STATE_SLUG_TO_ABBR[stateSlug];
  if (!stateAbbr) return null;

  return {
    stateSlug,
    stateAbbr,
    citySlug,
    cityName: deslugify(citySlug),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== GSC Expansion Check ===\n");

  // Authenticate with GSC
  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });

  const searchconsole = google.searchconsole({ version: "v1", auth });

  // Date range: last 90 days (GSC keeps 16 months; cast a wide net)
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 90);

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  console.log(`GSC date range: ${startStr} to ${endStr}`);
  console.log("Fetching page data...\n");

  const response = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: startStr,
      endDate: endStr,
      dimensions: ["page"],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: "page",
              operator: "contains",
              expression: "/emergency-plumbers/",
            },
          ],
        },
      ],
      rowLimit: 5000,
      type: "web",
    },
  });

  const rows = response.data.rows || [];
  if (rows.length === 0) {
    console.log("No GSC data returned for /emergency-plumbers/ pages.");
    return;
  }

  console.log(`GSC returned ${rows.length} page URLs\n`);

  // Parse city/state from each URL
  const gscCities = new Map(); // key: "stateAbbr:citySlug"

  for (const row of rows) {
    const url = row.keys[0];
    const parsed = parseCityUrl(url);
    if (!parsed) continue; // state-level pages or unparseable

    const key = `${parsed.stateAbbr}:${parsed.citySlug}`;
    const existing = gscCities.get(key);
    if (existing) {
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      // Weighted average for position/CTR when aggregating multiple rows
      const totalImpr = existing.impressions;
      existing.avgPosition = ((existing.avgPosition * (totalImpr - row.impressions)) + (row.position * row.impressions)) / totalImpr;
      existing.ctr = totalImpr > 0 ? existing.clicks / totalImpr : 0;
    } else {
      gscCities.set(key, {
        city: parsed.cityName,
        state: parsed.stateAbbr,
        citySlug: parsed.citySlug,
        stateSlug: parsed.stateSlug,
        impressions: row.impressions,
        clicks: row.clicks,
        avgPosition: row.position,
        ctr: row.ctr,
      });
    }
  }

  console.log(`Parsed ${gscCities.size} unique city pages from GSC data\n`);

  // =========================================================================
  // Update GSC metrics on ALL cities in results (new and existing)
  // =========================================================================

  const todayStr = new Date().toISOString().slice(0, 10);
  let metricsUpdated = 0;

  function getTier(impressions) {
    if (impressions >= 50) return "high";
    if (impressions >= 10) return "medium";
    if (impressions >= 1) return "low";
    return "none";
  }

  for (const [, city] of gscCities) {
    const docId = `${city.citySlug}-${city.state.toLowerCase()}`;
    const roundedPos = Math.round(city.avgPosition * 10) / 10;
    const roundedCtr = Math.round((city.ctr || 0) * 10000) / 10000;
    const tier = getTier(city.impressions);

    try {
      // Upsert latest GSC snapshot + tier on the city doc
      const cityPayload = {
        lastGSCImpressions: city.impressions,
        lastGSCClicks: city.clicks,
        lastGSCPosition: roundedPos,
        lastGSCCTR: roundedCtr,
        gscLastUpdated: todayStr,
        gscTier: tier,
      };
      await db.collection("cities").doc(docId).set(cityPayload, { merge: true });

      // Verify the write persisted (debug — remove once confirmed working)
      if (tier === "medium" || tier === "high") {
        const verifySnap = await db.collection("cities").doc(docId).get();
        const verifyData = verifySnap.data();
        console.log(`  ✓ ${docId}: gscTier="${verifyData?.gscTier}" (wrote "${tier}", ${city.impressions} impr)`);
      }

      // Write daily history to subcollection (date as doc ID = idempotent)
      await db.collection("cities").doc(docId)
        .collection("gscHistory")
        .doc(todayStr)
        .set({
          date: todayStr,
          impressions: city.impressions,
          clicks: city.clicks,
          position: roundedPos,
          ctr: roundedCtr,
        });

      metricsUpdated++;
    } catch (metricErr) {
      console.error(`  WARNING: failed to update GSC metrics for ${docId}: ${metricErr.message}`);
      console.error(`  Stack: ${metricErr.stack?.split("\n")[1]?.trim()}`);
    }
  }

  console.log(`Updated GSC metrics + history for ${metricsUpdated} cities\n`);

  // =========================================================================
  // Extended GSC captures — page+country+device and query+page+country
  // =========================================================================

  const GSC_FILTER = {
    filters: [{ dimension: "page", operator: "contains", expression: "/emergency-plumbers/" }],
  };
  const BATCH_SIZE = 400;
  const ROW_LIMIT = 5000;

  // --- Pull 1: page + country + device breakdown ---
  console.log("Fetching page+country+device breakdown...");
  const pcdResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: startStr,
      endDate: endStr,
      dimensions: ["page", "country", "device", "date"],
      dimensionFilterGroups: [GSC_FILTER],
      rowLimit: ROW_LIMIT,
      type: "web",
    },
  });

  const pcdRows = pcdResponse.data.rows || [];
  if (pcdRows.length === ROW_LIMIT) {
    console.warn(`  WARNING: page+country+device pull returned exactly ${ROW_LIMIT} rows — data may be truncated.`);
  }
  console.log(`  GSC returned ${pcdRows.length} page+country+device rows`);

  let pcdWritten = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const row of pcdRows) {
    const [pageUrl, country, device, date] = row.keys;
    const parsed = parseCityUrl(pageUrl);
    if (!parsed) continue;

    const docId = `${parsed.citySlug}-${parsed.stateAbbr.toLowerCase()}`;
    const subDocId = `${date}__${country}__${device}`;
    const ref = db.collection("cities").doc(docId)
      .collection("gscPageBreakdown").doc(subDocId);

    batch.set(ref, {
      date,
      page: pageUrl,
      country,
      device,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Math.round((row.ctr || 0) * 10000) / 10000,
      position: Math.round(row.position * 10) / 10,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batchCount++;
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
    pcdWritten++;
  }

  if (batchCount > 0) await batch.commit();
  console.log(`  Wrote ${pcdWritten} rows to gscPageBreakdown subcollections\n`);

  // --- Pull 2: query + page + country breakdown ---
  console.log("Fetching query+page+country breakdown...");
  const qpcResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: startStr,
      endDate: endStr,
      dimensions: ["query", "page", "country", "date"],
      dimensionFilterGroups: [GSC_FILTER],
      rowLimit: ROW_LIMIT,
      type: "web",
    },
  });

  const qpcRows = qpcResponse.data.rows || [];
  if (qpcRows.length === ROW_LIMIT) {
    console.warn(`  WARNING: query+page+country pull returned exactly ${ROW_LIMIT} rows — data may be truncated.`);
  }
  console.log(`  GSC returned ${qpcRows.length} query+page+country rows`);

  let qpcWritten = 0;
  batch = db.batch();
  batchCount = 0;

  for (const row of qpcRows) {
    const [query, pageUrl, country, date] = row.keys;
    const parsed = parseCityUrl(pageUrl);
    if (!parsed) continue;

    const docId = `${parsed.citySlug}-${parsed.stateAbbr.toLowerCase()}`;
    const subDocId = `${date}__${sha1Short(query)}__${sha1Short(pageUrl)}__${country}`;
    const ref = db.collection("cities").doc(docId)
      .collection("gscQueries").doc(subDocId);

    batch.set(ref, {
      date,
      query,
      page: pageUrl,
      country,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Math.round((row.ctr || 0) * 10000) / 10000,
      position: Math.round(row.position * 10) / 10,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batchCount++;
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
    qpcWritten++;
  }

  if (batchCount > 0) await batch.commit();
  console.log(`  Wrote ${qpcWritten} rows to gscQueries subcollections\n`);

  // --- Zero-fill: cities with no impressions on the target date ---
  // Use the most recent date in our range as the "target date" for zero-fill
  const targetDate = endStr;
  const citiesWithImpressions = new Set();
  for (const row of pcdRows) {
    const [pageUrl, , , date] = row.keys;
    if (date !== targetDate) continue;
    const parsed = parseCityUrl(pageUrl);
    if (parsed) citiesWithImpressions.add(`${parsed.citySlug}-${parsed.stateAbbr.toLowerCase()}`);
  }

  const allCityDocs = await db.collection("cities").get();
  let zeroFilled = 0;
  batch = db.batch();
  batchCount = 0;

  for (const doc of allCityDocs.docs) {
    if (citiesWithImpressions.has(doc.id)) continue;

    const ref = db.collection("cities").doc(doc.id)
      .collection("gscPageBreakdown").doc(`${targetDate}__zero`);

    batch.set(ref, {
      date: targetDate,
      page: null,
      country: null,
      device: null,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      position: null,
      zeroFilled: true,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batchCount++;
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
    zeroFilled++;
  }

  if (batchCount > 0) await batch.commit();
  console.log(`Zero-filled ${zeroFilled} cities with no impressions on ${targetDate}\n`);

  // =========================================================================
  // Site-wide GSC captures — all pages, all queries, search appearance
  // =========================================================================

  // --- Pull 3: Site-wide query + page + country (no URL filter) ---
  // Captures queries hitting non-emergency-plumber pages (homepage, blog, etc.)
  console.log("Fetching site-wide query+page+country breakdown (no URL filter)...");
  const siteQueryResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: startStr,
      endDate: endStr,
      dimensions: ["query", "page", "country", "date"],
      rowLimit: ROW_LIMIT,
      type: "web",
    },
  });

  const siteQueryRows = siteQueryResponse.data.rows || [];
  if (siteQueryRows.length === ROW_LIMIT) {
    console.warn(`  WARNING: site-wide query+page+country pull returned exactly ${ROW_LIMIT} rows — data may be truncated.`);
  }
  console.log(`  GSC returned ${siteQueryRows.length} site-wide query rows`);

  let swqWritten = 0;
  batch = db.batch();
  batchCount = 0;

  for (const row of siteQueryRows) {
    const [query, pageUrl, country, date] = row.keys;
    const subDocId = `${date}__${sha1Short(query)}__${sha1Short(pageUrl)}__${country}`;
    const ref = db.collection("gscSiteQueries").doc(subDocId);

    batch.set(ref, {
      date,
      query,
      page: pageUrl,
      country,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Math.round((row.ctr || 0) * 10000) / 10000,
      position: Math.round(row.position * 10) / 10,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batchCount++;
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
    swqWritten++;
  }

  if (batchCount > 0) await batch.commit();
  console.log(`  Wrote ${swqWritten} rows to gscSiteQueries\n`);

  // --- Pull 4: Site-wide page + country + device (no URL filter) ---
  console.log("Fetching site-wide page+country+device breakdown (no URL filter)...");
  const sitePageResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: startStr,
      endDate: endStr,
      dimensions: ["page", "country", "device", "date"],
      rowLimit: ROW_LIMIT,
      type: "web",
    },
  });

  const sitePageRows = sitePageResponse.data.rows || [];
  if (sitePageRows.length === ROW_LIMIT) {
    console.warn(`  WARNING: site-wide page+country+device pull returned exactly ${ROW_LIMIT} rows — data may be truncated.`);
  }
  console.log(`  GSC returned ${sitePageRows.length} site-wide page rows`);

  let swpWritten = 0;
  batch = db.batch();
  batchCount = 0;

  for (const row of sitePageRows) {
    const [pageUrl, country, device, date] = row.keys;
    const subDocId = `${date}__${sha1Short(pageUrl)}__${country}__${device}`;
    const ref = db.collection("gscSitePages").doc(subDocId);

    batch.set(ref, {
      date,
      page: pageUrl,
      country,
      device,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Math.round((row.ctr || 0) * 10000) / 10000,
      position: Math.round(row.position * 10) / 10,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batchCount++;
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
    swpWritten++;
  }

  if (batchCount > 0) await batch.commit();
  console.log(`  Wrote ${swpWritten} rows to gscSitePages\n`);

  // --- Pull 5: Search appearance ---
  console.log("Fetching search appearance breakdown...");
  const searchAppResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: startStr,
      endDate: endStr,
      dimensions: ["searchAppearance", "page", "date"],
      rowLimit: ROW_LIMIT,
      type: "web",
    },
  });

  const searchAppRows = searchAppResponse.data.rows || [];
  if (searchAppRows.length === ROW_LIMIT) {
    console.warn(`  WARNING: search appearance pull returned exactly ${ROW_LIMIT} rows — data may be truncated.`);
  }
  console.log(`  GSC returned ${searchAppRows.length} search appearance rows`);

  let saWritten = 0;
  batch = db.batch();
  batchCount = 0;

  for (const row of searchAppRows) {
    const [appearance, pageUrl, date] = row.keys;
    const subDocId = `${date}__${sha1Short(appearance)}__${sha1Short(pageUrl)}`;
    const ref = db.collection("gscSearchAppearance").doc(subDocId);

    batch.set(ref, {
      date,
      searchAppearance: appearance,
      page: pageUrl,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Math.round((row.ctr || 0) * 10000) / 10000,
      position: Math.round(row.position * 10) / 10,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batchCount++;
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
    saWritten++;
  }

  if (batchCount > 0) await batch.commit();
  console.log(`  Wrote ${saWritten} rows to gscSearchAppearance\n`);

  // --- Pull 6: Site-wide daily totals ---
  // One row per date — dense time series for overall site health
  console.log("Fetching site-wide daily totals...");
  const dailyResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: startStr,
      endDate: endStr,
      dimensions: ["date"],
      rowLimit: ROW_LIMIT,
      type: "web",
    },
  });

  const dailyRows = dailyResponse.data.rows || [];
  console.log(`  GSC returned ${dailyRows.length} daily total rows`);

  let dailyWritten = 0;
  batch = db.batch();
  batchCount = 0;

  for (const row of dailyRows) {
    const [date] = row.keys;
    const ref = db.collection("gscDailyTotals").doc(date);

    batch.set(ref, {
      date,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Math.round((row.ctr || 0) * 10000) / 10000,
      position: Math.round(row.position * 10) / 10,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batchCount++;
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
    dailyWritten++;
  }

  if (batchCount > 0) await batch.commit();
  console.log(`  Wrote ${dailyWritten} rows to gscDailyTotals\n`);

  // =========================================================================
  // Check Firestore cities collection for scrape status
  // =========================================================================

  const citiesSnap = await db.collection("cities").get();
  const scrapedCities = new Set();
  const knownCities = new Set();
  for (const doc of citiesSnap.docs) {
    const data = doc.data();
    const cityName = data.city || data.name || "";
    const state = data.state || "";
    if (!cityName || !state) continue;
    const key = `${state}:${slugify(cityName)}`;
    knownCities.add(key);
    if (data.scraped) {
      scrapedCities.add(key);
    }
  }

  console.log(`Firestore cities collection: ${citiesSnap.size} docs (${scrapedCities.size} scraped)\n`);

  // Categorize
  const alreadyScraped = [];
  const needsScraping = [];

  for (const [key, data] of gscCities) {
    if (scrapedCities.has(key)) {
      alreadyScraped.push(data);
    } else {
      needsScraping.push(data);
    }
  }

  // Create stub docs for newly discovered cities (not yet in Firestore at all)
  let stubsCreated = 0;
  for (const city of needsScraping) {
    const key = `${city.state}:${city.citySlug}`;
    if (knownCities.has(key)) continue;

    const docId = `${city.citySlug}-${city.state.toLowerCase()}`;
    try {
      await db.collection("cities").doc(docId).set({
        slug: docId,
        city: city.city,
        state: city.state,
        source: "gsc",
        firstSeenGSC: todayStr,
        impressionsAtDiscovery: city.impressions,
        scraped: false,
        plumberCount: 0,
      }, { merge: true });
      stubsCreated++;
    } catch (stubErr) {
      console.error(`  Warning: failed to create stub for ${docId}: ${stubErr.message}`);
    }
  }

  if (stubsCreated > 0) {
    console.log(`Created ${stubsCreated} stub docs in cities collection\n`);
  }

  // Sort new cities by impressions (highest priority first)
  needsScraping.sort((a, b) => b.impressions - a.impressions);

  // Tier breakdown
  const allCities = [...gscCities.values()];
  const tierCounts = { high: 0, medium: 0, low: 0 };
  for (const c of allCities) tierCounts[getTier(c.impressions)]++;

  // Summary
  console.log("=== SUMMARY ===");
  console.log(`  Total city pages in GSC: ${gscCities.size}`);
  console.log(`  Already scraped:         ${alreadyScraped.length}`);
  console.log(`  NEW — needs scraping:    ${needsScraping.length}`);
  console.log(`  GSC metrics updated:     ${metricsUpdated}`);
  console.log(`  Tiers — high (50+): ${tierCounts.high}, medium (10-49): ${tierCounts.medium}, low (1-9): ${tierCounts.low}`);
  console.log("");

  if (needsScraping.length > 0) {
    console.log("Top cities needing scrapes (by impressions):");
    console.log("");

    const header = [
      "City".padEnd(25),
      "State".padEnd(6),
      "Impr".padStart(6),
      "Clicks".padStart(7),
      "Pos".padStart(6),
    ].join(" | ");
    console.log(header);
    console.log("-".repeat(header.length));

    for (const city of needsScraping.slice(0, 30)) {
      console.log([
        city.city.padEnd(25),
        city.state.padEnd(6),
        String(city.impressions).padStart(6),
        String(city.clicks).padStart(7),
        city.avgPosition.toFixed(1).padStart(6),
      ].join(" | "));
    }

    if (needsScraping.length > 30) {
      console.log(`  ... and ${needsScraping.length - 30} more`);
    }
  }

  // Write expansion queue
  const output = {
    generatedAt: new Date().toISOString(),
    dateRange: { start: startStr, end: endStr },
    totalGscPages: gscCities.size,
    alreadyScraped: alreadyScraped.length,
    needsScraping: needsScraping.length,
    cities: needsScraping.map((c) => ({
      city: c.city,
      state: c.state,
      citySlug: c.citySlug,
      stateSlug: c.stateSlug,
      impressions: c.impressions,
      clicks: c.clicks,
      avgPosition: parseFloat(c.avgPosition.toFixed(1)),
      source: "gsc",
      discoveredAt: new Date().toISOString(),
    })),
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nExpansion queue written to: ${OUTPUT_PATH}`);
  console.log(`${needsScraping.length} cities queued for scraping.`);
}

main().catch((err) => {
  console.error("GSC Expansion Error:", err.message);
  if (err.code) console.error("HTTP status:", err.code);
  process.exit(1);
});
