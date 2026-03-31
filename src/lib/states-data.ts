export interface StateInfo {
  name: string;
  abbreviation: string;
  slug: string;
}

export const STATES_DATA: Record<string, StateInfo> = {
  AL: { name: "Alabama", abbreviation: "AL", slug: "alabama" },
  AK: { name: "Alaska", abbreviation: "AK", slug: "alaska" },
  AZ: { name: "Arizona", abbreviation: "AZ", slug: "arizona" },
  AR: { name: "Arkansas", abbreviation: "AR", slug: "arkansas" },
  CA: { name: "California", abbreviation: "CA", slug: "california" },
  CO: { name: "Colorado", abbreviation: "CO", slug: "colorado" },
  CT: { name: "Connecticut", abbreviation: "CT", slug: "connecticut" },
  DE: { name: "Delaware", abbreviation: "DE", slug: "delaware" },
  DC: { name: "District of Columbia", abbreviation: "DC", slug: "district-of-columbia" },
  FL: { name: "Florida", abbreviation: "FL", slug: "florida" },
  GA: { name: "Georgia", abbreviation: "GA", slug: "georgia" },
  HI: { name: "Hawaii", abbreviation: "HI", slug: "hawaii" },
  ID: { name: "Idaho", abbreviation: "ID", slug: "idaho" },
  IL: { name: "Illinois", abbreviation: "IL", slug: "illinois" },
  IN: { name: "Indiana", abbreviation: "IN", slug: "indiana" },
  IA: { name: "Iowa", abbreviation: "IA", slug: "iowa" },
  KS: { name: "Kansas", abbreviation: "KS", slug: "kansas" },
  KY: { name: "Kentucky", abbreviation: "KY", slug: "kentucky" },
  LA: { name: "Louisiana", abbreviation: "LA", slug: "louisiana" },
  ME: { name: "Maine", abbreviation: "ME", slug: "maine" },
  MD: { name: "Maryland", abbreviation: "MD", slug: "maryland" },
  MA: { name: "Massachusetts", abbreviation: "MA", slug: "massachusetts" },
  MI: { name: "Michigan", abbreviation: "MI", slug: "michigan" },
  MN: { name: "Minnesota", abbreviation: "MN", slug: "minnesota" },
  MS: { name: "Mississippi", abbreviation: "MS", slug: "mississippi" },
  MO: { name: "Missouri", abbreviation: "MO", slug: "missouri" },
  MT: { name: "Montana", abbreviation: "MT", slug: "montana" },
  NE: { name: "Nebraska", abbreviation: "NE", slug: "nebraska" },
  NV: { name: "Nevada", abbreviation: "NV", slug: "nevada" },
  NH: { name: "New Hampshire", abbreviation: "NH", slug: "new-hampshire" },
  NJ: { name: "New Jersey", abbreviation: "NJ", slug: "new-jersey" },
  NM: { name: "New Mexico", abbreviation: "NM", slug: "new-mexico" },
  NY: { name: "New York", abbreviation: "NY", slug: "new-york" },
  NC: { name: "North Carolina", abbreviation: "NC", slug: "north-carolina" },
  ND: { name: "North Dakota", abbreviation: "ND", slug: "north-dakota" },
  OH: { name: "Ohio", abbreviation: "OH", slug: "ohio" },
  OK: { name: "Oklahoma", abbreviation: "OK", slug: "oklahoma" },
  OR: { name: "Oregon", abbreviation: "OR", slug: "oregon" },
  PA: { name: "Pennsylvania", abbreviation: "PA", slug: "pennsylvania" },
  RI: { name: "Rhode Island", abbreviation: "RI", slug: "rhode-island" },
  SC: { name: "South Carolina", abbreviation: "SC", slug: "south-carolina" },
  SD: { name: "South Dakota", abbreviation: "SD", slug: "south-dakota" },
  TN: { name: "Tennessee", abbreviation: "TN", slug: "tennessee" },
  TX: { name: "Texas", abbreviation: "TX", slug: "texas" },
  UT: { name: "Utah", abbreviation: "UT", slug: "utah" },
  VT: { name: "Vermont", abbreviation: "VT", slug: "vermont" },
  VA: { name: "Virginia", abbreviation: "VA", slug: "virginia" },
  WA: { name: "Washington", abbreviation: "WA", slug: "washington" },
  WV: { name: "West Virginia", abbreviation: "WV", slug: "west-virginia" },
  WI: { name: "Wisconsin", abbreviation: "WI", slug: "wisconsin" },
  WY: { name: "Wyoming", abbreviation: "WY", slug: "wyoming" },
};

export function getStateBySlug(slug: string): StateInfo | undefined {
  return Object.values(STATES_DATA).find((state) => state.slug === slug);
}

export function getStateByAbbr(abbr: string): StateInfo | undefined {
  return STATES_DATA[abbr.toUpperCase()];
}

export function getAllStateSlugs(): string[] {
  return Object.values(STATES_DATA).map((state) => state.slug);
}
