#!/usr/bin/env node

/**
 * Daily scrape runner — picks next cities from queue, scrapes, synthesizes.
 *
 * Usage:
 *   node scripts/daily-scrape.js
 *
 * Reads scrape-queue.json, respects monthly budget, deduplicates against
 * existing data, and updates all output files.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const QUEUE_PATH = path.join(__dirname, "scrape-queue.json");
const RAW_PATH = path.join(__dirname, "..", "data", "raw", "plumbers-latest.json");
const UPLOAD_STAGING_PATH = path.join(__dirname, "..", "data", "raw", "plumbers-with-synthesis.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

// ---------------------------------------------------------------------------
// Safety constants
// ---------------------------------------------------------------------------

const MAX_DAILY_CALLS = 50;
const MIN_DAILY_CALLS = 20;
const MONTHLY_BUFFER = 50; // stop at budget - 50
const RATE_LIMIT_MS = 300;
const SYNTH_RATE_LIMIT_MS = 500;

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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error("ERROR: GOOGLE_PLACES_API_KEY missing. Set in .env.local.");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY missing. Set in .env.local.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);
fs.mkdirSync(LOG_DIR, { recursive: true });
const logFile = path.join(LOG_DIR, `daily-scrape-${today}.log`);
const logStream = fs.createWriteStream(logFile, { flags: "a" });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}

// ---------------------------------------------------------------------------
// API call counter
// ---------------------------------------------------------------------------

let apiCallsMade = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function slugify(text) {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Lazy Firestore access — returns db or null if unavailable
let _firestoreDb = null;
function getFirestoreDb() {
  if (_firestoreDb) return _firestoreDb;
  const saPath = path.join(__dirname, "..", "service-account.json");
  if (!fs.existsSync(saPath)) return null;
  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      const sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    _firestoreDb = admin.firestore();
    return _firestoreDb;
  } catch { return null; }
}

function formatPhone(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function daysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1; // include today
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Google Places API — with call counting
// ---------------------------------------------------------------------------

async function textSearch(query) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", GOOGLE_API_KEY);
  url.searchParams.set("type", "plumber");

  apiCallsMade++;
  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    log(`  API error: ${data.status} — ${data.error_message || ""}`);
    return [];
  }
  return data.results || [];
}

async function getPlaceDetails(placeId) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", GOOGLE_API_KEY);
  url.searchParams.set("fields",
    "place_id,name,formatted_address,geometry,rating,user_ratings_total," +
    "formatted_phone_number,international_phone_number,website,opening_hours," +
    "business_status,types,reviews,price_level,editorial_summary"
  );

  apiCallsMade++;
  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") {
    log(`  Details error for ${placeId}: ${data.status}`);
    return null;
  }
  return data.result || null;
}

// ---------------------------------------------------------------------------
// Transform place result
// ---------------------------------------------------------------------------

function transformPlace(place, city, state, region) {
  const name = place.name || "Unknown";
  const phone = place.formatted_phone_number || place.international_phone_number || "";
  const hours = place.opening_hours?.weekday_text || null;

  return {
    placeId: place.place_id,
    name,
    slug: slugify(name),
    phone: formatPhone(phone),
    website: place.website || null,
    address: place.formatted_address || "",
    city,
    state: state,
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
    reviews: (place.reviews || []).map((r) => ({
      author: r.author_name || "Anonymous",
      rating: r.rating || 0,
      text: r.text || "",
      time: r.time ? new Date(r.time * 1000).toISOString() : "",
      relativeTime: r.relative_time_description || "",
    })),
    is24Hour: hours ? hours.some((h) => h.toLowerCase().includes("open 24 hours")) : false,
    workingHours: hours,
    scrapedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Review hash (matches refresh-reviews.ts format for deduplication)
// ---------------------------------------------------------------------------

function hashReviewId(authorName, text) {
  const input = `${authorName}::${(text || "").slice(0, 100)}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return `rev_${Math.abs(hash).toString(36)}`;
}

/**
 * Store reviews from Google Places API into Firestore reviews collection.
 * Uses the same dedup hash as refresh-reviews.ts so reviews are never
 * double-counted. Tagged with source: "google-places-initial".
 */
