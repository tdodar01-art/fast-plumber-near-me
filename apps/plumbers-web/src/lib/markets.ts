/**
 * Typed loader for the committed market data (data/synthesized/markets.json)
 * plus joins into plumbers-synthesized.json.
 *
 * Node runtime ONLY — reads from the filesystem at build time. Every consumer
 * is a statically generated route (generateStaticParams) or the sitemap; there
 * is zero runtime Firestore on this path. All loads are module-level cached.
 *
 * markets.json is produced by scripts/generate-markets.js (Epic 1). This file
 * is read-only over it — single-writer invariant respected.
 */

import fs from "fs";
import path from "path";
import { calculateDistance } from "./geo";
import { getAllPlumbers, type SynthesizedPlumber } from "./plumber-data";

export interface MarketCounts {
  /** Listed plumbers assigned to this market (max 60 ids carried). */
  plumbers: number;
  /** Plumbers with synthesis + >=1 attributed evidence quote (rankable per 02 §6). */
  rankableQuoted: number;
  /** 24-hour plumbers with synthesis (emergency-page eligibility input). */
  emergency: number;
}

export interface Market {
  /** City slug, lowercase kebab (e.g. "aurora"). */
  slug: string;
  /** Two-letter lowercase state code (e.g. "il"). */
  st: string;
  /** Full-name state slug, legacy URL space only (e.g. "illinois"). */
  stateSlug: string;
  /** Display city name (e.g. "Aurora"). */
  name: string;
  lat: number;
  lng: number;
  counts: MarketCounts;
  /** True when the market qualifies for /plumbers/{st}/{city}/emergency. */
  hasEmergencyPage: boolean;
  /** placeIds in editorial-quality order (page renders <=15 ranked). */
  plumberIds: string[];
  /** Suburb names collapsed into this market — rendered as Areas Served. */
  clusterCities: string[];
  /** Real last-modified ISO stamp for sitemaps (never new Date()). */
  lastmod: string;
}

export interface MarketsMeta {
  generatedFrom: string;
  radiusMiles: number;
  clusterMiles: number;
  thresholds: {
    MIN_LISTED: number;
    MIN_RANKABLE_QUOTED: number;
    MIN_EMERGENCY: number;
  };
}

interface MarketsFile {
  meta: MarketsMeta;
  markets: Market[];
}

let cached: MarketsFile | null = null;

function loadMarketsFile(): MarketsFile {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "data", "synthesized", "markets.json");
  cached = JSON.parse(fs.readFileSync(filePath, "utf-8")) as MarketsFile;
  return cached;
}

export function getMarketsMeta(): MarketsMeta {
  return loadMarketsFile().meta;
}

export function getMarkets(): Market[] {
  return loadMarketsFile().markets;
}

// ---------------------------------------------------------------------------
// Lookups (module-level cached)
// ---------------------------------------------------------------------------

let marketIndex: Map<string, Market> | null = null;

function getMarketIndex(): Map<string, Market> {
  if (!marketIndex) {
    marketIndex = new Map();
    for (const m of getMarkets()) marketIndex.set(`${m.st}/${m.slug}`, m);
  }
  return marketIndex;
}

/** Resolve a market by two-letter state code + city slug (case-insensitive). */
export function getMarket(st: string, city: string): Market | undefined {
  return getMarketIndex().get(`${st.toLowerCase()}/${city.toLowerCase()}`);
}

let byState: Map<string, Market[]> | null = null;

/**
 * Markets grouped by two-letter state code, each group sorted by listed-plumber
 * count descending (biggest markets first).
 */
export function getMarketsByState(): Map<string, Market[]> {
  if (!byState) {
    byState = new Map();
    for (const m of getMarkets()) {
      const group = byState.get(m.st);
      if (group) group.push(m);
      else byState.set(m.st, [m]);
    }
    for (const group of byState.values()) {
      group.sort((a, b) => b.counts.plumbers - a.counts.plumbers);
    }
  }
  return byState;
}

/** Markets for one state (empty array when the state has none). */
export function getStateMarkets(st: string): Market[] {
  return getMarketsByState().get(st.toLowerCase()) ?? [];
}

/** Two-letter lowercase state codes that have at least one market. */
export function getMarketStateCodes(): string[] {
  return [...getMarketsByState().keys()].sort();
}

// ---------------------------------------------------------------------------
// Plumber joins
// ---------------------------------------------------------------------------

let plumberById: Map<string, SynthesizedPlumber> | null = null;

function getPlumberIdIndex(): Map<string, SynthesizedPlumber> {
  if (!plumberById) {
    plumberById = new Map();
    for (const p of getAllPlumbers()) plumberById.set(p.placeId, p);
  }
  return plumberById;
}

/**
 * Resolve a market's plumberIds into full records, preserving the committed
 * editorial-quality order. Ids that no longer resolve (record dropped from a
 * later export) are silently skipped rather than rendered as holes.
 */
export function getMarketPlumbers(market: Market): SynthesizedPlumber[] {
  const index = getPlumberIdIndex();
  const result: SynthesizedPlumber[] = [];
  for (const id of market.plumberIds) {
    const p = index.get(id);
    if (p) result.push(p);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Geo
// ---------------------------------------------------------------------------

export interface NearbyMarket {
  market: Market;
  distanceMiles: number;
}

/**
 * The n nearest OTHER markets by haversine distance. Kept markets only by
 * construction (markets.json contains nothing else), so nearby links never
 * point at thin/gone cities.
 */
export function nearbyMarkets(market: Market, n: number): NearbyMarket[] {
  const others: NearbyMarket[] = [];
  for (const m of getMarkets()) {
    if (m.st === market.st && m.slug === market.slug) continue;
    others.push({
      market: m,
      distanceMiles: calculateDistance(market.lat, market.lng, m.lat, m.lng),
    });
  }
  others.sort((a, b) => a.distanceMiles - b.distanceMiles);
  return others.slice(0, n);
}
