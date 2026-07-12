#!/usr/bin/env node

/**
 * generate-markets.js — compute the canonical market list for the ground-up
 * rebuild (2026-07 spam-update recovery, see docs/rebuild/00-REBUILD-SPEC.md).
 *
 * A "market page" (/plumbers/{st}/{city}) exists only for a city that:
 *   1. has >= MIN_LISTED active plumbers within SERVICE_RADIUS_MILES (20mi), AND
 *   2. has >= MIN_RANKABLE_QUOTED quote-backed rankable plumbers (synthesis +
 *      >=1 verbatim evidence quote + >=10 reviews analyzed), AND
 *   3. survives 8-mile greedy market clustering (highest listed count wins) —
 *      two cities 8mi apart share ~70% of their 20mi circles; separate pages
 *      for both is a doorway set by construction.
 *
 * Emits (single-writer: only this script writes these files):
 *   data/synthesized/markets.json          — the kept markets w/ plumber ids + counts
 *   src/lib/generated/redirect-map.json    — legacy {stateSlug}/{citySlug} -> disposition
 *   src/lib/generated/market-states.json   — states that have >=1 market
 *
 * Usage: node scripts/generate-markets.js
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config (thresholds per 00-REBUILD-SPEC C16 / 01-seo-architecture D1-D2)
// ---------------------------------------------------------------------------

const SERVICE_RADIUS_MILES = 20;
const CLUSTER_RADIUS_MILES = 8;
/**
 * Overlap clustering: two cities whose ranked shortlists (top-15 nearest
 * plumbers) share >= this fraction are the same market regardless of raw
 * distance — distance alone misses e.g. Chicago suburbs 8.5mi apart whose
 * 20mi circles contain near-identical plumber sets (the doorway pathology).
 */
const CLUSTER_OVERLAP = 0.6;
const SHORTLIST_SIZE = 15;
const SUBURB_REDIRECT_MILES = 12;
const MIN_LISTED = 10;
const MIN_RANKABLE_QUOTED = 5;
const MIN_RANKABLE_REVIEWS = 10; // googleReviewCount: the business has >=10 public reviews
const MIN_EMERGENCY = 12;
const MAX_LISTED_IDS = 60; // cap stored ids per market (page renders <=15 ranked)

const APP_DIR = path.join(__dirname, "..");
const SYNTH_PATH = path.join(APP_DIR, "data", "synthesized", "plumbers-synthesized.json");
const CITIES_CSV = path.join(__dirname, "data", "us-cities.csv");
const MARKETS_OUT = path.join(APP_DIR, "data", "synthesized", "markets.json");
const GENERATED_DIR = path.join(APP_DIR, "src", "lib", "generated");
const REDIRECTS_OUT = path.join(GENERATED_DIR, "redirect-map.json");
const STATES_OUT = path.join(GENERATED_DIR, "market-states.json");

// Full-name state slugs (legacy URLs) -> two-letter codes (new URLs)
const STATE_SLUGS = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", DC: "district-of-columbia",
  FL: "florida", GA: "georgia", HI: "hawaii", ID: "idaho", IL: "illinois",
  IN: "indiana", IA: "iowa", KS: "kansas", KY: "kentucky", LA: "louisiana",
  ME: "maine", MD: "maryland", MA: "massachusetts", MI: "michigan",
  MN: "minnesota", MS: "mississippi", MO: "missouri", MT: "montana",
  NE: "nebraska", NV: "nevada", NH: "new-hampshire", NJ: "new-jersey",
  NM: "new-mexico", NY: "new-york", NC: "north-carolina", ND: "north-dakota",
  OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
  RI: "rhode-island", SC: "south-carolina", SD: "south-dakota",
  TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont", VA: "virginia",
  WA: "washington", WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
};

/** Matches business-slug.ts slugifyName — MUST stay behaviourally identical. */
function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------------------
// Load plumbers
// ---------------------------------------------------------------------------