async function storeReviewsInFirestore(plumber) {
  const db = getFirestoreDb();
  if (!db || !plumber.reviews || plumber.reviews.length === 0) return 0;

  let stored = 0;
  for (const r of plumber.reviews) {
    const authorName = r.author || "Anonymous";
    const text = r.text || "";
    if (!text) continue;

    const googleReviewId = hashReviewId(authorName, text);

    // Dedup check
    const dupeCheck = await db.collection("reviews")
      .where("plumberId", "==", plumber.placeId)
      .where("googleReviewId", "==", googleReviewId)
      .limit(1)
      .get();
    if (!dupeCheck.empty) continue;

    await db.collection("reviews").add({
      plumberId: plumber.placeId,
      googleReviewId,
      authorName,
      rating: r.rating || 0,
      text,
      relativeTimeDescription: r.relativeTime || "",
      publishedAt: r.time || "",
      cachedAt: new Date().toISOString(),
      source: "google-places-initial",
    });
    stored++;
  }
  return stored;
}

// ---------------------------------------------------------------------------
// Claude API for synthesis
// ---------------------------------------------------------------------------

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.content[0]?.text || "";
}

function buildSynthesisPrompt(plumber) {
  const reviewText = plumber.reviews
    .map((r, i) => `Review ${i + 1} (${r.rating}/5 by ${r.author}): "${r.text}"`)
    .join("\n");

  return `You are analyzing Google reviews for a plumbing company to help homeowners decide who to hire for emergencies.

BUSINESS: ${plumber.name}
CITY: ${plumber.city}, ${plumber.state}
GOOGLE RATING: ${plumber.googleRating || "N/A"}/5 (${plumber.googleReviewCount || 0} reviews)
24-HOUR SERVICE: ${plumber.is24Hour ? "Yes" : "Unknown"}

REVIEWS:
${reviewText || "No review text available."}

Analyze these reviews and return a JSON object (no markdown, no code fences, just raw JSON) with these exact fields:

{
  "score": <number 1-100, your overall trust/quality score>,
  "trustLevel": <"high" | "moderate" | "low">,
  "summary": <string, 2-3 sentences written for a homeowner deciding whether to call this plumber in an emergency>,
  "strengths": [<up to 4 short strings>],
  "weaknesses": [<up to 3 short strings>],
  "bestFor": [<up to 3 strings like "emergency repairs", "bathroom remodels", "water heater replacement">],
  "redFlags": [<strings describing serious concerns, empty array if none>],
  "priceSignal": <"budget" | "mid-range" | "premium" | "unknown">,
  "topQuote": <string, the most helpful/positive customer quote from the reviews, or null>,
  "worstQuote": <string, the most concerning customer quote, or null>
}

If there are very few reviews, be conservative with the score. Weight emergency responsiveness and reliability heavily.`;
}

