import { Timestamp } from "firebase/firestore";

export interface PlumberAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
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

  // Verification & Scoring
  verificationStatus: "unverified" | "verified" | "failed";
  reliabilityScore: number;
  lastVerifiedAt: Timestamp | null;
  totalCallAttempts: number;
  totalCallAnswered: number;
  answerRate: number;
  avgResponseTime: number;

  // Listing tier
  listingTier: "free" | "premium" | "featured";

  // Reviews
  googleRating: number | null;
  googleReviewCount: number | null;
  yelpRating: number | null;

  // Meta
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  notes: string;
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
  city: string;
  clickType: "call" | "website" | "directions";
  source: string;
  createdAt: Timestamp;
  userAgent: string;
  billed: boolean;
  billedAmount: number | null;
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
