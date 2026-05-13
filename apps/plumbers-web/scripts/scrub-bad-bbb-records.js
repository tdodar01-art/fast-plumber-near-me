#!/usr/bin/env node

/**
 * One-time scrub of stored BBB records that fail the locality check
 * introduced in bbb-lookup.js (2026-05-07).
 *
 * Walks every plumber with a stored `bbb` field and re-validates the
 * stored `bbbUrl` against the plumber's address state. Any record whose
 * URL points to a different state (the symptom of having indexed a
 * national-HQ profile for a franchise chain) gets its `bbb` field
 * deleted entirely so the plumber renders cleanly with no BBB data
 * until the next BBB lookup populates a correctly-localized record.
 *
 * Why nuke the whole `bbb` field instead of just `bbbUrl`?
 *   The other BBB fields (rating, complaints, accredited, years) were
 *   sourced from that wrong record too. Keeping them while nulling the
 *   URL would leave 793-complaint numbers attached to plumbers whose
 *   actual local profile has zero complaints. All-or-nothing.
 *
 * Run with --dry-run first to see what would change.
 *
 * Usage:
 *   node scripts/scrub-bad-bbb-records.js --dry-run
 *   node scripts/scrub-bad-bbb-records.js
 */

const fs = require("fs");
const path = require("path");
const { COLLECTIONS } = require("./config/plumbing-directory.cjs");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("ERROR: service-account.json not found.");
  process.exit(1);
}

const admin = require("firebase-admin");
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

function extractStateFromBbbUrl(url) {
  if (!url) return null;
  const m = url.match(/\/us\/([a-z]{2})\//i);
  return m ? m[1].toUpperCase() : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=== BBB Bad-Record Scrub ===");
  if (dryRun) console.log("DRY RUN — no Firestore writes\n");

  const snap = await db.collection(COLLECTIONS.businesses).get();
  console.log(`Scanning ${snap.size} plumber records...\n`);

  let withBbb = 0;
  let scrubbed = 0;
  let kept = 0;
  let noUrl = 0;
  let noPlumberState = 0;
  const samples = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.bbb) continue;
    withBbb++;

    const plumberState = (data.address?.state || "").toUpperCase();
    const url = data.bbb.bbbUrl;
    const urlState = extractStateFromBbbUrl(url);

    if (!plumberState) {
      noPlumberState++;
      continue;
    }
    if (!url) {
      noUrl++;
      continue;
    }
    if (!urlState) {
      // URL doesn't match the standard /us/<state>/ pattern. Conservative:
      // treat as suspect and scrub.
      samples.push({
        name: data.businessName,
        plumberState,
        urlState: "?",
        url,
        complaints: data.bbb.complaintsPast3Years,
      });
      if (!dryRun) {
        await doc.ref.update({
          bbb: admin.firestore.FieldValue.delete(),
        });
      }
      scrubbed++;
      continue;
    }

    if (urlState !== plumberState) {
      samples.push({
        name: data.businessName,
        plumberState,
        urlState,
        url,
        complaints: data.bbb.complaintsPast3Years,
      });
      if (!dryRun) {
        await doc.ref.update({
          bbb: admin.firestore.FieldValue.delete(),
        });
      }
      scrubbed++;
    } else {
      kept++;
    }
  }

  console.log("=".repeat(60));
  console.log("📊 Summary:");
  console.log(`  Plumbers scanned:           ${snap.size}`);
  console.log(`  With BBB record:            ${withBbb}`);
  console.log(`    Kept (state matches):     ${kept}`);
  console.log(`    Scrubbed (out-of-state):  ${scrubbed}`);
  console.log(`    Skipped (no URL):         ${noUrl}`);
  console.log(`    Skipped (no plumber st.): ${noPlumberState}`);
  console.log();
  console.log("First 15 scrubbed (would-scrub if dry-run):");
  console.log("─".repeat(60));
  for (const s of samples.slice(0, 15)) {
    console.log(`  ${(s.name || "?").padEnd(50).slice(0, 50)} ${s.plumberState} → ${s.urlState}  c3y=${s.complaints ?? "-"}`);
  }
  if (samples.length > 15) console.log(`  ... and ${samples.length - 15} more`);

  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
