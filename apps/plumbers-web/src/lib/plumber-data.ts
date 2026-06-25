import fs from "fs";
import path from "path";
import { calculateDistance } from "./geo";
import { getCityCoordBySlug } from "./city-coords";
import { businessProfileSlug, legacyBusinessSlug } from "./business-slug";
import type { Plumber } from "./types";
import type {
  Scores,
  CityRank,
  DecisionCore,
  EvidenceQuote,
} from "./decision-engine";

export interface PlumberReview {
  author: string;
  rating: number;
  text: string;
  time: string;
  relativeTime: string;
  source?: "google" | "yelp";
}

export interface ServiceMention {
  count: number;
  avgRating: number;
  topQuote: string;
}

export type ServiceCategory =
  | "burst-pipe" | "flooding" | "sewer" | "gas-leak" | "water-heater"
  | "toilet" | "sump-pump" | "drain-cleaning" | "water-line" | "slab-leak"
  | "garbage-disposal" | "faucet-fixture" | "backflow" | "repiping"
  | "water-softener" | "bathroom-remodel";

export interface PlumberSynthesis {
  score: number;
  trustLevel: "high" | "moderate" | "low";
  summary: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  redFlags: string[];
  priceSignal: "budget" | "mid-range" | "premium" | "mixed" | "unknown";
  emergencyReadiness?: "high" | "medium" | "low" | "unknown";
  emergencyNotes?: string;
  topQuote: string | null;
  worstQuote: string | null;
  platformDiscrepancy?: string | null;
  servicesMentioned?: Partial<Record<ServiceCategory, ServiceMention>>;
}

export interface SynthesizedPlumber {
  placeId: string;
  name: string;
  slug: string;
  phone: string;
  website: string | null;
  address: string;
  city: string;
  state: string;
  region: string;
  location: { lat: number; lng: number } | null;
  googleRating: number | null;
  googleReviewCount: number;
  businessStatus: string;
  types: string[];
  priceLevel: number | null;
  editorialSummary: string | null;
  reviews: PlumberReview[];
  is24Hour: boolean;
  workingHours: string[] | null;
  scrapedAt: string;
  synthesis: PlumberSynthesis | null;
  serviceCities?: string[];
  bbb?: {
    accredited: boolean;
    rating: string | null;
    complaintsTotal: number | null;
    complaintsPast3Years: number | null;
    yearsInBusiness: number | null;
    bbbUrl: string | null;
  } | null;
  /** Decision layer fields — populated by score-plumbers.ts, exported via copyDecisionLayer(). */
  scores?: Scores;
  city_rank?: CityRank;
  decision?: DecisionCore;
  evidence_quotes?: EvidenceQuote[];
}

interface SynthesizedData {
  meta: {
    scrapedAt: string;
    synthesizedAt: string;
    totalPlumbers: number;
    totalSynthesized: number;
  };
  plumbers: SynthesizedPlumber[];
}

let cachedData: SynthesizedData | null = null;

