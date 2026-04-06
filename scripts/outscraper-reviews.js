#!/usr/bin/env node

/**
 * Pull deep Google reviews via Outscraper API for plumbers in high-traction cities,
 * then re-synthesize with Claude using the full review corpus.
 *
 * Manual use only — not wired into the daily cron.
 *
 * Usage:
 *   node scripts/outscraper-reviews.js crystal-lake-il aberdeen-md
 *   node scripts/outscraper-reviews.js crystal-lake-il --dry-run
 *   node scripts/outscraper-reviews.js crystal-lake-il --skip-synthesis
 *
 * Env:
 *   OUTSCRAPER_API_KEY  — required
 *   ANTHROPIC_API_KEY   — required for synthesis step
 */

const fs = require("fs");
const path = require("path");
const Outscraper = require("outscraper");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
const OUTSCRAPER_QPS_DELAY_MS = 2000; // 1 request per 2s to stay safe
const CLAUDE_RATE_LIMIT_MS = 500;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const MAX_REVIEWS_PER_PLUMBER = 100;
// Outscraper pricing: ~$2 per 1000 reviews
const COST_PER_REVIEW = 0.002;

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

function hashReviewId(authorName, text) {
  // Same hash as refresh-reviews.ts for dedup compatibility
  const crypto = require("crypto");
  return crypto.createHash("md5").update(`${authorName}:${text.slice(0, 100)}`).digest("hex");
}

// ---------------------------------------------------------------------------
// Outscraper: pull reviews for a plumber
// ---------------------------------------------------------------------------

