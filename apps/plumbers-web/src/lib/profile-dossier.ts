/**
 * Pure computation layer behind the /plumber/[slug] dossier (03).
 * Everything the profile renders is derived here from the committed JSON —
 * NO page-side keyword re-derivation, badge matching, or upsell scanning
 * (03 §1 kill list). Claims come from the cited synthesis form; quotes come
 * from evidence_quotes and are attributed from cached-review fields, never
 * LLM-extracted (structurally hallucination-proof, 03 §6.5).
 */

import { calculateDistance } from "./geo";
import { getMarket, getMarkets, getMarketPlumbers, type Market } from "./markets";
import type { SynthesizedPlumber } from "./plumber-data";
import type { EvidenceQuote, DimensionKey } from "./decision-engine";
import { DIMENSION_KEYS } from "./decision-engine";
import {
  splitRanked,
  tierGroups,
  sourceLabel,
  formatMonthYear,
  reviewsReadCount,
  type AttributedQuote,
} from "./report-card";

// ---------------------------------------------------------------------------
// Verdict banner
// ---------------------------------------------------------------------------

export type VerdictTone = "good" | "warn" | "bad";

export interface VerdictInfo {
  /** Loud label, 03 §3.2 */
  label: string;
  /** Compact chip label (compare strip, sticky bar). */
  short: string;
  tone: VerdictTone;
}

const VERDICT_DISPLAY: Record<string, VerdictInfo> = {
  strong_hire: { label: "HIRE — few reservations", short: "HIRE", tone: "good" },
  conditional_hire: { label: "HIRE, WITH CONDITIONS", short: "CONDITIONAL", tone: "warn" },
  caution: { label: "PROCEED WITH CAUTION", short: "CAUTION", tone: "warn" },
  avoid: { label: "WE'D LOOK ELSEWHERE", short: "LOOK ELSEWHERE", tone: "bad" },
};

/**
 * Verdict label — primary signal decision.verdict; fallback synthesis.score
 * bands aligned with the decision engine's composite thresholds (80/70/60).
 */
export function verdictInfo(p: SynthesizedPlumber): VerdictInfo | null {
  const v = p.decision?.verdict;
  if (v && VERDICT_DISPLAY[v]) return VERDICT_DISPLAY[v];
  const s = p.synthesis?.score;
  if (typeof s !== "number") return null;
  if (s >= 80) return VERDICT_DISPLAY.strong_hire;
  if (s >= 70) return VERDICT_DISPLAY.conditional_hire;
  if (s >= 60) return VERDICT_DISPLAY.caution;
  return VERDICT_DISPLAY.avoid;
}

export interface DimensionBar {
  key: DimensionKey;
  label: string;
  value: number;
  weakest: boolean;
}

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  reliability: "Reliability",
  pricing_fairness: "Pricing fairness",
  workmanship: "Workmanship",
  responsiveness: "Responsiveness",
  communication: "Communication",
};

/** Five dimension bars from scores.*, weakest flagged; null when unscored. */
export function dimensionBars(p: SynthesizedPlumber): DimensionBar[] | null {
  const s = p.scores;
  if (!s || typeof s.reliability !== "number") return null;
  if (s.method === "keyword_fallback" || s.method === "no_reviews") return null;
  const bars = DIMENSION_KEYS.map((key) => ({
    key,
    label: DIMENSION_LABELS[key],
    value: Math.round(s[key]),
    weakest: false,
  })).sort((a, b) => b.value - a.value);
  if (bars.length > 0) bars[bars.length - 1].weakest = true;
  return bars;
}

/** Analysis-updated date: scores.last_scored_at, fallback scrapedAt. */
export function analysisUpdatedLabel(p: SynthesizedPlumber): string | null {
  return formatMonthYear(p.scores?.last_scored_at ?? p.scrapedAt ?? null);
}

export function scrapedLabel(p: SynthesizedPlumber): string | null {
  return formatMonthYear(p.scrapedAt ?? null);
}

