/**
 * Server-side reader for plumbers that need Sonnet synthesis.
 *
 * Fetches `apps/plumbers-web/data/synthesized/plumbers-synthesized.json`
 * from main and returns plumbers whose `synthesis.summary` is empty or
 * missing. These are the work pile for the operator's manual paste-flow
 * (replaces the disabled `score-plumbers.ts` daily run).
 *
 * Sorted by review count desc — most reviews = synthesis with the most
 * signal, so worth the operator's first paste.
 *
 * Returns null on any fetch / parse failure; caller falls back to empty.
 */

const REPO = "tdodar01-art/fast-plumber-near-me";
const REVALIDATE_SECONDS = 300;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const JSON_PATH = "apps/plumbers-web/data/synthesized/plumbers-synthesized.json";

export interface PlumberReview {
  rating?: number;
  text?: string;
  publishedAt?: string;
  authorName?: string;
}

export interface PlumberSynthesis {
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  redFlags?: string[];
  emergencyNotes?: string;
  emergencyReadiness?: string;
  bestFor?: string[];
  topQuote?: string;
  worstQuote?: string;
  trustLevel?: string;
  priceSignal?: string;
  servicesMentioned?: unknown;
  score?: unknown;
}

export interface SynthesisCandidate {
  placeId: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  serviceCities: string[];
  googleRating?: number;
  googleReviewCount?: number;
  reviewsCachedCount: number;
  scrapedAt?: string;
  hasSynthesis: boolean;
  synthesis?: PlumberSynthesis;
  reviews: PlumberReview[];
  pageUrl?: string;
}

const STATE_ABBR_TO_SLUG: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi",
  MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada",
  NH: "new-hampshire", NJ: "new-jersey", NM: "new-mexico", NY: "new-york",
  NC: "north-carolina", ND: "north-dakota", OH: "ohio", OK: "oklahoma",
  OR: "oregon", PA: "pennsylvania", RI: "rhode-island", SC: "south-carolina",
  SD: "south-dakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont",
  VA: "virginia", WA: "washington", WV: "west-virginia", WI: "wisconsin",
  WY: "wyoming", DC: "district-of-columbia",
};

function plumberPageUrl(slug: string): string {
  return `https://www.fastplumbernearme.com/plumber/${slug}`;
}

function cityPageUrl(cityName: string, stateAbbr: string): string | undefined {
  const stateSlug = STATE_ABBR_TO_SLUG[stateAbbr.toUpperCase()];
  if (!stateSlug) return undefined;
  const citySlug = cityName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `https://www.fastplumbernearme.com/emergency-plumbers/${stateSlug}/${citySlug}`;
}

interface RawPlumber {
  placeId?: string;
  slug?: string;
  name?: string;
  city?: string;
  state?: string;
  serviceCities?: string[];
  googleRating?: number;
  googleReviewCount?: number;
  scrapedAt?: string;
  reviews?: PlumberReview[];
  synthesis?: PlumberSynthesis;
}

interface PlumbersJsonFile {
  meta?: Record<string, unknown>;
  plumbers: RawPlumber[];
}

async function fetchPlumbersJson(): Promise<PlumbersJsonFile | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${JSON_PATH}?ref=main`,
      { headers, next: { revalidate: REVALIDATE_SECONDS } },
    );
    if (!res.ok) return null;
    return (await res.json()) as PlumbersJsonFile;
  } catch {
    return null;
  }
}

function toCandidate(p: RawPlumber): SynthesisCandidate {
  const synth = p.synthesis;
  const hasSummary =
    !!synth && typeof synth.summary === "string" && synth.summary.trim().length > 0;
  return {
    placeId: p.placeId ?? "",
    slug: p.slug ?? "",
    name: p.name ?? "(unnamed)",
    city: p.city ?? "",
    state: p.state ?? "",
    serviceCities: p.serviceCities ?? [],
    googleRating: p.googleRating,
    googleReviewCount: p.googleReviewCount,
    reviewsCachedCount: p.reviews?.length ?? 0,
    scrapedAt: p.scrapedAt,
    hasSynthesis: hasSummary,
    synthesis: synth,
    reviews: p.reviews ?? [],
    pageUrl:
      p.state && cityPageUrl(p.city ?? "", p.state)
        ? plumberPageUrl(p.slug ?? "")
        : undefined,
  };
}

export interface SynthesisQueueSnapshot {
  totalPlumbers: number;
  needingSynthesis: number;
  hasSynthesis: number;
  candidates: SynthesisCandidate[];
}

export async function loadSynthesisQueue(): Promise<SynthesisQueueSnapshot | null> {
  const file = await fetchPlumbersJson();
  if (!file) return null;

  const all = (file.plumbers ?? []).map(toCandidate);
  const needing = all
    .filter((c) => !c.hasSynthesis)
    // Most reviews first — that's where Sonnet synthesis adds the most signal
    .sort(
      (a, b) =>
        b.reviewsCachedCount - a.reviewsCachedCount ||
        (b.googleReviewCount ?? 0) - (a.googleReviewCount ?? 0),
    );

  return {
    totalPlumbers: all.length,
    needingSynthesis: needing.length,
    hasSynthesis: all.length - needing.length,
    candidates: needing,
  };
}

export async function loadCandidate(
  placeIdOrSlug: string,
): Promise<SynthesisCandidate | null> {
  const file = await fetchPlumbersJson();
  if (!file) return null;
  const match = (file.plumbers ?? []).find(
    (p) => p.placeId === placeIdOrSlug || p.slug === placeIdOrSlug,
  );
  return match ? toCandidate(match) : null;
}
