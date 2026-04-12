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
] as const;

export type SpecialtyKey = (typeof SPECIALTY_KEYS)[number];

export type SpecialtyStrength = Record<SpecialtyKey, number>;

export type Scores = DimensionScores & {
  specialty_strength: SpecialtyStrength;
  variance: number;
  review_count_used: number;
  last_scored_at: string;
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

export function computeDecision(
  scores: Scores,
  cityRank: CityRankEntry,
): DecisionCore {
  return {
    best_for: computeBestFor(scores),
    avoid_if: computeAvoidIf(scores, cityRank),
    hire_if: computeHireIf(scores),
    caution_if: computeCautionIf(scores),
    verdict: computeVerdict(scores, cityRank),
  };
}

/** Mean of the 5 core dimension scores. */
export function overallComposite(scores: Scores): number {
  const dims = DIMENSION_KEYS.map((k) => scores[k]);
  return dims.reduce((a, b) => a + b, 0) / dims.length;
}

/**
 * Absolute floor: a plumber with an overall composite >= 65 cannot receive
 * "avoid". In a city of uniformly good plumbers, percentile ranking alone
 * would label the bottom half "avoid" even when every plumber has 4.8+ stars.
 * The floor caps the worst possible verdict at "caution" for plumbers whose
 * absolute quality is still reasonable.
 */
const AVOID_COMPOSITE_FLOOR = 65;

export function computeVerdict(
  scores: Scores,
  cityRank: CityRankEntry,
): Verdict {
  const p = cityRank.overall_percentile;
  if (p >= 80 && scores.variance < 20) return "strong_hire";
  if (p >= 60) return "conditional_hire";
  if (p >= 40) return "caution";
  // Absolute floor: demote "avoid" to "caution" if composite is strong enough
  if (overallComposite(scores) >= AVOID_COMPOSITE_FLOOR) return "caution";
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
  if (scores.specialty_strength.water_heater >= 85) {
    out.push("Water heater install/repair");
  }
  if (scores.specialty_strength.drain >= 85) {
    out.push("Drain and sewer work");
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
