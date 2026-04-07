#!/usr/bin/env node

/**
 * Request Google indexing for updated pages via the Indexing API,
 * and submit the sitemap via Search Console API.
 *
 * Uses the existing GSC service account credentials.
 * Logs every request to Firestore `indexingRequests` collection.
 *
 * Usage:
 *   node scripts/request-indexing.js /emergency-plumbers/maryland/aberdeen /blog/best-plumbers
 *   node scripts/request-indexing.js --sitemap-only
 *
 * Rate limit: max 200 indexing requests per day (Google's quota).
 * The script checks Firestore for today's request count before proceeding.
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
const SITE_URL = process.env.GSC_SITE_URL || "https://www.fastplumbernearme.com/";
const SITE_ORIGIN = SITE_URL.replace(/\/$/, "");
const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`;
const DAILY_QUOTA = 200;

// ---------------------------------------------------------------------------
// Load .env.local
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

// ---------------------------------------------------------------------------
// Prerequisites
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
// Auth — shared JWT client for both APIs
// ---------------------------------------------------------------------------

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: [
    "https://www.googleapis.com/auth/indexing",
    "https://www.googleapis.com/auth/webmasters",
  ],
});

// ---------------------------------------------------------------------------
// Firebase Admin (lazy — only if service-account.json exists)
// ---------------------------------------------------------------------------

let admin, db;
try {
  admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  db = admin.firestore();
} catch {
  console.warn("WARN: firebase-admin not available — Firestore logging disabled.");
  db = null;
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "2026-04-06"
}

async function getTodayRequestCount() {
  if (!db) return 0;
  const today = todayStr();
  const snap = await db
    .collection("indexingRequests")
    .where("date", "==", today)
    .where("type", "==", "indexing")
    .get();
  return snap.size;
}

async function logRequest(entry) {
  if (!db) return;
  await db.collection("indexingRequests").add(entry);
}

// ---------------------------------------------------------------------------
// Sitemap submission via Search Console API
// ---------------------------------------------------------------------------

async function submitSitemap() {
  console.log(`\nSubmitting sitemap: ${SITEMAP_URL}`);
  const searchconsole = google.searchconsole({ version: "v1", auth });

  try {
    await searchconsole.sitemaps.submit({
      siteUrl: SITE_URL,
      feedpath: SITEMAP_URL,
    });
    console.log("  ✓ Sitemap submitted successfully");

    await logRequest({
      type: "sitemap",
      url: SITEMAP_URL,
      status: "submitted",
      date: todayStr(),
      timestamp: admin ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
    });
    return true;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`  ✗ Sitemap submission failed: ${msg}`);

    await logRequest({
      type: "sitemap",
      url: SITEMAP_URL,
      status: "error",
      error: msg,
      date: todayStr(),
      timestamp: admin ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Indexing API — request URL indexing
// ---------------------------------------------------------------------------

async function requestIndexing(urlPath) {
  const fullUrl = urlPath.startsWith("http") ? urlPath : `${SITE_ORIGIN}${urlPath.startsWith("/") ? "" : "/"}${urlPath}`;

  const indexing = google.indexing({ version: "v3", auth });

  try {
    await indexing.urlNotifications.publish({
      requestBody: {
        url: fullUrl,
        type: "URL_UPDATED",
      },
    });
    console.log(`  ✓ ${fullUrl}`);

    await logRequest({
      type: "indexing",
      url: fullUrl,
      status: "submitted",
      date: todayStr(),
      timestamp: admin ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
    });
    return { url: fullUrl, status: "submitted" };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`  ✗ ${fullUrl} — ${msg}`);

    await logRequest({
      type: "indexing",
      url: fullUrl,
      status: "error",
      error: msg,
      date: todayStr(),
      timestamp: admin ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
    });
    return { url: fullUrl, status: "error", error: msg };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pipeline run logging (shows in admin Activity dashboard)
// ---------------------------------------------------------------------------

async function logPipelineRun(startedAt, summary, error) {
  if (!db) return;
  const completedAt = new Date();
  const durationSeconds = Math.round((completedAt - startedAt) / 1000);
  const hasErrors = !!error || (summary.indexingErrors || 0) > 0;

  await db.collection("pipelineRuns").add({
    script: "request-indexing",
    startedAt: admin.firestore.Timestamp.fromDate(startedAt),
    completedAt: admin.firestore.Timestamp.fromDate(completedAt),
    durationSeconds,
    status: error ? "error" : hasErrors ? "partial" : "success",
    summary,
    ...(error && { error }),
    triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const sitemapOnly = args.includes("--sitemap-only");
  const urls = args.filter((a) => !a.startsWith("--"));
  const startedAt = new Date();

  console.log("=== Request Indexing ===");
  console.log(`Date: ${todayStr()}`);

  // Always submit sitemap
  const sitemapOk = await submitSitemap();

  if (sitemapOnly) {
    console.log("\n--sitemap-only flag set, skipping URL indexing.");
    await logPipelineRun(startedAt, {
      sitemapSubmitted: sitemapOk,
      urlsRequested: 0,
    });
    return;
  }

  if (urls.length === 0) {
    console.log("\nNo URLs provided. Pass paths as arguments to request indexing.");
    console.log("Example: node scripts/request-indexing.js /emergency-plumbers/illinois/crystal-lake");
    await logPipelineRun(startedAt, {
      sitemapSubmitted: sitemapOk,
      urlsRequested: 0,
    });
    return;
  }

  // Check daily quota
  const usedToday = await getTodayRequestCount();
  const remaining = DAILY_QUOTA - usedToday;

  console.log(`\nDaily quota: ${usedToday}/${DAILY_QUOTA} used, ${remaining} remaining`);

  if (remaining <= 0) {
    console.error("ERROR: Daily indexing quota exhausted. Try again tomorrow.");
    await logPipelineRun(startedAt, {
      sitemapSubmitted: sitemapOk,
      urlsRequested: 0,
      quotaExhausted: true,
    }, "Daily indexing quota exhausted");
    process.exit(1);
  }

  const toProcess = urls.slice(0, remaining);
  if (toProcess.length < urls.length) {
    console.warn(`WARN: Only processing ${toProcess.length} of ${urls.length} URLs (quota limit).`);
  }

  console.log(`\nRequesting indexing for ${toProcess.length} URL(s):`);

  const results = [];
  for (const url of toProcess) {
    const result = await requestIndexing(url);
    results.push(result);
  }

  // Summary
  const submitted = results.filter((r) => r.status === "submitted").length;
  const errors = results.filter((r) => r.status === "error").length;
  console.log(`\nDone: ${submitted} submitted, ${errors} failed.`);

  const fullUrls = toProcess.map((u) => u.startsWith("http") ? u : `${SITE_ORIGIN}${u.startsWith("/") ? "" : "/"}${u}`);
  const slugPaths = toProcess.map((u) => u.startsWith("http") ? new URL(u).pathname : (u.startsWith("/") ? u : `/${u}`));

  await logPipelineRun(startedAt, {
    sitemapSubmitted: sitemapOk,
    urlsRequested: toProcess.length,
    indexingSubmitted: submitted,
    indexingErrors: errors,
    urls: fullUrls,
    slugPaths,
  });

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
