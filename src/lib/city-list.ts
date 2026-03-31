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

export const FEATURED_CITIES = CITY_LIST.filter((c) =>
  [
    "los-angeles", "houston", "phoenix", "chicago", "new-york",
    "miami", "dallas", "atlanta", "seattle", "denver",
    "boston", "nashville",
  ].includes(c.citySlug)
).slice(0, 12);
