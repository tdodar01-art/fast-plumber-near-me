/**
 * Plumber signals — pure resolver that turns a plumber's numeric scores,
 * decision, reviewSynthesis, and BBB data into a typed list of visual
 * "chips" for display on the card and detail page.
 *
 * Called from PlumberCard + the detail page. No side effects, no React
 * imports — this file is unit-testable and framework-agnostic so the exact
 * same resolver runs at build time (server-rendered cards) and client time
 * (filtered views, sort toggles, etc.).
 *
 * Design principles:
 *   1. Honesty: if a plumber has ANY flag, the most severe flag ALWAYS
 *      takes slot 1 of the top-N view. The user must see concerns first.
 *   2. Priority is numeric 1-10, higher = more impactful. Flags generally
 *      outrank excels at equal priorities.
 *   3. Thresholds are shared with scoring.ts so the sort ceilings, badge
 *      gates, and UI flags all agree.
 */

import type { Plumber } from "./types";
import type { DimensionKey, SpecialtyKey } from "./decision-engine";

/**
 * Accept either the Firestore-shape Plumber (with `reviewSynthesis` field)
 * or the JSON-shape SynthesizedPlumber (with `synthesis` field). The
 * detail page loads from the static JSON, the city pages load from
 * Firestore, but both feed into the same visual components — so the
 * resolver normalizes at the edge.
 *
 * Structurally typed to just the fields this module actually reads, so
 * both Plumber and SynthesizedPlumber satisfy it without casts.
 */
export type PlumberLike = {
  scores?: Plumber["scores"];
  decision?: Plumber["decision"];
  city_rank?: Plumber["city_rank"];
  evidence_quotes?: Plumber["evidence_quotes"];
  /** Firestore-shape narrative (Plumber.reviewSynthesis) */
  reviewSynthesis?: Plumber["reviewSynthesis"];
  /** JSON-shape narrative (SynthesizedPlumber.synthesis) */
  synthesis?: Plumber["reviewSynthesis"] | unknown;
  googleRating?: number | null;
  yelpRating?: number | null;
  is24Hour?: boolean;
  status?: string;
  bbb?: unknown;
};

function getSynthesis(plumber: PlumberLike): Plumber["reviewSynthesis"] | null {
  return (plumber.reviewSynthesis ?? (plumber.synthesis as Plumber["reviewSynthesis"]) ?? null) as
    | Plumber["reviewSynthesis"]
    | null;
}

// ---------------------------------------------------------------------------
// Thresholds (exported so tests + other callers stay in sync)
// ---------------------------------------------------------------------------

/** A dimension score below this threshold triggers a "flag" signal. */
export const FLAG_THRESHOLD = 60;
/** A dimension score at or above this threshold triggers an "excel" signal. */
export const EXCEL_THRESHOLD = 80;
/** A specialty_strength at or above this threshold triggers a specialty-excel signal. */
export const SPECIALTY_EXCEL_THRESHOLD = 85;
/** Variance at or above this threshold triggers an "inconsistent" flag. */
export const VARIANCE_HIGH = 25;
/** Variance below this threshold + good mean triggers a "consistent" excel. */
export const VARIANCE_LOW = 10;
/** BBB complaints in past 3 years at or above this number triggers a concern. */
export const BBB_COMPLAINTS_3YR_CONCERN = 10;
/** BBB complaints in past 12 months at or above this number triggers a concern. */
export const BBB_COMPLAINTS_12MO_CONCERN = 5;
/** BBB years in business at or above this number triggers a tenure info chip. */
export const BBB_LONG_ESTABLISHED = 20;
/** review_count_used below this number triggers a small-sample warning. */
export const SMALL_SAMPLE_THRESHOLD = 10;
/** Google minus Yelp rating gap above this value triggers a platform-mismatch flag. */
export const PLATFORM_GAP_STARS = 1.0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignalKind = "excel" | "flag" | "info" | "seal";

