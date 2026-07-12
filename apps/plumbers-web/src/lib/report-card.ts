/**
 * Pure computation layer behind PlumberReportCard (02 §3.2 zones A–H).
 * Everything a card renders is derived here from the committed JSON so the
 * render layer stays declarative and every displayed number is defensible.
 *
 * TIER MAPPING (documented per the build spec):
 *   Primary signal — decision.verdict (the decision engine's defensible
 *   verdict, 02 §3.4 maps tiers 1:1 onto it):
 *     strong_hire                  → "top"  (Our top picks, green)
 *     conditional_hire | caution   → "caveat" (Worth a look — with caveats, amber)
 *     avoid                        → "avoid" (We'd keep looking, red)
 *   Fallback when decision is missing — synthesis.score bands (the same
 *   0–100 editorial score that feeds ranking; never displayed on cards):
 *     >= 80 → top · 55–79 → caveat · < 55 → avoid
 *   (synthesis.trustLevel is NOT used: in current data it is uniformly
 *   "high" and carries no discrimination.)
 */

import { calculateDistance } from "./geo";
import type {
  SynthesizedPlumber,
  PlumberReview,
} from "./plumber-data";

export type CardTier = "top" | "caveat" | "avoid";

export interface TierInfo {
  tier: CardTier;
  /** Chip label rendered next to the business name. */
  chipLabel: string;
}

export function cardTier(p: SynthesizedPlumber): TierInfo {
  const verdict = p.decision?.verdict;
  let tier: CardTier;
  if (verdict === "strong_hire") tier = "top";
  else if (verdict === "conditional_hire" || verdict === "caution") tier = "caveat";
  else if (verdict === "avoid") tier = "avoid";
  else {
    const s = p.synthesis?.score ?? 0;
    tier = s >= 80 ? "top" : s >= 55 ? "caveat" : "avoid";
  }
  const chipLabel =
    tier === "top" ? "Top pick" : tier === "caveat" ? "Caveats apply" : "We'd call someone else first";
  return { tier, chipLabel };
}

// ---------------------------------------------------------------------------
// Market ranking order — SINGLE DEFINITION shared by the market page and the
// profile page's rank line / compare strip, so "#3 of 12" can never disagree
// between the two surfaces.
// ---------------------------------------------------------------------------

export const MAX_RANKED = 15;

/** Ranked = synthesis + at least one attributed evidence quote (02 §6). */
export function splitRanked(plumbers: SynthesizedPlumber[]): {
  ranked: SynthesizedPlumber[];
  unranked: SynthesizedPlumber[];
} {
  const rankable = plumbers.filter(
    (p) => p.synthesis && (p.evidence_quotes?.length ?? 0) >= 1,
  );
  const ranked = rankable.slice(0, MAX_RANKED);
  const rankedIds = new Set(ranked.map((p) => p.placeId));
  return { ranked, unranked: plumbers.filter((p) => !rankedIds.has(p.placeId)) };
}

/** Display order: tier groups (top → caveat → avoid), editorial order within. */
export function tierGroups(
  ranked: SynthesizedPlumber[],
): { tier: CardTier; plumbers: SynthesizedPlumber[] }[] {
  const groups: Record<CardTier, SynthesizedPlumber[]> = { top: [], caveat: [], avoid: [] };
  for (const p of ranked) groups[cardTier(p).tier].push(p);
  return (["top", "caveat", "avoid"] as CardTier[])
    .filter((t) => groups[t].length > 0)
    .map((t) => ({ tier: t, plumbers: groups[t] }));
}

export const TIER_HEADINGS: Record<
  CardTier,
  { heading: string; sub: string; tone: "good" | "warn" | "bad" }
> = {
  top: {
    heading: "Our top picks",
    sub: "Consistent evidence of showing up, honest pricing, and work that lasts",
    tone: "good",
  },
  caveat: {
    heading: "Worth a look — with caveats",
    sub: "Real strengths, but read the concerns first",
    tone: "warn",
  },
  avoid: {
    heading: "We'd keep looking",
    sub: "The average rating hides complaint patterns we can't ignore",
    tone: "bad",
  },
};

// ---------------------------------------------------------------------------
// Rating mix — computed strictly over the analyzed review set we hold (C10).
// ---------------------------------------------------------------------------

export interface RatingMixData {
  /** counts[0] = 1★ … counts[4] = 5★ */
  counts: [number, number, number, number, number];
  /** Size of the analyzed set the bars describe. */
  analyzed: number;
  /** True when analyzed < 10 → render the small-sample caveat. */
  smallSample: boolean;
  /**
   * True when the analyzed sample disagrees sharply with the Google average
   * (>=30% of the sample is <=2★ while Google shows >=4.5) — render the
   * red disagreement note.
   */
  disagreesWithAverage: boolean;
}

