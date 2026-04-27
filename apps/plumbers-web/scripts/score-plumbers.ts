#!/usr/bin/env npx tsx
/**
 * Decision Layer scoring pipeline — Level 2 (Analysis) + Level 3 (Decision).
 *
 * Three resumable passes:
 *   1. Score:  extract per-dimension scores from cached reviews via Claude
 *              Sonnet, aggregate with recency-weighted decay, write scores{}
 *              and evidence_quotes to the plumber doc.
 *   2. Rank:   for each city, rank plumbers and write the per-city rank entry
 *              into city_rank on every plumber in that city.
 *   3. Decide: run the pure decision-engine against each plumber's scores and
 *              primary city rank; write decision{} including evidence_quotes.
 *
 * Idempotent: skips plumbers scored in the last 30 days unless --force.
 * Resumable: each pass writes to Firestore immediately after each plumber;
 * interrupting mid-run and re-running picks up where it left off.
 *
 * Usage:
 *   cd apps/plumbers-web
 *   npx tsx scripts/score-plumbers.ts [--pass 1|2|3|all] [--dry-run] [--force]
 *                                     [--limit N] [--city SLUG] [--plumber ID]
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  computeDecision,
  computeBestFor,
  DIMENSION_KEYS,
  SPECIALTY_KEYS,
  type DimensionKey,
  type SpecialtyKey,
  type CityRankEntry,
  type Scores,
  type EvidenceQuote,
} from "../src/lib/decision-engine.js";

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
// Tunable constants (centralized so a future tweak is a one-line change)
// ---------------------------------------------------------------------------

// Piecewise linear recency decay. Spec intent: "last 12 months 2x". We honor
// the intent without the cliff bug that would make a 13-month-old review
// suddenly worthless. Tune here if the worked-example scoring looks off.
const WEIGHT_RECENT = 1.0; // age <= 12 months
const WEIGHT_MID = 0.5; // 12 months < age <= 24 months
const WEIGHT_OLD = 0.25; // age > 24 months

const CLAUDE_MODEL = "claude-sonnet-4-6";
// Batch sizing tuned 2026-04-21. Was 15; Sonnet handles 30 reviews per call
// comfortably inside 4096 output tokens. Roughly halves call count on the
// 327-plumber 200+ review bucket.
const REVIEWS_PER_BATCH = 30;
// Rate-limit sleep between Claude calls. Was 2000ms. Dropped to 500ms —
// 2s was a safety-mode default, not an optimum. If we hit 429s in practice,
// callClaude's existing retry-after backoff handles it.
const RATE_LIMIT_MS = 500;
const MAX_RETRIES = 3;
const CLAUDE_MAX_TOKENS = 4096;

// Cap reviews processed per plumber. The synthesis recency weighting already
// discounts >24mo reviews to 0.25×, so extracting from older reviews is
// low-ROI. Sort by publishedAt desc, take top N. Collapses the 200+ bucket
// from 14+ batches to 3–5 at REVIEWS_PER_BATCH=30.
const REVIEW_CAP = 75;

const SKIP_IF_SCORED_WITHIN_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_REVIEWS_TO_SCORE = 3;

// ---------------------------------------------------------------------------
// Synthesis types
// ---------------------------------------------------------------------------

type SynthesisResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  emergencyNotes: string;
  badges: string[];
  emergencyReadiness: "high" | "medium" | "low" | "unknown";
  emergencySignals: string[];
  pricingTier: "budget" | "mid-range" | "premium" | "unknown";
  bestFor: string[];
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

type PassFlag = "1" | "2" | "3" | "all";

type CliArgs = {
  pass: PassFlag;
  dryRun: boolean;
  force: boolean;
  limit: number | null;
  city: string | null;
  plumber: string | null;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const getVal = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx === args.length - 1) return null;
    return args[idx + 1];
  };
  const pass = (getVal("--pass") ?? "all") as PassFlag;
  if (!["1", "2", "3", "all"].includes(pass)) {
    console.error(`Invalid --pass value: ${pass}. Use 1|2|3|all.`);
    process.exit(1);
  }
  const limitStr = getVal("--limit");
  return {
    pass,
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force"),
    limit: limitStr ? parseInt(limitStr, 10) : null,
    city: getVal("--city"),
    plumber: getVal("--plumber"),
  };
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
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    console.error(
      "ERROR: No service-account.json or GOOGLE_APPLICATION_CREDENTIALS found",
    );
    process.exit(1);
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function monthsSince(iso: string | null | undefined): number {
  if (!iso) return 999;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 999;
  const diffMs = Date.now() - then;
  return diffMs / (1000 * 60 * 60 * 24 * 30.44);
}

function weightForAge(months: number): number {
  if (months <= 12) return WEIGHT_RECENT;
  if (months <= 24) return WEIGHT_MID;
  return WEIGHT_OLD;
}

function weightedMean(
  values: number[],
  weights: number[],
): number | null {
  if (values.length === 0) return null;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < values.length; i++) {
    numerator += values[i] * weights[i];
    denominator += weights[i];
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Bridges a convention mismatch between two Firestore collections:
 *
 * - Plumber docs store serviceCities as plain slugs: "provo", "crystal-lake"
 *   (written by scripts/upload-to-firestore.js)
 * - The cities/ collection keys docs with state-suffixed slugs: "provo-ut",
 *   "crystal-lake-il"
 *
 * The decision layer needs the suffixed form so city_rank keys match cities/
 * entries (Pass 2 looks up city display names from cities/ docs). This
 * function always emits the suffixed form — even when serviceCities already
 * has plain entries — by deriving it from address.state on the plumber doc.
 *
 * If ingestion ever standardizes on the suffixed form, this bridge (and the
 * dedup below) can be deleted.
 */