function parseSynthesis(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  const parsed = JSON.parse(cleaned);
  if (typeof parsed.score !== "number" || parsed.score < 1 || parsed.score > 100) {
    throw new Error(`Invalid score: ${parsed.score}`);
  }
  return {
    score: parsed.score,
    trustLevel: parsed.trustLevel || "moderate",
    summary: parsed.summary || "",
    strengths: parsed.strengths || [],
    weaknesses: parsed.weaknesses || [],
    bestFor: parsed.bestFor || [],
    redFlags: parsed.redFlags || [],
    priceSignal: parsed.priceSignal || "unknown",
    topQuote: parsed.topQuote || null,
    worstQuote: parsed.worstQuote || null,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log("=== Daily Scrape Starting ===");

  // Load queue
  if (!fs.existsSync(QUEUE_PATH)) {
    log("ERROR: scrape-queue.json not found");
    process.exit(1);
  }
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf-8"));

  // Monthly reset check
  const monthKey = currentMonthKey();
  if (queue.currentMonth !== monthKey) {
    log(`New month detected (${queue.currentMonth} -> ${monthKey}). Resetting usage.`);
    queue.usedThisMonth = 0;
    queue.currentMonth = monthKey;
  }

  // Budget calculations
  const remainingBudget = queue.monthlyBudget - queue.usedThisMonth - MONTHLY_BUFFER;
  if (remainingBudget <= 0) {
    log(`Monthly budget exhausted (${queue.usedThisMonth}/${queue.monthlyBudget} used, ${MONTHLY_BUFFER} buffer). Stopping.`);
    process.exit(0);
  }

  const daysLeft = daysLeftInMonth();
  const rawDailyBudget = Math.floor(remainingBudget / daysLeft);
  const dailyBudget = Math.max(MIN_DAILY_CALLS, Math.min(MAX_DAILY_CALLS, rawDailyBudget));

  log(`Budget: ${queue.usedThisMonth}/${queue.monthlyBudget} used | ${remainingBudget} remaining | ${daysLeft} days left`);
  log(`Today's budget: ${dailyBudget} API calls`);

  // Load existing plumber data for dedup
  let existingPlumbers = {};
  if (fs.existsSync(RAW_PATH)) {
    const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf-8"));
    for (const p of raw.plumbers) {
      existingPlumbers[p.placeId] = p;
    }
    log(`Loaded ${Object.keys(existingPlumbers).length} existing plumbers for dedup`);
  }

  // Load existing synthesis data (from staging file or canonical JSON)
  let existingSynthesis = {};
  const synthSourcePath = fs.existsSync(UPLOAD_STAGING_PATH) ? UPLOAD_STAGING_PATH
    : fs.existsSync(path.join(__dirname, "..", "data", "synthesized", "plumbers-synthesized.json"))
      ? path.join(__dirname, "..", "data", "synthesized", "plumbers-synthesized.json")
      : null;
  if (synthSourcePath) {
    const synth = JSON.parse(fs.readFileSync(synthSourcePath, "utf-8"));
    for (const p of synth.plumbers) {
      if (p.synthesis) existingSynthesis[p.placeId] = p.synthesis;
    }
    log(`Loaded ${Object.keys(existingSynthesis).length} existing syntheses`);
  }

  // Pick cities from queue that fit today's budget
  const pending = queue.queue.filter((c) => c.status === "pending");
  if (pending.length === 0) {
    log("Queue is empty — all cities scraped!");
    process.exit(0);
  }

  const todayCities = [];
  let estBudgetUsed = 0;
  for (const city of pending) {
    if (estBudgetUsed + city.estCalls > dailyBudget) {
      // If we haven't picked any city yet and this one is close, take it anyway
      if (todayCities.length === 0 && city.estCalls <= dailyBudget + 10) {
        todayCities.push(city);
        estBudgetUsed += city.estCalls;
      }
      break;
    }
    todayCities.push(city);
    estBudgetUsed += city.estCalls;
  }

  if (todayCities.length === 0) {
    log("No cities fit today's budget. Waiting for tomorrow.");
    process.exit(0);
  }

  log(`Today's cities: ${todayCities.map((c) => c.city).join(", ")} (est ${estBudgetUsed} calls)`);

  // =========================================================================
  // SCRAPE
  // =========================================================================

  let totalNewPlumbers = 0;
  let totalDeduped = 0;
  const citiesProcessed = [];
  const newPlumberDetails = [];

  // State abbreviation to full name for search queries
  const STATE_NAMES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia"};

  for (const cityEntry of todayCities) {
    const callsBefore = apiCallsMade;
    const cityName = cityEntry.city;
    const cityState = cityEntry.state;
    const stateName = STATE_NAMES[cityState] || cityState;
    const region = cityEntry.region;

    log(`\nScraping: ${cityName}, ${cityState} (${region})`);

    try {
      await sleep(RATE_LIMIT_MS);
      const searchResults = await textSearch(`emergency plumber in ${cityName}, ${stateName}`);
      log(`  Found ${searchResults.length} search results`);

      let cityNew = 0;
      let cityDeduped = 0;

      for (const sr of searchResults) {
        const placeId = sr.place_id;

        // DEDUP: skip Place Details API call if we already have this plumber
        if (existingPlumbers[placeId]) {
          cityDeduped++;
          totalDeduped++;
          continue;
        }

        // Hard stop: never exceed daily budget
        if (apiCallsMade - callsBefore + 1 >= dailyBudget && todayCities.indexOf(cityEntry) < todayCities.length - 1) {
          log(`  Approaching daily budget, stopping early for ${cityName}`);
          break;
        }

        await sleep(RATE_LIMIT_MS);
        const details = await getPlaceDetails(placeId);
        if (!details) continue;

        const plumber = transformPlace(details, cityName, cityState, region);
        if (!plumber.phone) {
          log(`  Skipping ${plumber.name} — no phone`);
          continue;
        }

        existingPlumbers[plumber.placeId] = plumber;
        cityNew++;
        totalNewPlumbers++;
        newPlumberDetails.push({ name: plumber.name, slug: slugify(plumber.name), city: cityName, state: cityState });

        // Store reviews in Firestore immediately (same collection as refresh-reviews)
        try {
          const reviewsStored = await storeReviewsInFirestore(plumber);
          if (reviewsStored > 0) log(`    + ${reviewsStored} reviews cached for ${plumber.name}`);
        } catch (revErr) {
          log(`    Warning: failed to cache reviews for ${plumber.name}: ${revErr.message}`);
        }
      }

      const callsUsed = apiCallsMade - callsBefore;
      log(`  +${cityNew} new, ${cityDeduped} deduped, ${callsUsed} API calls`);

      // Mark city as done in queue
      const queueEntry = queue.queue.find((c) => c.city === cityName && c.status === "pending");
      if (queueEntry) {
        queueEntry.status = "done";
      }
      queue.completed.push({
        city: cityName,
        state: cityEntry.state,
        county: cityEntry.county,
        region,
        status: "done",
        actualCalls: callsUsed,
        plumbersFound: cityNew,
        completedAt: today,
      });

      citiesProcessed.push({ city: cityName, newPlumbers: cityNew, calls: callsUsed });

      // Update cities collection (non-blocking)
      try {
        const db = getFirestoreDb();
        if (db) {
          const citySlug = `${slugify(cityName)}-${cityState.toLowerCase()}`;
          const source = cityEntry.source === "gsc" ? "gsc" : (cityState === "IL" ? "cron" : "manual");
          await db.collection("cities").doc(citySlug).set({
            slug: citySlug,
            city: cityName,
            state: cityState,
            source,
            scraped: true,
            scrapedAt: new Date().toISOString(),
            scrapeSource: "google-places",
            plumberCount: cityNew,
          }, { merge: true });
          log(`  Updated cities/${citySlug} in Firestore`);
        }
      } catch (cityErr) {
        log(`  Warning: failed to update cities collection: ${cityErr.message}`);
      }
    } catch (err) {
      log(`  FAILED: ${err.message}`);
      const queueEntry = queue.queue.find((c) => c.city === cityName && c.status === "pending");
      if (queueEntry) queueEntry.status = "failed";
    }

    // Update queue after every city
    queue.usedThisMonth += (apiCallsMade - callsBefore);
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
  }

  // Remove completed/failed from queue array
  queue.queue = queue.queue.filter((c) => c.status === "pending");
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));

  // =========================================================================
  // WRITE RAW DATA
  // =========================================================================

  const allPlumbersList = Object.values(existingPlumbers);
  allPlumbersList.sort((a, b) => (b.googleReviewCount || 0) - (a.googleReviewCount || 0));

  const rawOutput = {
    meta: {
      scrapedAt: new Date().toISOString(),
      totalPlumbers: allPlumbersList.length,
      citiesScraped: queue.completed.length,
    },
    plumbers: allPlumbersList,
  };

  fs.mkdirSync(path.dirname(RAW_PATH), { recursive: true });
  fs.writeFileSync(RAW_PATH, JSON.stringify(rawOutput, null, 2));
  log(`\nRaw data saved: ${allPlumbersList.length} total plumbers`);

  // =========================================================================
  // SYNTHESIS SKIPPED — handled by unified scoring pipeline
  // =========================================================================
  // Synthesis is now done by score-plumbers.ts (Sonnet) which runs as the
  // next step in the daily workflow. No point synthesizing on 5 reviews here
  // when the scoring pipeline will analyze all cached reviews and produce
  // both dimensional scores AND display synthesis in one pass.

  let synthSuccess = 0;
  let synthFailed = 0;

  // =========================================================================
  // WRITE STAGING FILE FOR UPLOAD-TO-FIRESTORE
  // =========================================================================
  // NOTE: daily-scrape does NOT write plumbers-synthesized.json.
  // That file is a derived artifact owned by export-firestore-to-json.js.
  // This staging file is an intermediate working file only.

  const synthesizedPlumbers = allPlumbersList.map((p) => ({
    ...p,
    synthesis: existingSynthesis[p.placeId] || null,
  }));

  const stagingOutput = {
    meta: {
      ...rawOutput.meta,
      synthesizedAt: new Date().toISOString(),
      totalSynthesized: Object.keys(existingSynthesis).length,
      model: "claude-sonnet-4-20250514",
    },
    plumbers: synthesizedPlumbers,
  };

  fs.writeFileSync(UPLOAD_STAGING_PATH, JSON.stringify(stagingOutput, null, 2));
  log(`Staging file written: ${UPLOAD_STAGING_PATH}`);

  // =========================================================================
  // SUMMARY
  // =========================================================================

  log(`\n${"=".repeat(50)}`);
  log(`Daily scrape complete`);
  log(`  Cities: ${citiesProcessed.map((c) => `${c.city} (+${c.newPlumbers})`).join(", ")}`);
  log(`  API calls: ${apiCallsMade}`);
  log(`  New plumbers: ${totalNewPlumbers}`);
  log(`  Deduped (skipped): ${totalDeduped}`);
  log(`  Synthesized: ${synthSuccess} new, ${synthFailed} failed`);
  log(`  Total plumbers: ${allPlumbersList.length}`);
  log(`  Total synthesized: ${Object.keys(existingSynthesis).length}`);
  log(`  Monthly usage: ${queue.usedThisMonth}/${queue.monthlyBudget}`);
  log(`  Queue remaining: ${queue.queue.length} cities`);

  logStream.end();

  // Return summary for daily-publish
  return {
    startedAt: scrapeStartTime,
    citiesProcessed,
    newPlumbers: totalNewPlumbers,
    newPlumberDetails,
    totalPlumbers: allPlumbersList.length,
    apiCalls: apiCallsMade,
    synthesized: synthSuccess,
    synthFailed,
    deduped: totalDeduped,
    monthlyUsage: queue.usedThisMonth,
    monthlyBudget: queue.monthlyBudget,
    queueRemaining: queue.queue.length,
  };
}

