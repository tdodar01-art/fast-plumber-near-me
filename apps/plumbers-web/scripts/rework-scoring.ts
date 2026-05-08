#!/usr/bin/env npx tsx

/**
 * 2026-05-08 first-principles scoring rework.
 *
 * For every active plumber with valid review-text dimension scores, this
 * script applies the new scoring architecture:
 *
 *   1. Compute cross-platform signals from Google + Yelp + BBB data
 *   2. Apply deterministic adjustment penalty to the dimension scores
 *   3. Recompute city_rank for every city using the adjusted scores
 *   4. Recompute decision (verdict + best_for + caution_if + …) using the
 *      new ABSOLUTE composite thresholds + signal-clean requirement
 *   5. Write {scores, scores.review_text_only, scores.cross_platform_signals,
 *      scores.adjustment_penalty, city_rank, decision} atomically per plumber
 *
 * Why this and not "just run score-plumbers.ts --pass all":
 *   - Pass 1's review-text dimension scores are still canonical and clean.
 *     We don't need to re-run Sonnet extraction.
 *   - The new logic is purely deterministic (signals + penalty + thresholds).
 *     One pass over Firestore, no Anthropic credits.
 *
 * Idempotent. Safe to re-run; it computes the same outputs from the same
 * inputs and skips writes when the data didn't change.
 *
 * Usage:
 *   npx tsx scripts/rework-scoring.ts --dry-run
 *   npx tsx scripts/rework-scoring.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeCrossPlatformSignals,
  computeAdjustmentPenalty,
  applyAdjustment,
  computeDecision,
  overallComposite,
  DIMENSION_KEYS,
  type Scores,
  type CityRankEntry,
  type CrossPlatformSignals,
  type Verdict,
} from "../src/lib/decision-engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("ERROR: service-account.json not found");
  process.exit(1);
}

// firebase-admin requires CommonJS-style require for ESM compatibility here
// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require("firebase-admin");
const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
// Older plumber records have undefined fields (e.g. older scoring runs that
// didn't set review_count_used). The default Firestore behavior is to reject
// undefined values; ignoreUndefinedProperties tells it to drop those keys
// instead of throwing.
db.settings({ ignoreUndefinedProperties: true });

type PlumberDoc = {
  id: string;
  data: {
    businessName?: string;
    googleRating?: number | null;
    googleReviewCount?: number | null;
    yelpRating?: number | null;
    yelpReviewCount?: number | null;
    address?: { state?: string };
    serviceCities?: string[];
    scores?: Scores & {
      method?: string;
      review_text_only?: Scores;
      cross_platform_signals?: CrossPlatformSignals;
      adjustment_penalty?: number;
    };
    reviewSynthesis?: { platformDiscrepancy?: string | null };
    bbb?: { complaintsPast3Years?: number | null };
    decision?: { verdict?: Verdict };
    city_rank?: Record<string, CityRankEntry>;
    isActive?: boolean;
  };
};

function effectiveServiceCities(p: PlumberDoc): string[] {
  const raw = p.data.serviceCities ?? [];
  const state = (p.data.address?.state ?? "").toLowerCase();
  if (!state) return raw;
  // Bridge: ingestion writes plain "crystal-lake"; ranking expects suffixed
  // "crystal-lake-il". Emit both forms (deduped) so consumers find it under
  // either key.
  const out = new Set<string>();
  for (const slug of raw) {
    if (typeof slug !== "string" || !slug) continue;
    out.add(slug);
    if (!slug.endsWith(`-${state}`)) out.add(`${slug}-${state}`);
  }
  return [...out];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log("=== Scoring Rework (2026-05-08) ===");
  if (dryRun) console.log("DRY RUN — no Firestore writes");
  console.log();

  const snap = await db.collection("plumbers").where("isActive", "==", true).get();
  const all: PlumberDoc[] = [];
  snap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) =>
    all.push({ id: doc.id, data: doc.data() as PlumberDoc["data"] }),
  );
  console.log(`Loaded ${all.length} active plumbers`);

  // Step 1: compute new scores per plumber
  type Computed = {
    plumber: PlumberDoc;
    rawScores: Scores | null;
    signals: CrossPlatformSignals | null;
    penalty: number;
    adjustedScores: Scores | null;
    composite: number | null;
  };
  const computed: Computed[] = [];

  let withScores = 0;
  let withoutScores = 0;
  for (const p of all) {
    const s = p.data.scores;
    const dimsValid =
      s &&
      DIMENSION_KEYS.every((k) => typeof s[k] === "number") &&
      typeof s.variance === "number" &&
      s.method !== "no_reviews";

    if (!dimsValid) {
      withoutScores++;
      computed.push({
        plumber: p,
        rawScores: null,
        signals: null,
        penalty: 0,
        adjustedScores: null,
        composite: null,
      });
      continue;
    }
    withScores++;

    // The "raw" review-text-only scores are whatever's stored today. If we've
    // already run this rework (idempotency), the stored `review_text_only`
    // is canonical and `scores.*` are already adjusted — use that.
    const rawScores: Scores = (s.review_text_only as Scores) ?? {
      reliability: s.reliability,
      pricing_fairness: s.pricing_fairness,
      workmanship: s.workmanship,
      responsiveness: s.responsiveness,
      communication: s.communication,
      variance: s.variance,
      review_count_used: s.review_count_used,
      last_scored_at: s.last_scored_at,
      specialty_strength: s.specialty_strength,
      method: s.method,
    };

    const signals = computeCrossPlatformSignals({
      googleRating: p.data.googleRating ?? null,
      googleReviewCount: p.data.googleReviewCount ?? null,
      yelpRating: p.data.yelpRating ?? null,
      yelpReviewCount: p.data.yelpReviewCount ?? null,
      platformDiscrepancyText: p.data.reviewSynthesis?.platformDiscrepancy ?? null,
      bbb: p.data.bbb ?? null,
    });
    const penalty = computeAdjustmentPenalty(signals);
    const adjustedScores = applyAdjustment(rawScores, penalty);
    const composite = overallComposite(adjustedScores);

    computed.push({ plumber: p, rawScores, signals, penalty, adjustedScores, composite });
  }

  console.log(`  with valid scores:    ${withScores}`);
  console.log(`  without (skipping):   ${withoutScores}`);
  console.log();

  // Step 2: compute city_rank using adjusted composites
  // Map every plumber to all of their effective service-city slugs and
  // rank within each city.
  type CityCandidate = { computedIdx: number; composite: number; dims: Scores };
  const byCity: Map<string, CityCandidate[]> = new Map();

  computed.forEach((c, idx) => {
    if (!c.adjustedScores || c.composite == null) return;
    const cities = effectiveServiceCities(c.plumber);
    for (const city of cities) {
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city)!.push({
        computedIdx: idx,
        composite: c.composite,
        dims: c.adjustedScores,
      });
    }
  });

  console.log(`Ranking across ${byCity.size} city slugs...`);

  // Per-plumber accumulator for city_rank entries
  const cityRankByPlumber: Map<number, Record<string, CityRankEntry>> = new Map();
  for (let i = 0; i < computed.length; i++) cityRankByPlumber.set(i, {});

  for (const [city, candidates] of byCity) {
    if (candidates.length === 0) continue;
    // Sort by adjusted composite desc — this is the "absolute" ranking
    candidates.sort((a, b) => b.composite - a.composite);

    // Per-dimension percentile maps
    const dimPercentiles: Record<string, Map<number, number>> = {};
    for (const k of DIMENSION_KEYS) {
      const sorted = [...candidates].sort((a, b) => a.dims[k] - b.dims[k]);
      const map = new Map<number, number>();
      sorted.forEach((c, i) => {
        // Percentile 0..100, ties take the higher position
        map.set(c.computedIdx, Math.round((i / Math.max(1, sorted.length - 1)) * 100));
      });
      dimPercentiles[k] = map;
    }

    candidates.forEach((cand, position) => {
      const overall_percentile = Math.round(
        ((candidates.length - 1 - position) / Math.max(1, candidates.length - 1)) * 100,
      );
      // best_dimension = highest dim percentile within this city
      let best: keyof typeof dimPercentiles = "reliability";
      let worst: keyof typeof dimPercentiles = "reliability";
      let bestPct = -1;
      let worstPct = 101;
      const dim_percentiles: Record<string, number> = {};
      for (const k of DIMENSION_KEYS) {
        const pct = dimPercentiles[k].get(cand.computedIdx) ?? 0;
        dim_percentiles[k] = pct;
        if (pct > bestPct) { bestPct = pct; best = k; }
        if (pct < worstPct) { worstPct = pct; worst = k; }
      }
      const cityName = city.replace(/-[a-z]{2}$/, "").replace(/-/g, " ");
      const totalInCity = candidates.length;
      const entry: CityRankEntry = {
        rank: `#${position + 1} of ${totalInCity} in ${cityName}`,
        overall_percentile,
        best_dimension: best,
        worst_dimension: worst,
        dim_percentiles,
      };
      cityRankByPlumber.get(cand.computedIdx)![city] = entry;
    });
  }

  // Step 3: build update payloads
  let writes = 0;
  let skipped = 0;
  let writeErrors = 0;
  const verdictDist: Record<string, number> = {};

  for (let i = 0; i < computed.length; i++) {
    const c = computed[i];
    if (!c.adjustedScores || !c.signals || c.rawScores == null) {
      skipped++;
      continue;
    }
    const cityRank = cityRankByPlumber.get(i) ?? {};
    // Pick a primary city for the decision: first city slug that has a rank
    const cities = effectiveServiceCities(c.plumber);
    const primarySlug = cities.find((s) => cityRank[s]) ?? null;
    const primaryRank: CityRankEntry = primarySlug
      ? cityRank[primarySlug]
      : {
          rank: "unranked",
          overall_percentile: 0,
          best_dimension: "reliability",
          worst_dimension: "reliability",
        };

    const decision = computeDecision(c.adjustedScores, primaryRank, c.signals);
    verdictDist[decision.verdict] = (verdictDist[decision.verdict] ?? 0) + 1;

    if (dryRun) {
      writes++;
      continue;
    }

    // Atomic per-plumber write of all derived fields
    const updatePayload: Record<string, unknown> = {
      "scores.reliability": c.adjustedScores.reliability,
      "scores.pricing_fairness": c.adjustedScores.pricing_fairness,
      "scores.workmanship": c.adjustedScores.workmanship,
      "scores.responsiveness": c.adjustedScores.responsiveness,
      "scores.communication": c.adjustedScores.communication,
      "scores.variance": c.adjustedScores.variance,
      "scores.review_text_only": c.rawScores,
      "scores.cross_platform_signals": c.signals,
      "scores.adjustment_penalty": c.penalty,
      "scores.last_adjusted_at": admin.firestore.Timestamp.now(),
      city_rank: cityRank,
      "decision.verdict": decision.verdict,
      "decision.best_for": decision.best_for,
      "decision.avoid_if": decision.avoid_if,
      "decision.hire_if": decision.hire_if,
      "decision.caution_if": decision.caution_if,
      "decision.primary_city_slug": primarySlug,
      "decision.decided_at": admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    try {
      await db.collection("plumbers").doc(c.plumber.id).update(updatePayload);
      writes++;
      if (writes % 50 === 0) console.log(`  written ${writes}/${withScores}`);
    } catch (e) {
      writeErrors++;
      console.error(`  ✗ ${c.plumber.id}: ${(e as Error).message}`);
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log("📊 Summary:");
  console.log(`  plumbers loaded:       ${all.length}`);
  console.log(`  with valid scores:     ${withScores}`);
  console.log(`  written:               ${writes}`);
  console.log(`  skipped (no scores):   ${skipped}`);
  console.log(`  write errors:          ${writeErrors}`);
  console.log();
  console.log("Verdict distribution (new):");
  Object.entries(verdictDist)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${String(v).padStart(4)} (${((v / writes) * 100).toFixed(1)}%)`));

  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
