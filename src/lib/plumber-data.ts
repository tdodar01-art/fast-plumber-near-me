import fs from "fs";
import path from "path";

export interface PlumberReview {
  author: string;
  rating: number;
  text: string;
  time: string;
  relativeTime: string;
}

export interface PlumberSynthesis {
  score: number;
  trustLevel: "high" | "moderate" | "low";
  summary: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  redFlags: string[];
  priceSignal: "budget" | "mid-range" | "premium" | "mixed" | "unknown";
  topQuote: string | null;
  worstQuote: string | null;
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
  const cities = new Set(loadData().plumbers.map((p) => p.city));
  return [...cities].sort();
}

export function getDataMeta() {
  return loadData().meta;
}