function loadData(): SynthesizedData {
  if (cachedData) return cachedData;
  const filePath = path.join(
    process.cwd(),
    "data",
    "synthesized",
    "plumbers-synthesized.json"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed: SynthesizedData = JSON.parse(raw);
  // Normalize each profile slug to the canonical computed value over stable
  // fields (name + city + state + placeId). The export script also writes this
  // slug, but recomputing here means runtime link-generation, getPlumberBySlug,
  // generateStaticParams, and the sitemap all agree on the NEW scheme the
  // instant this code deploys — without waiting for the next Firestore→JSON
  // rebuild. businessProfileSlug is the same function the Firestore-path
  // resolver and the export script's CJS twin use, so every path matches.
  for (const p of parsed.plumbers) {
    p.slug = businessProfileSlug({
      name: p.name,
      city: p.city,
      state: p.state,
      placeId: p.placeId,
    });
  }
  cachedData = parsed;
  return cachedData;
}

export function getAllPlumbers(): SynthesizedPlumber[] {
  return loadData().plumbers;
}

// Lazily-built slug → record index. getPlumberBySlug is called twice per
// profile page (metadata + body) across ~5k pages, so a Map beats a linear
// scan. First-write-wins is a belt-and-suspenders guard; slugs are unique.
let slugIndex: Map<string, SynthesizedPlumber> | null = null;
function getSlugIndex(): Map<string, SynthesizedPlumber> {
  if (!slugIndex) {
    slugIndex = new Map();
    for (const p of loadData().plumbers) {
      if (p.slug && !slugIndex.has(p.slug)) slugIndex.set(p.slug, p);
    }
  }
  return slugIndex;
}

export function getPlumberBySlug(slug: string): SynthesizedPlumber | undefined {
  return getSlugIndex().get(slug);
}

export function getAllPlumberSlugs(): string[] {
  // Slugs are unique per location (businessProfileSlug appends city/state/
  // placeId), so the index keys are exactly the distinct profile URLs.
  return [...getSlugIndex().keys()];
}

// ---------------------------------------------------------------------------
// Legacy slug redirects
// ---------------------------------------------------------------------------

let legacySlugMap: Map<string, string> | null = null;

/**
 * Map a pre-2026-06 name-only slug (e.g. `roto-rooter-plumbing-water-cleanup`)
 * to its new canonical slug, for 308-redirecting already-indexed URLs.
 *
 * For names that collided under the old scheme (every franchise), the OLD URL
 * resolved to whichever record appeared first in the JSON — `getPlumberBySlug`
 * used `.find()`. We preserve that by keeping the FIRST occurrence, so a
 * currently-indexed franchise URL redirects to the same physical business it
 * shows today. Returns undefined if no legacy match exists (caller 404s).
 */
export function resolveLegacySlug(oldSlug: string): string | undefined {
  if (!legacySlugMap) {
    legacySlugMap = new Map();
    for (const p of loadData().plumbers) {
      const legacy = legacyBusinessSlug(p.name);
      // First-write-wins → mirrors the old .find() first-match behaviour.
      if (!legacySlugMap.has(legacy)) legacySlugMap.set(legacy, p.slug);
    }
  }
  const target = legacySlugMap.get(oldSlug);
  // Guard against a no-op redirect when a legacy slug equals a current slug
  // (e.g. a unique single-location business whose new slug starts the same).
  return target && target !== oldSlug ? target : undefined;
}

export function getPlumbersRanked(): SynthesizedPlumber[] {
  return [...loadData().plumbers].sort(
    (a, b) => (b.synthesis?.score ?? 0) - (a.synthesis?.score ?? 0)
  );
}

export function getUniqueCities(): string[] {
  const cities = new Set<string>();
  for (const p of loadData().plumbers) {
    if (p.serviceCities) {
      for (const c of p.serviceCities) cities.add(c);
    } else {
      cities.add(p.city);
    }
  }
  return [...cities].sort();
}

export function getDataMeta() {
  return loadData().meta;
}

/**
 * Map a synthesized plumber to the Plumber type used by city pages.
 */
function toPlumber(p: SynthesizedPlumber, distanceMiles?: number): Plumber & { distanceMiles?: number; latestReviewAt?: string } {
  const syn = p.synthesis;
  const latestReviewAt = (p.reviews || [])
    .map(r => r.time)
    .filter(Boolean)
    .sort()
    .reverse()[0] || undefined;
  return {
    id: p.placeId,
    businessName: p.name,
    // Canonical slug straight from the JSON (written by export-firestore-to-json
    // via businessProfileSlug). Carried through so cards/links use the stored
    // slug instead of re-deriving from businessName, which collides for
    // national franchises.
    slug: p.slug,
    ownerName: "",
    phone: p.phone || "",
    website: p.website || null,
    email: null,
    address: {
      full: p.address || "",
      street: "",
      city: p.city || "",
      state: p.state || "IL",
      zip: "",
      lat: p.location?.lat || 0,
      lng: p.location?.lng || 0,
    },
    serviceCities: p.serviceCities || [],
    services: [],
    is24Hour: p.is24Hour || false,
    licenseNumber: null,
    insured: false,
    yearsInBusiness: null,
    verificationStatus: "unverified",
    reliabilityScore: syn?.score || 0,
    lastVerifiedAt: null,
    totalCallAttempts: 0,
    totalCallAnswered: 0,
    answerRate: 0,
    avgResponseTime: 0,
    listingTier: "free",
    googleRating: p.googleRating || null,
    googleReviewCount: p.googleReviewCount || 0,
    googlePlaceId: p.placeId,
    googleId: null,
    googleVerified: true,
    workingHours: null,
    category: "Plumber",
    isAreaService: false,
    photoUrl: null,
    logoUrl: null,
    isActive: p.businessStatus === "OPERATIONAL" || !p.businessStatus,
    // Bridge decision-layer fields directly from the JSON shape. Without
    // this bridge, VerdictSeal + SignalRow + DimensionBars render empty on
    // any city page that falls through to the static JSON fallback.
    scores: p.scores,
    city_rank: p.city_rank,
    decision: p.decision,
    evidence_quotes: p.evidence_quotes,
    reviewSynthesis: syn ? {
      strengths: syn.strengths || [],
      weaknesses: syn.weaknesses || [],
      // Derive emergencySignals from emergencyNotes when readiness is
      // non-unknown. Matches the Firestore-shape the old Haiku scripts wrote.
      emergencySignals:
        syn.emergencyReadiness && syn.emergencyReadiness !== "unknown" && syn.emergencyNotes
          ? [syn.emergencyNotes]
          : [],
      redFlags: syn.redFlags || [],
      badges: Array.isArray((syn as unknown as { badges?: string[] }).badges)
        ? ((syn as unknown as { badges: string[] }).badges)
        : [],
      bestFor: Array.isArray((syn as { bestFor?: string[] }).bestFor)
        ? (syn as { bestFor: string[] }).bestFor
        : [],
      reviewCount: p.reviews?.length || 0,
      synthesizedAt: new Date().toISOString(),
      pricingTier: syn.priceSignal === "budget" || syn.priceSignal === "mid-range" || syn.priceSignal === "premium"
        ? syn.priceSignal : "unknown",
      summary: syn.summary || "",
      emergencyReadiness: syn.emergencyReadiness || "unknown",
      emergencyNotes: syn.emergencyNotes || "",
      platformDiscrepancy: (syn as { platformDiscrepancy?: string | null }).platformDiscrepancy ?? null,
      servicesMentioned: (syn as { servicesMentioned?: Record<string, { count: number; avgRating: number; topQuote: string }> }).servicesMentioned,
      sampleSizeWarning: (syn as { sampleSizeWarning?: string }).sampleSizeWarning,
      synthesisVersion: "json-static",
    } : null,
    distanceMiles,
    latestReviewAt,
  } as Plumber & { distanceMiles?: number; latestReviewAt?: string };
}

/**
 * Get plumbers near a city from the static synthesized JSON.
 * Uses 20-mile radius matching via Haversine distance.
 */
export function getPlumbersNearCity(
  stateAbbr: string,
  citySlug: string,
  radiusMiles: number = 20,
): (Plumber & { distanceMiles?: number; latestReviewAt?: string })[] {
  const coord = getCityCoordBySlug(stateAbbr, citySlug);
  if (!coord) return [];
  const [cityLat, cityLng] = coord;

  const allPlumbers = loadData().plumbers;
  const results: (Plumber & { distanceMiles?: number; latestReviewAt?: string })[] = [];

  for (const p of allPlumbers) {
    if (!p.location?.lat || !p.location?.lng) continue;
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
    const dist = calculateDistance(cityLat, cityLng, p.location.lat, p.location.lng);
    if (dist <= radiusMiles) {
      results.push(toPlumber(p, dist));
    }
  }

  return results.sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));
}
