#!/usr/bin/env node

/**
 * Ingest GSC sitemap submission/processing status.
 *
 * Pulls the list of submitted sitemaps for the site and their current
 * state (lastDownloaded, lastSubmitted, errors, warnings, contents
 * count) and persists each to Firestore. Useful for detecting silent
 * sitemap fetch failures and stalled discovery.
 *
 * Runs nightly inside daily-scrape.yml.
 *
 * Writes:
 *   Firestore sitemapStatus/<sitemapHash> — latest snapshot per sitemap path
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

function docId(sitemapPath) {
  return crypto.createHash("sha1").update(sitemapPath).digest("hex").slice(0, 24);
}

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("ERROR: service-account.json not found.");
    process.exit(1);
  }

  const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const sc = google.searchconsole({ version: "v1", auth });

  const list = await sc.sitemaps.list({ siteUrl: SITE_URL });
  const sitemaps = list.data.sitemap || [];
  console.log(`Sitemaps submitted: ${sitemaps.length}`);

  const todayIso = new Date().toISOString();
  let written = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const s of sitemaps) {
    const submitted = (s.contents || []).reduce((sum, c) => sum + Number(c.submitted || 0), 0);
    const indexed = (s.contents || []).reduce((sum, c) => sum + Number(c.indexed || 0), 0);
    const errors = Number(s.errors || 0);
    const warnings = Number(s.warnings || 0);
    totalErrors += errors;
    totalWarnings += warnings;

    const doc = {
      path: s.path || null,
      type: s.type || null,
      isPending: !!s.isPending,
      isSitemapsIndex: !!s.isSitemapsIndex,
      lastSubmitted: s.lastSubmitted || null,
      lastDownloaded: s.lastDownloaded || null,
      errors,
      warnings,
      submittedUrls: submitted,
      indexedUrls: indexed,
      contents: s.contents || [],
      lastInspectedAt: todayIso,
    };

    await db.collection("sitemapStatus").doc(docId(s.path || "default")).set(doc, { merge: false });
    written++;
    console.log(
      `  ${s.path}  type=${s.type}  submitted=${submitted}  indexed=${indexed}  errors=${errors}  warnings=${warnings}  lastDownloaded=${s.lastDownloaded || "—"}`
    );
  }

  console.log(`\nDone: ${written} sitemap docs written. Total errors=${totalErrors}, warnings=${totalWarnings}`);
  if (totalErrors > 0) {
    console.log("⚠️  Errors detected — investigate via /admin/sitemap or GSC UI");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