async function pullReviews(placeId, businessName, cutoffTimestamp) {
  console.log(`    Calling Outscraper for ${businessName} (${placeId})...`);

  const params = {
    reviewsLimit: MAX_REVIEWS_PER_PLUMBER,
    sort: "newest",
    language: "en",
  };

  if (cutoffTimestamp) {
    // Outscraper cutoff is a Unix timestamp in seconds
    const cutoffSec = Math.floor(cutoffTimestamp.toDate().getTime() / 1000);
    params.cutoff = cutoffSec;
  }

  try {
    const results = await outscraper.googleMapsReviews([placeId], params.reviewsLimit, params.sort, null, params.language, null, params.cutoff || null);

    if (!results || results.length === 0 || !results[0]) {
      console.log(`    No results returned.`);
      return [];
    }

    const place = results[0];
    const reviews = place.reviews_data || [];
    console.log(`    Got ${reviews.length} reviews from Outscraper.`);
    return reviews;
  } catch (err) {
    console.error(`    Outscraper error: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Store reviews in Firestore
// ---------------------------------------------------------------------------

async function storeReviews(plumberId, reviews) {
  let newCount = 0;
  let dupeCount = 0;

  for (const review of reviews) {
    const authorName = review.author_title || review.reviewer_name || "Anonymous";
    const text = review.review_text || "";
    if (!text) continue;

    const reviewId = hashReviewId(authorName, text);

    // Check for dupe in top-level reviews collection (existing pipeline compat)
    const dupeCheck = await db.collection("reviews")
      .where("plumberId", "==", plumberId)
      .where("googleReviewId", "==", reviewId)
      .limit(1)
      .get();

    if (!dupeCheck.empty) {
      dupeCount++;
      continue;
    }

    // Write to top-level reviews collection (same schema as refresh-reviews.ts)
    await db.collection("reviews").add({
      plumberId,
      googleReviewId: reviewId,
      authorName,
      rating: review.review_rating || 0,
      text,
      relativeTimeDescription: review.review_datetime_utc || "",
      publishedAt: review.review_datetime_utc || "",
      cachedAt: admin.firestore.Timestamp.now(),
      source: "outscraper",
    });

    newCount++;
  }

  return { newCount, dupeCount };
}

// ---------------------------------------------------------------------------
// Claude synthesis (same prompt as synthesize-reviews.ts)
// ---------------------------------------------------------------------------

function buildPrompt(name, rating, googleReviewCount, reviews) {
  const reviewBlock = reviews
    .map((r) => `[${r.rating}/5${r.date ? ` — ${r.date}` : ""}] ${r.text}`)
    .join("\n\n");

  return `You are analyzing Google reviews for a plumber to help homeowners in an emergency.

Plumber: ${name}
Google Rating: ${rating ?? "N/A"}/5 (${googleReviewCount} reviews)
We have ${reviews.length} cached reviews.

Reviews:
${reviewBlock}

Respond in JSON only. No markdown, no preamble, no backticks.
{
  "summary": "One specific sentence a friend would say. Never say 'reliable and professional'. Reference actual patterns from the reviews.",
  "strengths": ["2-3 specific strengths with evidence. e.g. '3 of 8 reviewers mention arriving within an hour'"],
  "weaknesses": ["1-2 specific weaknesses. e.g. 'Two reviews mention charges exceeding the initial quote'. Say 'Not enough data to identify weaknesses' if none are clear."],
  "emergencyReadiness": "high|medium|low|unknown",
  "emergencyNotes": "One sentence about emergency signals — after-hours mentions, response time, weekend availability.",
  "badges": ["Only from: 'Fast Responder', 'Fair Pricing', '24/7 Available', 'Clean & Professional', 'Great Communicator'. Only include if reviews clearly support it."],
  "redFlags": ["Concerning patterns. Empty array if none."],
  "bestFor": ["1-2 specific services or scenarios this plumber excels at, based on review patterns. e.g. 'Water heater replacements', 'After-hours emergencies'"],
  "pricingTier": "budget|mid-range|premium|unknown"
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

async function synthesizePlumber(plumberId, plumberData) {
  // Fetch ALL cached reviews for this plumber
  const reviewsSnap = await db.collection("reviews")
    .where("plumberId", "==", plumberId)
    .get();

  if (reviewsSnap.empty) {
    console.log(`    No cached reviews to synthesize.`);
    return false;
  }

  const reviews = reviewsSnap.docs.map((d) => ({
    rating: d.data().rating || 0,
    text: d.data().text || "",
    date: d.data().publishedAt || "",
  }));

  console.log(`    Synthesizing with ${reviews.length} total reviews...`);

  const prompt = buildPrompt(
    plumberData.businessName,
    plumberData.googleRating,
    plumberData.googleReviewCount || 0,
    reviews
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
    sampleSizeWarning: undefined,
    summary: ai.summary || "",
    emergencyReadiness: ai.emergencyReadiness || "unknown",
    emergencyNotes: ai.emergencyNotes || "",
    aiSynthesizedAt: admin.firestore.Timestamp.now(),
    synthesisVersion: "ai-v1-outscraper",
  };

  await db.collection("plumbers").doc(plumberId).update({
    reviewSynthesis: synthesis,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log(`    ✓ Synthesis: ${ai.badges?.join(", ") || "no badges"} | ${ai.redFlags?.length || 0} red flags | emergency: ${ai.emergencyReadiness}`);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipSynthesis = args.includes("--skip-synthesis");
  const citySlugs = args.filter((a) => !a.startsWith("--"));

  if (citySlugs.length === 0) {
    console.error("Usage: node scripts/outscraper-reviews.js <city-slug> [city-slug...] [--dry-run] [--skip-synthesis]");
    console.error("Example: node scripts/outscraper-reviews.js crystal-lake-il aberdeen-md");
    process.exit(1);
  }

  if (dryRun) console.log("DRY RUN — no Outscraper calls, no writes\n");
  if (skipSynthesis) console.log("SKIP SYNTHESIS — pulling reviews only\n");

  console.log("=== Outscraper Deep Review Pull ===\n");

  let totalPlumbers = 0;
  let totalNewReviews = 0;
  let totalDupes = 0;
  let totalSynthesized = 0;
  let totalErrors = 0;
  const startedAt = new Date();

  for (const citySlug of citySlugs) {
    console.log(`\n📍 City: ${citySlug}`);

    // Look up plumbers with this city in serviceCities
    const snap = await db.collection("plumbers")
      .where("serviceCities", "array-contains", citySlug)
      .where("isActive", "==", true)
      .get();

    if (snap.empty) {
      console.log(`  No active plumbers found for ${citySlug}. Skipping.`);
      continue;
    }

    console.log(`  Found ${snap.size} plumber(s)\n`);

    for (const doc of snap.docs) {
      const data = doc.data();
      const placeId = data.googlePlaceId;
      totalPlumbers++;

      console.log(`  🔧 ${data.businessName} (${placeId || "no placeId"})`);

      if (!placeId) {
        console.log(`    Skipping — no Google Place ID.`);
        continue;
      }

      if (dryRun) {
        const existing = data.lastOutscraperPull ? `last pull: ${data.lastOutscraperPull.toDate().toISOString().slice(0, 10)}` : "never pulled";
        console.log(`    [DRY RUN] Would pull up to ${MAX_REVIEWS_PER_PLUMBER} reviews (${existing})`);
        continue;
      }

      try {
        // Pull reviews from Outscraper
        await sleep(OUTSCRAPER_QPS_DELAY_MS);
        const cutoff = data.lastOutscraperPull || null;
        const reviews = await pullReviews(placeId, data.businessName, cutoff);

        if (reviews.length === 0) {
          // Still update the timestamp so we don't re-pull immediately
          await db.collection("plumbers").doc(doc.id).update({
            lastOutscraperPull: admin.firestore.Timestamp.now(),
          });
          continue;
        }

        // Store reviews
        const { newCount, dupeCount } = await storeReviews(doc.id, reviews);
        totalNewReviews += newCount;
        totalDupes += dupeCount;

        console.log(`    Stored: ${newCount} new, ${dupeCount} dupes skipped`);

        // Update plumber document
        const totalCached = (await db.collection("reviews").where("plumberId", "==", doc.id).get()).size;
        await db.collection("plumbers").doc(doc.id).update({
          lastOutscraperPull: admin.firestore.Timestamp.now(),
          cachedReviewCount: totalCached,
          reviewSource: "outscraper",
          reviewGap: (data.googleReviewCount || 0) - totalCached,
        });

        // Re-synthesize with full review corpus
        if (!skipSynthesis && newCount > 0 && ANTHROPIC_API_KEY) {
          try {
            const synthesized = await synthesizePlumber(doc.id, data);
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
          dupesSkipped: totalDupes,
          synthesized: totalSynthesized,
          errors: totalErrors,
          estimatedCost: `$${estCost}`,
        },
        triggeredBy: "manual",
      });
    } catch { /* */ }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
