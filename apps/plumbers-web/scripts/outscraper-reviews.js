#!/usr/bin/env node

/**
 * Pull deep reviews from Google and Yelp via Outscraper API
 * for plumbers in high-traction cities. Stores reviews in the
 * `reviews` subcollection and updates per-plumber review counts.
 *
 * Synthesis is owned by score-plumbers.ts and runs as a separate
 * downstream step in the workflow.
 *
 * Usage:
 *   node scripts/outscraper-reviews.js crystal-lake-il aberdeen-md
 *   node scripts/outscraper-reviews.js crystal-lake-il --dry-run
 *   node scripts/outscraper-reviews.js crystal-lake-il --google-only
 *
 * Env:
 *   OUTSCRAPER_API_KEY  — required
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Outscraper = require("outscraper");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
const OUTSCRAPER_QPS_DELAY_MS = 2000;
const MAX_REVIEWS_PER_SOURCE = 100;
const COST_PER_REVIEW = 0.002; // ~$2 per 1000 reviews across sources

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

const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;
if (!OUTSCRAPER_API_KEY) {
  console.error("ERROR: OUTSCRAPER_API_KEY not set. Add it to .env.local or export it.");
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
// Outscraper client
// ---------------------------------------------------------------------------

const outscraper = new Outscraper(OUTSCRAPER_API_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hashReviewId(source, authorName, text) {
  return crypto.createHash("md5").update(`${source}:${authorName}:${text.slice(0, 100)}`).digest("hex");
}

// Backwards-compatible hash for existing Google reviews (no source prefix)
function hashGoogleReviewId(authorName, text) {
  return crypto.createHash("md5").update(`${authorName}:${text.slice(0, 100)}`).digest("hex");
}

// ---------------------------------------------------------------------------
// Outscraper REST API with async polling (SDK doesn't poll for reviews)
// ---------------------------------------------------------------------------

async function outscraperRequest(path, params) {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`https://api.app.outscraper.com${path}?${qs}`, {
    headers: { "X-API-KEY": OUTSCRAPER_API_KEY, "client": "Node Script" },
  });

  const body = await resp.json();

  // Synchronous response — data is inline
  if (body.data) return body.data;

  // Async response — poll for results
  if (body.id && body.results_location) {
    console.log(`    Waiting for async result (${body.id})...`);
    const pollUrl = body.results_location;
    for (let attempt = 0; attempt < 30; attempt++) {
      await sleep(5000);
      const pollResp = await fetch(pollUrl, {
        headers: { "X-API-KEY": OUTSCRAPER_API_KEY },
      });
      const pollBody = await pollResp.json();
      if (pollBody.status === "Success" && pollBody.data) {
        return pollBody.data;
      }
      if (pollBody.status === "Error") {
        throw new Error(`Outscraper async error: ${pollBody.errorMessage || "unknown"}`);
      }
      // Still pending — continue polling
    }
    throw new Error("Outscraper async request timed out after 150s");
  }

  if (body.error || body.errorMessage) {
    throw new Error(`Outscraper: ${body.errorMessage || body.error}`);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Google Reviews via Outscraper
// ---------------------------------------------------------------------------

async function pullGoogleReviews(placeId, businessName, cutoffTimestamp) {
  console.log(`    [Google] Pulling reviews for ${placeId}...`);

  const params = {
    query: placeId,
    reviewsLimit: String(MAX_REVIEWS_PER_SOURCE),
    sort: "newest",
    language: "en",
    async: "false",
  };

  if (cutoffTimestamp) {
    params.cutoff = String(Math.floor(cutoffTimestamp.toDate().getTime() / 1000));
  }

  try {
    const data = await outscraperRequest("/maps/reviews-v3", params);

    if (!data || !data[0]) return [];
    const reviews = data[0].reviews_data || [];
    console.log(`    [Google] Got ${reviews.length} reviews (of ${data[0].reviews || "?"} total).`);
    return reviews.map((r) => ({
      source: "google",
      author: r.author_title || r.reviewer_name || "Anonymous",
      rating: r.review_rating || 0,
      text: r.review_text || "",
      date: r.review_datetime_utc || "",
    }));
  } catch (err) {
    console.error(`    [Google] Error: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Yelp Reviews via Outscraper (3-step fallback)
// ---------------------------------------------------------------------------

function slugifyForYelp(name, city) {
  // "D & D Plumbing Company" + "Crystal Lake" → "d-and-d-plumbing-company-crystal-lake"
  return (name + " " + city)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchYelpReviews(yelpUrl) {
  // Outscraper yelp/reviews returns flat review objects in data[0], not nested
  const data = await outscraperRequest("/yelp/reviews", {
    query: yelpUrl,
    limit: String(MAX_REVIEWS_PER_SOURCE),
    sort: "relevance_desc",
    async: "false",
  });

  if (!data || !data[0]) return [];

  // Reviews are flat objects in data[0] array
  const reviews = Array.isArray(data[0]) ? data[0] : [];
  // Filter out sentinel markers
  return reviews.filter((r) => r.review_id !== "__NO_REVIEWS_FOUND__" && r.review_text);
}

async function pullYelpReviews(businessName, city, state) {
  console.log(`    [Yelp] Looking up "${businessName}" in ${city}, ${state}...`);

  try {
    let reviews = [];
    let yelpUrl = null;

    // --- Approach A: Construct likely Yelp URL and try directly ---
    const slug = slugifyForYelp(businessName, city);
    const constructedUrl = `https://www.yelp.com/biz/${slug}`;
    console.log(`    [Yelp] Trying constructed URL: ${constructedUrl}`);

    reviews = await fetchYelpReviews(constructedUrl);
    if (reviews.length > 0) {
      yelpUrl = constructedUrl;
      console.log(`    [Yelp] Got ${reviews.length} reviews via constructed URL.`);
    }

    // --- Approach B: Google search for the Yelp page ---
    if (reviews.length === 0) {
      console.log(`    [Yelp] Constructed URL empty — searching Google for Yelp listing...`);
      const searchData = await outscraperRequest("/google-search", {
        query: `site:yelp.com "${businessName}" ${city} ${state}`,
        limit: "3",
        async: "false",
      });

      const organic = searchData?.[0]?.organic_results || [];
      const yelpResult = organic.find((r) =>
        (r.link || "").match(/yelp\.com\/biz\/[a-z0-9-]+/)
      );

      if (yelpResult) {
        // Clean URL: strip fragments, query params, and mobile prefix
        yelpUrl = yelpResult.link
          .replace(/[#?].*$/, "")
          .replace("://m.yelp.com/", "://www.yelp.com/");
        console.log(`    [Yelp] Found via Google: ${yelpUrl}`);
        await sleep(OUTSCRAPER_QPS_DELAY_MS);
        reviews = await fetchYelpReviews(yelpUrl);
        console.log(`    [Yelp] Got ${reviews.length} reviews via Google-discovered URL.`);
      } else {
        console.log(`    [Yelp] No Yelp listing found via Google search.`);
        return [];
      }
    }

    if (reviews.length === 0) {
      console.log(`    [Yelp] No reviews returned.`);
      return [];
    }

    // Extract aggregate rating from first review's business data if available
    const firstReview = reviews[0] || {};
    const yelpBizName = firstReview.business_name || null;

    return reviews.map((r) => ({
      source: "yelp",
      author: r.author_title || "Anonymous",
      rating: r.review_rating || 0,
      text: r.review_text || "",
      date: r.datetime_utc || r.review_datetime_utc || "",
      yelpUrl,
      yelpBizName,
    }));
  } catch (err) {
    console.error(`    [Yelp] Error: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Store reviews in Firestore (multi-source)
// ---------------------------------------------------------------------------

async function storeReviews(plumberId, reviews) {
  let newCount = 0;
  let dupeCount = 0;
  const countBySource = { google: 0, yelp: 0 };

  for (const review of reviews) {
    if (!review.text) continue;

    // Use backwards-compatible hash for Google, source-prefixed for others
    const reviewId = review.source === "google"
      ? hashGoogleReviewId(review.author, review.text)
      : hashReviewId(review.source, review.author, review.text);

    // Check for dupe
    const dupeCheck = await db.collection("reviews")
      .where("plumberId", "==", plumberId)
      .where("googleReviewId", "==", reviewId)
      .limit(1)
      .get();

    if (!dupeCheck.empty) {
      dupeCount++;
      continue;
    }

    await db.collection("reviews").add({
      plumberId,
      googleReviewId: reviewId, // field name kept for compat; it's really "reviewHash"
      authorName: review.author,
      rating: review.rating || 0,
      text: review.text,
      relativeTimeDescription: review.date || "",
      publishedAt: review.date || "",
      cachedAt: admin.firestore.Timestamp.now(),
      source: review.source,
    });

    newCount++;
    countBySource[review.source] = (countBySource[review.source] || 0) + 1;
  }

  return { newCount, dupeCount, countBySource };
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const googleOnly = args.includes("--google-only");
  const citySlugs = args.filter((a) => !a.startsWith("--"));

  if (citySlugs.length === 0) {
    console.error("Usage: node scripts/outscraper-reviews.js <city-slug> [city-slug...] [--dry-run] [--google-only]");
    console.error("Example: node scripts/outscraper-reviews.js crystal-lake-il aberdeen-md");
    process.exit(1);
  }

  if (dryRun) console.log("DRY RUN — no API calls, no writes\n");
  if (googleOnly) console.log("GOOGLE ONLY — skipping Yelp\n");

  console.log("=== Outscraper Multi-Source Deep Review Pull ===\n");

  let totalPlumbers = 0;
  let totalNewReviews = 0;
  let totalDupes = 0;
  let totalErrors = 0;
  const reviewsBySource = { google: 0, yelp: 0 };
  const plumberDetails = [];
  const startedAt = new Date();

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
      const placeId = data.googlePlaceId;
      const city = data.address?.city || "";
      const state = data.address?.state || "";
      totalPlumbers++;

      console.log(`  🔧 ${data.businessName} (${city}, ${state})`);

      if (!placeId) {
        console.log(`    Skipping — no Google Place ID.`);
        plumberDetails.push({ name: data.businessName, id: doc.id, skipped: true, reason: "no placeId" });
        continue;
      }

      if (dryRun) {
        const existing = data.lastOutscraperPull ? `last pull: ${data.lastOutscraperPull.toDate().toISOString().slice(0, 10)}` : "never pulled";
        console.log(`    [DRY RUN] Would pull Google${googleOnly ? "" : " + Yelp"} reviews (${existing})`);
        plumberDetails.push({ name: data.businessName, id: doc.id, skipped: true, reason: "dry-run" });
        continue;
      }

      const allReviews = [];
      const platformStats = {
        yelpRating: null,
        yelpReviewCount: null,
      };

      // Per-plumber tracking variables
      let plumberCountBySource = { google: 0, yelp: 0 };
      let plumberDupeCount = 0;
      let plumberError = false;

      try {
        // 1. Google reviews
        await sleep(OUTSCRAPER_QPS_DELAY_MS);
        const cutoff = data.lastOutscraperPull || null;
        const googleReviews = await pullGoogleReviews(placeId, data.businessName, cutoff);
        allReviews.push(...googleReviews);

        if (!googleOnly) {
          // 2. Yelp reviews
          await sleep(OUTSCRAPER_QPS_DELAY_MS);
          const yelpReviews = await pullYelpReviews(data.businessName, city, state);
          if (yelpReviews.length > 0) {
            // Compute average Yelp rating from the reviews we pulled
            const yelpRatings = yelpReviews.filter((r) => r.rating > 0);
            if (yelpRatings.length > 0) {
              platformStats.yelpRating = Math.round(yelpRatings.reduce((s, r) => s + r.rating, 0) / yelpRatings.length * 10) / 10;
              platformStats.yelpReviewCount = yelpRatings.length;
            }
            allReviews.push(...yelpReviews);
          }
        }

        if (allReviews.length === 0) {
          await db.collection("plumbers").doc(doc.id).update({
            lastOutscraperPull: admin.firestore.Timestamp.now(),
          });
          console.log(`    No reviews found across any platform.`);
          plumberDetails.push({
            name: data.businessName, id: doc.id,
            reviews: { google: 0, yelp: 0 },
            dupes: 0, hasBBB: !!data.bbb,
          });
          continue;
        }

        // Store all reviews
        const { newCount, dupeCount, countBySource } = await storeReviews(doc.id, allReviews);
        plumberCountBySource = countBySource;
        plumberDupeCount = dupeCount;
        totalNewReviews += newCount;
        totalDupes += dupeCount;
        for (const [src, cnt] of Object.entries(countBySource)) {
          reviewsBySource[src] = (reviewsBySource[src] || 0) + cnt;
        }

        console.log(`    Stored: ${newCount} new (G:${countBySource.google || 0} Y:${countBySource.yelp || 0}), ${dupeCount} dupes skipped`);

        // Count reviews per source for this plumber
        const allSnap = await db.collection("reviews").where("plumberId", "==", doc.id).get();
        let gCount = 0, yCount = 0;
        allSnap.docs.forEach((d) => {
          const src = d.data().source || "google";
          if (src === "google") gCount++;
          else if (src === "yelp") yCount++;
        });

        // Update plumber document
        await db.collection("plumbers").doc(doc.id).update({
          lastOutscraperPull: admin.firestore.Timestamp.now(),
          cachedReviewCount: allSnap.size,
          googleReviewsCached: gCount,
          yelpReviewsCached: yCount,
          reviewSource: googleOnly ? "outscraper" : "outscraper-multi",
          reviewGap: (data.googleReviewCount || 0) - gCount,
          ...(platformStats.yelpRating && { yelpRating: platformStats.yelpRating, yelpReviewCount: platformStats.yelpReviewCount }),
        });

      } catch (err) {
        console.error(`    ERROR: ${err.message}`);
        totalErrors++;
        plumberError = true;
      }

      plumberDetails.push({
        name: data.businessName,
        id: doc.id,
        reviews: { google: plumberCountBySource.google || 0, yelp: plumberCountBySource.yelp || 0 },
        dupes: plumberDupeCount,
        hasBBB: !!data.bbb,
        ...(plumberError && { error: true }),
      });
    }
  }

  // Summary
  const elapsed = Math.round((Date.now() - startedAt.getTime()) / 1000);
  const estCost = (totalNewReviews * COST_PER_REVIEW).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`  Cities processed: ${citySlugs.length}`);
  console.log(`  Plumbers processed: ${totalPlumbers}`);
  console.log(`  New reviews stored: ${totalNewReviews}`);
  console.log(`    Google: ${reviewsBySource.google || 0}`);
  console.log(`    Yelp:   ${reviewsBySource.yelp || 0}`);
  console.log(`  Duplicate reviews skipped: ${totalDupes}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`  Estimated Outscraper cost: $${estCost}`);
  console.log(`  Duration: ${elapsed}s`);

  // Log to pipelineRuns
  if (!dryRun) {
    try {
      await db.collection("pipelineRuns").add({
        script: "outscraper-reviews",
        startedAt: admin.firestore.Timestamp.fromDate(startedAt),
        completedAt: admin.firestore.Timestamp.now(),
        durationSeconds: elapsed,
        status: totalErrors > 0 ? "partial" : "success",
        summary: {
          citySlugs,
          plumbersProcessed: totalPlumbers,
          newReviews: totalNewReviews,
          googleReviews: reviewsBySource.google || 0,
          yelpReviews: reviewsBySource.yelp || 0,
          dupesSkipped: totalDupes,
          errors: totalErrors,
          estimatedCost: `$${estCost}`,
          plumberDetails,
        },
        triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
      });
    } catch { /* */ }
  }
}

