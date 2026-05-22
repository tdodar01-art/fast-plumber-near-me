/**
 * Decision Layer rules engine — pure, deterministic, unit-testable.
 *
 * Input: aggregated dimension scores (0-100) + the plumber's rank entry for
 * the city being rendered.
 * Output: a DecisionCore (best_for, avoid_if, hire_if, caution_if, verdict).
 *
 * Evidence quotes are attached downstream by the scoring script, not here —
 * the engine stays free of raw review data so it's trivially testable and
 * deterministic across every rendered page.
 */

export const DIMENSION_KEYS = [
  "reliability",
  "pricing_fairness",
  "workmanship",
  "responsiveness",
  "communication",
] as const;

export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export type DimensionScores = Record<DimensionKey, number>;

export const SPECIALTY_KEYS = [
  "water_heater",
  "drain",
  "repipe",
  "emergency",
  "remodel",
  "sewer",
  "toilet",
  "fixture",
  "sump_pump",
  "gas_line",
  "slab_leak",
  "water_line",
] as const;

export type SpecialtyKey = (typeof SPECIALTY_KEYS)[number];

/** Display names for specialty keys — used by computeBestFor and service pages */
export const SPECIALTY_DISPLAY_NAMES: Record<SpecialtyKey, string> = {
  water_heater: "Water heater install/repair",
  drain: "Drain and sewer work",
  repipe: "Whole-house repiping",
  emergency: "Emergency and burst pipe repair",
  remodel: "Bathroom and kitchen remodel plumbing",
  sewer: "Sewer line repair and replacement",
  toilet: "Toilet repair and installation",
  fixture: "Faucet and fixture work",
  sump_pump: "Sump pump repair and installation",
  gas_line: "Gas line repair",
  slab_leak: "Slab leak detection and repair",
  water_line: "Water line repair and replacement",
};

export type SpecialtyStrength = Record<SpecialtyKey, number>;

/**
 * Service categories the synthesis pipeline extracts from review text.
 * Hyphenated slugs — distinct from the underscored SpecialtyKey used
 * for numeric specialty_strength scoring.
 */