const synth = JSON.parse(fs.readFileSync(SYNTH_PATH, "utf-8"));
const plumbers = synth.plumbers
  .filter(
    (p) =>
      p.location && p.location.lat != null && p.location.lng != null &&
      p.businessStatus !== "CLOSED_PERMANENTLY"
  )
  .map((p) => ({
    placeId: p.placeId,
    slug: p.slug,
    lat: p.location.lat,
    lng: p.location.lng,
    state: p.state,
    is24Hour: !!p.is24Hour,
    hasSynthesis: !!p.synthesis,
    quoted: Array.isArray(p.evidence_quotes) && p.evidence_quotes.length > 0,
    googleReviewCount: p.googleReviewCount || 0,
    score: (p.synthesis && typeof p.synthesis.score === "number") ? p.synthesis.score : 0,
    addressCityKey: p.city && p.state ? `${p.state}:${slugify(p.city)}` : null,
    scrapedAt: p.scrapedAt || null,
  }));

// How many plumbers are ADDRESSED in each city — the "is this a real hub" signal
const addressedCount = new Map();
for (const p of plumbers) {
  if (!p.addressCityKey) continue;
  addressedCount.set(p.addressCityKey, (addressedCount.get(p.addressCityKey) || 0) + 1);
}

// rankable card per 02 §6 data contract: synthesis + an established review base
// (>=10 public Google reviews; the analyzed-set size renders with its own
// small-sample caveat in the UI — stored review arrays are capped and are NOT
// a proxy for how established the business is)
for (const p of plumbers) {
  p.rankable = p.hasSynthesis && p.googleReviewCount >= MIN_RANKABLE_REVIEWS;
  p.rankableQuoted = p.rankable && p.quoted;
  p.emergency = p.is24Hour && p.hasSynthesis;
}

// 1-degree grid for radius lookups
const grid = new Map();
for (const p of plumbers) {
  const key = `${Math.floor(p.lat)}:${Math.floor(p.lng)}`;
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(p);
}
function plumbersNear(lat, lng, miles) {
  const out = [];
  const la = Math.floor(lat), lo = Math.floor(lng);
  for (let i = la - 1; i <= la + 1; i++)
    for (let j = lo - 1; j <= lo + 1; j++) {
      const cell = grid.get(`${i}:${j}`);
      if (!cell) continue;
      for (const p of cell) {
        const d = haversineMiles(lat, lng, p.lat, p.lng);
        if (d <= miles) out.push({ p, d });
      }
    }
  return out;
}

// ---------------------------------------------------------------------------
// Load cities & compute 20mi coverage
// ---------------------------------------------------------------------------

const csvLines = fs.readFileSync(CITIES_CSV, "utf-8").split("\n").slice(1);
const cities = [];
const seenCityKeys = new Set();
for (const line of csvLines) {
  if (!line.trim()) continue;
  const m = line.match(/^(\d+),([A-Z]{2}),([^,]+),(?:"([^"]*)"|([^,]*)),(?:"([^"]*)"|([^,]*)),(-?[\d.]+),(-?[\d.]+)/);
  if (!m) continue;
  const state = m[2];
  if (!STATE_SLUGS[state]) continue;
  const name = m[4] || m[5];
  const key = `${STATE_SLUGS[state]}/${slugify(name)}`;
  if (seenCityKeys.has(key)) continue; // first occurrence wins (duplicate rows exist)
  seenCityKeys.add(key);
  cities.push({ state, name, lat: parseFloat(m[8]), lng: parseFloat(m[9]), key });
}

for (const c of cities) {
  const near = plumbersNear(c.lat, c.lng, SERVICE_RADIUS_MILES);
  c.listed = near.length;
  c.rankableQuoted = near.filter((n) => n.p.rankableQuoted).length;
  c.emergencyCount = near.filter((n) => n.p.emergency).length;
  if (c.listed >= MIN_LISTED) {
    // ranked shortlist: what the page would actually show — editorial quality
    // order (synthesis score, then review base), NOT nearest-first. This is
    // the duplication test: neighboring suburbs share the same best plumbers.
    c.shortlist = new Set(
      near
        .filter((n) => n.p.rankableQuoted)
        .sort((a, b) => b.p.score - a.p.score || b.p.googleReviewCount - a.p.googleReviewCount)
        .slice(0, SHORTLIST_SIZE)
        .map((n) => n.p.placeId)
    );
  }
}

const covered = cities.filter((c) => c.listed > 0);
const candidates = cities.filter(
  (c) => c.listed >= MIN_LISTED && c.rankableQuoted >= MIN_RANKABLE_QUOTED
);