function effectiveServiceCities(
  data: admin.firestore.DocumentData,
): string[] {
  const state: string | undefined = data.address?.state;
  const stateLower = state?.toLowerCase();

  if (Array.isArray(data.serviceCities) && data.serviceCities.length > 0) {
    if (!stateLower) return data.serviceCities;

    const out = new Set<string>(data.serviceCities);
    for (const slug of data.serviceCities) {
      const suffixed = `${slug}-${stateLower}`;
      if (slug !== suffixed) out.add(suffixed);
    }
    return Array.from(out);
  }

  const city: string | undefined = data.address?.city;
  if (!city || !stateLower) return [];
  return [`${slugify(city)}-${stateLower}`];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReviewInput = {
  review_id: string;
  rating: number;
  text: string;
  publishedAt: string | null;
};

type ExtractedReview = {
  review_id: string;
  scores: {
    reliability: number | null;
    pricing_fairness: number | null;
    workmanship: number | null;
    responsiveness: number | null;
    communication: number | null;
  };
  job_type:
    | "water_heater"
    | "drain"
    | "repipe"
    | "emergency"
    | "remodel"
    | "general"
    | "unknown";
  evidence_quote: string | null;
  dimension_quoted: DimensionKey | null;
};

// ---------------------------------------------------------------------------
// Claude extraction
// ---------------------------------------------------------------------------

function buildExtractionPrompt(reviews: ReviewInput[]): string {
  const reviewBlock = reviews
    .map(
      (r) =>
        `[review_id: ${r.review_id}] (${r.rating}/5${
          r.publishedAt ? `, ${r.publishedAt}` : ""
        })\n${r.text}`,
    )
    .join("\n\n---\n\n");

  return `You are analyzing reviews for a plumbing company. For EACH review, return JSON with scores 0-100 for: reliability, pricing_fairness, workmanship, responsiveness, communication. Also tag job_type (water_heater|drain|repipe|emergency|remodel|general|unknown) and extract ONE short evidence quote (under 15 words) if the review strongly supports any dimension. Return null for dimensions the review doesn't address — do NOT guess. Output: { reviews: [{ review_id, scores{}, job_type, evidence_quote, dimension_quoted }] }

Reviews to analyze:

${reviewBlock}

Return JSON only. No preamble, no markdown, no backticks. The review_id in each response MUST exactly match the review_id in the input.`;
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
        max_tokens: CLAUDE_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.content?.[0]?.text || "";
    }

    if (resp.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = parseInt(resp.headers.get("retry-after") || "0", 10);
      const backoff =
        retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 5000;
      console.log(
        `    rate limited, retrying in ${Math.round(backoff / 1000)}s`,
      );
      await sleep(backoff);
      continue;
    }

    const body = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${body}`);
  }

  throw new Error("Claude API: max retries exceeded");
}

function parseExtractionResponse(text: string): ExtractedReview[] {
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || !Array.isArray(parsed.reviews)) {
    throw new Error("Response missing reviews array");
  }
  return parsed.reviews as ExtractedReview[];
}

async function extractBatch(
  batch: ReviewInput[],
  dryRun: boolean,
): Promise<ExtractedReview[]> {
  if (dryRun) {
    return batch.map((r) => ({
      review_id: r.review_id,
      scores: {
        reliability: null,
        pricing_fairness: null,
        workmanship: null,
        responsiveness: null,
        communication: null,
      },
      job_type: "unknown",
      evidence_quote: null,
      dimension_quoted: null,
    }));
  }
  const prompt = buildExtractionPrompt(batch);
  await sleep(RATE_LIMIT_MS);
  const raw = await callClaude(prompt);
  return parseExtractionResponse(raw);
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

type AggregationResult = {
  scores: Scores;
  evidenceQuotes: EvidenceQuote[];
};

function aggregate(
  extracted: ExtractedReview[],
  ageByReviewId: Map<string, number>,
  reviews: ReviewInput[],
): AggregationResult {
  // Per-dimension weighted mean and stddev
  const dimScores: Record<DimensionKey, number> = {
    reliability: 0,
    pricing_fairness: 0,
    workmanship: 0,
    responsiveness: 0,
    communication: 0,
  };
  const dimStddevs: Record<DimensionKey, number> = {
    reliability: 0,
    pricing_fairness: 0,
    workmanship: 0,
    responsiveness: 0,
    communication: 0,
  };

  for (const dim of DIMENSION_KEYS) {
    const values: number[] = [];
    const weights: number[] = [];
    for (const r of extracted) {
      const v = r.scores[dim];
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      const age = ageByReviewId.get(r.review_id) ?? 0;
      values.push(v);
      weights.push(weightForAge(age));
    }
    const mean = weightedMean(values, weights);
    dimScores[dim] = mean === null ? 0 : Math.round(mean);
    dimStddevs[dim] = stddev(values);
  }

  // variance = max per-dim stddev (locked in per architectural decision)
  const variance = Math.max(...Object.values(dimStddevs));

  // Specialty clusters: for each job_type, composite = mean of that cluster's
  // per-review dim-averages (ignoring nulls).
  const specialty: Record<SpecialtyKey, number> = {
    water_heater: 0,
    drain: 0,
    repipe: 0,
    emergency: 0,
    remodel: 0,
  };
  for (const key of SPECIALTY_KEYS) {
    const clusterReviews = extracted.filter((r) => r.job_type === key);
    if (clusterReviews.length === 0) continue;
    const perReviewMeans: number[] = [];
    for (const r of clusterReviews) {
      const dims = DIMENSION_KEYS.map((d) => r.scores[d]).filter(
        (v): v is number => v !== null && v !== undefined && !Number.isNaN(v),
      );
      if (dims.length === 0) continue;
      perReviewMeans.push(dims.reduce((a, b) => a + b, 0) / dims.length);
    }
    if (perReviewMeans.length === 0) continue;
    specialty[key] = Math.round(
      perReviewMeans.reduce((a, b) => a + b, 0) / perReviewMeans.length,
    );
  }

  // Evidence: one quote per dimension. Pick the most recent review that has
  // a quote for that dimension AND scored that dim in the top half of the
  // plumber's range. Fallback: any quote for that dim.
  const evidenceQuotes: EvidenceQuote[] = [];
  for (const dim of DIMENSION_KEYS) {
    const candidates = extracted.filter(
      (r) => r.dimension_quoted === dim && r.evidence_quote,
    );
    if (candidates.length === 0) continue;
    // Prefer most recent (smallest age).
    candidates.sort(
      (a, b) =>
        (ageByReviewId.get(a.review_id) ?? 999) -
        (ageByReviewId.get(b.review_id) ?? 999),
    );
    const chosen = candidates[0];
    evidenceQuotes.push({
      dimension: dim,
      quote: chosen.evidence_quote!,
      review_id: chosen.review_id,
    });
  }

  const scores: Scores = {
    ...dimScores,
    specialty_strength: specialty,
    variance: Math.round(variance),
    review_count_used: extracted.length,
    last_scored_at: new Date().toISOString(),
  };

  // Build servicesMentioned from extracted reviews: bridges scoring pipeline
  // data into the format that service-specific city pages consume for Tier 2
  // eligibility. Maps job_type → { count, avgRating, topQuote }.
  const servicesMentioned = buildServicesMentioned(extracted, reviews);

  return { scores, evidenceQuotes, servicesMentioned };
}

// ---------------------------------------------------------------------------
// servicesMentioned bridge: job_type → service page keys
// ---------------------------------------------------------------------------

/** Map scoring job_type to the servicesMentioned keys used by service pages. */
const JOB_TYPE_TO_SERVICE_KEYS: Record<string, string[]> = {
  water_heater: ["water-heater"],
  drain: ["drain-cleaning"],
  repipe: ["repiping"],
  emergency: ["burst-pipe", "flooding"],
  remodel: ["bathroom-remodel"],
  sewer: ["sewer"],
  toilet: ["toilet"],
  fixture: ["faucet-fixture"],
  sump_pump: ["sump-pump"],
  gas_line: ["gas-leak"],
  slab_leak: ["slab-leak"],
  water_line: ["water-line"],
};

function buildServicesMentioned(
  extracted: ExtractedReview[],
  reviews: ReviewInput[],
): Record<string, { count: number; avgRating: number; topQuote: string }> {
  const ratingByReviewId = new Map<string, number>();
  for (const r of reviews) ratingByReviewId.set(r.review_id, r.rating);

  // Group extracted reviews by job_type (skip general/unknown)
  const groups = new Map<
    string,
    Array<{ rating: number; quote: string | null }>
  >();
  for (const ex of extracted) {
    if (ex.job_type === "general" || ex.job_type === "unknown") continue;
    const serviceKeys = JOB_TYPE_TO_SERVICE_KEYS[ex.job_type];
    if (!serviceKeys) continue;
    const rating = ratingByReviewId.get(ex.review_id) ?? 0;
    for (const key of serviceKeys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ rating, quote: ex.evidence_quote });
    }
  }

  const result: Record<
    string,
    { count: number; avgRating: number; topQuote: string }
  > = {};
  for (const [key, entries] of groups) {
    if (entries.length === 0) continue;
    const avgRating =
      Math.round(
        (entries.reduce((s, e) => s + e.rating, 0) / entries.length) * 10,
      ) / 10;
    // Pick the best quote: prefer one from a high-rated review
    const withQuotes = entries.filter((e) => e.quote);
    withQuotes.sort((a, b) => b.rating - a.rating);
    const topQuote = withQuotes[0]?.quote || "";
    result[key] = { count: entries.length, avgRating, topQuote };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Unified synthesis
// ---------------------------------------------------------------------------

/**
 * After batch extraction + aggregation, make ONE Sonnet call with the full
 * review set + aggregated scores to generate display copy.
 */
function buildSynthesisPrompt(
  plumberName: string,
  reviews: ReviewInput[],
  scores: Scores,
  evidenceQuotes: EvidenceQuote[],
  platformContext?: {
    googleRating?: number | null;
    googleReviewCount?: number;
    yelpRating?: number | null;
    yelpReviewCount?: number;
    bbbAccredited?: boolean;
    bbbRating?: string | null;
    bbbComplaintsPast3Years?: number | null;
  },
): string {
  // Include up to 30 reviews for synthesis context (sorted by recency)
  const reviewsSorted = [...reviews].sort((a, b) => {
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
  const reviewBlock = reviewsSorted
    .slice(0, 30)
    .map((r) => `[${r.rating}/5${r.publishedAt ? ` — ${r.publishedAt}` : ""}] ${r.text}`)
    .join("\n\n---\n\n");

  const quoteBlock = evidenceQuotes
    .map((eq) => `${eq.dimension}: "${eq.quote}"`)
    .join("\n");

  // Platform context block — for cross-platform discrepancy detection
  const platformBlock = platformContext
    ? `Platform ratings:
- Google: ${platformContext.googleRating ?? "N/A"}/5 (${platformContext.googleReviewCount ?? 0} reviews)
- Yelp: ${platformContext.yelpRating ?? "N/A"}/5 (${platformContext.yelpReviewCount ?? 0} reviews)
${platformContext.bbbAccredited != null ? `- BBB: ${platformContext.bbbRating ?? "Unrated"}, accredited=${platformContext.bbbAccredited}, complaints (past 3yr)=${platformContext.bbbComplaintsPast3Years ?? 0}` : ""}`
    : "";

  return `You are synthesizing reviews for an emergency plumber directory. Your output helps homeowners decide who to call at 2am with a burst pipe.

Plumber: ${plumberName}
Reviews analyzed: ${reviews.length}
Dimension scores (0-100): reliability=${scores.reliability}, pricing_fairness=${scores.pricing_fairness}, workmanship=${scores.workmanship}, responsiveness=${scores.responsiveness}, communication=${scores.communication}
Score variance: ${scores.variance}

${platformBlock}

Evidence quotes already extracted:
${quoteBlock || "(none)"}

Reviews:
${reviewBlock}

Respond in JSON only. No markdown, no preamble, no backticks.
{
  "summary": "One specific, punchy sentence a friend would say. NEVER say 'reliable and professional'. Reference actual patterns. Example: 'Responds fast to emergencies but pricing runs 20% above competitors'",
  "strengths": ["2-3 specific strengths with evidence counts. e.g. '4 of 6 reviewers mention same-day arrival' or 'Multiple reviews praise thorough cleanup after work'"],
  "weaknesses": ["1-2 specific weaknesses from reviews. e.g. 'Two reviews mention final bill exceeding initial quote by $200+'. Say 'Not enough data to identify weaknesses' ONLY if every review is positive."],
  "redFlags": ["Concerning patterns with specifics. For <25 reviews, even 1-2 mentions of the same issue = pattern. e.g. '2 of 8 reviews report no-show on scheduled appointment'. Empty array [] if genuinely none."],
  "emergencyNotes": "One sentence about emergency capability signals: after-hours mentions, response time, weekend/holiday availability, burst-pipe experience. If reviews mention fast response even during business hours, note it.",
  "platformDiscrepancy": "If Google and Yelp ratings differ by 0.7+ stars OR if Yelp/BBB complaints contradict Google's positive picture, describe the gap in one sentence. e.g. 'Google rates 4.9 but Yelp shows 3.8 with multiple billing disputes'. Return null if ratings are consistent across platforms."
}`;
}

function parseSynthesisResponse(text: string): {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  emergencyNotes: string;
  platformDiscrepancy: string | null;
} {
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return {
    summary: parsed.summary || "",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    emergencyNotes: parsed.emergencyNotes || "",
    platformDiscrepancy: parsed.platformDiscrepancy || null,
  };
}

/**
 * Derive badges deterministically from dimension scores. No AI needed —
 * thresholds are explicit and can never contradict the scores.
 */
function deriveBadges(scores: Scores, redFlags: string[]): string[] {
  const badges: string[] = [];
  const hasRedFlag = (keywords: string[]) =>
    redFlags.some((rf) => keywords.some((kw) => rf.toLowerCase().includes(kw)));

  // Fast Responder: high responsiveness AND no response-time complaints
  if (scores.responsiveness >= 85 && !hasRedFlag(["slow", "late", "no-show", "didn't show", "waited", "response time"])) {
    badges.push("Fast Responder");
  }
  // Fair Pricing: high pricing fairness AND no pricing complaints
  if (scores.pricing_fairness >= 85 && !hasRedFlag(["price", "pricing", "overcharg", "surprise fee", "hidden fee", "bill", "quote"])) {
    badges.push("Fair Pricing");
  }
  // 24/7 Available: emergency specialty + high responsiveness
  if ((scores.specialty_strength.emergency ?? 0) >= 75 && scores.responsiveness >= 80) {
    badges.push("24/7 Available");
  }
  // Clean & Professional: high workmanship AND no professionalism complaints
  if (scores.workmanship >= 85 && !hasRedFlag(["unprofessional", "messy", "rude", "disrespect"])) {
    badges.push("Clean & Professional");
  }
  // Great Communicator: high communication score
  if (scores.communication >= 85 && !hasRedFlag(["communicat", "didn't explain", "no update", "ghosted"])) {
    badges.push("Great Communicator");
  }
  return badges;
}

/**
 * Derive emergency readiness from scores. Uses emergency specialty strength
 * + responsiveness + business signals.
 */
function deriveEmergencyReadiness(
  scores: Scores,
  emergencyNotes: string,
): { readiness: "high" | "medium" | "low" | "unknown"; signals: string[] } {
  const emergScore = scores.specialty_strength.emergency ?? 0;
  const respScore = scores.responsiveness;
  const signals: string[] = [];

  if (emergencyNotes) signals.push(emergencyNotes);

  if (emergScore >= 75 && respScore >= 80) {
    return { readiness: "high", signals };
  }
  if (emergScore >= 50 || respScore >= 75) {
    return { readiness: "medium", signals };
  }
  if (respScore < 55) {
    return { readiness: "low", signals };
  }
  return { readiness: "unknown", signals };
}

/**
 * Derive pricing tier from pricing_fairness score.
 */
function derivePricingTier(scores: Scores): "budget" | "mid-range" | "premium" | "unknown" {
  if (scores.pricing_fairness >= 85) return "budget";
  if (scores.pricing_fairness >= 65) return "mid-range";
  if (scores.pricing_fairness < 50 && scores.workmanship >= 80) return "premium";
  return "unknown";
}

/**
 * Keyword fallback for plumbers with < MIN_REVIEWS_TO_SCORE reviews.
 * Produces the same reviewSynthesis fields without a Claude call.
 */
const KW_FAST = ["fast", "quick", "rapid", "same day", "prompt", "responsive", "right away", "within an hour"];
const KW_EMERGENCY = ["emergency", "burst", "after hours", "weekend", "24 hour", "24/7", "middle of the night"];
const KW_PRICE_GOOD = ["fair price", "reasonable", "affordable", "upfront pricing", "transparent"];
const KW_PRICE_BAD = ["expensive", "overcharged", "overpriced", "surprise fee", "hidden fee"];
const KW_QUALITY = ["professional", "knowledgeable", "thorough", "expert", "excellent work"];

function keywordFallback(reviews: ReviewInput[]): SynthesisResult {
  const total = reviews.length;
  const texts = reviews.map((r) => r.text.toLowerCase());
  const countMatches = (kws: string[]) => texts.filter((t) => kws.some((k) => t.includes(k))).length;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const badges: string[] = [];
  const emergencySignals: string[] = [];

  const fastCount = countMatches(KW_FAST);
  if (fastCount > 0) {
    strengths.push("Quick response mentioned in reviews");
    if (fastCount / total >= 0.3) badges.push("Fast Responder");
  }
  const qualCount = countMatches(KW_QUALITY);
  if (qualCount > 0) strengths.push("Professional service noted by reviewers");
  const priceGood = countMatches(KW_PRICE_GOOD);
  if (priceGood > 0) { strengths.push("Fair pricing mentioned"); badges.push("Fair Pricing"); }

  const priceBad = countMatches(KW_PRICE_BAD);
  if (priceBad > 0) weaknesses.push("Pricing concerns noted");
  if (total < 3) weaknesses.push(`Only ${total} review${total === 1 ? "" : "s"} — limited data`);

  const emergCount = countMatches(KW_EMERGENCY);
  if (emergCount > 0) emergencySignals.push("Emergency/after-hours work mentioned");

  let pricingTier: "budget" | "mid-range" | "premium" | "unknown" = "unknown";
  if (priceBad > priceGood) pricingTier = "premium";
  else if (priceGood > 0) pricingTier = "mid-range";

  return {
    summary: "",
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    redFlags: [],
    emergencyNotes: emergencySignals[0] || "",
    badges: badges.slice(0, 3),
    emergencyReadiness: emergCount > 0 ? "medium" : "unknown",
    emergencySignals: emergencySignals.slice(0, 2),
    pricingTier,
    bestFor: [],
  };
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

async function loadPlumbers(
  db: admin.firestore.Firestore,
  args: CliArgs,
  opts: { ordered?: boolean } = {},
): Promise<Array<admin.firestore.QueryDocumentSnapshot>> {
  if (args.plumber) {
    const doc = await db.collection("plumbers").doc(args.plumber).get();
    if (!doc.exists) {
      console.error(`Plumber ${args.plumber} not found`);
      process.exit(1);
    }
    return [doc as admin.firestore.QueryDocumentSnapshot];
  }
  const snap = await db.collection("plumbers").get();
  let docs: admin.firestore.QueryDocumentSnapshot[] = snap.docs;
  if (args.city) {
    // Client-side filter so the primary-city fallback in effectiveServiceCities
    // catches plumbers whose serviceCities array is empty.
    docs = docs.filter((d) =>
      effectiveServiceCities(d.data()).includes(args.city!),
    );
  }

  // Ordered iteration (Pass 1 only): drain stale/unscored plumbers first
  // so a timeout-bounded run makes monotonic progress, instead of always
  // restarting from the top of doc-ID sort. Unscored go first (most urgent),
  // then scored in ascending last_scored_at order (oldest score = most stale).
  // 712-doc collection → client-side sort is cheap and avoids the Firestore
  // "field missing" query limitation that would require a two-query dance.
  if (opts.ordered) {
    docs = docs.slice().sort((a, b) => {
      const aTs: string | undefined = a.data().scores?.last_scored_at;
      const bTs: string | undefined = b.data().scores?.last_scored_at;
      if (!aTs && !bTs) return 0;
      if (!aTs) return -1; // unscored → first
      if (!bTs) return 1;
      return aTs.localeCompare(bTs); // oldest scoring timestamp first
    });
  }

  if (args.limit && args.limit < docs.length) {
    docs = docs.slice(0, args.limit);
  }
  return docs;
}

async function loadReviews(
  db: admin.firestore.Firestore,
  plumberId: string,
): Promise<ReviewInput[]> {
  const snap = await db
    .collection("reviews")
    .where("plumberId", "==", plumberId)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      review_id: d.id,
      rating: typeof data.rating === "number" ? data.rating : 0,
      text: typeof data.text === "string" ? data.text : "",
      publishedAt:
        typeof data.publishedAt === "string" ? data.publishedAt : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Pass 1: Score
// ---------------------------------------------------------------------------

async function runPass1(
  db: admin.firestore.Firestore,
  args: CliArgs,
): Promise<void> {
  console.log("\n=== Pass 1: Score ===");
  const plumbers = await loadPlumbers(db, args, { ordered: true });
  console.log(`Loaded ${plumbers.length} plumber(s) (unscored first, then oldest-scored ascending)`);

  let scored = 0;
  let skipped = 0;
  let failed = 0;

  for (const plumberDoc of plumbers) {
    const data = plumberDoc.data();
    const name = data.businessName ?? plumberDoc.id;

    const allReviews = await loadReviews(db, plumberDoc.id);
    const totalReviewCount = allReviews.length;

    // Smart re-score trigger: skip if recently scored AND review count
    // hasn't changed by 20%+. The 30-day timer is the fallback; the
    // primary trigger is "review data changed meaningfully".
    //
    // NOTE: compares TOTAL review count (not capped), so the cap below
    // doesn't mask genuine review growth from the delta check.
    if (!args.force && data.scores?.last_scored_at) {
      const last = Date.parse(data.scores.last_scored_at);
      const recentlyScored =
        !Number.isNaN(last) && Date.now() - last < SKIP_IF_SCORED_WITHIN_MS;
      const lastReviewCount = data.scores?.review_count_used || 0;
      const reviewCountDelta = lastReviewCount > 0
        ? Math.abs(totalReviewCount - lastReviewCount) / lastReviewCount
        : 1;
      const reviewsChangedSignificantly = reviewCountDelta >= 0.20;

      if (recentlyScored && !reviewsChangedSignificantly) {
        skipped++;
        continue;
      }
      if (recentlyScored && reviewsChangedSignificantly) {
        console.log(
          `  ! ${name}: recently scored but review count changed ${(reviewCountDelta * 100).toFixed(0)}% (${lastReviewCount} → ${totalReviewCount}) — re-scoring`,
        );
      }
    }

    // Cap reviews fed to Claude at REVIEW_CAP most recent. The recency
    // weighting in aggregate() already discounts reviews >24mo to 0.25×,
    // so extracting from older reviews is low-ROI. Nulls sort to end.
    const reviews =
      totalReviewCount > REVIEW_CAP
        ? allReviews
            .slice()
            .sort((a, b) => {
              if (!a.publishedAt && !b.publishedAt) return 0;
              if (!a.publishedAt) return 1;
              if (!b.publishedAt) return -1;
              return b.publishedAt.localeCompare(a.publishedAt);
            })
            .slice(0, REVIEW_CAP)
        : allReviews;

    // Plumbers with < MIN_REVIEWS_TO_SCORE get keyword fallback synthesis
    // (no Claude call) but still get reviewSynthesis written.
    //
    // Both the keyword-fallback and no-reviews branches now stamp
    // scores.{last_scored_at, method, review_count_used}. Without this,
    // these plumbers look "unscored" to the cursor ordering and get
    // re-examined every run forever (cheap each, but wasteful).
    if (reviews.length < MIN_REVIEWS_TO_SCORE) {
      const nowIso = new Date().toISOString();
      if (reviews.length === 0) {
        if (!args.dryRun) {
          await db.collection("plumbers").doc(plumberDoc.id).update({
            "scores.last_scored_at": nowIso,
            "scores.method": "no_reviews",
            "scores.review_count_used": 0,
            updatedAt: admin.firestore.Timestamp.now(),
          });
        }
        console.log(`  - ${name}: no reviews cached — stamped and skipped`);
        skipped++;
        continue;
      }
      const synth = keywordFallback(reviews);
      if (!args.dryRun) {
        await db.collection("plumbers").doc(plumberDoc.id).update({
          "scores.last_scored_at": nowIso,
          "scores.method": "keyword_fallback",
          "scores.review_count_used": totalReviewCount,
          "reviewSynthesis.summary": synth.summary,
          "reviewSynthesis.strengths": synth.strengths,
          "reviewSynthesis.weaknesses": synth.weaknesses,
          "reviewSynthesis.redFlags": synth.redFlags,
          "reviewSynthesis.badges": synth.badges,
          "reviewSynthesis.emergencyReadiness": synth.emergencyReadiness,
          "reviewSynthesis.emergencyNotes": synth.emergencyNotes,
          "reviewSynthesis.emergencySignals": synth.emergencySignals,
          "reviewSynthesis.pricingTier": synth.pricingTier,
          "reviewSynthesis.bestFor": synth.bestFor,
          "reviewSynthesis.reviewCount": reviews.length,
          "reviewSynthesis.synthesisVersion": "keyword-fallback",
          "reviewSynthesis.synthesizedAt": admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }
      console.log(`  - ${name}: keyword fallback (${reviews.length} reviews)`);
      skipped++;
      continue;
    }

    const ageByReviewId = new Map<string, number>();
    for (const r of reviews) {
      ageByReviewId.set(r.review_id, monthsSince(r.publishedAt));
    }

    try {
      // --- Step 1: Batch extraction (per-review dimensional scores) ---
      const batches: ReviewInput[][] = [];
      for (let i = 0; i < reviews.length; i += REVIEWS_PER_BATCH) {
        batches.push(reviews.slice(i, i + REVIEWS_PER_BATCH));
      }
      console.log(
        `  ~ ${name}: ${reviews.length} reviews in ${batches.length} batch(es)`,
      );
      const extracted: ExtractedReview[] = [];
      for (const batch of batches) {
        const batchResults = await extractBatch(batch, args.dryRun);
        extracted.push(...batchResults);
      }

      if (args.dryRun) {
        console.log(`    [dry-run] would aggregate ${extracted.length} rows`);
        scored++;
        continue;
      }

      // --- Step 2: Aggregate scores ---
      const { scores, evidenceQuotes, servicesMentioned } = aggregate(extracted, ageByReviewId, reviews);

      // Override review_count_used with the TOTAL review count (not capped)
      // so the 20%-delta skip check on the next run compares apples to apples.
      // aggregate() sets this to extracted.length by default, which would
      // equal the cap (75) and cause the delta check to always fire.
      scores.review_count_used = totalReviewCount;
      scores.method = "sonnet";

      // --- Step 3: Sonnet synthesis call ---
      // Pass platform context (Yelp/BBB ratings) so Sonnet can detect
      // cross-platform discrepancies.
      const platformContext = {
        googleRating: data.googleRating ?? null,
        googleReviewCount: data.googleReviewCount ?? 0,
        yelpRating: data.yelpRating ?? null,
        yelpReviewCount: data.yelpReviewCount ?? 0,
        bbbAccredited: data.bbb?.accredited,
        bbbRating: data.bbb?.rating ?? null,
        bbbComplaintsPast3Years: data.bbb?.complaintsPast3Years ?? null,
      };
      await sleep(RATE_LIMIT_MS);
      const synthPrompt = buildSynthesisPrompt(name, reviews, scores, evidenceQuotes, platformContext);
      const synthRaw = await callClaude(synthPrompt);
      const synthParsed = parseSynthesisResponse(synthRaw);

      // --- Step 4: Derive deterministic fields from scores ---
      const badges = deriveBadges(scores, synthParsed.redFlags);
      const { readiness: emergencyReadiness, signals: emergencySignals } =
        deriveEmergencyReadiness(scores, synthParsed.emergencyNotes);
      const pricingTier = derivePricingTier(scores);

      // bestFor: from decision engine (already imported at top)
      const bestFor = computeBestFor(scores);

      // --- Step 5: Write scores + unified synthesis to Firestore ---
      const updateData: Record<string, unknown> = {
        scores,
        evidence_quotes: evidenceQuotes,
        // Unified synthesis — sole writer of reviewSynthesis.*
        "reviewSynthesis.summary": synthParsed.summary,
        "reviewSynthesis.strengths": synthParsed.strengths,
        "reviewSynthesis.weaknesses": synthParsed.weaknesses,
        "reviewSynthesis.redFlags": synthParsed.redFlags,
        "reviewSynthesis.badges": badges,
        "reviewSynthesis.emergencyReadiness": emergencyReadiness,
        "reviewSynthesis.emergencyNotes": synthParsed.emergencyNotes,
        "reviewSynthesis.emergencySignals": emergencySignals,
        "reviewSynthesis.pricingTier": pricingTier,
        "reviewSynthesis.bestFor": bestFor,
        "reviewSynthesis.platformDiscrepancy": synthParsed.platformDiscrepancy,
        "reviewSynthesis.reviewCount": reviews.length,
        "reviewSynthesis.aiSynthesizedAt": admin.firestore.Timestamp.now(),
        "reviewSynthesis.synthesisVersion": "unified-sonnet-v2",
        updatedAt: admin.firestore.Timestamp.now(),
      };
      if (Object.keys(servicesMentioned).length > 0) {
        updateData["reviewSynthesis.servicesMentioned"] = servicesMentioned;
      }
      await db.collection("plumbers").doc(plumberDoc.id).update(updateData);
      scored++;
      console.log(
        `  + ${name}: variance=${scores.variance} badges=[${badges.join(",")}] emergency=${emergencyReadiness} redFlags=${synthParsed.redFlags.length}`,
      );
    } catch (err) {
      failed++;
      console.error(`  ! ${name}: ${(err as Error).message}`);
    }
  }

  console.log(
    `\nPass 1 done: ${scored} scored, ${skipped} skipped, ${failed} failed`,
  );
}

// ---------------------------------------------------------------------------
// Pass 2: Rank (per-city percentiles)
// ---------------------------------------------------------------------------

function overallScore(scores: Scores): number {
  const dims = DIMENSION_KEYS.map((k) => scores[k]);
  return dims.reduce((a, b) => a + b, 0) / dims.length;
}

function bestWorstDim(scores: Scores): {
  best: DimensionKey;
  worst: DimensionKey;
} {
  let best: DimensionKey = DIMENSION_KEYS[0];
  let worst: DimensionKey = DIMENSION_KEYS[0];
  for (const d of DIMENSION_KEYS) {
    if (scores[d] > scores[best]) best = d;
    if (scores[d] < scores[worst]) worst = d;
  }
  return { best, worst };
}

async function runPass2(
  db: admin.firestore.Firestore,
  args: CliArgs,
): Promise<void> {
  console.log("\n=== Pass 2: Rank ===");

  const plumbersSnap = await db.collection("plumbers").get();
  type Entry = {
    id: string;
    scores: Scores;
    serviceCities: string[];
    overall: number;
  };
  const withScores: Entry[] = [];
  for (const doc of plumbersSnap.docs) {
    const data = doc.data();
    if (!data.scores) continue;
    withScores.push({
      id: doc.id,
      scores: data.scores as Scores,
      serviceCities: effectiveServiceCities(data),
      overall: overallScore(data.scores as Scores),
    });
  }
  console.log(`Ranking ${withScores.length} scored plumber(s)`);

  // Collect all city slugs in play
  const citySet = new Set<string>();
  for (const e of withScores) {
    for (const c of e.serviceCities) citySet.add(c);
  }
  if (args.city) {
    for (const slug of citySet) if (slug !== args.city) citySet.delete(slug);
    citySet.add(args.city);
  }

  // Look up city display names + state from cities collection in one sweep
  const cityLabels = new Map<string, string>(); // slug -> "Aurora, IL"
  for (const slug of citySet) {
    const cityDoc = await db.collection("cities").doc(slug).get();
    if (cityDoc.exists) {
      const d = cityDoc.data()!;
      const label =
        d.name && d.state ? `${d.name}, ${d.state}` : slug;
      cityLabels.set(slug, label);
    } else {
      cityLabels.set(slug, slug);
    }
  }

  // Per-plumber city_rank map built up across cities
  const cityRankUpdates = new Map<
    string,
    Record<string, CityRankEntry>
  >();

  for (const slug of citySet) {
    const members = withScores.filter((e) =>
      e.serviceCities.includes(slug),
    );
    if (members.length === 0) continue;
    members.sort((a, b) => b.overall - a.overall);
    const n = members.length;

    // Pre-compute per-dimension sorted ranks for percentile calculation
    const dimSorted: Record<DimensionKey, string[]> = {} as Record<
      DimensionKey,
      string[]
    >;
    for (const dim of DIMENSION_KEYS) {
      dimSorted[dim] = [...members]
        .sort((a, b) => b.scores[dim] - a.scores[dim])
        .map((m) => m.id);
    }

    for (let i = 0; i < n; i++) {
      const rank = i + 1;
      const percentile =
        n <= 1 ? 100 : Math.round((100 * (n - rank)) / (n - 1));
      const { best, worst } = bestWorstDim(members[i].scores);

      // Per-dimension percentiles within this city
      const dimPercentiles: Partial<Record<DimensionKey, number>> = {};
      for (const dim of DIMENSION_KEYS) {
        const dimRank = dimSorted[dim].indexOf(members[i].id) + 1;
        dimPercentiles[dim] =
          n <= 1 ? 100 : Math.round((100 * (n - dimRank)) / (n - 1));
      }

      const entry: CityRankEntry = {
        rank: `#${rank} of ${n} in ${cityLabels.get(slug) ?? slug}`,
        overall_percentile: percentile,
        best_dimension: best,
        worst_dimension: worst,
        dim_percentiles: dimPercentiles,
      };
      const existing = cityRankUpdates.get(members[i].id) ?? {};
      existing[slug] = entry;
      cityRankUpdates.set(members[i].id, existing);
    }
  }

  if (args.dryRun) {
    console.log(
      `  [dry-run] computed city_rank for ${cityRankUpdates.size} plumbers`,
    );
    return;
  }

  let written = 0;
  for (const [plumberId, cityRank] of cityRankUpdates.entries()) {
    await db.collection("plumbers").doc(plumberId).update({
      city_rank: cityRank,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    written++;
  }
  console.log(`Pass 2 done: wrote city_rank for ${written} plumber(s)`);
}

// ---------------------------------------------------------------------------
// Pass 3: Decide
// ---------------------------------------------------------------------------

async function runPass3(
  db: admin.firestore.Firestore,
  args: CliArgs,
): Promise<void> {
  console.log("\n=== Pass 3: Decide ===");

  const plumbers = await loadPlumbers(db, args);
  let decided = 0;
  let skipped = 0;

  for (const plumberDoc of plumbers) {
    const data = plumberDoc.data();
    const name = data.businessName ?? plumberDoc.id;
    const scores = data.scores as Scores | undefined;
    const cityRank = data.city_rank as
      | Record<string, CityRankEntry>
      | undefined;
    const serviceCities = effectiveServiceCities(data);
    const evidenceQuotes: EvidenceQuote[] = Array.isArray(data.evidence_quotes)
      ? data.evidence_quotes
      : [];

    if (!scores || !cityRank) {
      skipped++;
      continue;
    }

    // Primary city = first serviceCity with a city_rank entry.
    const primarySlug = serviceCities.find((c) => cityRank[c]) ?? null;
    if (!primarySlug) {
      skipped++;
      continue;
    }
    const primaryEntry = cityRank[primarySlug];

    const core = computeDecision(scores, primaryEntry);
    const decision = {
      ...core,
      evidence_quotes: evidenceQuotes,
      primary_city_slug: primarySlug,
      decided_at: new Date().toISOString(),
    };

    if (args.dryRun) {
      console.log(
        `  [dry-run] ${name}: verdict=${decision.verdict} best_for=${decision.best_for.length} avoid_if=${decision.avoid_if.length}`,
      );
      decided++;
      continue;
    }

    await db.collection("plumbers").doc(plumberDoc.id).update({
      decision,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    decided++;
    console.log(`  + ${name}: ${decision.verdict}`);
  }

  console.log(`\nPass 3 done: ${decided} decided, ${skipped} skipped`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.dryRun) {
    console.log("DRY RUN — no API calls or Firestore writes\n");
  }
  const db = initFirebase();
  const startedAt = new Date();

  if (args.pass === "1" || args.pass === "all") await runPass1(db, args);
  if (args.pass === "2" || args.pass === "all") await runPass2(db, args);
  if (args.pass === "3" || args.pass === "all") await runPass3(db, args);

  // Phase 1 stabilization: log a pipelineRuns entry so publish vs score
  // behavior can be separated in Firestore. Wrapped in try/catch so this
  // logging hook can never affect scoring outcomes.
  if (!args.dryRun) {
    try {
      const durationSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
      await db.collection("pipelineRuns").add({
        script: "score-plumbers",
        phase: "score",
        startedAt: admin.firestore.Timestamp.fromDate(startedAt),
        completedAt: admin.firestore.Timestamp.now(),
        durationSeconds,
        status: "success",
        summary: { pass: args.pass },
        triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
      });
    } catch (e) {
      console.error("Failed to log pipelineRun for score-plumbers:", (e as Error).message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
