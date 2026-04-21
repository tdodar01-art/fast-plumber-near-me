#!/usr/bin/env node

/**
 * GSC Empty Pages Audit — how many indexed pages have no plumbers?
 *
 * Pulls 90 days of page-level GSC data, parses city/state from each URL,
 * cross-references with CITY_COVERAGE (plumber count within 20 miles),
 * and reports how many indexed city pages are empty (0 plumbers).
 *
 * Usage: node scripts/gsc-empty-pages-audit.js [--csv] [--days=90]
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const SITE_URL = process.env.GSC_SITE_URL || "https://fastplumbernearme.com/";

// ---------------------------------------------------------------------------
// URL parsing — matches gsc-expansion.js patterns
// ---------------------------------------------------------------------------

const STATE_SLUG_TO_ABBR = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new-hampshire": "NH", "new-jersey": "NJ", "new-mexico": "NM", "new-york": "NY",
  "north-carolina": "NC", "north-dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode-island": "RI", "south-carolina": "SC",
  "south-dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west-virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district-of-columbia": "DC",
};

function parseCityUrl(url) {
  const pathStr = url.replace(/https?:\/\/[^/]+/, "").replace(/\/$/, "");

  const epMatch = pathStr.match(/^\/emergency-plumbers\/([^/]+)\/([^/]+)$/);
  if (epMatch) {
    const stateAbbr = STATE_SLUG_TO_ABBR[epMatch[1]];
    if (!stateAbbr) return null;
    return { stateAbbr, citySlug: epMatch[2], pageType: "emergency-plumbers" };
  }

  const svcMatch = pathStr.match(/^\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (svcMatch) {
    const stateAbbr = STATE_SLUG_TO_ABBR[svcMatch[2]];
    if (!stateAbbr) return null;
    return { stateAbbr, citySlug: svcMatch[3], pageType: svcMatch[1] };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Load CITY_COVERAGE (plumbers within 20 miles of each city)
// ---------------------------------------------------------------------------

function loadCityCoverage() {
  const filePath = path.join(__dirname, "..", "src", "lib", "city-coverage.ts");
  const src = fs.readFileSync(filePath, "utf-8");
  const match = src.match(/CITY_COVERAGE:\s*Record<string,\s*number>\s*=\s*(\{[^;]+\});/);
  if (!match) throw new Error("Failed to parse CITY_COVERAGE from city-coverage.ts");
  return JSON.parse(match[1]);
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const CSV_OUT = args.includes("--csv");
const daysArg = args.find((a) => a.startsWith("--days="));
const DAYS = daysArg ? parseInt(daysArg.split("=")[1], 10) : 90;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("ERROR: service-account.json not found.");
    process.exit(1);
  }

  const coverage = loadCityCoverage();
  console.log(`Loaded CITY_COVERAGE: ${Object.keys(coverage).length} cities with plumber counts\n`);

  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - DAYS);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  console.log(`GSC site: ${SITE_URL}`);
  console.log(`Date range: ${startStr} to ${endStr} (${DAYS} days)\n`);

  // Paginate in case > 5000 unique pages
  const allRows = [];
  let startRow = 0;
  const rowLimit = 25000;
  while (true) {
    const resp = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: startStr,
        endDate: endStr,
        dimensions: ["page"],
        rowLimit,
        startRow,
        type: "web",
      },
    });
    const rows = resp.data.rows || [];
    allRows.push(...rows);
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }

  console.log(`GSC returned ${allRows.length} total page URLs with impressions\n`);

  // Aggregate per (stateAbbr, citySlug) — collapse all page types per city
  const cityAgg = new Map();
  let nonCityPages = 0;

  for (const row of allRows) {
    const url = row.keys[0];
    const parsed = parseCityUrl(url);
    if (!parsed) {
      nonCityPages++;
      continue;
    }
    const key = `${parsed.stateAbbr}:${parsed.citySlug}`;
    const existing = cityAgg.get(key) || {
      stateAbbr: parsed.stateAbbr,
      citySlug: parsed.citySlug,
      impressions: 0,
      clicks: 0,
      pageCount: 0,
      pageTypes: new Set(),
      bestPosition: Infinity,
      urls: [],
    };
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.pageCount += 1;
    existing.pageTypes.add(parsed.pageType);
    existing.bestPosition = Math.min(existing.bestPosition, row.position);
    existing.urls.push({ url, pageType: parsed.pageType, impressions: row.impressions, clicks: row.clicks });
    cityAgg.set(key, existing);
  }

  // Also track per-URL (not just per-city) so we can count individual indexed pages
  const perUrlCityPages = allRows
    .map((r) => ({ url: r.keys[0], impressions: r.impressions, clicks: r.clicks, parsed: parseCityUrl(r.keys[0]) }))
    .filter((r) => r.parsed);

  // Classify each city page as populated / empty
  const empty = [];
  const populated = [];
  for (const [key, c] of cityAgg) {
    const plumberCount = coverage[key] || 0;
    const row = { key, ...c, plumberCount, pageTypes: Array.from(c.pageTypes) };
    if (plumberCount === 0) empty.push(row);
    else populated.push(row);
  }

  empty.sort((a, b) => b.impressions - a.impressions);
  populated.sort((a, b) => b.impressions - a.impressions);

  // Per-URL counts
  const emptyUrls = perUrlCityPages.filter((r) => (coverage[`${r.parsed.stateAbbr}:${r.parsed.citySlug}`] || 0) === 0);
  const populatedUrls = perUrlCityPages.filter((r) => (coverage[`${r.parsed.stateAbbr}:${r.parsed.citySlug}`] || 0) > 0);

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  const totalCityImpr = [...cityAgg.values()].reduce((s, c) => s + c.impressions, 0);
  const emptyImpr = empty.reduce((s, c) => s + c.impressions, 0);
  const populatedImpr = populated.reduce((s, c) => s + c.impressions, 0);
  const emptyClicks = empty.reduce((s, c) => s + c.clicks, 0);
  const populatedClicks = populated.reduce((s, c) => s + c.clicks, 0);

  console.log("=== SUMMARY ===\n");
  console.log(`Indexed city page URLs (with any impressions):  ${perUrlCityPages.length}`);
  console.log(`  - On cities WITH plumbers (>=1):              ${populatedUrls.length}`);
  console.log(`  - On cities WITHOUT plumbers (empty):         ${emptyUrls.length}`);
  console.log(`Non-city indexed pages (homepage, blog, etc):   ${nonCityPages}\n`);

  console.log(`Unique cities indexed:            ${cityAgg.size}`);
  console.log(`  - Populated (>=1 plumber):      ${populated.length}`);
  console.log(`  - Empty (0 plumbers):           ${empty.length}  (${((empty.length / cityAgg.size) * 100).toFixed(1)}%)\n`);

  console.log(`Impressions on city pages:        ${totalCityImpr.toLocaleString()}`);
  console.log(`  - From populated cities:        ${populatedImpr.toLocaleString()}  (${((populatedImpr / totalCityImpr) * 100).toFixed(1)}%)`);
  console.log(`  - From empty cities (wasted):   ${emptyImpr.toLocaleString()}  (${((emptyImpr / totalCityImpr) * 100).toFixed(1)}%)\n`);

  console.log(`Clicks on city pages:             ${(populatedClicks + emptyClicks).toLocaleString()}`);
  console.log(`  - From populated cities:        ${populatedClicks.toLocaleString()}`);
  console.log(`  - From empty cities:            ${emptyClicks.toLocaleString()}\n`);

  // Top empty cities by impressions (highest-leverage scrape targets)
  const showTop = 30;
  console.log(`=== TOP ${showTop} EMPTY CITIES BY IMPRESSIONS (scrape these first) ===\n`);
  const header = [
    "City-Slug".padEnd(32),
    "State".padEnd(6),
    "Pages".padStart(6),
    "Impr".padStart(7),
    "Clicks".padStart(7),
    "BestPos".padStart(8),
    "Types".padEnd(30),
  ].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const c of empty.slice(0, showTop)) {
    console.log([
      c.citySlug.padEnd(32),
      c.stateAbbr.padEnd(6),
      String(c.pageCount).padStart(6),
      String(c.impressions).padStart(7),
      String(c.clicks).padStart(7),
      c.bestPosition.toFixed(1).padStart(8),
      c.pageTypes.slice(0, 3).join(",").padEnd(30),
    ].join(" | "));
  }
  if (empty.length > showTop) {
    console.log(`  ... and ${empty.length - showTop} more empty cities`);
  }

  // CSV output
  if (CSV_OUT) {
    const outPath = path.join(__dirname, "..", "data", "gsc-empty-pages-audit.csv");
    const lines = ["city_slug,state,status,plumber_count,page_count,impressions,clicks,best_position,page_types"];
    for (const c of [...empty, ...populated]) {
      lines.push([
        c.citySlug,
        c.stateAbbr,
        c.plumberCount === 0 ? "empty" : "populated",
        c.plumberCount,
        c.pageCount,
        c.impressions,
        c.clicks,
        c.bestPosition.toFixed(1),
        `"${c.pageTypes.join(",")}"`,
      ].join(","));
    }
    fs.writeFileSync(outPath, lines.join("\n"));
    console.log(`\nCSV written to: ${outPath}`);
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  if (err.code) console.error("HTTP status:", err.code);
  if (err.errors) console.error("Details:", JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
