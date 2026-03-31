/**
 * Flat city list for use in client components (CitySearch, Footer, etc.)
 * Derived from CITY_DATA but without the heavy heroContent.
 */

import { CITY_DATA } from "./cities-data";

export interface CityListItem {
  name: string;
  state: string;
  slug: string;
  county: string;
}

export const CITY_LIST: CityListItem[] = Object.entries(CITY_DATA)
  .map(([slug, data]) => ({
    name: data.name,
    state: data.state,
    slug,
    county: data.county,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const FEATURED_CITIES = CITY_LIST.filter((c) =>
  [
    "naperville-il",
    "aurora-il",
    "joliet-il",
    "bolingbrook-il",
    "plainfield-il",
    "wheaton-il",
    "downers-grove-il",
    "schaumburg-il",
    "elgin-il",
    "st-charles-il",
    "crystal-lake-il",
    "batavia-il",
  ].includes(c.slug)
);
