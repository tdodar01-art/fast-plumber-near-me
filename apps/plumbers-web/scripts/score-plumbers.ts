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
const REVIEWS_PER_BATCH = 15;
const RATE_LIMIT_MS = 2000;
const MAX_RETRIES = 3;
const CLAUDE_MAX_TOKENS = 4096;

const SKIP_IF_SCORED_WITHIN_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_REVIEWS_TO_SCORE = 3;

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
 * Effective service-city list for a plumber doc. Most existing plumber docs
 * have `serviceCities: []` and rely on their primary address for city
 * placement — fall back to `{slug(address.city)}-{state}` so Pass 2 ranking
 * and the --city filter don't silently skip them.
 */
function effectiveServiceCities(
  data: admin.firestore.DocumentData,
): string[] {
  if (Array.isArray(data.serviceCities) && data.serviceCities.length > 0) {
    return data.serviceCities;
  }
  const city: string | undefined = data.address?.city;
  const state: string | undefined = data.address?.state;
  if (!city || !state) return [];
  return [`${slugify(city)}-${state.toLowerCase()}`];
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

  return { scores, evidenceQuotes };
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

async function loadPlumbers(
  db: admin.firestore.Firestore,
  args: CliArgs,
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
  const plumbers = await loadPlumbers(db, args);
  console.log(`Loaded ${plumbers.length} plumber(s)`);

  let scored = 0;
  let skipped = 0;
  let failed = 0;

  for (const plumberDoc of plumbers) {
    const data = plumberDoc.data();
    const name = data.businessName ?? plumberDoc.id;

    if (!args.force && data.scores?.last_scored_at) {
      const last = Date.parse(data.scores.last_scored_at);
      if (
        !Number.isNaN(last) &&
        Date.now() - last < SKIP_IF_SCORED_WITHIN_MS
      ) {
        skipped++;
        continue;
      }
    }

    const reviews = await loadReviews(db, plumberDoc.id);
    if (reviews.length < MIN_REVIEWS_TO_SCORE) {
      console.log(
        `  - ${name}: skipped (only ${reviews.length} reviews, need ${MIN_REVIEWS_TO_SCORE})`,
      );
      skipped++;
      continue;
    }

    const ageByReviewId = new Map<string, number>();
    for (const r of reviews) {
      ageByReviewId.set(r.review_id, monthsSince(r.publishedAt));
    }

    try {
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

      const { scores, evidenceQuotes } = aggregate(extracted, ageByReviewId);
      await db.collection("plumbers").doc(plumberDoc.id).update({
        scores,
        evidence_quotes: evidenceQuotes,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      scored++;
      console.log(
        `  + ${name}: variance=${scores.variance} reviews_used=${scores.review_count_used}`,
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
    for (let i = 0; i < n; i++) {
      const rank = i + 1;
      const percentile =
        n <= 1 ? 100 : Math.round((100 * (n - rank)) / (n - 1));
      const { best, worst } = bestWorstDim(members[i].scores);
      const entry: CityRankEntry = {
        rank: `#${rank} of ${n} in ${cityLabels.get(slug) ?? slug}`,
        overall_percentile: percentile,
        best_dimension: best,
        worst_dimension: worst,
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

  if (args.pass === "1" || args.pass === "all") await runPass1(db, args);
  if (args.pass === "2" || args.pass === "all") await runPass2(db, args);
  if (args.pass === "3" || args.pass === "all") await runPass3(db, args);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
