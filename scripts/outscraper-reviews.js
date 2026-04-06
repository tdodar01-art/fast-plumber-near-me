#!/usr/bin/env node

/**
 * Pull deep reviews from Google, Yelp, and Angi via Outscraper API
 * for plumbers in high-traction cities, then re-synthesize with Claude
 * using the full multi-source review corpus.
 *
 * Usage:
 *   node scripts/outscraper-reviews.js crystal-lake-il aberdeen-md
 *   node scripts/outscraper-reviews.js crystal-lake-il --dry-run
 *   node scripts/outscraper-reviews.js crystal-lake-il --skip-synthesis
 *   node scripts/outscraper-reviews.js crystal-lake-il --google-only
 *
 * Env:
 *   OUTSCRAPER_API_KEY  — required
 *   ANTHROPIC_API_KEY   — required for synthesis step
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
const CLAUDE_RATE_LIMIT_MS = 500;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
// Angi Reviews via Outscraper (Google search scrape — Angi has no direct API)
// ---------------------------------------------------------------------------

async function pullAngiReviews(businessName, city, state) {
  const query = `${businessName} ${city} ${state} site:angi.com`;
  console.log(`    [Angi] Searching Google for Angi listing: "${query}"...`);

  try {
    // Use Google search to find the Angi page, then scrape reviews from it
    const searchResults = await outscraper.googleSearch(query, 3);
    if (!searchResults || searchResults.length === 0 || !searchResults[0]) {
      console.log(`    [Angi] No search results.`);
      return [];
    }

    const organic = searchResults[0].organic_results || [];
    const angiResult = organic.find((r) => (r.link || "").includes("angi.com"));
    if (!angiResult) {
      console.log(`    [Angi] No Angi listing found in search results.`);
      return [];
    }

    console.log(`    [Angi] Found: ${angiResult.link}`);

    // Extract review snippets from search result descriptions
    // Angi doesn't have a dedicated Outscraper reviews endpoint,
    // so we pull what's available from the search snippet + any rich data
    const description = angiResult.description || angiResult.snippet || "";
    if (!description || description.length < 20) {
      console.log(`    [Angi] No review content extractable.`);
      return [];
    }

    // Parse rating from search result if available
    const ratingMatch = description.match(/(\d+\.?\d*)\s*(?:out of|\/)\s*5/i);
    const reviewCountMatch = description.match(/(\d+)\s*(?:reviews?|ratings?)/i);

    console.log(`    [Angi] Rating: ${ratingMatch ? ratingMatch[1] : "N/A"}, Reviews: ${reviewCountMatch ? reviewCountMatch[1] : "N/A"}`);

    // Return metadata even without individual reviews — useful for cross-platform comparison
    return [{
      source: "angi",
      author: "Angi Aggregate",
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
      text: description,
      date: "",
      angiUrl: angiResult.link,
      angiRating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      angiReviewCount: reviewCountMatch ? parseInt(reviewCountMatch[1]) : null,
    }];
  } catch (err) {
    console.error(`    [Angi] Error: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Store reviews in Firestore (multi-source)
// ---------------------------------------------------------------------------

async function storeReviews(plumberId, reviews) {
  let newCount = 0;
  let dupeCount = 0;
  const countBySource = { google: 0, yelp: 0, angi: 0 };

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
// Claude synthesis (multi-source aware)
// ---------------------------------------------------------------------------

function buildPrompt(name, googleRating, googleReviewCount, reviews, platformStats) {
  // Group reviews by source for the prompt
  const googleReviews = reviews.filter((r) => r.source === "google");
  const yelpReviews = reviews.filter((r) => r.source === "yelp");
  const angiReviews = reviews.filter((r) => r.source === "angi");

  let reviewBlock = "";

  if (googleReviews.length > 0) {
    reviewBlock += `=== GOOGLE REVIEWS (${googleReviews.length}) ===\n`;
    reviewBlock += googleReviews.map((r) => `[${r.rating}/5${r.date ? ` — ${r.date}` : ""}] ${r.text}`).join("\n\n");
    reviewBlock += "\n\n";
  }
  if (yelpReviews.length > 0) {
    reviewBlock += `=== YELP REVIEWS (${yelpReviews.length}) ===\n`;
    reviewBlock += yelpReviews.map((r) => `[${r.rating}/5${r.date ? ` — ${r.date}` : ""}] ${r.text}`).join("\n\n");
    reviewBlock += "\n\n";
  }
  if (angiReviews.length > 0) {
    reviewBlock += `=== ANGI DATA (${angiReviews.length}) ===\n`;
    reviewBlock += angiReviews.map((r) => `[${r.rating}/5] ${r.text}`).join("\n\n");
    reviewBlock += "\n\n";
  }

  let platformContext = `Google Rating: ${googleRating ?? "N/A"}/5 (${googleReviewCount} reviews)`;
  if (platformStats.yelpRating) platformContext += `\nYelp Rating: ${platformStats.yelpRating}/5 (${platformStats.yelpReviewCount || "?"} reviews)`;
  if (platformStats.angiRating) platformContext += `\nAngi Rating: ${platformStats.angiRating}/5 (${platformStats.angiReviewCount || "?"} reviews)`;

  // BBB data
  const bbb = platformStats.bbb;
  let bbbContext = "";
  if (bbb) {
    bbbContext = `\n\n=== BBB DATA ===\nBBB Rating: ${bbb.rating || "N/A"} | Accredited: ${bbb.accredited ? "Yes" : "No"}`;
    if (bbb.complaintsPast3Years != null) bbbContext += ` | Complaints (3yr): ${bbb.complaintsPast3Years}`;
    if (bbb.complaintsTotal != null) bbbContext += ` | Complaints (total): ${bbb.complaintsTotal}`;
    if (bbb.yearsInBusiness != null) bbbContext += ` | Years in business: ${bbb.yearsInBusiness}`;
  }

  return `You are analyzing reviews from multiple platforms for a plumber to help homeowners in an emergency.

Plumber: ${name}
${platformContext}${bbbContext}
We have ${reviews.length} total reviews across all platforms.

${reviewBlock}
IMPORTANT: If ratings differ significantly between platforms (e.g. 4.8 on Google but 2.5 on Yelp), note this discrepancy in your summary and weaknesses. Platform rating gaps are a signal.
${bbb ? "IMPORTANT: BBB complaints are a strong reliability signal. Unresolved or high complaint counts should be flagged as red flags. BBB accreditation is a positive trust signal. Low BBB ratings (B or below) with high Google ratings suggest possible review manipulation." : ""}

Respond in JSON only. No markdown, no preamble, no backticks.
{
  "summary": "One specific sentence a friend would say. Never say 'reliable and professional'. Reference actual patterns. If platforms disagree, mention it.",
  "strengths": ["2-3 specific strengths with evidence. e.g. '3 of 8 Google reviewers mention arriving within an hour'${bbb?.accredited ? " Include BBB accreditation as a trust signal." : ""}"],
  "weaknesses": ["1-2 specific weaknesses. e.g. 'Yelp reviews mention surprise fees not seen on Google'. Include platform discrepancies if significant.${bbb?.complaintsPast3Years > 0 ? " Flag BBB complaints." : ""}"],
  "emergencyReadiness": "high|medium|low|unknown",
  "emergencyNotes": "One sentence about emergency signals — after-hours mentions, response time, weekend availability.",
  "badges": ["Only from: 'Fast Responder', 'Fair Pricing', '24/7 Available', 'Clean & Professional', 'Great Communicator'. Only include if reviews clearly support it."],
  "redFlags": ["Concerning patterns across any platform. Empty array if none."],
  "bestFor": ["1-2 specific services or scenarios this plumber excels at, based on review patterns."],
  "pricingTier": "budget|mid-range|premium|unknown",
  "platformDiscrepancy": "Describe any significant rating gap between platforms, or null if ratings are consistent"
}`;
}

async function callClaude(prompt) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text || "";
}

function parseAIResponse(text) {
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

async function synthesizePlumber(plumberId, plumberData, platformStats) {
  // Fetch ALL cached reviews for this plumber (all sources)
  const reviewsSnap = await db.collection("reviews")
    .where("plumberId", "==", plumberId)
    .get();

  if (reviewsSnap.empty) {
    console.log(`    No cached reviews to synthesize.`);
    return false;
  }

  const reviews = reviewsSnap.docs.map((d) => ({
    source: d.data().source || "google",
    rating: d.data().rating || 0,
    text: d.data().text || "",
    date: d.data().publishedAt || "",
  }));

  const googleCount = reviews.filter((r) => r.source === "google").length;
  const yelpCount = reviews.filter((r) => r.source === "yelp").length;
  const angiCount = reviews.filter((r) => r.source === "angi").length;
  console.log(`    Synthesizing ${reviews.length} reviews (Google: ${googleCount}, Yelp: ${yelpCount}, Angi: ${angiCount})...`);

  const prompt = buildPrompt(
    plumberData.businessName,
    plumberData.googleRating,
    plumberData.googleReviewCount || 0,
    reviews,
    platformStats
  );

  await sleep(CLAUDE_RATE_LIMIT_MS);
  const response = await callClaude(prompt);
  const ai = parseAIResponse(response);

  const synthesis = {
    strengths: ai.strengths || [],
    weaknesses: ai.weaknesses || [],
    emergencySignals: ai.emergencyReadiness !== "unknown"
      ? [ai.emergencyNotes].filter(Boolean)
      : [],
    redFlags: ai.redFlags || [],
    badges: ai.badges || [],
    reviewCount: reviews.length,
    synthesizedAt: admin.firestore.Timestamp.now(),
    pricingTier: ai.pricingTier || "unknown",
    categories: {
      emergency: {
        strengths: ai.emergencyReadiness === "high" ? [ai.emergencyNotes] : [],
        weaknesses: ai.emergencyReadiness === "low" ? [ai.emergencyNotes] : [],
      },
      pricing: { strengths: [], weaknesses: [] },
      quality: { strengths: [], weaknesses: [] },
      communication: { strengths: [], weaknesses: [] },
      homeRespect: { strengths: [], weaknesses: [] },
      punctuality: { strengths: [], weaknesses: [] },
    },
    summary: ai.summary || "",
    emergencyReadiness: ai.emergencyReadiness || "unknown",
    emergencyNotes: ai.emergencyNotes || "",
    platformDiscrepancy: ai.platformDiscrepancy || null,
    aiSynthesizedAt: admin.firestore.Timestamp.now(),
    synthesisVersion: "ai-v1-multisource",
  };

  await db.collection("plumbers").doc(plumberId).update({
    reviewSynthesis: synthesis,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log(`    ✓ Synthesis: ${ai.badges?.join(", ") || "no badges"} | ${ai.redFlags?.length || 0} red flags | emergency: ${ai.emergencyReadiness}${ai.platformDiscrepancy ? ` | ⚠ ${ai.platformDiscrepancy}` : ""}`);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipSynthesis = args.includes("--skip-synthesis");
  const googleOnly = args.includes("--google-only");
  const citySlugs = args.filter((a) => !a.startsWith("--"));

  if (citySlugs.length === 0) {
    console.error("Usage: node scripts/outscraper-reviews.js <city-slug> [city-slug...] [--dry-run] [--skip-synthesis] [--google-only]");
    console.error("Example: node scripts/outscraper-reviews.js crystal-lake-il aberdeen-md");
    process.exit(1);
  }

  if (dryRun) console.log("DRY RUN — no API calls, no writes\n");
  if (skipSynthesis) console.log("SKIP SYNTHESIS — pulling reviews only\n");
  if (googleOnly) console.log("GOOGLE ONLY — skipping Yelp and Angi\n");

  console.log("=== Outscraper Multi-Source Deep Review Pull ===\n");

  let totalPlumbers = 0;
  let totalNewReviews = 0;
  let totalDupes = 0;
  let totalSynthesized = 0;
  let totalErrors = 0;
  const reviewsBySource = { google: 0, yelp: 0, angi: 0 };
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
        continue;
      }

      if (dryRun) {
        const existing = data.lastOutscraperPull ? `last pull: ${data.lastOutscraperPull.toDate().toISOString().slice(0, 10)}` : "never pulled";
        console.log(`    [DRY RUN] Would pull Google${googleOnly ? "" : " + Yelp + Angi"} reviews (${existing})`);
        continue;
      }

      const allReviews = [];
      const platformStats = {
        yelpRating: null,
        yelpReviewCount: null,
        angiRating: null,
        angiReviewCount: null,
      };

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

          // 3. Angi reviews
          await sleep(OUTSCRAPER_QPS_DELAY_MS);
          const angiReviews = await pullAngiReviews(data.businessName, city, state);
          if (angiReviews.length > 0) {
            const withStats = angiReviews.find((r) => r.angiRating);
            if (withStats) {
              platformStats.angiRating = withStats.angiRating;
              platformStats.angiReviewCount = withStats.angiReviewCount;
            }
            allReviews.push(...angiReviews);
          }
        }

        if (allReviews.length === 0) {
          await db.collection("plumbers").doc(doc.id).update({
            lastOutscraperPull: admin.firestore.Timestamp.now(),
          });
          console.log(`    No reviews found across any platform.`);
          continue;
        }

        // Store all reviews
        const { newCount, dupeCount, countBySource } = await storeReviews(doc.id, allReviews);
        totalNewReviews += newCount;
        totalDupes += dupeCount;
        for (const [src, cnt] of Object.entries(countBySource)) {
          reviewsBySource[src] = (reviewsBySource[src] || 0) + cnt;
        }

        console.log(`    Stored: ${newCount} new (G:${countBySource.google || 0} Y:${countBySource.yelp || 0} A:${countBySource.angi || 0}), ${dupeCount} dupes skipped`);

        // Count reviews per source for this plumber
        const allSnap = await db.collection("reviews").where("plumberId", "==", doc.id).get();
        let gCount = 0, yCount = 0, aCount = 0;
        allSnap.docs.forEach((d) => {
          const src = d.data().source || "google";
          if (src === "google") gCount++;
          else if (src === "yelp") yCount++;
          else if (src === "angi") aCount++;
        });

        // Update plumber document
        await db.collection("plumbers").doc(doc.id).update({
          lastOutscraperPull: admin.firestore.Timestamp.now(),
          cachedReviewCount: allSnap.size,
          googleReviewsCached: gCount,
          yelpReviewsCached: yCount,
          angiReviewsCached: aCount,
          reviewSource: googleOnly ? "outscraper" : "outscraper-multi",
          reviewGap: (data.googleReviewCount || 0) - gCount,
          ...(platformStats.yelpRating && { yelpRating: platformStats.yelpRating, yelpReviewCount: platformStats.yelpReviewCount }),
          ...(platformStats.angiRating && { angiRating: platformStats.angiRating, angiReviewCount: platformStats.angiReviewCount }),
        });

        // Re-synthesize with full multi-source corpus (include BBB if available)
        if (data.bbb) platformStats.bbb = data.bbb;
        if (!skipSynthesis && newCount > 0 && ANTHROPIC_API_KEY) {
          try {
            const synthesized = await synthesizePlumber(doc.id, data, platformStats);
            if (synthesized) totalSynthesized++;
          } catch (err) {
            console.error(`    Synthesis error: ${err.message}`);
            totalErrors++;
          }
        } else if (!ANTHROPIC_API_KEY && !skipSynthesis) {
          console.log(`    Skipping synthesis — ANTHROPIC_API_KEY not set.`);
        }
      } catch (err) {
        console.error(`    ERROR: ${err.message}`);
        totalErrors++;
      }
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
  console.log(`    Angi:   ${reviewsBySource.angi || 0}`);
  console.log(`  Duplicate reviews skipped: ${totalDupes}`);
  console.log(`  Plumbers re-synthesized: ${totalSynthesized}`);
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
          angiReviews: reviewsBySource.angi || 0,
          dupesSkipped: totalDupes,
          synthesized: totalSynthesized,
          errors: totalErrors,
          estimatedCost: `$${estCost}`,
        },
        triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
      });
    } catch { /* */ }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