// ---------------------------------------------------------------------------
// 8-mile greedy clustering: sort by listed desc (rankableQuoted, then name for
// determinism); keep a candidate only if no kept market within 8 miles.
// ---------------------------------------------------------------------------

candidates.sort(
  (a, b) =>
    b.listed - a.listed ||
    b.rankableQuoted - a.rankableQuoted ||
    a.name.localeCompare(b.name)
);

function shortlistOverlap(a, b) {
  if (!a || !b || a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const id of a) if (b.has(id)) shared++;
  return shared / Math.min(a.size, b.size);
}

const kept = [];
for (const c of candidates) {
  let home = null;
  for (const k of kept) {
    const d = haversineMiles(c.lat, c.lng, k.lat, k.lng);
    if (
      d <= CLUSTER_RADIUS_MILES ||
      // same-inventory test only makes sense for plausibly-shared circles
      (d <= SERVICE_RADIUS_MILES && shortlistOverlap(c.shortlist, k.shortlist) >= CLUSTER_OVERLAP)
    ) {
      home = k;
      break;
    }
  }
  if (home) home.members.push(c);
  else kept.push(Object.assign(c, { members: [c] }));
}

// Re-anchor each cluster to its most plausible hub: the member city where the
// most plumbers are physically addressed (searchers look for the hub name, not
// whichever suburb's circle happened to catch the most plumbers), provided it
// still clears the market thresholds. Tiebreak: listed count, then name.
for (let i = 0; i < kept.length; i++) {
  const cluster = kept[i];
  const best = [...cluster.members]
    .filter((m) => m.listed >= MIN_LISTED && m.rankableQuoted >= MIN_RANKABLE_QUOTED)
    .sort((a, b) => {
      const aAddr = addressedCount.get(`${a.state}:${slugify(a.name)}`) || 0;
      const bAddr = addressedCount.get(`${b.state}:${slugify(b.name)}`) || 0;
      return bAddr - aAddr || b.listed - a.listed || a.name.localeCompare(b.name);
    })[0];
  if (best && best !== cluster) {
    kept[i] = Object.assign(best, { members: cluster.members });
  }
}

// ---------------------------------------------------------------------------
// Assemble markets.json
// ---------------------------------------------------------------------------

const markets = kept.map((c) => {
  // quality order — the order the page renders (rankable first, then the rest)
  const near = plumbersNear(c.lat, c.lng, SERVICE_RADIUS_MILES).sort(
    (a, b) =>
      Number(b.p.rankableQuoted) - Number(a.p.rankableQuoted) ||
      b.p.score - a.p.score ||
      b.p.googleReviewCount - a.p.googleReviewCount ||
      a.d - b.d
  );
  const lastmodTimes = near
    .map((n) => n.p.scrapedAt)
    .filter(Boolean)
    .sort();
  return {
    slug: slugify(c.name),
    st: c.state.toLowerCase(),
    stateSlug: STATE_SLUGS[c.state],
    name: c.name,
    lat: c.lat,
    lng: c.lng,
    counts: {
      plumbers: c.listed,
      rankableQuoted: c.rankableQuoted,
      emergency: c.emergencyCount,
    },
    hasEmergencyPage: c.emergencyCount >= MIN_EMERGENCY,
    plumberIds: near.slice(0, MAX_LISTED_IDS).map((n) => n.p.placeId),
    clusterCities: [], // filled below
    lastmod: lastmodTimes.length ? lastmodTimes[lastmodTimes.length - 1] : synth.meta.synthesizedAt,
  };
});

// Market lookup grid for nearest-market queries
const marketGrid = new Map();
for (const mkt of markets) {
  const key = `${Math.floor(mkt.lat)}:${Math.floor(mkt.lng)}`;
  if (!marketGrid.has(key)) marketGrid.set(key, []);
  marketGrid.get(key).push(mkt);
}
function nearestMarket(lat, lng, maxMiles) {
  let best = null, bestD = Infinity;
  const la = Math.floor(lat), lo = Math.floor(lng);
  for (let i = la - 1; i <= la + 1; i++)
    for (let j = lo - 1; j <= lo + 1; j++) {
      const cell = marketGrid.get(`${i}:${j}`);
      if (!cell) continue;
      for (const mkt of cell) {
        const d = haversineMiles(lat, lng, mkt.lat, mkt.lng);
        if (d < bestD) { best = mkt; bestD = d; }
      }
    }
  return best && bestD <= maxMiles ? { market: best, d: bestD } : null;
}

