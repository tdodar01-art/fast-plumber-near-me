import { Timestamp } from "firebase/firestore";
import type {
  Scores,
  DecisionCore,
  CityRank,
  EvidenceQuote,
} from "./decision-engine";

export interface PlumberAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  full?: string;
}

export interface Plumber {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  website: string | null;
  email: string | null;
  address: PlumberAddress;
  serviceCities: string[];
  services: string[];
  is24Hour: boolean;
  licenseNumber: string | null;
  insured: boolean;
  yearsInBusiness: number | null;

  // Status & Verification
  status?: "active" | "inactive" | "flagged";
  closedAt?: Timestamp | null;
  closureSource?: "google" | "user-reports" | "manual" | null;
  verificationStatus: "unverified" | "verified" | "partially_verified" | "failed";
  reliabilityScore: number;
  lastVerifiedAt: Timestamp | null;
  totalCallAttempts: number;
  totalCallAnswered: number;
  answerRate: number;
  avgResponseTime: number;

  // Listing tier
  listingTier: "free" | "premium" | "featured";

  // Google data (from Outscraper)
  googleRating: number | null;
  googleReviewCount: number | null;
  googlePlaceId: string | null;
  googleId: string | null;
  googleVerified: boolean;
  workingHours: Record<string, string> | null;
  category: string | null;
  isAreaService: boolean;
  photoUrl: string | null;
  logoUrl: string | null;
  description: string | null;
  businessStatus: string | null;
  bookingLink: string | null;

  // Social
  social: {
    facebook: string | null;
    instagram: string | null;
  };

  // Legacy / other reviews
  yelpRating: number | null;

  // Caching & synthesis
  lastReviewRefreshAt: Timestamp | null;
  reviewSynthesis: ReviewSynthesis | null;
  cachedFromGoogle: boolean;

  // Decision layer (populated by scripts/score-plumbers.ts). Optional so
  // legacy plumbers without Pass 2/3 data remain readable.
  scores?: Scores;
  city_rank?: CityRank;
  decision?: (DecisionCore & { primary_city_slug?: string; decided_at?: string }) | null;
  evidence_quotes?: EvidenceQuote[];

  // Review accumulation tracking
  cachedReviewCount?: number;
  lastRefreshNewCount?: number;
  consecutiveZeroRefreshes?: number;
  reviewGap?: number; // googleReviewCount - cachedReviewCount

  // Manual overrides (admin-editable, merged with synthesis)
  manualRedFlags?: string[];
  manualWeaknesses?: string[];

  // Meta
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  notes: string;
}

export interface ReviewSynthesis {
  strengths: string[];
  weaknesses: string[];
  emergencySignals: string[];
  redFlags: string[];
  badges: string[];
  reviewCount: number;
  synthesizedAt: Timestamp;

  // Categorized signals for display filtering
  categories: {
    emergency: { strengths: string[]; weaknesses: string[] };
    pricing: { strengths: string[]; weaknesses: string[] };
    quality: { strengths: string[]; weaknesses: string[] };
    communication: { strengths: string[]; weaknesses: string[] };
    homeRespect: { strengths: string[]; weaknesses: string[] };
    punctuality: { strengths: string[]; weaknesses: string[] };
  };

  // Pricing tier derived from review analysis
  pricingTier: "budget" | "mid-range" | "premium" | "mixed" | "unknown";

  // Sample size warning — when we have tiny fraction of total reviews
  sampleSizeWarning?: string;

  // AI synthesis fields
  summary?: string;
  emergencyReadiness?: "high" | "medium" | "low" | "unknown";
  emergencyNotes?: string;
  aiSynthesizedAt?: Timestamp;
  /**
   * Marks which pipeline produced this synthesis:
   * - "ai-v1" | "keyword-fallback" — legacy Haiku (deleted April 2026)
   * - "ai-v2-services" — transitional outscraper-haiku shape
   * - "unified-sonnet-v2" — current unified Sonnet pipeline
   * - "json-static" — bridged from SynthesizedPlumber JSON via toPlumber()
   * Widened to string so unknown historical values don't break readers.
   */
  synthesisVersion?: string;

  // Platform-mismatch prose written by unified pipeline (Google vs Yelp gap)
  platformDiscrepancy?: string | null;

  // Services the plumber is mentioned doing in reviews, keyed by service slug
  servicesMentioned?: Record<
    string,
    { count: number; avgRating: number; topQuote: string }
  >;

  // Scenarios this plumber is particularly good for, from decision engine
  bestFor?: string[];
}

export interface VerificationCall {
  id: string;
  plumberId: string;
  calledAt: Timestamp;
  answered: boolean;
  responseTimeSec: number | null;
  callDurationSec: number;
  transcript: string | null;
  saidAvailable: boolean | null;
  estimatedArrivalMin: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  callSid: string;
  recordingUrl: string | null;
}

export interface Lead {
  id: string;
  plumberId: string;
  plumberName: string;
  plumberPhone: string;
  city: string;
  state: string;
  citySlug: string;
  pageUrl: string;
  clickType: "call" | "website" | "directions";
  source: string;
  createdAt: Timestamp;
  userAgent: string;
  referrer: string;
  billed: boolean;
  billedAmount: number | null;
}

export interface CachedReview {
  id: string;
  plumberId: string;
  googleReviewId: string;
  authorName: string;
  rating: number;
  text: string;
  relativeTimeDescription: string;
  publishedAt: string;
  cachedAt: Timestamp;
}

export interface RatingSnapshot {
  id: string;
  plumberId: string;
  googleRating: number;
  googleReviewCount: number;
  snapshotAt: Timestamp;
}

export interface ApiUsageRecord {
  id: string;
  month: string;
  year: number;
  textSearchCalls: number;
  placeDetailsCalls: number;
  totalCalls: number;
  estimatedCost: number;
  lastUpdatedAt: Timestamp;
}

export interface PlumberReport {
  id: string;
  plumberId: string;
  reportType: "bad-number" | "seems-closed" | "answered-fast" | "no-answer";
  city: string;
  createdAt: Timestamp;
}

export interface City {
  id: string;
  name: string;
  state: string;
  county: string;
  population: number | null;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  heroContent: string;
  isPublished: boolean;
  publishedAt: Timestamp | null;
  plumberCount: number;
  nearbyCities: string[];
}
