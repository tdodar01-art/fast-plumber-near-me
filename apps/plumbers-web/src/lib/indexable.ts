/**
 * SINGLE DEFINITION SITE for the indexation predicates (spec §5 CI gate 2,
 * checklist C). Page metadata.robots AND the sitemap segments both import
 * from here so the two can never drift.
 *
 * - Markets: kept market = >=10 listed plumbers AND >=5 quote-backed rankable
 *   cards (C16). markets.json only contains kept markets, but a data refresh
 *   can drop a market below threshold; it then stays live and flips
 *   noindex,follow (hysteresis state, 01 §3.1) — this predicate is what flips.
 * - Plumbers: active + synthesis + >=3 attributed evidence quotes (C5 — 01's
 *   stricter gate). Below the bar renders noindex,follow.
 */

import type { Market } from "./markets";
import type { SynthesizedPlumber } from "./plumber-data";

/** Threshold constants — keep aligned with markets.json meta.thresholds. */
export const MIN_LISTED_PLUMBERS = 10;
export const MIN_RANKABLE_QUOTED = 5;
export const MIN_EMERGENCY_PLUMBERS = 12;
export const MIN_EVIDENCE_QUOTES = 3;

export function isIndexableMarket(market: Market): boolean {
  return (
    market.counts.plumbers >= MIN_LISTED_PLUMBERS &&
    market.counts.rankableQuoted >= MIN_RANKABLE_QUOTED
  );
}

/**
 * Emergency sub-page indexation: the market must be index-eligible itself,
 * carry the hasEmergencyPage flag (route only exists then), and still have
 * enough 24-hour plumbers after refresh.
 */
export function isIndexableEmergencyMarket(market: Market): boolean {
  return (
    isIndexableMarket(market) &&
    market.hasEmergencyPage &&
    market.counts.emergency >= MIN_EMERGENCY_PLUMBERS
  );
}

export function isIndexablePlumber(p: SynthesizedPlumber): boolean {
  const active = !p.businessStatus || p.businessStatus === "OPERATIONAL";
  return (
    active &&
    p.synthesis != null &&
    (p.evidence_quotes?.length ?? 0) >= MIN_EVIDENCE_QUOTES
  );
}
