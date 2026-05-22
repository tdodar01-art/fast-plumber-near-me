#!/usr/bin/env node

/**
 * Ingest GSC URL Inspection data.
 *
 * For every URL currently earning impressions (last 90 days), call
 * urlInspection.index.inspect and persist the result in Firestore.
 * Captures last-crawl-time, coverage state, canonical, robots state —
 * everything we need to track how Googlebot is treating each page and
 * detect re-crawl latency after we push content changes.
 *
 * Runs nightly inside daily-scrape.yml.
 *
 * Writes:
 *   Firestore urlInspection/<urlHash> — latest snapshot per URL
 *
 * Rate limits: GSC URL Inspection allows ~2k/day. We hit ~750 URLs/day,
 * comfortably under the cap.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { google } = require("googleapis");
const admin = require("firebase-admin");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const SITE_URL = process.env.GSC_SITE_URL || "https://www.fastplumbernearme.com/";
const RATE_LIMIT_MS = 250; // conservative; GSC tolerates more but we have no need to push
const PER_RUN_CAP = Number(process.env.URL_INSPECTION_CAP || 1500);

function urlDocId(url) {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 24);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("ERROR: service-account.json not found.");
    process.exit(1);
  }

  const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  // Log to pipelineRuns so the daily report surfaces this run. Added
  // 2026-05-22 — prior runs ran nightly via cron but never appeared in
  // the report because the script didn't write an entry. The daily-report
  // classifier puts ingest-url-inspection in the "Publish" group as the
  // diagnostic read-back step.
  const startedAt = new Date();

  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const sc = google.searchconsole({ version: "v1", auth });

  // ---------------------------------------------------------------------
  // Step 1: get the URL list — every URL with ≥1 impression in 90 days
  // ---------------------------------------------------------------------
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 90);

  console.log(`Pulling URL list from GSC searchAnalytics (${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)})`);

  const urls = new Set();
  let startRow = 0;
  while (true) {
    const resp = await sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        dimensions: ["page"],
        rowLimit: 25000,
        startRow,
      },
    });
    const rows = resp.data.rows || [];
    for (const r of rows) urls.add(r.keys[0]);
    if (rows.length < 25000) break;
    startRow += 25000;
  }

  console.log(`Distinct URLs to inspect: ${urls.size}`);
  if (urls.size > PER_RUN_CAP) {
    console.log(`Capped at ${PER_RUN_CAP} per run (URL_INSPECTION_CAP env)`);
  }

  // ---------------------------------------------------------------------
  // Step 2: inspect each URL, persist snapshot
  // ---------------------------------------------------------------------
  let ok = 0;
  let failed = 0;
  const todayIso = new Date().toISOString();
  const seen = [...urls].slice(0, PER_RUN_CAP);

  for (let i = 0; i < seen.length; i++) {
    const url = seen[i];
    try {
      const resp = await sc.urlInspection.index.inspect({
        requestBody: { inspectionUrl: url, siteUrl: SITE_URL },
      });
      const r = resp.data.inspectionResult || {};
      const idx = r.indexStatusResult || {};
      const mob = r.mobileUsabilityResult || {};
      const rich = r.richResultsResult || {};

      const doc = {
        url,
        lastInspectedAt: todayIso,
        coverageState: idx.coverageState || null,            // "Submitted and indexed", "Crawled - currently not indexed", etc.
        verdict: idx.verdict || null,                         // PASS / NEUTRAL / FAIL / VERDICT_UNSPECIFIED
        lastCrawlTime: idx.lastCrawlTime || null,             // ISO datetime
        googleCanonical: idx.googleCanonical || null,
        userCanonical: idx.userCanonical || null,
        indexingState: idx.indexingState || null,             // "INDEXING_ALLOWED" etc.
        robotsTxtState: idx.robotsTxtState || null,
        pageFetchState: idx.pageFetchState || null,
        crawledAs: idx.crawledAs || null,
        referringUrls: idx.referringUrls || [],
        sitemap: idx.sitemap || [],
        mobileVerdict: mob.verdict || null,
        richResultsVerdict: rich.verdict || null,
      };

      await db.collection("urlInspection").doc(urlDocId(url)).set(doc, { merge: false });
      ok++;
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${seen.length} done (${ok} ok, ${failed} failed)`);
    } catch (e) {
      failed++;
      const msg = e?.errors?.[0]?.message || e?.message || String(e);
      console.error(`  [${i + 1}/${seen.length}] ${url}: ${msg}`);
      // Rate-limit responses tell us to slow down — back off briefly
      if (/quota|rate/i.test(msg)) await sleep(2000);
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nDone: ${ok} inspected, ${failed} failed`);

  // Quick rollup for the workflow log
  const snap = await db.collection("urlInspection").get();
  const states = {};
  for (const d of snap.docs) {
    const s = d.data().coverageState || "(none)";
    states[s] = (states[s] || 0) + 1;
  }
  console.log("\nCoverage state distribution (all-time, this collection):");
  for (const [k, v] of Object.entries(states).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v}\t${k}`);
  }

  // Log to pipelineRuns so the daily report can count + surface this run.
  try {
    const durationSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
    await db.collection("pipelineRuns").add({
      script: "ingest-url-inspection",
      startedAt: admin.firestore.Timestamp.fromDate(startedAt),
      completedAt: admin.firestore.Timestamp.now(),
      durationSeconds,
      status: failed === 0 ? "success" : ok === 0 ? "error" : "partial",
      summary: {
        urlsInspected: ok,
        urlsFailed: failed,
        urlsRequested: seen.length,
        coverageStates: states,
      },
      triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
    });
  } catch (e) {
    console.error("Failed to log pipelineRun for ingest-url-inspection:", e?.message || e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
