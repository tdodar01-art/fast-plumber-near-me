/**
 * City-intro composer — 04 §4 framework, rules 1–7.
 *
 * Every sentence is computed from THIS market's data (slots S1–S10); nothing
 * here can be written for a city we haven't analyzed. Three density tiers
 * with tier-distinct sentence skeletons, a mandatory caution/limitation
 * sentence in every intro, and wording variants rotated on a per-city STABLE
 * seed (FNV-1a hash of "{st}/{slug}") so recrawls never see churn — no
 * Math.random at render, ever.
 */

import type { Market } from "./markets";
import type { SynthesizedPlumber, ServiceCategory } from "./plumber-data";
import { reviewsReadCount } from "./report-card";

// ---------------------------------------------------------------------------
// Stable per-city seed
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit — deterministic across builds and runtimes. */
export function citySeed(st: string, slug: string): number {
  const key = `${st}/${slug}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic variant picker — seed-stable across rebuilds (rule 5). */
function pickVariant<T>(seed: number, salt: number, variants: T[]): T {
  const idx = ((seed ^ Math.imul(salt + 1, 2654435761)) >>> 0) % variants.length;
  return variants[idx];
}

// ---------------------------------------------------------------------------
// Data slots (04 §4 table) — computed per market at build time
// ---------------------------------------------------------------------------

const SERVICE_LABELS: Partial<Record<ServiceCategory, string>> = {
  "burst-pipe": "burst pipes",
  flooding: "flooding",
  sewer: "sewer work",
  "gas-leak": "gas leaks",
  "water-heater": "water heaters",
  toilet: "toilet repair",
  "sump-pump": "sump pumps",
  "drain-cleaning": "drain clearing",
  "water-line": "water lines",
  "slab-leak": "slab leaks",
  "garbage-disposal": "garbage disposals",
  "faucet-fixture": "faucets and fixtures",
  backflow: "backflow work",
  repiping: "repiping",
  "water-softener": "water softeners",
  "bathroom-remodel": "bathroom remodels",
};

export interface CityIntroSlots {
  /** S1 */ plumberCount: number;
  /** S2 */ reviewsRead: number;
  /** S3 */ count24Hour: number;
  pct24Hour: number;
  /** S4 */ medianRating: number | null;
  /** S5 */ lowRatedCount: number;
  /** S6 */ concernCount: number;
  /** S7 */ deepReviewCount: number;
  /** S8 */ thinDataCount: number;
  /** S9 */ dominantSpecialties: string[];
  /** S10 */ standoutFact: string | null;
}

function hasRealConcern(p: SynthesizedPlumber): boolean {
  const syn = p.synthesis;
  if (!syn) return false;
  const real = (arr?: string[]) =>
    (arr ?? []).some((t) => !/^(not enough|insufficient)/i.test(t.trim()));
  return real(syn.redFlags) || real(syn.weaknesses);
}

export function computeIntroSlots(plumbers: SynthesizedPlumber[]): CityIntroSlots {
  const n = plumbers.length;
  const reviewsRead = plumbers.reduce((s, p) => s + reviewsReadCount(p), 0);
  const count24Hour = plumbers.filter((p) => p.is24Hour).length;
  const rated = plumbers
    .map((p) => p.googleRating)
    .filter((r): r is number => typeof r === "number")
    .sort((a, b) => a - b);
  const medianRating =
    rated.length === 0
      ? null
      : rated.length % 2
        ? rated[(rated.length - 1) / 2]
        : (rated[rated.length / 2 - 1] + rated[rated.length / 2]) / 2;
  const lowRatedCount = rated.filter((r) => r < 4.0).length;
  const concernCount = plumbers.filter(hasRealConcern).length;
  const deepReviewCount = plumbers.filter((p) => p.googleReviewCount >= 100).length;
  const thinDataCount = plumbers.filter((p) => reviewsReadCount(p) < 10).length;

  // S9 — dominant specialties from servicesMentioned across the market.
  const svcCounts = new Map<string, number>();
  for (const p of plumbers) {
    const svc = p.synthesis?.servicesMentioned;
    if (!svc) continue;
    for (const [key, mention] of Object.entries(svc)) {
      const label = SERVICE_LABELS[key as ServiceCategory];
      if (!label || !mention?.count) continue;
      svcCounts.set(label, (svcCounts.get(label) ?? 0) + mention.count);
    }
  }
  const dominantSpecialties = [...svcCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => label);

  // S10 — standout fact: names a real business and a real number (unfakeable).
  let standoutFact: string | null = null;
  const biggest = [...plumbers].sort((a, b) => b.googleReviewCount - a.googleReviewCount)[0];
  if (biggest && biggest.googleReviewCount >= 100) {
    standoutFact = `${biggest.name} alone carries ${biggest.googleReviewCount.toLocaleString()} Google reviews — the deepest review base in this radius`;
  }
  const onlyLow = plumbers.filter(
    (p) => typeof p.googleRating === "number" && (p.googleRating as number) < 4.0,
  );
  if (lowRatedCount === 1 && onlyLow[0] && typeof onlyLow[0].googleRating === "number") {
    standoutFact = `only one company in this radius — ${onlyLow[0].name} — sits below 4.0 (${(onlyLow[0].googleRating as number).toFixed(1)})`;
  }

  return {
    plumberCount: n,
    reviewsRead,
    count24Hour,
    pct24Hour: n > 0 ? count24Hour / n : 0,
    medianRating,
    lowRatedCount,
    concernCount,
    deepReviewCount,
    thinDataCount,
    dominantSpecialties,
    standoutFact,
  };
}

// ---------------------------------------------------------------------------
// Composition — three tier-distinct skeletons (04 §4 rule 1)
// ---------------------------------------------------------------------------

export type IntroTier = "dense" | "standard" | "thin";

export interface CityIntro {
  tier: IntroTier;
  /** Serif dek sentences (paragraph 1 — the methods byline). */
  dek: string[];
  /** Optional paragraph 2 — the caution / differentiation sentences. */
  more: string | null;
  slots: CityIntroSlots;
}

export function composeCityIntro(
  market: Market,
  plumbers: SynthesizedPlumber[],
): CityIntro {
  const s = computeIntroSlots(plumbers);
  const seed = citySeed(market.st, market.slug);
  const city = market.name;
  const tier: IntroTier =
    s.plumberCount >= 25 ? "dense" : s.plumberCount >= 5 ? "standard" : "thin";

  const dek: string[] = [];
  const moreParts: string[] = [];

  // --- opening: what we read (numbers computed, tier-distinct skeletons) ---
  if (tier === "dense") {
    dek.push(
      pickVariant(seed, 1, [
        `We track ${s.plumberCount} plumbing companies working within 20 miles of ${city} and have read ${s.reviewsRead.toLocaleString()} of their reviews across Google, Yelp and BBB — including every one-star review we could find.`,
        `We read ${s.reviewsRead.toLocaleString()} reviews across Google, Yelp and BBB for the ${s.plumberCount} plumbers serving ${city} — including the one-star reviews other directories bury — and ranked them the way we'd rank them for a friend.`,
      ]),
    );
  } else if (tier === "standard") {
    dek.push(
      pickVariant(seed, 1, [
        `${s.plumberCount} plumbing companies serve the ${city} area within 20 miles, and we've read ${s.reviewsRead.toLocaleString()} of their public reviews — the critical ones first.`,
        `For the ${s.plumberCount} plumbers working within 20 miles of ${city}, we read ${s.reviewsRead.toLocaleString()} public reviews across Google, Yelp and BBB and ranked them like a friend who'd done the research.`,
      ]),
    );
  } else {
    dek.push(
      `Our coverage near ${city} is small: ${s.plumberCount} plumbing compan${s.plumberCount === 1 ? "y" : "ies"} within 20 miles, with ${s.reviewsRead.toLocaleString()} public reviews between them — we'd rather show you the honest count than pad this page.`,
    );
  }

  // --- lead fact by rule 2 (most decision-relevant for THIS city) ---
  const lowShare24 = s.pct24Hour < 0.5;
  if (tier !== "thin") {
    if (lowShare24 && s.count24Hour > 0) {
      dek.push(
        pickVariant(seed, 2, [
          `The number that matters most here: only ${s.count24Hour} of the ${s.plumberCount} list 24-hour service — if it's the middle of the night, start with those.`,
          `After-hours options are thin in ${city}: just ${s.count24Hour} of ${s.plumberCount} list 24-hour service, so read those cards first if water is already moving.`,
        ]),
      );
    } else if (s.count24Hour > 0) {
      dek.push(
        pickVariant(seed, 2, [
          `${s.count24Hour} of the ${s.plumberCount} list 24/7 hours — but "open 24 hours" on a Google profile and "answered at 2 a.m." in a customer review are not the same claim, and we quote the reviews that tell you which is which.`,
          `${s.count24Hour} answer 24/7 per their Google listings; where reviewers describe real middle-of-the-night calls, that evidence is quoted on the cards below.`,
        ]),
      );
    }
  } else if (s.count24Hour > 0) {
    dek.push(
      `${s.count24Hour === s.plumberCount ? "All" : `${s.count24Hour} of the`} ${s.plumberCount} advertise 24-hour service per their Google listings.`,
    );
  }

  dek.push("Rankings are not for sale.");

  // --- paragraph 2: ratings texture + MANDATORY caution (rule 3) + S10 ---
  if (tier === "dense") {
    if (s.medianRating != null && s.medianRating >= 4.5) {
      moreParts.push(
        `${city}'s problem isn't finding a plumber; it's telling them apart — the median rating here is ${s.medianRating.toFixed(1)}, and when everyone has five stars, the stars stop helping.`,
      );
    }
    if (s.deepReviewCount > 0) {
      moreParts.push(
        `${s.deepReviewCount} of these companies carry 100+ reviews — enough history for real patterns to show.`,
      );
    }
    // caution
    moreParts.push(
      s.concernCount > 0
        ? `The patterns differ more than the ratings do: ${s.concernCount} of the ${s.plumberCount} have a repeated complaint pattern in their reviews — quotes that grew mid-job, unreturned callbacks — flagged and quoted on their cards below.`
        : `A high average with a thin review base deserves a harder look than the stars suggest — where our evidence is thin, the card says so instead of pretending confidence.`,
    );
  } else if (tier === "standard") {
    if (s.medianRating != null) {
      moreParts.push(
        `Ratings run high here (median ${s.medianRating.toFixed(1)}${s.lowRatedCount === 0 ? ", nobody below 4.0" : `, ${s.lowRatedCount} below 4.0`}), but the depth behind them varies: ${s.deepReviewCount} compan${s.deepReviewCount === 1 ? "y carries" : "ies carry"} 100+ reviews while others have a few dozen, which we treat as thinner evidence and say so on their cards.`,
      );
    }
    // caution
    moreParts.push(
      s.concernCount > 0
        ? `Where reviewers repeat a specific complaint — ${s.concernCount} of the ${s.plumberCount} companies have one — it's flagged below with their exact words.`
        : `No repeated complaint patterns surfaced in the reviews we've analyzed so far — but ${s.thinDataCount > 0 ? `${s.thinDataCount} of these companies have fewer than 10 analyzed reviews, so` : ""} treat thin evidence as a first impression, not a clean bill.`,
    );
  } else {
    // thin tier: honest-scope caution is the lead
    moreParts.push(
      `In a market this small you may end up calling more than one — the strengths sections below tell you who to try first for your specific problem, and any recurring complaint is quoted with names and dates.`,
    );
  }

  if (s.standoutFact) {
    moreParts.push(`One number worth knowing: ${s.standoutFact}.`);
  }
  if (tier !== "thin" && s.dominantSpecialties.length >= 2) {
    moreParts.push(
      `Across the reviews we analyzed, the work named most often is ${s.dominantSpecialties[0]} and ${s.dominantSpecialties[1]}.`,
    );
  }

  return { tier, dek, more: moreParts.length ? moreParts.join(" ") : null, slots: s };
}