export const SERVICE_CATEGORIES = [
  "burst-pipe",
  "flooding",
  "sewer",
  "gas-leak",
  "water-heater",
  "toilet",
  "sump-pump",
  "drain-cleaning",
  "water-line",
  "slab-leak",
  "garbage-disposal",
  "faucet-fixture",
  "backflow",
  "repiping",
  "water-softener",
  "bathroom-remodel",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export type ServiceMention = {
  count: number;
  avgRating: number;
  topQuote: string;
};

export type Scores = DimensionScores & {
  specialty_strength: SpecialtyStrength;
  variance: number;
  review_count_used: number;
  last_scored_at: string;
  /**
   * How the plumber was processed:
   * - "sonnet": full Claude Sonnet extraction + synthesis (the normal path)
   * - "manual-claude": parallel Claude subagents in place of Sonnet (no Anthropic API spend)
   * - "keyword_fallback": 1–2 reviews, keyword-only synthesis, no dimension scores
   * - "no_reviews": 0 reviews cached, nothing to synthesize
   *
   * Present from 2026-04-21 onward. Older records will not have this field.
   */
  method?: "sonnet" | "manual-claude" | "keyword_fallback" | "no_reviews";
};

export type CityRankEntry = {
  rank: string;
  overall_percentile: number;
  best_dimension: DimensionKey;
  worst_dimension: DimensionKey;
  /** Per-dimension percentile within this city (0-100). Added in Pass 2. */
  dim_percentiles?: Partial<Record<DimensionKey, number>>;
};

export type CityRank = Record<string, CityRankEntry>;

export type Verdict =
  | "strong_hire"
  | "conditional_hire"
  | "caution"
  | "avoid";

export type DecisionCore = {
  best_for: string[];
  avoid_if: string[];
  hire_if: string[];
  caution_if: string[];
  verdict: Verdict;
};

export type EvidenceQuote = {
  dimension: string;
  quote: string;
  review_id: string;
  /**
   * Attribution fields added 2026-05-22 to close the citation-integrity gap.
   * Populated from the source review at aggregation time — NOT extracted by
   * Claude — so they are guaranteed to come from a real cached review and
   * cannot be hallucinated. Older records may lack these fields; renderers
   * must treat them as optional and degrade gracefully.
   */
  source?: "google" | "yelp" | "angi" | "bbb" | string;
  author_name?: string | null;
  published_at?: string | null;
  rating?: number | null;
};

/**
 * A synthesis claim paired with the review_ids that support it. The Sonnet
 * synthesis prompt now returns strengths/weaknesses/redFlags in this shape;
 * the scoring pipeline stores both the structured form (for verification)
 * and a flat string[] form (backward compat with existing render layer).
 *
 * supporting_review_ids reference review docs in the reviews collection.
 * An empty array means the model was unable to ground the claim — those
 * are surfaced to the audit pipeline as "unverified claims".
 */
export type EvidencedClaim = {
  text: string;
  supporting_review_ids: string[];
};

export type Decision = DecisionCore & {
  evidence_quotes: EvidenceQuote[];
};

const STRENGTH_PHRASES: Record<DimensionKey, string> = {
  reliability: "a plumber who actually shows up when scheduled",
  pricing_fairness: "transparent, predictable pricing with no surprise fees",
  workmanship: "high-quality work that holds up over time",
  responsiveness: "fast same-day or after-hours response",
  communication: "clear communication and upfront explanations",
};

const WEAKNESS_PHRASES: Record<DimensionKey, string> = {
  reliability: "airtight scheduling and guaranteed arrival times",
  pricing_fairness: "rock-bottom prices with zero flexibility on the quote",
  workmanship: "warranty-grade work on a complex or high-stakes install",
  responsiveness: "guaranteed sub-hour response for true emergencies",
  communication: "detailed walkthroughs and written estimates before work starts",
};

/**
 * Cross-platform signal severity flags used by the verdict + adjustment
 * logic. Computed deterministically from review counts, ratings, and BBB
 * data. See `computeCrossPlatformSignals()` below.
 */
export type PlatformSeverity = "none" | "minor" | "major" | "severe";
export type BbbSeverity = "none" | "amber" | "red";

export type CrossPlatformSignals = {
  /** Google vs Yelp rating gap, sample-gated. */
  platform: PlatformSeverity;
  /** BBB complaint count normalized against total review volume. */
  bbb: BbbSeverity;
};

/**
 * Inputs that the cross-platform signal detector reads. Caller passes
 * a structurally-typed shape so this stays library-agnostic — works for
 * Firestore-shape Plumber and JSON-shape SynthesizedPlumber alike.
 */
export type CrossPlatformInput = {
  googleRating?: number | null;
  googleReviewCount?: number | null;
  yelpRating?: number | null;
  yelpReviewCount?: number | null;
  /**
   * The synthesizer's narrative discrepancy detection. When the synthesis
   * pass surfaces a Google/Yelp/BBB contradiction in prose, treat it as
   * MAJOR even when our raw rating-gap heuristic doesn't fire. The
   * synthesizer sees review TEXT for both platforms and catches things
   * a numeric gap misses (e.g. consistent billing-dispute themes on Yelp
   * absent from Google).
   */
  platformDiscrepancyText?: string | null;
  bbb?: {
    complaintsPast3Years?: number | null;
  } | null;
};

/**
 * Compute the cross-platform signal severity for a plumber. Pure function.
 *
 * Platform severity tiers (require ≥10 reviews on each side; otherwise the
 * gap isn't reliable enough to act on):
 *   - severe: gap ≥ 1.5 stars
 *   - major:  gap ≥ 1.0 stars  (also: synthesizer-detected discrepancy)
 *   - minor:  gap ≥ 0.7 stars
 *   - none:   below 0.7 stars OR insufficient sample
 *
 * BBB severity tiers (require ≥3 complaints absolute floor; below that we
 * never flag — small-shop noise):
 *   - red:   complaints/total_reviews ≥ 1.0%
 *   - amber: complaints/total_reviews ≥ 0.5%
 *   - none:  below 0.5%, missing data, or below absolute floor
 */
export function computeCrossPlatformSignals(
  input: CrossPlatformInput,
): CrossPlatformSignals {
  const g = input.googleRating;
  const y = input.yelpRating;
  const gn = input.googleReviewCount ?? 0;
  const yn = input.yelpReviewCount ?? 0;
  const totalRev = gn + yn;

  let platform: PlatformSeverity = "none";
  if (typeof g === "number" && typeof y === "number" && gn >= 10 && yn >= 10) {
    const gap = Math.abs(g - y);
    if (gap >= 1.5) platform = "severe";
    else if (gap >= 1.0) platform = "major";
    else if (gap >= 0.7) platform = "minor";
  }
  if (input.platformDiscrepancyText && (platform === "none" || platform === "minor")) {
    // Synthesizer-detected discrepancy is at least major-grade evidence.
    // platform is "none" | "minor" here (TS narrowed by the if condition);
    // promote to "major" unconditionally.
    platform = "major";
  }

  let bbb: BbbSeverity = "none";
  const c = input.bbb?.complaintsPast3Years;
  if (typeof c === "number" && c >= 3 && totalRev > 0) {
    const rate = c / totalRev;
    if (rate >= 0.01) bbb = "red";
    else if (rate >= 0.005) bbb = "amber";
  }

  return { platform, bbb };
}

/**
 * Penalty (in composite-score points) to apply to a plumber's raw
 * dimension scores given their cross-platform signals.
 *
 * Why deterministic + at-write-time, not at render: see commit message of
 * the architectural rework. Scores must reflect ALL signals, not just
 * review text. Render reads the stored verdict and trusts it.
 *
 * Tilted toward reliability + pricing? No — applied uniformly to all 5
 * dimensions because the goal is composite-level dampening; per-dimension
 * deductions get drowned out by the variance check downstream.
 *
 * Capped at 15 points to prevent stacking from producing unrecognizable
 * scores. A genuinely terrible plumber (Yelp 1-star vs Google 5-star
 * with 50 BBB complaints) should already have a low review-text composite.
 */
export function computeAdjustmentPenalty(signals: CrossPlatformSignals): number {
  const platPen = { none: 0, minor: 3, major: 6, severe: 10 }[signals.platform];
  const bbbPen = { none: 0, amber: 5, red: 10 }[signals.bbb];
  return Math.min(platPen + bbbPen, 15);
}

/**
 * Apply the cross-platform adjustment to raw review-text dimension scores.
 * Returns a new Scores object — does not mutate. Penalty is subtracted
 * uniformly from each dimension and clamped to [0, 100]. Variance is
 * preserved (it's a measure of consistency across reviews, unaffected
 * by cross-platform signals).
 *
 * The original raw scores are intended to be stored alongside as
 * `scores.review_text_only` for audit/debugging — see the rework script.
 */
export function applyAdjustment(scores: Scores, penalty: number): Scores {
  const adjusted: Scores = { ...scores };
  for (const k of DIMENSION_KEYS) {
    adjusted[k] = Math.max(0, Math.min(100, scores[k] - penalty));
  }
  return adjusted;
}

export function computeDecision(
  scores: Scores,
  cityRank: CityRankEntry,
  signals?: CrossPlatformSignals,
): DecisionCore {
  return {
    best_for: computeBestFor(scores),
    avoid_if: computeAvoidIf(scores, cityRank),
    hire_if: computeHireIf(scores),
    caution_if: computeCautionIf(scores),
    verdict: computeVerdict(scores, cityRank, signals),
  };
}

/** Mean of the 5 core dimension scores. */
export function overallComposite(scores: Scores): number {
  const dims = DIMENSION_KEYS.map((k) => scores[k]);
  return dims.reduce((a, b) => a + b, 0) / dims.length;
}

/**
 * Verdict thresholds — ABSOLUTE composite, not city percentile.
 *
 * The pre-rework version mapped percentile within city to verdict, which
 * crowned the cleanest mediocre plumber as "Top Pick" in mediocre cities.
 * Now: a plumber's verdict reflects their absolute quality across all
 * signals (review-text dimensions + cross-platform adjustment applied at
 * write time). City rank still exists and ships in `decision.primary_city`
 * but is purely a position indicator — not a quality bar.
 *
 * The signal-clean requirement on strong_hire encodes the chip→verdict
 * cap that previously lived at render time. A plumber with a major
 * platform discrepancy or red BBB rate cannot be strong_hire even if
 * their adjusted composite is ≥80.
 */
const COMPOSITE_STRONG_HIRE = 80;
const COMPOSITE_CONDITIONAL_HIRE = 70;
const COMPOSITE_CAUTION = 60;
const VARIANCE_STRONG_HIRE_MAX = 20;

export function computeVerdict(
  scores: Scores,
  // Kept in the signature for backward compat / future use (e.g. tie-breaks).
  // Verdict is now absolute, so cityRank no longer drives it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cityRank: CityRankEntry,
  signals?: CrossPlatformSignals,
): Verdict {
  const composite = overallComposite(scores);
  const hasMajorConcern =
    signals?.platform === "major" ||
    signals?.platform === "severe" ||
    signals?.bbb === "red";

  if (
    composite >= COMPOSITE_STRONG_HIRE &&
    scores.variance < VARIANCE_STRONG_HIRE_MAX &&
    !hasMajorConcern
  ) {
    return "strong_hire";
  }
  if (composite >= COMPOSITE_CONDITIONAL_HIRE) return "conditional_hire";
  if (composite >= COMPOSITE_CAUTION) return "caution";
  return "avoid";
}

export function computeBestFor(scores: Scores): string[] {
  const out: string[] = [];
  if (scores.reliability >= 85 && scores.responsiveness >= 80) {
    out.push("Emergency and same-day calls");
  }
  if (scores.pricing_fairness >= 85 && scores.workmanship >= 75) {
    out.push("Budget-conscious homeowners");
  }
  if (scores.workmanship >= 90 && scores.communication >= 85) {
    out.push("Complex installs and remodels");
  }
  // Check all specialty keys dynamically
  for (const key of SPECIALTY_KEYS) {
    if ((scores.specialty_strength[key] ?? 0) >= 85) {
      out.push(SPECIALTY_DISPLAY_NAMES[key]);
    }
  }
  return out;
}

export function computeAvoidIf(
  scores: Scores,
  cityRank?: CityRankEntry,
): string[] {
  const out: string[] = [];
  if (scores.pricing_fairness < 60) {
    out.push("You're highly price-sensitive");
  }
  if (scores.workmanship < 65) {
    out.push("You need this for a complex or high-stakes install");
  }
  // Relative rule: if pricing is in the bottom quartile for this city,
  // surface that better-priced options exist locally — even when the absolute
  // score is above the hard threshold.
  const pricingPct = cityRank?.dim_percentiles?.pricing_fairness;
  if (
    pricingPct !== undefined &&
    pricingPct <= 25 &&
    scores.pricing_fairness >= 60 // don't double up with the absolute rule
  ) {
    out.push("You can find better-priced options nearby");
  }
  return out;
}

export function computeCautionIf(scores: Scores): string[] {
  const out: string[] = [];
  const coveredDims = new Set<DimensionKey>();

  if (scores.variance > 25) {
    out.push("You need predictable, consistent service across every visit");
    // variance isn't a single dimension — no coveredDims entry
  }
  if (scores.communication < 60) {
    out.push("You want detailed upfront explanations");
    // When a hard rule for a dimension fires (here: communication < 60), mark
    // the dimension covered so the templated-weakness fill below doesn't also
    // emit its communication phrase. Prevents duplicate caution entries where
    // both the rule and the templated fill describe the same weakness. If you
    // remove this, every plumber with communication < 60 gets two nearly
    // identical caution bullets. Preserve the dedup.
    coveredDims.add("communication");
  }

  const weakest = rankDimensions(scores, "asc")
    .filter((d) => !coveredDims.has(d))
    .slice(0, 2);

  for (const dim of weakest) {
    out.push(`You need ${WEAKNESS_PHRASES[dim]}`);
  }

  return out;
}

export function computeHireIf(scores: Scores): string[] {
  const strongest = rankDimensions(scores, "desc").slice(0, 2);
  return strongest.map((dim) => `You need ${STRENGTH_PHRASES[dim]}`);
}

function rankDimensions(
  scores: Scores,
  order: "asc" | "desc",
): DimensionKey[] {
  const pairs: Array<[DimensionKey, number]> = DIMENSION_KEYS.map((k) => [
    k,
    scores[k],
  ]);
  pairs.sort((a, b) => (order === "desc" ? b[1] - a[1] : a[1] - b[1]));
  return pairs.map((p) => p[0]);
}