export function ratingMix(p: SynthesizedPlumber): RatingMixData | null {
  const reviews = (p.reviews ?? []).filter(
    (r) => typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5,
  );
  if (reviews.length === 0) return null;
  const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const r of reviews) counts[Math.round(r.rating) - 1]++;
  const analyzed = reviews.length;
  const lowShare = (counts[0] + counts[1]) / analyzed;
  return {
    counts,
    analyzed,
    smallSample: analyzed < 10,
    disagreesWithAverage:
      analyzed >= 10 && lowShare >= 0.3 && (p.googleRating ?? 0) >= 4.5,
  };
}

// ---------------------------------------------------------------------------
// Evidence — counted strengths & concerns from the cited synthesis form.
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  text: string;
  /** Number of analyzed reviews supporting the claim (0 = uncounted claim). */
  supportCount: number;
  severity: "strength" | "concern" | "redflag";
}

interface EvidencedClaimLike {
  text: string;
  supporting_review_ids?: string[];
}

function evidencedList(p: SynthesizedPlumber, key: string): EvidencedClaimLike[] {
  const syn = p.synthesis as unknown as Record<string, unknown> | null;
  const v = syn?.[key];
  return Array.isArray(v) ? (v as EvidencedClaimLike[]) : [];
}

/** Filter out pipeline placeholder lines like "Not enough data to …". */
function isRealClaim(text: string): boolean {
  return !/^(not enough|insufficient) (data|evidence|reviews)/i.test(text.trim());
}

export interface CardEvidence {
  strengths: EvidenceItem[];
  concerns: EvidenceItem[];
  /** Concerns column renders BEFORE strengths when red flags exist (02 §3.2 E). */
  concernForward: boolean;
}

export function cardEvidence(p: SynthesizedPlumber, max = 3): CardEvidence {
  const syn = p.synthesis;
  const strengths: EvidenceItem[] = [];
  const concerns: EvidenceItem[] = [];

  const strengthsEv = evidencedList(p, "strengthsEvidence");
  if (strengthsEv.length > 0) {
    for (const c of strengthsEv) {
      if (!c.text || !isRealClaim(c.text)) continue;
      strengths.push({
        text: c.text,
        supportCount: c.supporting_review_ids?.length ?? 0,
        severity: "strength",
      });
    }
  } else {
    for (const s of syn?.strengths ?? []) {
      if (isRealClaim(s)) strengths.push({ text: s, supportCount: 0, severity: "strength" });
    }
  }

  // Red flags first (sort-first rule), then weaknesses.
  const redEv = evidencedList(p, "redFlagsEvidence");
  const redTexts = redEv.length > 0 ? redEv : (syn?.redFlags ?? []).map((t) => ({ text: t }));
  for (const c of redTexts) {
    if (!c.text || !isRealClaim(c.text)) continue;
    concerns.push({
      text: c.text,
      supportCount: (c as EvidencedClaimLike).supporting_review_ids?.length ?? 0,
      severity: "redflag",
    });
  }
  const weakEv = evidencedList(p, "weaknessesEvidence");
  const weakTexts = weakEv.length > 0 ? weakEv : (syn?.weaknesses ?? []).map((t) => ({ text: t }));
  for (const c of weakTexts) {
    if (!c.text || !isRealClaim(c.text)) continue;
    concerns.push({
      text: c.text,
      supportCount: (c as EvidencedClaimLike).supporting_review_ids?.length ?? 0,
      severity: "concern",
    });
  }

  return {
    strengths: strengths.slice(0, max),
    concerns: concerns.slice(0, max),
    concernForward: concerns.some((c) => c.severity === "redflag"),
  };
}

// ---------------------------------------------------------------------------
// Quote pair — verbatim, attributed, or the honest absence (02 §3.2 F).
// ---------------------------------------------------------------------------

export interface AttributedQuote {
  text: string;
  author: string;
  /** Star rating the reviewer gave with this review. */
  rating: number | null;
  /** Display label: Google / Yelp / BBB / Angi. */
  sourceLabel: string;
  /** e.g. "Jun 2026" — null when the platform date is unavailable. */
  dateLabel: string | null;
}

export interface QuotePairData {
  positive: AttributedQuote | null;
  negative: AttributedQuote | null;
  /** Rendered when negative === null: honest-absence copy with the analyzed count. */
  absenceNote: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  "google-places-initial": "Google",
  yelp: "Yelp",
  bbb: "BBB",
  angi: "Angi",
};

export function sourceLabel(source: string | undefined | null): string | null {
  if (!source) return null;
  return SOURCE_LABELS[source.toLowerCase()] ?? null;
}

