/**
 * Flat city list for client components (CitySearch, Footer, etc.)
 */

import { CITY_DATA, type CityInfo } from "./cities-data";
import { STATES_DATA } from "./states-data";

export interface CityListItem {
  name: string;
  state: string; // abbreviation
  stateSlug: string;
  citySlug: string;
  county: string;
}

// Build flat list sorted by name
const list: CityListItem[] = [];
for (const [stateAbbr, cities] of Object.entries(CITY_DATA)) {
  const stateInfo = STATES_DATA[stateAbbr];
  if (!stateInfo) continue;
  for (const [slug, info] of Object.entries(cities)) {
    list.push({
      name: info.name,
      state: stateAbbr,
      stateSlug: stateInfo.slug,
      citySlug: slug,
      county: info.county,
    });
  }
}
list.sort((a, b) => a.name.localeCompare(b.name));

export const CITY_LIST = list;

// Featured cities on the homepage. Picked 2026-04-28 to match where we have
// (a) GSC impressions earning the link, (b) ≥3 scored plumbers within the
// 20-mi radius so the city page actually renders Top 3, and (c) confirmed
// city data so the link doesn't dead-end.
//
// Previous list (LA, Houston, Phoenix, Chicago, NYC, Miami, Dallas, Atlanta,
// Seattle, Denver, Boston, Nashville) was aspirational — most of those
// cities had no plumbers in the system. Replace this list as scrape
// footprint and rankings evolve.
//
// State-keyed because some city slugs (e.g. "lakewood") exist in multiple
// states and the unscoped citySlug filter would surface all of them.
const FEATURED_CITY_KEYS = [
  ["aberdeen", "MD"],          // 2,258 GSC impressions
  ["nashville", "TN"],         // 1,914
  ["aiken", "SC"],             // 1,798
  ["alameda", "CA"],           // 1,095
  ["abilene", "TX"],           //   997
  ["acworth", "GA"],           //   898
  ["prescott-valley", "AZ"],   //   560
  ["huntsville", "AL"],        //   425
  ["lake-zurich", "IL"],       //   285
  ["lompoc", "CA"],            //   232
  ["worcester", "MA"],         //   223
  ["stow", "OH"],              //   213
] as const;

const FEATURED_KEY_SET = new Set(
  FEATURED_CITY_KEYS.map(([slug, state]) => `${slug}|${state}`),
);

// Preserve the order above (impressions desc) rather than alphabetical from
// CITY_LIST. Build a map then walk FEATURED_CITY_KEYS to look each up.
const cityListByKey = new Map(
  CITY_LIST.filter((c) => FEATURED_KEY_SET.has(`${c.citySlug}|${c.state}`))
    .map((c) => [`${c.citySlug}|${c.state}`, c]),
);

export const FEATURED_CITIES: CityListItem[] = FEATURED_CITY_KEYS
  .map(([slug, state]) => cityListByKey.get(`${slug}|${state}`))
  .filter((c): c is CityListItem => c !== undefined);
