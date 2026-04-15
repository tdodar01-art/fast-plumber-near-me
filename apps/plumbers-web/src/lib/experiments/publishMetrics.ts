/**
 * Publish daily GSC metrics to Firestore for experiment tracking.
 *
 * Writes to: experiment_metrics/plumbers/{slug}/{YYYY-MM-DD}
 * Uses the source-agnostic schema with metrics nested under sources.gsc.
 *
 * EXTRACTION TODO: When extracted, the GSC client and Firestore client
 * will need to be wired in by the consuming app.
 */

import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { getAllTrackedSlugs } from "./activeExperiments";

// ─── Config ───────────────────────────────────────────────

const SITE = "plumbers";
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "..", "..", "..", "service-account.json");
const ENV_PATH = path.join(__dirname, "..", "..", "..", "..", ".env.local");

// ─── Load env ──────────────────────────────────────────────

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── Main ──────────────────────────────────────────────────

export async function publishDailyMetrics(targetDate?: string): Promise<number> {
  loadEnv();

  const slugs = getAllTrackedSlugs();
  if (slugs.length === 0) {
    console.log("[metrics] No tracked slugs — nothing to publish");
    return 0;
  }

  // Initialize Firebase Admin
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account not found at ${SERVICE_ACCOUNT_PATH}`);
  }

  const admin = (await import("firebase-admin")).default;
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const db = admin.firestore();

  // Determine date — default to yesterday (GSC data has ~2 day lag, but we pull what's available)
  const date = targetDate || getYesterdayDate();
  console.log(`[metrics] Publishing metrics for ${date}, ${slugs.length} slugs`);

  // Authenticate with GSC
  const gscSiteUrl = process.env.GSC_SITE_URL || "https://www.fastplumbernearme.com/";
  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  // Pull GSC data for tracked pages
  // Build URL patterns from slugs (state/city → /emergency-plumbers/state/city)
  const urlPatterns = slugs.map((slug) => `/emergency-plumbers/${slug}`);

  const response = await searchconsole.searchanalytics.query({
    siteUrl: gscSiteUrl,
    requestBody: {
      startDate: date,
      endDate: date,
      dimensions: ["page"],
      rowLimit: 5000,
      type: "web",
    },
  });

  const rows = response.data.rows || [];

  // Match rows to slugs
  let published = 0;
  for (const slug of slugs) {
    const urlPattern = `/emergency-plumbers/${slug}`;
    const row = rows.find((r) => {
      const url = r.keys?.[0] || "";
      return url.includes(urlPattern);
    });

    const metrics = {
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      sources: {
        gsc: {
          impressions: row?.impressions || 0,
          clicks: row?.clicks || 0,
          ctr: Math.round((row?.ctr || 0) * 10000) / 10000,
          position: Math.round((row?.position || 0) * 10) / 10,
        },
      },
    };

    // Write to experiment_metrics/plumbers/{slug}/{date}
    // Slug uses slash (state/city), but Firestore doc IDs can't have slashes,
    // so we use the slug as a subcollection path: site → slug-as-collection → date
    const slugDocPath = slug.replace("/", "__"); // texas/garland → texas__garland
    await db
      .collection("experiment_metrics")
      .doc(SITE)
      .collection(slugDocPath)
      .doc(date)
      .set(metrics);

    published++;

    if (row) {
      console.log(`  ${slug}: pos=${metrics.sources.gsc.position} imp=${metrics.sources.gsc.impressions} clicks=${metrics.sources.gsc.clicks}`);
    } else {
      console.log(`  ${slug}: no GSC data for ${date} (wrote zeros)`);
    }
  }

  console.log(`[metrics] Published ${published} slug metrics for ${date}`);
  return published;
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