// ---------------------------------------------------------------------------
// Log pipeline run to Firestore for Activity dashboard
// ---------------------------------------------------------------------------

async function logPipelineRun(result, error) {
  const db = getFirestoreDb();
  if (!db) return;

  const admin = require("firebase-admin");
  const endTime = new Date();

  try {
    await db.collection("pipelineRuns").add({
      script: "daily-scrape",
      startedAt: admin.firestore.Timestamp.fromDate(
        result?.startedAt ? new Date(result.startedAt) : new Date(endTime.getTime() - 60000)
      ),
      completedAt: admin.firestore.Timestamp.fromDate(endTime),
      durationSeconds: result?.startedAt
        ? Math.round((endTime.getTime() - new Date(result.startedAt).getTime()) / 1000)
        : 0,
      status: error ? "error" : (result?.synthFailed > 0 ? "partial" : "success"),
      triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
      error: error ? error.message : null,
      summary: {
        citiesSearched: (result?.citiesProcessed || []).map((c) => c.city),
        newPlumbers: result?.newPlumbers || 0,
        newPlumberDetails: result?.newPlumberDetails || [],
        totalPlumbers: result?.totalPlumbers || 0,
        apiCalls: result?.apiCalls || 0,
        synthesized: result?.synthesized || 0,
        synthFailed: result?.synthFailed || 0,
        deduped: result?.deduped || 0,
        monthlyUsage: `${result?.monthlyUsage || 0}/${result?.monthlyBudget || 0}`,
        queueRemaining: result?.queueRemaining || 0,
      },
    });
    console.log("Pipeline run logged to Firestore");
  } catch (logErr) {
    console.error("Warning: failed to log pipeline run:", logErr.message);
  }
}

// Run and export result
const scrapeStartTime = new Date().toISOString();

main()
  .then(async (result) => {
    // Write result for daily-publish to read
    const resultPath = path.join(LOG_DIR, `daily-result-${today}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    await logPipelineRun(result, null);
    process.exit(0);
  })
  .catch(async (err) => {
    log(`FATAL: ${err.message}`);
    logStream.end();
    await logPipelineRun(null, err);
    process.exit(1);
  });
