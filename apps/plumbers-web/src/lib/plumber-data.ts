import fs from "fs";
import path from "path";
import { calculateDistance } from "./geo";
import { getCityCoordBySlug } from "./city-coords";
import type { Plumber } from "./types";

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
    reviewSynthesis: syn ? {
      strengths: syn.strengths || [],
      weaknesses: syn.weaknesses || [],
      emergencySignals: [],
      redFlags: syn.redFlags || [],
      badges: [],
      reviewCount: p.reviews?.length || 0,
      categories: {
        emergency: { strengths: [], weaknesses: [] },
        pricing: { strengths: [], weaknesses: [] },
        quality: { strengths: [], weaknesses: [] },
        communication: { strengths: [], weaknesses: [] },
        homeRespect: { strengths: [], weaknesses: [] },
        punctuality: { strengths: [], weaknesses: [] },
      },
      pricingTier: syn.priceSignal === "budget" || syn.priceSignal === "mid-range" || syn.priceSignal === "premium"
        ? syn.priceSignal : "unknown",
      summary: syn.summary || "",
      emergencyReadiness: syn.emergencyReadiness || "unknown",
      synthesisVersion: "json-static",
    } : undefined,
    distanceMiles,
    latestReviewAt,
  } as Plumber & { distanceMiles?: number; latestReviewAt?: string };
}

/**
 * Get plumbers near a city from the static synthesized JSON.
 * Uses 20-mile radius matching via Haversine distance.
 *
 * Anchor resolution:
 *   1. `city-coords.ts` hand-curated map (primary — stable town-center coord).
 *   2. Fallback: derive an anchor from plumbers whose `serviceCities` includes
 *      this slug. Prefer a plumber whose own `city` field matches the slug
 *      (office in-town), else take the centroid of tagged plumbers.
 *
 * The fallback exists because `gsc-prepend-queue.js` can silently fail to
 * write new GSC-discovered cities into `city-coords.ts` (continue-on-error in
 * the daily-scrape workflow + geocoding API failures), which previously
 * caused city pages to render "0 plumbers available" even though the data
 * was present in the JSON. See docs/diagnostics/marble-falls-zero-plumbers.md.
 */
export function getPlumbersNearCity(
  stateAbbr: string,
  citySlug: string,
  radiusMiles: number = 20,
): (Plumber & { distanceMiles?: number; latestReviewAt?: string })[] {
  const allPlumbers = loadData().plumbers;

  let coord = getCityCoordBySlug(stateAbbr, citySlug);

  if (!coord) {
    // Fallback: anchor on plumbers explicitly tagged to this serviceCities slug.
    const tagged = allPlumbers.filter(
      (p) =>
        p.state === stateAbbr &&
        (p.serviceCities || []).includes(citySlug) &&
        p.location?.lat != null &&
        p.location?.lng != null &&
        (!p.businessStatus || p.businessStatus === "OPERATIONAL"),
    );
    if (tagged.length === 0) return [];

    const normalizeCity = (s: string) =>
      s.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const inTown = tagged.find((p) => p.city && normalizeCity(p.city) === citySlug);
    if (inTown?.location) {
      coord = [inTown.location.lat, inTown.location.lng];
    } else {
      const avgLat = tagged.reduce((s, p) => s + p.location!.lat, 0) / tagged.length;
      const avgLng = tagged.reduce((s, p) => s + p.location!.lng, 0) / tagged.length;
      coord = [avgLat, avgLng];
    }
  }

  const [cityLat, cityLng] = coord;
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