main()
  .then(() => {
    // Post-run: export to static JSON + request indexing for all affected cities
    const { execSync } = require("child_process");
    const root = path.join(__dirname, "..");
    const noPush = process.argv.includes("--dry-run") ? "--no-push" : "";

    console.log("\n=== Exporting Firestore → Static JSON ===\n");
    try {
      const exportOut = execSync(
        `node scripts/export-firestore-to-json.js ${noPush}`,
        { cwd: root, encoding: "utf-8", timeout: 120000 }
      );
      console.log(exportOut);

      // Parse affected cities from export output
      const citiesMatch = exportOut.match(/__AFFECTED_CITIES__:(.+)/);
      if (citiesMatch) {
        const cities = JSON.parse(citiesMatch[1]);
        if (cities.length > 0 && !process.argv.includes("--dry-run")) {
          console.log("\n=== Requesting indexing for all affected city pages ===\n");

          // Convert service city slugs to URL paths
          const STATE_ABBR_TO_SLUG = {AL:"alabama",AK:"alaska",AZ:"arizona",AR:"arkansas",CA:"california",CO:"colorado",CT:"connecticut",DE:"delaware",FL:"florida",GA:"georgia",HI:"hawaii",ID:"idaho",IL:"illinois",IN:"indiana",IA:"iowa",KS:"kansas",KY:"kentucky",LA:"louisiana",ME:"maine",MD:"maryland",MA:"massachusetts",MI:"michigan",MN:"minnesota",MS:"mississippi",MO:"missouri",MT:"montana",NE:"nebraska",NV:"nevada",NH:"new-hampshire",NJ:"new-jersey",NM:"new-mexico",NY:"new-york",NC:"north-carolina",ND:"north-dakota",OH:"ohio",OK:"oklahoma",OR:"oregon",PA:"pennsylvania",RI:"rhode-island",SC:"south-carolina",SD:"south-dakota",TN:"tennessee",TX:"texas",UT:"utah",VT:"vermont",VA:"virginia",WA:"washington",WV:"west-virginia",WI:"wisconsin",WY:"wyoming",DC:"district-of-columbia"};

          // Service city slugs are like "crystal-lake" — we need to figure out the state.
          // Read from the just-exported JSON to get city→state mapping.
          const jsonData = JSON.parse(fs.readFileSync(path.join(root, "data", "synthesized", "plumbers-synthesized.json"), "utf-8"));
          const cityStateMap = new Map();
          for (const p of jsonData.plumbers) {
            for (const sc of (p.serviceCities || [])) {
              if (!cityStateMap.has(sc)) cityStateMap.set(sc, p.state);
            }
          }

          const urls = cities
            .map((c) => {
              const state = cityStateMap.get(c);
              if (!state) return null;
              const stateSlug = STATE_ABBR_TO_SLUG[state] || state.toLowerCase();
              return `/emergency-plumbers/${stateSlug}/${c}`;
            })
            .filter(Boolean);

          if (urls.length > 0) {
            try {
              execSync(
                `node scripts/request-indexing.js ${urls.join(" ")}`,
                { cwd: root, stdio: "inherit", timeout: 60000 }
              );
            } catch (e) {
              console.error("Indexing request failed:", e.message);
            }
          }
        }
      }
    } catch (err) {
      console.error("Export failed:", err.message);
    }
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