// ---------------------------------------------------------------------------
// Claims + resolved verbatim quotes
// ---------------------------------------------------------------------------

export interface ProfileQuote extends AttributedQuote {
  /** Neutral dimension tag when present (pricing, reliability, …). */
  dimension: string | null;
  /** Star rating drives pos/neg tone; null renders neutral-positive. */
}

export interface ClaimBlock {
  text: string;
  severity: "strength" | "concern" | "redflag";
  /** Count of supporting review ids the pipeline validated for this claim. */
  supportCount: number;
  /** Verbatim quotes resolvable on this page (subset of supportCount). */
  quotes: ProfileQuote[];
}

export interface DossierClaims {
  strengths: ClaimBlock[];
  /** Red flags first, then weaknesses (03 §3.4). */
  concerns: ClaimBlock[];
  /** Distinct review ids across concern claims — fairness counterweight numerator. */
  concernReviewIdCount: number;
}

/** Filter out pipeline placeholder lines like "Not enough data to …". */
function isRealClaim(text: string): boolean {
  return !/^(not enough|insufficient) (data|evidence|reviews)/i.test(text.trim());
}

const DIMENSION_CHIP: Record<string, string> = {
  reliability: "reliability",
  pricing_fairness: "pricing",
  workmanship: "workmanship",
  responsiveness: "responsiveness",
  communication: "communication",
};

/**
 * Attribute an evidence quote for display. Hard rule: every rendered quote
 * carries author + source + date. Quotes whose source is missing/"unknown"
 * get one recovery attempt against the cached review sample (text match →
 * adopt that review's source/time); still unattributable → not rendered.
 */
export function attributeEvidenceQuote(
  p: SynthesizedPlumber,
  q: EvidenceQuote,
): ProfileQuote | null {
  if (!q.quote || !q.author_name) return null;
  let label = sourceLabel(q.source);
  let dateIso: string | null | undefined = q.published_at;
  if (!label) {
    const needle = q.quote.trim().toLowerCase().slice(0, 60);
    if (needle.length >= 15) {
      const match = (p.reviews ?? []).find((r) =>
        r.text?.toLowerCase().includes(needle),
      );
      if (match) {
        label = sourceLabel(match.source ?? null);
        dateIso = match.time ?? dateIso;
      }
    }
  }
  if (!label) return null;
  return {
    text: q.quote.trim(),
    author: q.author_name,
    rating: typeof q.rating === "number" ? q.rating : null,
    sourceLabel: label,
    dateLabel: formatMonthYear(dateIso),
    dimension: q.dimension ? (DIMENSION_CHIP[q.dimension] ?? null) : null,
  };
}

interface EvidencedClaimLike {
  text: string;
  supporting_review_ids?: string[];
}

function buildClaims(
  p: SynthesizedPlumber,
  structured: EvidencedClaimLike[] | undefined,
  flat: string[] | undefined,
  severity: ClaimBlock["severity"],
  quoteIndex: Map<string, ProfileQuote>,
): ClaimBlock[] {
  const out: ClaimBlock[] = [];
  if (structured && structured.length > 0) {
    for (const c of structured) {
      if (!c.text || !isRealClaim(c.text)) continue;
      const ids = c.supporting_review_ids ?? [];
      const quotes: ProfileQuote[] = [];
      for (const id of ids) {
        const q = quoteIndex.get(id);
        if (q && !quotes.some((x) => x.text === q.text)) quotes.push(q);
      }
      // Negative claims lead with their most critical quote.
      if (severity !== "strength") {
        quotes.sort((a, b) => (a.rating ?? 6) - (b.rating ?? 6));
      }
      out.push({ text: c.text, severity, supportCount: ids.length, quotes });
    }
  } else {
    for (const t of flat ?? []) {
      if (isRealClaim(t)) out.push({ text: t, severity, supportCount: 0, quotes: [] });
    }
  }
  return out;
}

