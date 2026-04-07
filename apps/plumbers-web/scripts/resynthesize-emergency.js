#!/usr/bin/env node

/**
 * Bulk re-synthesize plumbers that have emergencyReadiness = "unknown" or missing.
 * Uses existing cached reviews (no new Outscraper pulls).
 * Exports to static JSON and pushes when done.
 *
 * Usage:
 *   node scripts/resynthesize-emergency.js
 *   node scripts/resynthesize-emergency.js --dry-run
 *   node scripts/resynthesize-emergency.js --limit 20
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const RATE_LIMIT_MS = 500;

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

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("ERROR: service-account.json not found.");
  process.exit(1);
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY not set.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Import buildPrompt from outscraper-reviews.js logic (inline)
// ---------------------------------------------------------------------------

// We require the outscraper-reviews module's buildPrompt function.
// Since it's not exported, we inline the key parts here.
// The prompt is the same as outscraper-reviews.js buildPrompt.

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function callClaude(prompt) {
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

// Matches the outscraper-reviews.js buildPrompt function
function buildPrompt(name, googleRating, googleReviewCount, reviews, platformStats, businessContext) {
  const googleReviews = reviews.filter((r) => r.source === "google");
  const yelpReviews = reviews.filter((r) => r.source === "yelp");
  const angiReviews = reviews.filter((r) => r.source === "angi");

  let reviewBlock = "";
  if (googleReviews.length > 0) {
    reviewBlock += `=== GOOGLE REVIEWS (${googleReviews.length}) ===\n`;
    reviewBlock += googleReviews.map((r) => `[${r.rating}/5${r.date ? ` — ${r.date}` : ""}] ${r.text}`).join("\n\n") + "\n\n";
  }
  if (yelpReviews.length > 0) {
    reviewBlock += `=== YELP REVIEWS (${yelpReviews.length}) ===\n`;
    reviewBlock += yelpReviews.map((r) => `[${r.rating}/5${r.date ? ` — ${r.date}` : ""}] ${r.text}`).join("\n\n") + "\n\n";
  }
  if (angiReviews.length > 0) {
    reviewBlock += `=== ANGI DATA (${angiReviews.length}) ===\n`;
    reviewBlock += angiReviews.map((r) => `[${r.rating}/5] ${r.text}`).join("\n\n") + "\n\n";
  }

  let platformContext = `Google Rating: ${googleRating ?? "N/A"}/5 (${googleReviewCount} reviews)`;
  if (platformStats.yelpRating) platformContext += `\nYelp Rating: ${platformStats.yelpRating}/5 (${platformStats.yelpReviewCount || "?"} reviews)`;
  if (platformStats.angiRating) platformContext += `\nAngi Rating: ${platformStats.angiRating}/5 (${platformStats.angiReviewCount || "?"} reviews)`;

  const bbb = platformStats.bbb;
  let bbbContext = "";
  if (bbb) {
    bbbContext = `\n\n=== BBB DATA ===\nBBB Rating: ${bbb.rating || "N/A"} | Accredited: ${bbb.accredited ? "Yes" : "No"}`;
    if (bbb.complaintsPast3Years != null) bbbContext += ` | Complaints (3yr): ${bbb.complaintsPast3Years}`;
    if (bbb.yearsInBusiness != null) bbbContext += ` | Years in business: ${bbb.yearsInBusiness}`;
  }

  const ctx = businessContext || {};
  let businessSignals = "";
  if (ctx.is24Hour) businessSignals += "\nGoogle Hours: Open 24 hours";
  else if (ctx.workingHours) businessSignals += `\nGoogle Hours: ${Array.isArray(ctx.workingHours) ? ctx.workingHours.join("; ") : ctx.workingHours}`;
  const nameLower = name.toLowerCase();
  const emergencyNameSignals = [];
  if (/24.?7|24.?hour|twenty.?four/i.test(nameLower)) emergencyNameSignals.push("24/7 in name");
  if (/emergency/i.test(nameLower)) emergencyNameSignals.push("'emergency' in name");
  if (/after.?hour|anytime|rescue|rapid|fast/i.test(nameLower)) emergencyNameSignals.push("urgency keyword in name");
  if (emergencyNameSignals.length > 0) businessSignals += `\nBusiness Name Signals: ${emergencyNameSignals.join(", ")}`;

  return `You are analyzing reviews from multiple platforms for a plumber to help homeowners in an emergency. This is an EMERGENCY PLUMBER DIRECTORY — emergency readiness detection is critical.

Plumber: ${name}
${platformContext}${businessSignals}${bbbContext}
We have ${reviews.length} total reviews across all platforms.

${reviewBlock}
CONSISTENCY CHECK: Before responding, verify that no badge contradicts a red flag and no strength contradicts a weakness. Negative signals always win over positive ones.

SERVICE CATEGORIES TO SCAN:
Identify mentions of these services in reviews. For each found, report count, avgRating (of only those reviews), and topQuote. Use exact keys:
burst-pipe, flooding, sewer, gas-leak, water-heater, toilet, sump-pump, drain-cleaning, water-line, slab-leak, garbage-disposal, faucet-fixture, backflow, repiping, water-softener, bathroom-remodel

Respond in JSON only. No markdown, no preamble, no backticks.
{
  "summary": "One specific sentence a friend would say. Never say 'reliable and professional'.",
  "strengths": ["2-3 specific strengths with evidence."],
  "weaknesses": ["1-2 specific weaknesses with evidence."],
  "emergencyReadiness": "high|medium|low|unknown — IMPORTANT: This is an emergency plumber directory. Look for ALL signals: (1) Business name contains '24/7', 'emergency', '24 hour', 'anytime', 'after hours', 'rescue' → high. (2) Google hours show 'Open 24 hours' → high. (3) Reviews mention after-hours, weekend, holiday, midnight, same-day, or emergency response → high. (4) Reviews mention quick scheduling or fast arrival (even during business hours) → medium. (5) Only mark 'unknown' if there are literally zero signals in name, hours, or reviews. Most plumbers who show up in an 'emergency plumber' Google search have SOME emergency capability — lean toward medium over unknown when there's any signal at all.",
  "emergencyNotes": "Summarize what reviews reveal about urgency response. If business hours show 24/7 or name contains emergency keywords, mention that. Do NOT say 'no emergency data' if reviews mention fast response or same-day visits.",
  "badges": ["Only from: 'Fast Responder', 'Fair Pricing', '24/7 Available', 'Clean & Professional', 'Great Communicator'. A badge MUST NOT contradict any red flag."],
  "redFlags": ["Concerning patterns. Be aggressive with small sample sizes (<25 reviews)."],
  "bestFor": ["1-2 specific services or scenarios."],
  "pricingTier": "budget|mid-range|premium|unknown",
  "platformDiscrepancy": "Rating gap between platforms, or null",
  "servicesMentioned": "Object mapping service keys to {count, avgRating, topQuote}. Only include categories with 1+ review mentions. Empty {} if none."
}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit"));
  const maxPlumbers = limitArg ? parseInt(args[args.indexOf(limitArg) + 1] || "999") : 999;
  const startedAt = new Date();

  console.log("=== Bulk Re-Synthesis: Emergency Readiness Fix ===\n");
  if (dryRun) console.log("[DRY RUN]\n");

  // Get all plumbers
  const plumbersSnap = await db.collection("plumbers").get();
  console.log(`Total plumbers in Firestore: ${plumbersSnap.size}`);

  // Find plumbers needing re-synthesis
  const needsResynthesis = [];
  for (const doc of plumbersSnap.docs) {
    const d = doc.data();
    if (!d.isActive) continue;
    const er = d.reviewSynthesis?.emergencyReadiness;
    if (!er || er === "unknown") {
      needsResynthesis.push({ id: doc.id, data: d });
    }
  }

  console.log(`Plumbers with unknown/missing emergencyReadiness: ${needsResynthesis.length}`);
  const toProcess = needsResynthesis.slice(0, maxPlumbers);
  console.log(`Processing: ${toProcess.length}\n`);

  // Load all reviews grouped by plumber
  const reviewsSnap = await db.collection("reviews").get();
  const reviewsByPlumber = new Map();
  for (const rdoc of reviewsSnap.docs) {
    const rd = rdoc.data();
    if (!rd.plumberId || !rd.text) continue;
    if (!reviewsByPlumber.has(rd.plumberId)) reviewsByPlumber.set(rd.plumberId, []);
    reviewsByPlumber.get(rd.plumberId).push({
      source: rd.source || "google",
      rating: rd.rating || 0,
      text: rd.text,
      date: rd.publishedAt || "",
    });
  }

  let synthesized = 0;
  let failed = 0;
  let skippedNoReviews = 0;
  const beforeCounts = { unknown: needsResynthesis.length };
  const afterCounts = { high: 0, medium: 0, low: 0, unknown: 0 };

  for (const { id, data } of toProcess) {
    const reviews = reviewsByPlumber.get(id) || [];
    if (reviews.length === 0) {
      skippedNoReviews++;
      // Even with no reviews, check business name/hours for emergency signals
      // But we still need at least something to synthesize
      continue;
    }

    const platformStats = {
      yelpRating: data.yelpRating || null,
      yelpReviewCount: data.yelpReviewCount || null,
      angiRating: data.angiRating || null,
      angiReviewCount: data.angiReviewCount || null,
      bbb: data.bbb || null,
    };

    const businessContext = {
      is24Hour: data.is24Hour || false,
      workingHours: data.workingHours || null,
    };

    if (dryRun) {
      console.log(`  [DRY] ${data.businessName} — ${reviews.length} reviews, is24Hour: ${businessContext.is24Hour}`);
      synthesized++;
      continue;
    }

    try {
      await sleep(RATE_LIMIT_MS);
      const prompt = buildPrompt(
        data.businessName,
        data.googleRating,
        data.googleReviewCount || 0,
        reviews,
        platformStats,
        businessContext
      );
      const response = await callClaude(prompt);
      const ai = parseAIResponse(response);

      // Update the synthesis in Firestore
      const synthesis = {
        ...(data.reviewSynthesis || {}),
        summary: ai.summary,
        strengths: ai.strengths || [],
        weaknesses: ai.weaknesses || [],
        emergencyReadiness: ai.emergencyReadiness || "unknown",
        emergencyNotes: ai.emergencyNotes || "",
        redFlags: ai.redFlags || [],
        badges: ai.badges || [],
        bestFor: ai.bestFor || [],
        pricingTier: ai.pricingTier || "unknown",
        platformDiscrepancy: ai.platformDiscrepancy || null,
        servicesMentioned: ai.servicesMentioned || {},
        aiSynthesizedAt: admin.firestore.Timestamp.now(),
        synthesisVersion: "ai-v2-services",
      };

      await db.collection("plumbers").doc(id).update({
        reviewSynthesis: synthesis,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      afterCounts[ai.emergencyReadiness] = (afterCounts[ai.emergencyReadiness] || 0) + 1;
      synthesized++;

      const emoji = ai.emergencyReadiness === "high" ? "🟢" : ai.emergencyReadiness === "medium" ? "🟡" : "⚪";
      console.log(`  ${emoji} ${data.businessName} → ${ai.emergencyReadiness} | ${ai.emergencyNotes?.slice(0, 80) || ""}`);
    } catch (err) {
      console.error(`  ✗ ${data.businessName}: ${err.message}`);
      failed++;
    }
  }

  const elapsed = Math.round((Date.now() - startedAt.getTime()) / 1000);
  console.log("\n" + "=".repeat(50));
  console.log("📊 Results:");
  console.log(`  BEFORE: ${beforeCounts.unknown} plumbers with unknown/missing emergencyReadiness`);
  console.log(`  AFTER:  high=${afterCounts.high} medium=${afterCounts.medium} low=${afterCounts.low} unknown=${afterCounts.unknown}`);
  console.log(`  Synthesized: ${synthesized}, Failed: ${failed}, Skipped (no reviews): ${skippedNoReviews}`);
  console.log(`  Duration: ${elapsed}s`);

  // Log to pipelineRuns
  if (!dryRun) {
    try {
      await db.collection("pipelineRuns").add({
        script: "resynthesize-emergency",
        startedAt: admin.firestore.Timestamp.fromDate(startedAt),
        completedAt: admin.firestore.Timestamp.now(),
        durationSeconds: elapsed,
        status: failed > 0 ? "partial" : "success",
        summary: {
          before: beforeCounts,
          after: afterCounts,
          synthesized,
          failed,
          skippedNoReviews,
        },
        triggeredBy: "manual",
      });
    } catch { /* */ }
  }

  // Export to static JSON
  if (!dryRun && synthesized > 0) {
    console.log("\n=== Exporting to static JSON ===\n");
    try {
      execSync("node scripts/export-firestore-to-json.js", {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
        timeout: 120000,
      });
    } catch (err) {
      console.error("Export failed:", err.message);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