// ---------------------------------------------------------------------------
// Redirect map: every city with any coverage (the legacy URL universe) gets a
// disposition. Kept markets -> self (new URL). Suburbs within 12mi -> their
// market. Everything else -> 410 ("g" = gone). Unknown cities are handled by
// the middleware fallback (410), so only covered cities need entries.
// ---------------------------------------------------------------------------

const keptKeys = new Set(kept.map((c) => c.key));
const redirectMap = {};
let suburb301 = 0, gone410 = 0;

for (const mkt of markets) {
  redirectMap[`${mkt.stateSlug}/${mkt.slug}`] = {
    t: `/plumbers/${mkt.st}/${mkt.slug}`,
    e: mkt.hasEmergencyPage ? `/plumbers/${mkt.st}/${mkt.slug}/emergency` : undefined,
  };
}

for (const c of covered) {
  if (keptKeys.has(c.key)) continue;
  if (redirectMap[c.key]) continue; // slug collision with a kept market: market wins
  const nm = nearestMarket(c.lat, c.lng, SUBURB_REDIRECT_MILES);
  if (nm) {
    redirectMap[c.key] = {
      t: `/plumbers/${nm.market.st}/${nm.market.slug}`,
      e: nm.market.hasEmergencyPage
        ? `/plumbers/${nm.market.st}/${nm.market.slug}/emergency`
        : undefined,
    };
    nm.market.clusterCities.push(c.name);
    suburb301++;
  } else {
    redirectMap[c.key] = { g: 1 };
    gone410++;
  }
}

// Keep clusterCities bounded and nearest-first-ish (alphabetical is fine for display)
for (const mkt of markets) {
  mkt.clusterCities = [...new Set(mkt.clusterCities)].sort().slice(0, 24);
}

const marketStates = [...new Set(markets.map((m) => m.st))].sort();

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(
  MARKETS_OUT,
  JSON.stringify({ meta: { generatedFrom: synth.meta.synthesizedAt, radiusMiles: SERVICE_RADIUS_MILES, clusterMiles: CLUSTER_RADIUS_MILES, thresholds: { MIN_LISTED, MIN_RANKABLE_QUOTED, MIN_EMERGENCY } }, markets }, null, 0)
);
fs.writeFileSync(REDIRECTS_OUT, JSON.stringify(redirectMap));
fs.writeFileSync(STATES_OUT, JSON.stringify(marketStates));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const emergencyPages = markets.filter((m) => m.hasEmergencyPage).length;
const medListed = markets.map((m) => m.counts.plumbers).sort((a, b) => a - b)[Math.floor(markets.length / 2)];
const medQuoted = markets.map((m) => m.counts.rankableQuoted).sort((a, b) => a - b)[Math.floor(markets.length / 2)];
console.log(`plumbers (active, coords): ${plumbers.length}`);
console.log(`covered cities (>=1 plumber): ${covered.length}`);
console.log(`candidates (>=${MIN_LISTED} listed, >=${MIN_RANKABLE_QUOTED} rankable-quoted): ${candidates.length}`);
console.log(`kept markets after ${CLUSTER_RADIUS_MILES}mi clustering: ${markets.length} across ${marketStates.length} states`);
console.log(`emergency pages (>=${MIN_EMERGENCY} 24h w/ synthesis): ${emergencyPages}`);
console.log(`median listed per market: ${medListed}; median rankable-quoted: ${medQuoted}`);
console.log(`redirect map: ${Object.keys(redirectMap).length} keys — ${markets.length} markets, ${suburb301} suburb 301s, ${gone410} 410s`);
console.log(`\nwrote ${MARKETS_OUT}`);
console.log(`wrote ${REDIRECTS_OUT}`);
console.log(`wrote ${STATES_OUT}`);

// Sanity: Chicago-suburb cluster spot check
const chi = markets.filter((m) => m.st === "il").slice(0, 8).map((m) => `${m.name}(${m.counts.plumbers})`);
console.log(`\nIL markets (first 8 by insertion): ${chi.join(", ")}`);