export function dossierClaims(p: SynthesizedPlumber): DossierClaims {
  const syn = p.synthesis;
  const quoteIndex = new Map<string, ProfileQuote>();
  for (const q of p.evidence_quotes ?? []) {
    if (quoteIndex.has(q.review_id)) continue;
    const attributed = attributeEvidenceQuote(p, q);
    if (attributed) quoteIndex.set(q.review_id, attributed);
  }

  const strengths = buildClaims(p, syn?.strengthsEvidence, syn?.strengths, "strength", quoteIndex);
  const redFlags = buildClaims(p, syn?.redFlagsEvidence, syn?.redFlags, "redflag", quoteIndex);
  const weaknesses = buildClaims(p, syn?.weaknessesEvidence, syn?.weaknesses, "concern", quoteIndex);
  const concerns = [...redFlags, ...weaknesses];

  const concernIds = new Set<string>();
  for (const src of [syn?.redFlagsEvidence, syn?.weaknessesEvidence]) {
    for (const c of src ?? []) {
      for (const id of c.supporting_review_ids ?? []) concernIds.add(id);
    }
  }

  return { strengths, concerns, concernReviewIdCount: concernIds.size };
}

// ---------------------------------------------------------------------------
// Evidence ledger (03 §3.6) — verbatim attributed quotes from the committed
// review sample, grouped Positive / Critical. This is how the first negative
// receipt renders even when a concern claim's supporting_review_ids don't
// resolve to the (5-quote) evidence_quotes set — a known pipeline depth gap
// (03 §8). Quotes are never chained to claims they don't cite.
// ---------------------------------------------------------------------------

export interface EvidenceLedger {
  positive: ProfileQuote[];
  critical: ProfileQuote[];
}