export function formatMonthYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Verbatim-or-ellipsized trim at a word boundary (quotes may only be trimmed with ellipses). */
function trimQuote(text: string, maxLen = 260): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : maxLen)} …`;
}

function reviewToQuote(r: PlumberReview): AttributedQuote | null {
  const label = sourceLabel(r.source ?? null);
  if (!r.text || !r.author || !label) return null;
  return {
    text: trimQuote(r.text),
    author: r.author,
    rating: typeof r.rating === "number" ? r.rating : null,
    sourceLabel: label,
    dateLabel: formatMonthYear(r.time),
  };
}

function newestFirst(reviews: PlumberReview[]): PlumberReview[] {
  return [...reviews].sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""));
}

/**
 * Quote pair selection (02 §3.2 F): most recent >=4★ and most recent <=2★
 * from the analyzed set, fully attributed or not rendered at all. When
 * synthesis.topQuote/worstQuote match an analyzed review, that review is
 * preferred (its attribution is recovered from the review record).
 * Falls back to attributed evidence_quotes when the review sample is empty.
 */
export function quotePair(p: SynthesizedPlumber): QuotePairData {
  const reviews = (p.reviews ?? []).filter((r) => r.text && r.author);
  const byRecency = newestFirst(reviews);

  const matchSyn = (needle: string | null | undefined): PlumberReview | undefined => {
    if (!needle) return undefined;
    const n = needle.trim().toLowerCase().slice(0, 80);
    if (n.length < 15) return undefined;
    return reviews.find((r) => r.text.toLowerCase().includes(n));
  };

  let positive: AttributedQuote | null = null;
  let negative: AttributedQuote | null = null;

  const topMatch = matchSyn(p.synthesis?.topQuote);
  if (topMatch && topMatch.rating >= 4) positive = reviewToQuote(topMatch);
  if (!positive) {
    for (const r of byRecency) {
      if (r.rating >= 4 && r.text.trim().length >= 20) {
        positive = reviewToQuote(r);
        if (positive) break;
      }
    }
  }

  const worstMatch = matchSyn(p.synthesis?.worstQuote);
  if (worstMatch && worstMatch.rating <= 3) negative = reviewToQuote(worstMatch);
  if (!negative) {
    for (const r of byRecency) {
      if (r.rating <= 2 && r.text.trim().length >= 15) {
        negative = reviewToQuote(r);
        if (negative) break;
      }
    }
  }
  // Most-critical fallback: a 3★ counts as the most critical take when no 1–2★ exists.
  if (!negative) {
    for (const r of byRecency) {
      if (r.rating === 3 && r.text.trim().length >= 15) {
        negative = reviewToQuote(r);
        if (negative) break;
      }
    }
  }

  // Evidence-quote fallback when the committed review sample is empty/thin.
  if (!positive || !negative) {
    for (const q of p.evidence_quotes ?? []) {
      const label = sourceLabel(q.source);
      if (!q.quote || !q.author_name || !label) continue;
      const quote: AttributedQuote = {
        text: trimQuote(q.quote),
        author: q.author_name,
        rating: typeof q.rating === "number" ? q.rating : null,
        sourceLabel: label,
        dateLabel: formatMonthYear(q.published_at),
      };
      if (!positive && (q.rating ?? 0) >= 4) positive = quote;
      else if (!negative && q.rating != null && q.rating <= 2) negative = quote;
    }
  }

  const analyzed = reviews.length;
  const absenceNote =
    negative == null
      ? analyzed > 0
        ? `No critical reviews among the ${analyzed} we analyzed — there is nothing negative to quote yet.`
        : "We haven't analyzed enough of this plumber's reviews to quote a critical take."
      : null;

  return { positive, negative, absenceNote };
}

// ---------------------------------------------------------------------------
// Facts, provenance, distance
// ---------------------------------------------------------------------------

/** Number of reviews the pipeline actually read for this plumber. */
export function reviewsReadCount(p: SynthesizedPlumber): number {
  return Math.max(p.scores?.review_count_used ?? 0, p.reviews?.length ?? 0);
}

export function newestReviewLabel(p: SynthesizedPlumber): string | null {
  const newest = (p.reviews ?? [])
    .map((r) => r.time)
    .filter(Boolean)
    .sort()
    .pop();
  return formatMonthYear(newest ?? null);
}

export function distanceMiles(
  p: SynthesizedPlumber,
  lat: number,
  lng: number,
): number | null {
  if (!p.location?.lat || !p.location?.lng) return null;
  return calculateDistance(lat, lng, p.location.lat, p.location.lng);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
}

export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const d = digits.length === 10 ? `1${digits}` : digits;
  return `tel:+${d}`;
}

/**
 * 24-hour honesty pair (04 §5): is24Hour is always a LISTING claim (their
 * Google hours), never our test. Corroboration = the synthesis found actual
 * after-hours evidence in the review text.
 */
export function emergencyHonesty(p: SynthesizedPlumber): string | null {
  if (!p.is24Hour) return null;
  const syn = p.synthesis;
  const corroborated =
    (syn?.emergencyReadiness === "high" || syn?.emergencyReadiness === "medium") &&
    !!syn?.emergencyNotes;
  return corroborated
    ? "Lists 24-hour service on its Google profile — and reviewers describe after-hours calls."
    : "Advertises 24-hour service on its Google profile — no reviews we analyzed mention after-hours response either way.";
}
