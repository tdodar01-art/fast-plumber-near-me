import fs from "fs";
import path from "path";
import { calculateDistance } from "./geo";
import { getCityCoordBySlug } from "./city-coords";
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
  cachedData = JSON.parse(raw);
  return cachedData!;
}

export function getAllPlumbers(): SynthesizedPlumber[] {
  return loadData().plumbers;
}

export function getPlumberBySlug(slug: string): SynthesizedPlumber | undefined {
  return loadData().plumbers.find((p) => p.slug === slug);
}

export function getAllPlumberSlugs(): string[] {
  return loadData().plumbers.map((p) => p.slug);
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