export type Signal = {
  /** Stable identifier for this signal (used for React keys, dedup). */
  id: string;
  kind: SignalKind;
  /** 1-10, higher = shown earlier in top-N. */
  priority: number;
  /** Short label for the chip / tooltip header. */
  label: string;
  /** Longer explainer for tooltip body / detail drawer. */
  detail: string;
  /** Path to the icon PNG under /public. */
  icon: string;
  /** Optional review quote supporting this signal. */
  evidence?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function icon(name: string): string {
  return `/icons/signals/${name}.png`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

const DIM_LABELS: Record<DimensionKey, string> = {
  reliability: "Reliability",
  pricing_fairness: "Pricing fairness",
  workmanship: "Workmanship",
  responsiveness: "Responsiveness",
  communication: "Communication",
};

const DIM_ICON_SLUGS: Record<DimensionKey, string> = {
  reliability: "reliability",
  pricing_fairness: "pricing",
  workmanship: "workmanship",
  responsiveness: "responsiveness",
  communication: "communication",
};

// ---------------------------------------------------------------------------
// Resolvers (one per input source)
// ---------------------------------------------------------------------------

function resolveDimensionSignals(plumber: PlumberLike): Signal[] {
  const out: Signal[] = [];
  const s = plumber.scores;
  if (!s) return out;

  for (const dim of Object.keys(DIM_LABELS) as DimensionKey[]) {
    const score = num((s as unknown as Record<string, unknown>)[dim]);
    if (score == null) continue;
    const label = DIM_LABELS[dim];
    const slug = DIM_ICON_SLUGS[dim];
    const evidence = plumber.evidence_quotes?.find(
      (q) => q.dimension === dim,
    )?.quote;

    if (score < FLAG_THRESHOLD) {
      out.push({
        id: `dim-${dim}-flag`,
        kind: "flag",
        // Lower scores = higher priority. Score 30 → priority 9, 50 → priority 7.
        priority: Math.min(10, Math.max(5, 10 - Math.floor(score / 10))),
        label: `${label} concerns`,
        detail: `${label} score: ${score}/100 — below the 60 threshold based on review analysis`,
        icon: icon(`${slug}-flag`),
        evidence,
      });
    } else if (score >= EXCEL_THRESHOLD) {
      out.push({
        id: `dim-${dim}-excel`,
        kind: "excel",
        // Higher scores = higher priority. Score 90 → priority 7, 100 → priority 8.
        priority: Math.min(8, 3 + Math.floor((score - EXCEL_THRESHOLD) / 5)),
        label: `Strong ${label.toLowerCase()}`,
        detail: `${label} score: ${score}/100 — reviews consistently support this`,
        icon: icon(`${slug}-excel`),
        evidence,
      });
    }
  }
  return out;
}

function resolveVarianceSignals(plumber: PlumberLike): Signal[] {
  const s = plumber.scores;
  if (!s) return [];
  const variance = num(s.variance);
  if (variance == null) return [];

  const dims: DimensionKey[] = [
    "reliability",
    "pricing_fairness",
    "workmanship",
    "responsiveness",
    "communication",
  ];
  const mean =
    dims.reduce(
      (sum, d) => sum + (num((s as unknown as Record<string, unknown>)[d]) ?? 0),
      0,
    ) / dims.length;

  if (variance >= VARIANCE_HIGH) {
    return [{
      id: "variance-flag",
      kind: "flag",
      priority: 6,
      label: "Hit-or-miss results",
      detail: `Service quality varies substantially between visits (variance ${Math.round(variance)}). Outcomes depend on which tech you get.`,
      icon: icon("variance-flag"),
    }];
  }
  if (variance < VARIANCE_LOW && mean >= 70) {
    return [{
      id: "consistency-excel",
      kind: "excel",
      priority: 6,
      label: "Consistent quality",
      detail: `Consistent service across reviews (variance ${Math.round(variance)}). What one customer gets, the next customer gets too.`,
      icon: icon("consistency-excel"),
    }];
  }
  return [];
}

function resolveSampleSignals(plumber: PlumberLike): Signal[] {
  const s = plumber.scores;
  if (!s) return [];
  const used = num(s.review_count_used);
  if (used == null) return [];
  if (used < SMALL_SAMPLE_THRESHOLD) {
    return [{
      id: "sample-warning",
      kind: "info",
      priority: 4,
      label: "Limited review sample",
      detail: `Only ${used} review${used === 1 ? "" : "s"} analyzed — signals are tentative until more data is pulled.`,
      icon: icon("sample-warning"),
    }];
  }
  return [];
}

function resolveDecisionSignals(plumber: PlumberLike): Signal[] {
  const out: Signal[] = [];
  // Emit the verdict itself as the highest-priority chip — this is the
  // headline signal. Replaces the standalone VerdictSeal component; the
  // verdict now flows through SignalRow like any other signal. Priority
  // 10 ensures it always appears in slot 1 (above the flag-first rule
  // in pickTop, which also peaks at priority 10 for major flags — tied
  // values fall back to kind weight where verdicts/seals are ranked
  // highest to win the tie).
  const verdict = plumber.decision?.verdict;
  if (verdict) {
    const VERDICT_LABELS = {
      strong_hire: { label: "Top Pick", detail: "Reviews confirm strong performance across reliability, workmanship, pricing, and response. Safe first call." },
      conditional_hire: { label: "Solid Choice", detail: "Good in most areas with minor caveats. Worth calling — review the specifics below." },
      caution: { label: "Use Caution", detail: "Reviews reveal real concerns in at least one area. Get a written quote and consider alternatives." },
      avoid: { label: "Avoid", detail: "Multiple material concerns across reviews. Consider alternatives before calling." },
    } as const;
    const cfg = VERDICT_LABELS[verdict];
    const iconSlug =
      verdict === "strong_hire" ? "verdict-strong-hire" :
      verdict === "conditional_hire" ? "verdict-conditional" :
      verdict === "caution" ? "verdict-caution" :
      "verdict-avoid";
    out.push({
      id: `verdict-${verdict}`,
      // Verdicts render with their own color (gold/green/amber/red); "seal"
      // kind ensures SignalChip applies the right styling.
      kind: "seal",
      priority: 10,
      label: cfg.label,
      detail: cfg.detail,
      icon: icon(iconSlug),
    });
  }

  const rank = plumber.city_rank;
  if (!rank) return out;

  // Extra flavor chip for truly top-ranked plumbers (90th percentile in city)
  // — distinct from the verdict chip above.
  for (const key of Object.keys(rank)) {
    const entry = rank[key];
    if (entry?.overall_percentile != null && entry.overall_percentile >= 90) {
      out.push({
        id: `rank-top-${key}`,
        kind: "excel",
        priority: 7,
        label: "Top pick in this city",
        detail: entry.rank ?? "",
        icon: icon("verdict-strong-hire"),
      });
      break; // only one
    }
  }
  return out;
}

function resolveSynthesisSignals(plumber: PlumberLike): Signal[] {
  const out: Signal[] = [];
  const rs = getSynthesis(plumber);
  if (!rs) return out;

  // Platform discrepancy — honesty signal when Google and Yelp disagree.
  if (
    (rs as { platformDiscrepancy?: string | null }).platformDiscrepancy
  ) {
    out.push({
      id: "platform-mismatch",
      kind: "flag",
      priority: 7,
      label: "Ratings don't agree",
      detail:
        (rs as { platformDiscrepancy?: string }).platformDiscrepancy ??
        "Google and Yelp scores diverge meaningfully — look at both before deciding.",
      icon: icon("platform-mismatch"),
    });
  }

  // Emergency readiness.
  const er = (rs as { emergencyReadiness?: string }).emergencyReadiness;
  if (er === "high" && plumber.is24Hour) {
    out.push({
      id: "24-7-verified",
      kind: "excel",
      priority: 8,
      label: "24/7 verified",
      detail:
        (rs as { emergencyNotes?: string }).emergencyNotes ??
        "Business hours and review signals both confirm after-hours availability.",
      icon: icon("responsiveness-excel"),
    });
  } else if (er === "low") {
    out.push({
      id: "emergency-weak",
      kind: "flag",
      priority: 7,
      label: "Slow for emergencies",
      detail:
        (rs as { emergencyNotes?: string }).emergencyNotes ??
        "Reviewers report long waits for urgent issues.",
      icon: icon("responsiveness-flag"),
    });
  }

  // Premium pricing + any pricing-related red flag = concern chip.
  const pricingTier = (rs as { pricingTier?: string }).pricingTier;
  const redFlags = Array.isArray(rs.redFlags) ? rs.redFlags : [];
  const pricingRelated = redFlags.some((f) =>
    /price|pric|quote|estimate|upsell|surpris|charge|fee/i.test(f),
  );
  if (pricingTier === "premium" && pricingRelated) {
    out.push({
      id: "premium-with-concerns",
      kind: "flag",
      priority: 8,
      label: "Premium pricing",
      detail:
        "Plumber bills at the premium tier AND reviewers cite pricing concerns. Get a written quote and a competing bid.",
      icon: icon("pricing-flag"),
    });
  }

  return out;
}

function resolveBbbSignals(plumber: PlumberLike): Signal[] {
  const out: Signal[] = [];
  const bbb = (plumber as { bbb?: unknown }).bbb as
    | {
        accredited?: boolean;
        rating?: string | null;
        complaintsPast3Years?: number | null;
        complaintsPast12Months?: number | null;
        yearsInBusiness?: number | null;
      }
    | undefined;
  if (!bbb) return out;

  if (bbb.accredited && bbb.rating === "A+") {
    out.push({
      id: "bbb-a-plus",
      kind: "excel",
      priority: 6,
      label: "BBB A+ accredited",
      detail: `Better Business Bureau rated A+ and accredited${bbb.yearsInBusiness ? ` — ${bbb.yearsInBusiness} years in business` : ""}.`,
      icon: icon("bbb-accredited"),
    });
  }

  if (
    (bbb.complaintsPast3Years ?? 0) >= BBB_COMPLAINTS_3YR_CONCERN
  ) {
    out.push({
      id: "bbb-complaints-3yr",
      kind: "flag",
      priority: 8,
      label: "BBB complaint history",
      detail: `${bbb.complaintsPast3Years} BBB complaints filed in the past 3 years — worth reviewing before booking.`,
      icon: icon("bbb-concerns"),
    });
  } else if (
    (bbb.complaintsPast12Months ?? 0) >= BBB_COMPLAINTS_12MO_CONCERN
  ) {
    out.push({
      id: "bbb-complaints-12mo",
      kind: "flag",
      priority: 7,
      label: "Recent BBB complaints",
      detail: `${bbb.complaintsPast12Months} BBB complaints in the past 12 months.`,
      icon: icon("bbb-concerns"),
    });
  }

  if ((bbb.yearsInBusiness ?? 0) >= BBB_LONG_ESTABLISHED && !bbb.accredited) {
    out.push({
      id: "bbb-tenure",
      kind: "info",
      priority: 3,
      label: `${bbb.yearsInBusiness}+ years in business`,
      detail: "Long-established business per BBB records.",
      icon: icon("bbb-accredited"),
    });
  }

  return out;
}

function resolvePlatformRatingGap(plumber: PlumberLike): Signal[] {
  const g = num(plumber.googleRating);
  const y = num(plumber.yelpRating);
  if (g == null || y == null) return [];
  const gap = Math.abs(g - y);
  if (gap < PLATFORM_GAP_STARS) return [];

  // Only emit if reviewSynthesis didn't already carry a platformDiscrepancy chip
  // (see resolveSynthesisSignals). We let the synthesis version win because
  // it has AI-written context; this is a fallback for older data.
  const rs = getSynthesis(plumber);
  if ((rs as { platformDiscrepancy?: string | null } | null)?.platformDiscrepancy) {
    return [];
  }
  return [{
    id: "platform-gap-raw",
    kind: "flag",
    priority: 6,
    label: "Ratings gap",
    detail: `Google ${g.toFixed(1)}★ vs Yelp ${y.toFixed(1)}★ — ${gap.toFixed(1)}-star gap across platforms.`,
    icon: icon("platform-mismatch"),
  }];
}

function resolveSpecialtySignals(plumber: PlumberLike): Signal[] {
  const out: Signal[] = [];
  const s = plumber.scores;
  if (!s) return out;
  const specialty = (s.specialty_strength ?? {}) as Partial<
    Record<SpecialtyKey, number>
  >;
  const rs = getSynthesis(plumber);
  const services = (rs as { servicesMentioned?: Record<string, { count: number; avgRating: number; topQuote: string }> } | null)?.servicesMentioned ?? {};

  // Only emit specialty excels when BOTH the numeric score is high AND the
  // narrative data confirms reviewers actually mention it. Belt and
  // suspenders prevents "we have a score of 85 but nobody talks about it" noise.
  const SPECIALTY_NAMES: Partial<Record<SpecialtyKey, string>> = {
    water_heater: "Water heater work",
    drain: "Drain work",
    sewer: "Sewer line work",
    emergency: "Emergency response",
    repipe: "Repiping",
    remodel: "Remodel plumbing",
    toilet: "Toilet repair",
    fixture: "Fixture install",
    sump_pump: "Sump pump",
    gas_line: "Gas line work",
    slab_leak: "Slab leak",
    water_line: "Water line",
  };

  for (const [key, score] of Object.entries(specialty)) {
    if ((score ?? 0) < SPECIALTY_EXCEL_THRESHOLD) continue;
    // Require some narrative confirmation (at least 2 mentions in services).
    const svcMap = services as Record<string, { count: number }>;
    const narrativeMentions = Object.entries(svcMap).find(([k]) =>
      k.replace(/-/g, "_").startsWith(key.split("_")[0] ?? key),
    );
    if (!narrativeMentions || (narrativeMentions[1].count ?? 0) < 2) continue;

    out.push({
      id: `specialty-${key}-excel`,
      kind: "excel",
      priority: 5,
      label: `Strong: ${SPECIALTY_NAMES[key as SpecialtyKey] ?? key}`,
      detail: `Specialty score ${score}/100 for ${SPECIALTY_NAMES[key as SpecialtyKey] ?? key}, confirmed by ${narrativeMentions[1].count} reviewers.`,
      icon: icon("workmanship-excel"),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Produce the full list of signals for a plumber, sorted priority-desc.
 * Does NOT cap — callers pick how many to show.
 */
export function resolveSignals(plumber: PlumberLike): Signal[] {
  const signals: Signal[] = [
    ...resolveDimensionSignals(plumber),
    ...resolveVarianceSignals(plumber),
    ...resolveSampleSignals(plumber),
    ...resolveDecisionSignals(plumber),
    ...resolveSynthesisSignals(plumber),
    ...resolveBbbSignals(plumber),
    ...resolvePlatformRatingGap(plumber),
    ...resolveSpecialtySignals(plumber),
  ];

  // Dedup by id (multiple resolvers could theoretically produce the same).
  const seen = new Set<string>();
  const deduped = signals.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  // Sort priority desc. Ties break by kind weight: verdict seals outrank
  // flags (headline), flags outrank excels (honesty), excels outrank info.
  const kindWeight: Record<SignalKind, number> = {
    seal: 4,
    flag: 3,
    excel: 2,
    info: 1,
  };
  deduped.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return kindWeight[b.kind] - kindWeight[a.kind];
  });

  return deduped;
}

/**
 * Pick the top N signals to display.
 *
 * Slot rules:
 *  1. Verdict seal (if present) ALWAYS slot 1 — the user's headline
 *     question "is this plumber worth calling?" gets answered first.
 *  2. Most severe flag (if any) ALWAYS slot 2 — honesty principle, user
 *     cannot miss concerns even when excels outnumber them.
 *  3. Remaining slots fill priority-desc from the rest.
 */
export function pickTop(signals: Signal[], n = 3): Signal[] {
  if (n <= 0 || signals.length === 0) return [];

  const verdict = signals.find((s) => s.kind === "seal");
  const flags = signals.filter((s) => s.kind === "flag");

  const result: Signal[] = [];
  if (verdict) result.push(verdict);
  if (flags.length > 0 && !result.includes(flags[0])) {
    result.push(flags[0]);
  }

  // Fill remaining slots with priority-desc mix of everything not yet chosen.
  const remaining = signals.filter((s) => !result.includes(s));
  for (const s of remaining) {
    if (result.length >= n) break;
    result.push(s);
  }
  return result.slice(0, n);
}

/** Group signals by kind for structured display sections. */
export function groupByKind(signals: Signal[]): Record<SignalKind, Signal[]> {
  const out: Record<SignalKind, Signal[]> = {
    excel: [],
    flag: [],
    info: [],
    seal: [],
  };
  for (const s of signals) out[s.kind].push(s);
  return out;
}

/** Count signals by kind — used for quick UI checks like "has any flag". */
export function countByKind(signals: Signal[]): Record<SignalKind, number> {
  return {
    excel: signals.filter((s) => s.kind === "excel").length,
    flag: signals.filter((s) => s.kind === "flag").length,
    info: signals.filter((s) => s.kind === "info").length,
    seal: signals.filter((s) => s.kind === "seal").length,
  };
}
