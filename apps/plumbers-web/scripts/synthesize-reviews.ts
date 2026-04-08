#!/usr/bin/env npx tsx
/**
 * AI-powered review synthesis using Claude Haiku.
 * Analyzes cached Google reviews and generates structured quality signals.
 * Falls back to keyword analysis for plumbers with fewer than 3 cached reviews.
 *
 * Uses firebase-admin SDK with service-account.json (bypasses security rules).
 *
 * Usage:
 *   npx tsx scripts/synthesize-reviews.ts [--dry-run] [--force]
 *
 * Flags:
 *   --dry-run   Log prompts and plumber names without making API calls or writes
 *   --force     Re-synthesize all plumbers regardless of existing AI synthesis
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
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

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length) return admin.firestore();

  const saPath = path.join(__dirname, "..", "service-account.json");
  if (fs.existsSync(saPath)) {
    const sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else {
    console.error("ERROR: No service-account.json or GOOGLE_APPLICATION_CREDENTIALS found");
    process.exit(1);
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const RATE_LIMIT_MS = 2000; // 2s between calls to stay under 50k input tokens/min
const MAX_RETRIES = 3;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function slugify(text: string): string {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface ReviewData { rating: number; text: string; date?: string; }

interface PlumberDetail {
  name: string;
  slug: string;
  method?: string;
}

interface PlumberError {
  name: string;
  slug: string;
  error: string;
}

function buildPrompt(
  name: string,
  rating: number | null,
  reviewCount: number,
  cachedReviewCount: number,
  reviews: ReviewData[]
): string {
  const reviewBlock = reviews
    .map((r) => `[${r.rating}/5${r.date ? ` — ${r.date}` : ""}] ${r.text}`)
    .join("\n\n");

  return `You are analyzing Google reviews for a plumber to help homeowners in an emergency.

Plumber: ${name}
Google Rating: ${rating ?? "N/A"}/5 (${reviewCount} reviews)
We have ${cachedReviewCount} cached reviews.

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
  "pricingTier": "budget|mid-range|premium|unknown"
}`;
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.content?.[0]?.text || "";
    }

    if (resp.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = parseInt(resp.headers.get("retry-after") || "0", 10);
      const backoff = retryAfter > 0 ? retryAfter * 1000 : (2 ** attempt) * 5000; // 5s, 10s, 20s
      console.log(`    ⏳ Rate limited, retrying in ${Math.round(backoff / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(backoff);
      continue;
    }

    const body = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${body}`);
  }

  throw new Error("Claude API: max retries exceeded");
}

interface AISynthesisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  emergencyReadiness: string;
  emergencyNotes: string;
  badges: string[];
  redFlags: string[];
  pricingTier: string;
}

function parseAIResponse(text: string): AISynthesisResult {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    summary: parsed.summary || "",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    emergencyReadiness: parsed.emergencyReadiness || "unknown",
    emergencyNotes: parsed.emergencyNotes || "",
    badges: Array.isArray(parsed.badges) ? parsed.badges : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    pricingTier: parsed.pricingTier || "unknown",
  };
}

// ---------------------------------------------------------------------------
// Keyword fallback for plumbers with < 3 reviews
// ---------------------------------------------------------------------------

const FAST_RESPONSE = ["fast", "quick", "rapid", "same day", "prompt", "responsive", "right away", "within an hour"];
const EMERGENCY_AVAIL = ["emergency", "burst", "after hours", "weekend", "24 hour", "24/7", "middle of the night"];
const PRICE_POSITIVE = ["fair price", "reasonable", "affordable", "upfront pricing", "transparent"];
const PRICE_NEGATIVE = ["expensive", "overcharged", "overpriced", "surprise fee", "hidden fee"];
const QUALITY_POSITIVE = ["professional", "knowledgeable", "thorough", "expert", "excellent work"];

function keywordFallback(reviews: ReviewData[], googleReviewCount: number) {
  const total = reviews.length;
  const texts = reviews.map((r) => r.text.toLowerCase());
  const countMatches = (kws: string[]) => texts.filter((t) => kws.some((k) => t.includes(k))).length;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const badges: string[] = [];
  const emergencySignals: string[] = [];

  const fastCount = countMatches(FAST_RESPONSE);
  if (fastCount > 0) {
    strengths.push(`Quick response mentioned in reviews`);
    if (fastCount / total >= 0.3) badges.push("Fast Responder");
  }
  const qualCount = countMatches(QUALITY_POSITIVE);
  if (qualCount > 0) strengths.push(`Professional service noted by reviewers`);
  const priceGood = countMatches(PRICE_POSITIVE);
  if (priceGood > 0) { strengths.push(`Fair pricing mentioned`); badges.push("Fair Pricing"); }

  const priceBad = countMatches(PRICE_NEGATIVE);
  if (priceBad > 0) weaknesses.push(`Pricing concerns noted`);
  if (total < 3) weaknesses.push(`Only ${total} review${total === 1 ? "" : "s"} — limited data`);

  const emergCount = countMatches(EMERGENCY_AVAIL);
  if (emergCount > 0) emergencySignals.push(`Emergency/after-hours work mentioned`);

  let pricingTier: string = "unknown";
  if (priceBad > priceGood) pricingTier = "premium";
  else if (priceGood > 0) pricingTier = "mid-range";

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    emergencySignals: emergencySignals.slice(0, 2),
    redFlags: [] as string[],
    badges: badges.slice(0, 3),
    reviewCount: total,
    synthesizedAt: admin.firestore.Timestamp.now(),
    categories: {
      emergency: { strengths: emergencySignals, weaknesses: [] as string[] },
      pricing: { strengths: priceGood > 0 ? ["Fair pricing noted"] : [], weaknesses: priceBad > 0 ? ["Pricing concerns"] : [] },
      quality: { strengths: qualCount > 0 ? ["Professional service"] : [], weaknesses: [] as string[] },
      communication: { strengths: [] as string[], weaknesses: [] as string[] },
      homeRespect: { strengths: [] as string[], weaknesses: [] as string[] },
      punctuality: { strengths: [] as string[], weaknesses: [] as string[] },
    },
    pricingTier,
    ...(googleReviewCount > 50 ? { sampleSizeWarning: `Based on ${total} of ${googleReviewCount} reviews` } : {}),
    synthesisVersion: "keyword-fallback",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  if (dryRun) console.log("🔍 DRY RUN — no API calls or Firestore writes\n");

  const db = initFirebase();
  const plumbersSnap = await db.collection("plumbers").get();
  let synthesized = 0;
  let skipped = 0;
  let keywordCount = 0;
  let aiCount = 0;
  let failed = 0;
  let totalRedFlags = 0;
  let totalBadges = 0;
  const synthesizedPlumbers: PlumberDetail[] = [];
  const errors: PlumberError[] = [];

  for (const plumberDoc of plumbersSnap.docs) {
    const data = plumberDoc.data();

    // Skip if already has AI synthesis and no new reviews (unless --force)
    if (!force && data.reviewSynthesis?.aiSynthesizedAt) {
      const lastSynth = data.reviewSynthesis.aiSynthesizedAt?.toDate?.() || new Date(0);
      const lastRefresh = data.lastReviewRefreshAt?.toDate?.() || new Date(0);
      if (lastRefresh <= lastSynth) {
        skipped++;
        continue;
      }
    }

    // Fetch cached reviews
    const reviewsSnap = await db.collection("reviews")
      .where("plumberId", "==", plumberDoc.id)
      .get();
    if (reviewsSnap.empty) { skipped++; continue; }

    const reviews: ReviewData[] = reviewsSnap.docs.map((d) => ({
      rating: d.data().rating || 0,
      text: d.data().text || "",
      date: d.data().publishedAt || "",
    }));

    const googleReviewCount = data.googleReviewCount || 0;

    // < 3 reviews: use keyword fallback
    if (reviews.length < 3) {
      const synthesis = keywordFallback(reviews, googleReviewCount);
      console.log(`📝 ${data.businessName}: KEYWORD fallback (${reviews.length} reviews) | ${synthesis.badges.join(", ") || "no badges"}`);

      if (!dryRun) {
        await db.collection("plumbers").doc(plumberDoc.id).update({
          reviewSynthesis: synthesis,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }
      keywordCount++;
      synthesized++;
      totalBadges += synthesis.badges.length;
      synthesizedPlumbers.push({ name: data.businessName, slug: slugify(data.businessName), method: "keyword" });
      continue;
    }

    // 3+ reviews: use Claude AI
    const prompt = buildPrompt(
      data.businessName,
      data.googleRating,
      googleReviewCount,
      reviews.length,
      reviews
    );

    if (dryRun) {
      console.log(`🤖 ${data.businessName}: Would send ${reviews.length} reviews to Claude`);
      console.log(`   Prompt length: ${prompt.length} chars\n`);
      synthesized++;
      aiCount++;
      continue;
    }

    try {
      await sleep(RATE_LIMIT_MS);
      const response = await callClaude(prompt);
      const aiResult = parseAIResponse(response);

      // Map AI result to the reviewSynthesis schema the frontend expects
      const synthesis = {
        // Existing fields (compatible with keyword system)
        strengths: aiResult.strengths,
        weaknesses: aiResult.weaknesses,
        emergencySignals: aiResult.emergencyReadiness !== "unknown"
          ? [aiResult.emergencyNotes].filter(Boolean)
          : [],
        redFlags: aiResult.redFlags,
        badges: aiResult.badges,
        reviewCount: reviews.length,
        synthesizedAt: admin.firestore.Timestamp.now(),
        pricingTier: aiResult.pricingTier,
        categories: {
          emergency: {
            strengths: aiResult.emergencyReadiness === "high" ? [aiResult.emergencyNotes] : [],
            weaknesses: aiResult.emergencyReadiness === "low" ? [aiResult.emergencyNotes] : [],
          },
          pricing: { strengths: [] as string[], weaknesses: [] as string[] },
          quality: { strengths: [] as string[], weaknesses: [] as string[] },
          communication: { strengths: [] as string[], weaknesses: [] as string[] },
          homeRespect: { strengths: [] as string[], weaknesses: [] as string[] },
          punctuality: { strengths: [] as string[], weaknesses: [] as string[] },
        },
        ...(googleReviewCount > 50 && reviews.length / googleReviewCount < 0.05
          ? { sampleSizeWarning: `Based on ${reviews.length} of ${googleReviewCount} reviews` }
          : {}),
        // New AI-specific fields
        summary: aiResult.summary,
        emergencyReadiness: aiResult.emergencyReadiness,
        emergencyNotes: aiResult.emergencyNotes,
        aiSynthesizedAt: admin.firestore.Timestamp.now(),
        synthesisVersion: "ai-v1",
      };

      console.log(`🤖 ${data.businessName}: ${aiResult.badges.join(", ") || "no badges"} | ${aiResult.redFlags.length} red flags | emergency: ${aiResult.emergencyReadiness} | pricing: ${aiResult.pricingTier}`);

      await db.collection("plumbers").doc(plumberDoc.id).update({
        reviewSynthesis: synthesis,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      aiCount++;
      synthesized++;
      totalRedFlags += aiResult.redFlags.length;
      totalBadges += aiResult.badges.length;
      synthesizedPlumbers.push({ name: data.businessName, slug: slugify(data.businessName), method: "ai" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ ${data.businessName}: ${msg}`);
      errors.push({ name: data.businessName, slug: slugify(data.businessName), error: msg });
      failed++;
    }
  }

  console.log("\n📊 Summary:");
  console.log(`  Synthesized: ${synthesized} plumbers`);
  console.log(`    AI (Claude): ${aiCount}`);
  console.log(`    Keyword fallback: ${keywordCount}`);
  console.log(`  Skipped (up-to-date): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total badges: ${totalBadges}`);
  console.log(`  Total red flags: ${totalRedFlags}`);

  return { synthesized, aiCount, keywordCount, skipped, failed, totalBadges, totalRedFlags, synthesizedPlumbers, errors };
}

// ---------------------------------------------------------------------------
// Run + log pipeline
// ---------------------------------------------------------------------------

const startedAt = admin.firestore.Timestamp.now();
const startTime = Date.now();

main()
  .then(async (result) => {
    if (!process.argv.includes("--dry-run")) {
      try {
        const db = initFirebase();
        await db.collection("pipelineRuns").add({
          script: "synthesize-reviews",
          startedAt,
          completedAt: admin.firestore.Timestamp.now(),
          durationSeconds: Math.round((Date.now() - startTime) / 1000),
          status: result.failed > 0 ? "partial" : "success",
          summary: {
            plumbersSynthesized: result.synthesized,
            aiSynthesized: result.aiCount,
            keywordFallback: result.keywordCount,
            skipped: result.skipped,
            failed: result.failed,
            badgesAwarded: result.totalBadges,
            redFlagsFound: result.totalRedFlags,
            synthesizedPlumbers: result.synthesizedPlumbers,
            errors: result.errors,
          },
          triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
        });
      } catch { /* */ }
    }
  })
  .catch(async (err) => {
    console.error(err);
    try {
      const db = initFirebase();
      await db.collection("pipelineRuns").add({
        script: "synthesize-reviews",
        startedAt,
        completedAt: admin.firestore.Timestamp.now(),
        durationSeconds: Math.round((Date.now() - startTime) / 1000),
        status: "error",
        summary: {},
        error: String(err),
        triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
      });
    } catch { /* */ }
    process.exit(1);
  });
