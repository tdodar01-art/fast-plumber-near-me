#!/usr/bin/env node

/**
 * Synthesize plumber reviews using Claude API.
 * Reads from data/raw/plumbers-latest.json, outputs to data/synthesized/.
 *
 * Usage:
 *   node scripts/synthesize-reviews.js --min-reviews 1
 *   node scripts/synthesize-reviews.js                  # default: min 1 review
 *
 * Output:
 *   data/synthesized/plumbers-synthesized.json
 *   data/synthesized/leaderboard.json
 *
 * Saves progress every 10 plumbers — safe to interrupt and resume.
 * Requires ANTHROPIC_API_KEY in environment or .env.local
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const INPUT_PATH = path.join(__dirname, "..", "data", "raw", "plumbers-latest.json");
const OUTPUT_DIR = path.join(__dirname, "..", "data", "synthesized");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "plumbers-synthesized.json");
const LEADERBOARD_PATH = path.join(OUTPUT_DIR, "leaderboard.json");
const PROGRESS_PATH = path.join(OUTPUT_DIR, ".synthesis-progress.json");
const SAVE_EVERY = 10; // Save progress every N plumbers
const RATE_LIMIT_MS = 500; // ms between Claude API calls

// ---------------------------------------------------------------------------
// Load env
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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY is missing. Set it in .env.local or environment.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let minReviews = 1;
const minIdx = args.indexOf("--min-reviews");
if (minIdx !== -1 && args[minIdx + 1]) {
  minReviews = parseInt(args[minIdx + 1], 10);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Claude API call
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

// ---------------------------------------------------------------------------
// Build prompt for a single plumber
// ---------------------------------------------------------------------------

function buildPrompt(plumber) {
  const reviewText = plumber.reviews
    .map(
      (r, i) =>
        `Review ${i + 1} (${r.rating}/5 by ${r.author}): "${r.text}"`
    )
    .join("\n");

  return `You are analyzing Google reviews for a plumbing company to help homeowners decide who to hire for emergencies.

BUSINESS: ${plumber.name}
CITY: ${plumber.city}, IL
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

If there are very few reviews, be conservative with the score. A plumber with 1 five-star review should not get 95 — there's not enough data. Weight emergency responsiveness and reliability heavily.`;
}

// ---------------------------------------------------------------------------
// Parse Claude's response
// ---------------------------------------------------------------------------

function parseSynthesis(text) {
  // Strip markdown code fences if Claude adds them despite instructions
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Validate required fields
  if (typeof parsed.score !== "number" || parsed.score < 1 || parsed.score > 100) {
    throw new Error(`Invalid score: ${parsed.score}`);
  }
  if (!["high", "moderate", "low"].includes(parsed.trustLevel)) {
    throw new Error(`Invalid trustLevel: ${parsed.trustLevel}`);
  }

  return {
    score: parsed.score,
    trustLevel: parsed.trustLevel,
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
// Progress tracking
// ---------------------------------------------------------------------------

function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
  }
  return { completed: {} }; // placeId → synthesis
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`ERROR: Input file not found: ${INPUT_PATH}`);
    console.error("Run scrape-plumbers.js first (Step 1).");
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(INPUT_PATH, "utf-8"));
  const allPlumbers = rawData.plumbers;

  // Filter to plumbers with enough reviews
  const eligible = allPlumbers.filter(
    (p) => p.reviews && p.reviews.length >= minReviews
  );
  const noReviews = allPlumbers.filter(
    (p) => !p.reviews || p.reviews.length < minReviews
  );

  console.log(`\n🧠 Review Synthesizer — Claude API`);
  console.log(`   Total plumbers: ${allPlumbers.length}`);
  console.log(`   Eligible (>=${minReviews} reviews): ${eligible.length}`);
  console.log(`   Skipping (too few reviews): ${noReviews.length}`);
  console.log(`   Output: ${OUTPUT_PATH}\n`);

  // Load progress
  const progress = loadProgress();
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < eligible.length; i++) {
    const plumber = eligible[i];

    // Skip if already synthesized
    if (progress.completed[plumber.placeId]) {
      skipped++;
      continue;
    }

    const pct = ((i + 1) / eligible.length * 100).toFixed(0);
    process.stdout.write(
      `  [${pct}%] ${i + 1}/${eligible.length} — ${plumber.name}... `
    );

    try {
      await sleep(RATE_LIMIT_MS);
      const prompt = buildPrompt(plumber);
      const response = await callClaude(prompt);
      const synthesis = parseSynthesis(response);

      progress.completed[plumber.placeId] = synthesis;
      processed++;
      console.log(`✅ score=${synthesis.score} (${synthesis.trustLevel})`);

      // Save progress periodically
      if (processed % SAVE_EVERY === 0) {
        saveProgress(progress);
        console.log(`  💾 Progress saved (${processed} synthesized)`);
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }
  }

  // Final save
  saveProgress(progress);

  // Build output: merge synthesis into plumber data
  const synthesizedPlumbers = allPlumbers.map((p) => ({
    ...p,
    synthesis: progress.completed[p.placeId] || null,
  }));

  const output = {
    meta: {
      ...rawData.meta,
      synthesizedAt: new Date().toISOString(),
      totalSynthesized: Object.keys(progress.completed).length,
      model: "claude-sonnet-4-20250514",
    },
    plumbers: synthesizedPlumbers,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  // Build leaderboard
  const ranked = synthesizedPlumbers
    .filter((p) => p.synthesis?.score)
    .sort((a, b) => b.synthesis.score - a.synthesis.score)
    .map((p, i) => ({
      rank: i + 1,
      name: p.name,
      city: p.city,
      score: p.synthesis.score,
      trustLevel: p.synthesis.trustLevel,
      googleRating: p.googleRating,
      reviewCount: p.googleReviewCount,
      phone: p.phone,
      summary: p.synthesis.summary,
      bestFor: p.synthesis.bestFor,
      redFlags: p.synthesis.redFlags,
    }));

  const leaderboard = {
    generatedAt: new Date().toISOString(),
    totalRanked: ranked.length,
    plumbers: ranked,
  };

  fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify(leaderboard, null, 2));

  // Clean up progress on full completion
  if (failed === 0) {
    if (fs.existsSync(PROGRESS_PATH)) fs.unlinkSync(PROGRESS_PATH);
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Synthesis complete`);
  console.log(`   Processed this run: ${processed}`);
  console.log(`   Skipped (already done): ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total synthesized: ${Object.keys(progress.completed).length}`);
  console.log(`   Output: ${OUTPUT_PATH}`);
  console.log(`   Leaderboard: ${LEADERBOARD_PATH}\n`);
}

main().catch((err) => {
  console.error("Synthesis failed:", err);
  process.exit(1);
});
