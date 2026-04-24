/**
 * Server-side reader for the scrape queue.
 *
 * Fetches two files from `main` via the GitHub Contents API (auth via
 * the shared GITHUB_TOKEN) and joins them on (city, state):
 *
 *   - apps/plumbers-web/scripts/scrape-queue.json
 *     The canonical ordered queue of cities pending scrape. Each entry:
 *       { city, state, status, estCalls, source }
 *
 *   - apps/plumbers-web/data/gsc-expansion-queue.json
 *     Today's snapshot of GSC-discovered cities with impression counts.
 *     Used to attach impressions/avgPosition to queue rows that came
 *     from GSC.
 *
 * Returns `null` on failure — callers should render an empty KPI rather
 * than fabricating a count.
 */

const REPO = "tdodar01-art/fast-plumber-near-me";
const REVALIDATE_SECONDS = 300;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export type GscTier = "high" | "medium" | "low" | "none";

export interface QueueEntry {
  city: string;
  state: string;
  status: string;
  source: string;
  estCalls: number;
  impressions?: number;
  clicks?: number;
  avgPosition?: number;
  pageTypes?: string[];
  discoveredAt?: string;
  /** fastplumbernearme.com URL for this city (when state maps cleanly). */
  pageUrl?: string;
  /** GSC tier matching scripts/gsc-expansion.js getTier(). `none` when
   *  impressions are 0 or unknown. */
  tier: GscTier;
}

// Mirrors getTier() in scripts/gsc-expansion.js. Keep in sync.
export function tierForImpressions(impr: number | undefined): GscTier {
  if (impr === undefined) return "none";
  if (impr >= 50) return "high";
  if (impr >= 10) return "medium";
  if (impr >= 1) return "low";
  return "none";
}

export const TIER_LABEL: Record<GscTier, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No GSC data",
};

export const TIER_RANGE: Record<GscTier, string> = {
  high: "50+ impressions",
  medium: "10–49 impressions",
  low: "1–9 impressions",
  none: "no recent GSC traffic",
};

export interface QueueSnapshot {
  total: number;
  pending: number;
  monthlyBudget: number;
  usedThisMonth: number;
  currentMonth: string;
  gscGeneratedAt?: string;
  entries: QueueEntry[];
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

function citySlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cityPageUrl(cityName: string, stateAbbr: string): string | undefined {
  const stateSlug = STATE_ABBR_TO_SLUG[stateAbbr.toUpperCase()];
  if (!stateSlug) return undefined;
  return `https://www.fastplumbernearme.com/emergency-plumbers/${stateSlug}/${citySlug(cityName)}`;
}

interface GhContent {
  content?: string;
  encoding?: string;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}?ref=main`,
      { headers, next: { revalidate: REVALIDATE_SECONDS } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as GhContent;
    if (!data.content) return null;
    const raw = Buffer.from(data.content, "base64").toString("utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface ScrapeQueueFile {
  currentMonth: string;
  monthlyBudget: number;
  usedThisMonth: number;
  queue: Array<{
    city: string;
    state: string;
    status: string;
    estCalls: number;
    source: string;
  }>;
}

interface GscQueueFile {
  generatedAt: string;
  cities: Array<{
    city: string;
    state: string;
    citySlug: string;
    stateSlug: string;
    impressions: number;
    clicks: number;
    avgPosition: number;
    pageTypes: string[];
    source: string;
    discoveredAt: string;
  }>;
}

export async function loadQueueSnapshot(): Promise<QueueSnapshot | null> {
  const [queueFile, gscFile] = await Promise.all([
    fetchJson<ScrapeQueueFile>(
      "apps/plumbers-web/scripts/scrape-queue.json",
    ),
    fetchJson<GscQueueFile>(
      "apps/plumbers-web/data/gsc-expansion-queue.json",
    ),
  ]);

  if (!queueFile) return null;

  const gscByKey = new Map<string, GscQueueFile["cities"][number]>();
  if (gscFile) {
    for (const c of gscFile.cities) {
      gscByKey.set(`${c.city.toLowerCase()}|${c.state.toUpperCase()}`, c);
    }
  }

  const entries: QueueEntry[] = queueFile.queue.map((q) => {
    const key = `${q.city.toLowerCase()}|${q.state.toUpperCase()}`;
    const gsc = gscByKey.get(key);
    return {
      city: q.city,
      state: q.state,
      status: q.status,
      source: q.source,
      estCalls: q.estCalls,
      impressions: gsc?.impressions,
      clicks: gsc?.clicks,
      avgPosition: gsc?.avgPosition,
      pageTypes: gsc?.pageTypes,
      discoveredAt: gsc?.discoveredAt,
      pageUrl: cityPageUrl(q.city, q.state),
      tier: tierForImpressions(gsc?.impressions),
    };
  });

  const pending = entries.filter((e) => e.status === "pending").length;

  return {
    total: entries.length,
    pending,
    monthlyBudget: queueFile.monthlyBudget,
    usedThisMonth: queueFile.usedThisMonth,
    currentMonth: queueFile.currentMonth,
    gscGeneratedAt: gscFile?.generatedAt,
    entries,
  };
}