/** Verbatim-or-ellipsized trim at a word boundary. */
function trimVerbatim(text: string, maxLen = 420): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : maxLen)} …`;
}

function normKey(text: string): string {
  return text.trim().toLowerCase().slice(0, 60);
}

export function evidenceLedger(
  p: SynthesizedPlumber,
  shownQuoteTexts: string[],
): EvidenceLedger {
  const shown = new Set(shownQuoteTexts.map(normKey));
  const byRecency = [...(p.reviews ?? [])]
    .filter((r) => r.text && r.author && typeof r.rating === "number")
    .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""));

  const toQuote = (r: (typeof byRecency)[number]): ProfileQuote | null => {
    const label = sourceLabel(r.source ?? null);
    if (!label) return null;
    return {
      text: trimVerbatim(r.text),
      author: r.author,
      rating: r.rating,
      sourceLabel: label,
      dateLabel: formatMonthYear(r.time),
      dimension: null,
    };
  };

  const positive: ProfileQuote[] = [];
  const critical: ProfileQuote[] = [];
  for (const r of byRecency) {
    const key = normKey(r.text);
    if (shown.has(key)) continue;
    if (r.rating <= 2 && critical.length < 3) {
      const q = toQuote(r);
      if (q) {
        critical.push(q);
        shown.add(key);
      }
    } else if (r.rating >= 4 && positive.length < 2 && r.text.trim().length >= 30) {
      const q = toQuote(r);
      if (q) {
        positive.push(q);
        shown.add(key);
      }
    }
  }
  // Most-critical fallback: a 3★ is the most critical take when no 1–2★ exists.
  if (critical.length === 0) {
    for (const r of byRecency) {
      if (r.rating === 3 && !shown.has(normKey(r.text))) {
        const q = toQuote(r);
        if (q) {
          critical.push(q);
          break;
        }
      }
    }
  }
  return { positive, critical };
}

// ---------------------------------------------------------------------------
// Platform comparison (03 §3.5.2)
// ---------------------------------------------------------------------------

export interface PlatformRow {
  label: "Google" | "Yelp" | "BBB";
  /** 0–5 stars; null for BBB letter grades. */
  rating: number | null;
  detail: string;
  tone: "good" | "bad" | "plain";
}

export interface PlatformPicture {
  rows: PlatformRow[];
  /** synthesis.platformDiscrepancy prose, rendered as the caption. */
  discrepancy: string | null;
  /** Header chip: platforms disagree materially. */
  gapChip: boolean;
}

export function platformPicture(p: SynthesizedPlumber): PlatformPicture | null {
  const rows: PlatformRow[] = [];
  if (typeof p.googleRating === "number") {
    rows.push({
      label: "Google",
      rating: p.googleRating,
      detail: `★${p.googleRating.toFixed(1)} · ${p.googleReviewCount.toLocaleString()} reviews`,
      tone: p.googleRating >= 4 ? "good" : p.googleRating < 3.5 ? "bad" : "plain",
    });
  }
  if (typeof p.yelpRating === "number" && p.yelpRating > 0) {
    rows.push({
      label: "Yelp",
      rating: p.yelpRating,
      detail: `★${p.yelpRating.toFixed(1)}${p.yelpReviewCount ? ` · ${p.yelpReviewCount.toLocaleString()} reviews` : ""}`,
      tone: p.yelpRating >= 4 ? "good" : p.yelpRating < 3.5 ? "bad" : "plain",
    });
  }
  if (p.bbb?.rating || p.bbb?.accredited) {
    rows.push({
      label: "BBB",
      rating: null,
      detail: `${p.bbb.rating ?? "—"}${p.bbb.accredited ? " · Accredited" : ""}`,
      tone: p.bbb.rating?.startsWith("A") ? "good" : "plain",
    });
  }
  if (rows.length < 2) return null;
  const g = p.googleRating;
  const y = p.yelpRating;
  const numericGap =
    typeof g === "number" && typeof y === "number" && y > 0 && Math.abs(g - y) >= 1.0;
  const discrepancy = p.synthesis?.platformDiscrepancy ?? null;
  return { rows, discrepancy, gapChip: numericGap || !!discrepancy };
}

// ---------------------------------------------------------------------------
// Market context — rank line, compare strip, breadcrumb parent
// ---------------------------------------------------------------------------

export interface MarketRankContext {
  market: Market;
  /** 1-based position in the market page's display order. */
  rank: number;
  /** Total ranked on that market page. */
  total: number;
  /** Adjacent ranked profiles (up to n), for the compare strip. */
  neighbors: { plumber: SynthesizedPlumber; rank: number }[];
}

let placeIdToMarket: Map<string, Market> | null = null;

function getPlaceIdMarketIndex(): Map<string, Market> {
  if (!placeIdToMarket) {
    placeIdToMarket = new Map();
    for (const m of getMarkets()) {
      for (const id of m.plumberIds) {
        // First market wins — plumberIds can appear in several nearby markets;
        // keep the first (markets.json order is stable), it's the "home" page.
        if (!placeIdToMarket.has(id)) placeIdToMarket.set(id, m);
      }
    }
  }
  return placeIdToMarket;
}

const displayOrderCache = new Map<string, SynthesizedPlumber[]>();

/** The market page's exact display order (tier groups, editorial within). */
function marketDisplayOrder(market: Market): SynthesizedPlumber[] {
  const key = `${market.st}/${market.slug}`;
  let order = displayOrderCache.get(key);
  if (!order) {
    const { ranked } = splitRanked(getMarketPlumbers(market));
    order = tierGroups(ranked).flatMap((g) => g.plumbers);
    displayOrderCache.set(key, order);
  }
  return order;
}

function slugifyCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * The market that lists this plumber (breadcrumb parent). Prefers the market
 * matching the plumber's own city when it lists them (a Provo business
 * breadcrumbs to Provo, not to a neighboring market that also carries it);
 * falls back to the first market carrying the placeId.
 */
export function homeMarket(p: SynthesizedPlumber): Market | undefined {
  if (p.state && p.city) {
    const own = getMarket(p.state.toLowerCase(), slugifyCity(p.city));
    if (own && own.plumberIds.includes(p.placeId)) return own;
  }
  return getPlaceIdMarketIndex().get(p.placeId);
}

/**
 * Rank context within the home market — matches the market page's numerals
 * exactly (same splitRanked + tierGroups path). Null when the plumber isn't
 * ranked there (unranked row or not listed).
 */
export function marketRankContext(
  p: SynthesizedPlumber,
  maxNeighbors = 2,
): MarketRankContext | null {
  const market = homeMarket(p);
  if (!market) return null;
  const order = marketDisplayOrder(market);
  const idx = order.findIndex((x) => x.placeId === p.placeId);
  if (idx === -1) return null;
  const neighbors: { plumber: SynthesizedPlumber; rank: number }[] = [];
  // Prefer the plumber ranked directly above, then directly below, then next.
  const candidateIdx = [idx - 1, idx + 1, idx - 2, idx + 2];
  for (const i of candidateIdx) {
    if (neighbors.length >= maxNeighbors) break;
    if (i >= 0 && i < order.length) neighbors.push({ plumber: order[i], rank: i + 1 });
  }
  neighbors.sort((a, b) => a.rank - b.rank);
  return { market, rank: idx + 1, total: order.length, neighbors };
}

// ---------------------------------------------------------------------------
// Service area — kept markets within 20 miles (01 §4)
// ---------------------------------------------------------------------------

export interface NearbyMarketLink {
  name: string;
  st: string;
  slug: string;
  distanceMiles: number;
}

// Max 4 by distance per 01 §4 (profile -> other kept markets within 20mi).
export function nearbyMarketLinks(p: SynthesizedPlumber, max = 4): NearbyMarketLink[] {
  if (!p.location?.lat || !p.location?.lng) return [];
  const { lat, lng } = p.location;
  return getMarkets()
    .map((m) => ({
      name: m.name,
      st: m.st,
      slug: m.slug,
      distanceMiles: calculateDistance(lat, lng, m.lat, m.lng),
    }))
    .filter((m) => m.distanceMiles <= 20)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// Services — plain-text chips (C13: no service pages exist to link)
// ---------------------------------------------------------------------------

const SERVICE_DISPLAY: Record<string, string> = {
  "burst-pipe": "Burst pipes",
  flooding: "Flooding",
  sewer: "Sewer lines",
  "gas-leak": "Gas leaks",
  "water-heater": "Water heaters",
  toilet: "Toilets",
  "sump-pump": "Sump pumps",
  "drain-cleaning": "Drain cleaning",
  "water-line": "Water lines",
  "slab-leak": "Slab leaks",
  "garbage-disposal": "Garbage disposals",
  "faucet-fixture": "Faucets & fixtures",
  backflow: "Backflow",
  repiping: "Repiping",
  "water-softener": "Water softeners",
  "bathroom-remodel": "Bathroom remodels",
};

/** Services reviewers actually mention, most-mentioned first (max 6). */
export function serviceChips(p: SynthesizedPlumber, max = 6): string[] {
  const mentioned = p.synthesis?.servicesMentioned;
  if (!mentioned) return [];
  return Object.entries(mentioned)
    .filter(([, v]) => v && v.count > 0)
    .sort((a, b) => (b[1]?.count ?? 0) - (a[1]?.count ?? 0))
    .slice(0, max)
    .map(([k]) => SERVICE_DISPLAY[k] ?? k.replace(/-/g, " "));
}

// ---------------------------------------------------------------------------
// Hours
// ---------------------------------------------------------------------------

export interface HoursRow {
  day: string;
  hours: string;
}

/** Parse "Monday: 8 AM – 5 PM" lines into table rows; null when absent. */
export function hoursTable(p: SynthesizedPlumber): HoursRow[] | null {
  if (!p.workingHours || p.workingHours.length === 0) return null;
  const rows: HoursRow[] = [];
  for (const line of p.workingHours) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    rows.push({ day: line.slice(0, i).trim(), hours: line.slice(i + 1).trim() });
  }
  return rows.length > 0 ? rows : null;
}

// re-export for the page
export { reviewsReadCount };
export type { Market };
