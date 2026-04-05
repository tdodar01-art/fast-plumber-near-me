#!/usr/bin/env node

/**
 * GSC Pull Test — verify Search Console API access.
 *
 * Authenticates with service-account.json, pulls 7 days of page-level data
 * for /emergency-plumbers/ URLs, and displays a readable table.
 *
 * Usage:
 *   node scripts/gsc-pull-test.js
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");

// Load .env.local for GSC_SITE_URL
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
// Check prerequisites
// ---------------------------------------------------------------------------

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("ERROR: service-account.json not found at:");
  console.error(`  ${SERVICE_ACCOUNT_PATH}`);
  console.error("");
  console.error("Download it from Firebase Console:");
  console.error("  Project Settings > Service accounts > Generate new private key");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Authenticate
  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
  console.log(`Service account: ${keyFile.client_email}`);
  console.log(`GCP project: ${keyFile.project_id}`);
  console.log(`Site URL: ${SITE_URL}`);
  console.log("");

  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });

  const searchconsole = google.searchconsole({ version: "v1", auth });

  // Date range: last 90 days (GSC keeps 16 months; cast a wide net)
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 90);

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  console.log(`Date range: ${startStr} to ${endStr}`);
  console.log("Fetching page-level data for /emergency-plumbers/ URLs...");
  console.log("");

  const response = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: startStr,
      endDate: endStr,
      dimensions: ["page"],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: "page",
              operator: "contains",
              expression: "/emergency-plumbers/",
            },
          ],
        },
      ],
      rowLimit: 1000,
      type: "web",
    },
  });

  const rows = response.data.rows || [];

  if (rows.length === 0) {
    console.log("No data returned. Possible causes:");
    console.log("  - Search Console API not enabled on this GCP project");
    console.log("  - Service account not added as user in GSC");
    console.log("  - No impressions yet for /emergency-plumbers/ pages");
    return;
  }

  // Sort by impressions descending
  rows.sort((a, b) => b.impressions - a.impressions);

  // Display table
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);

  console.log(`Found ${rows.length} pages with data`);
  console.log(`Total: ${totalImpressions} impressions, ${totalClicks} clicks`);
  console.log("");

  // Header
  const header = [
    "Page URL".padEnd(65),
    "Impr".padStart(6),
    "Clicks".padStart(7),
    "CTR".padStart(7),
    "Pos".padStart(6),
  ].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of rows) {
    // Shorten URL for display
    const url = row.keys[0].replace("https://www.fastplumbernearme.com", "").replace("https://fastplumbernearme.com", "");
    const ctr = (row.ctr * 100).toFixed(1) + "%";
    const pos = row.position.toFixed(1);

    console.log([
      url.padEnd(65),
      String(row.impressions).padStart(6),
      String(row.clicks).padStart(7),
      ctr.padStart(7),
      pos.padStart(6),
    ].join(" | "));
  }

  console.log("");
  console.log("GSC API access is working.");
}

main().catch((err) => {
  console.error("");
  console.error("=== GSC API ERROR ===");
  console.error("");
  console.error("Error message:", err.message);
  if (err.errors) {
    console.error("Details:", JSON.stringify(err.errors, null, 2));
  }
  if (err.code) {
    console.error("HTTP status:", err.code);
  }
  console.error("");

  if (err.message.includes("not enabled") || err.message.includes("accessNotConfigured")) {
    console.error("FIX: Enable the Search Console API in GCP console:");
    console.error("  https://console.cloud.google.com/apis/library/searchconsole.googleapis.com");
  } else if (err.code === 403) {
    console.error("FIX: Add the service account email as a user in Google Search Console:");
    console.error("  1. Go to https://search.google.com/search-console");
    console.error("  2. Select fastplumbernearme.com");
    console.error("  3. Settings > Users and permissions > Add user");
    console.error("  4. Add the service account email with 'Restricted' permission");
  } else if (err.code === 401) {
    console.error("FIX: Check that service-account.json has valid credentials");
  }

  process.exit(1);
});
