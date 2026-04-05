#!/usr/bin/env node

/**
 * Upload synthesized plumber data to Firestore.
 * Only runs if service-account.json exists in the project root.
 *
 * Usage:
 *   node scripts/upload-to-firestore.js
 *
 * Reads: data/synthesized/plumbers-synthesized.json
 * Writes to: Firestore 'plumbers' collection (upsert by placeId)
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const INPUT_PATH = path.join(
  __dirname,
  "..",
  "data",
  "synthesized",
  "plumbers-synthesized.json"
);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");

// ---------------------------------------------------------------------------
// Check prerequisites
// ---------------------------------------------------------------------------

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.log("⚠️  service-account.json not found — skipping Firestore upload.");
  console.log("   Place your Firebase service account key at:");
  console.log(`   ${SERVICE_ACCOUNT_PATH}`);
  process.exit(0);
}

if (!fs.existsSync(INPUT_PATH)) {
  console.error(`ERROR: Input file not found: ${INPUT_PATH}`);
  console.error("Run synthesize-reviews.js first (Step 2).");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase Admin SDK (lazy require — only if service account exists)
// ---------------------------------------------------------------------------

let admin;
try {
  admin = require("firebase-admin");
} catch {
  console.error(
    "ERROR: firebase-admin package not installed. Run: npm install firebase-admin"
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rawData = JSON.parse(fs.readFileSync(INPUT_PATH, "utf-8"));
  const plumbers = rawData.plumbers;

  console.log(`\n🔥 Firestore Uploader`);
  console.log(`   Plumbers to upload: ${plumbers.length}`);
  console.log();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const batch_size = 500; // Firestore batch limit
  let batch = db.batch();
  let batchCount = 0;

  for (const plumber of plumbers) {
    if (!plumber.placeId || !plumber.name) {
      skipped++;
      continue;
    }

    const docRef = db.collection("plumbers").doc(plumber.placeId);

    const data = {
      businessName: plumber.name,
      ownerName: "",
      phone: plumber.phone || "",
      website: plumber.website || null,
      email: null,
      address: {
        full: plumber.address || "",
        street: "",
        city: plumber.city || "",
        state: plumber.state || "",
        zip: "",
        lat: plumber.location?.lat || 0,
        lng: plumber.location?.lng || 0,
      },
      serviceCities: [slugify(plumber.city || "")],
      services: [],
      is24Hour: plumber.is24Hour || false,
      licenseNumber: null,
      insured: false,
      yearsInBusiness: null,

      // Verification fields
      verificationStatus: "unverified",
      reliabilityScore: plumber.synthesis?.score || 0,
      lastVerifiedAt: null,
      totalCallAttempts: 0,
      totalCallAnswered: 0,
      answerRate: 0,
      avgResponseTime: 0,

      // Listing
      listingTier: "free",

      // Google data
      googleRating: plumber.googleRating || null,
      googleReviewCount: plumber.googleReviewCount || 0,
      googlePlaceId: plumber.placeId,
      googleVerified: true,
      workingHours: plumber.workingHours || null,
      category: "Plumber",
      businessStatus: plumber.businessStatus || "OPERATIONAL",
      isActive:
        plumber.businessStatus === "OPERATIONAL" || !plumber.businessStatus,

      // Synthesis
      synthesis: plumber.synthesis || null,

      // Metadata
      region: plumber.region || null,
      notes: "Imported from Google Places API + Claude synthesis",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const existing = await docRef.get();
      if (existing.exists) {
        // Update — preserve createdAt
        batch.set(docRef, data, { merge: true });
        updated++;
      } else {
        batch.set(docRef, {
          ...data,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        created++;
      }

      batchCount++;

      // Commit in batches of 500
      if (batchCount >= batch_size) {
        await batch.commit();
        console.log(`  💾 Committed batch (${created + updated} so far)`);
        batch = db.batch();
        batchCount = 0;
        await sleep(100);
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${plumber.name} — ${err.message}`);
      failed++;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Firestore upload complete`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log();

  // Log Firestore upload as its own pipeline run
  try {
    const endTime = new Date();
    await db.collection("pipelineRuns").add({
      script: "upload-firestore",
      startedAt: admin.firestore.Timestamp.fromDate(new Date(endTime.getTime() - 10000)),
      completedAt: admin.firestore.Timestamp.fromDate(endTime),
      durationSeconds: 10,
      status: failed > 0 ? "partial" : "success",
      triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
      summary: {
        created,
        updated,
        skipped,
        failed,
        totalPlumbers: plumbers.length,
      },
    });
    console.log(`📝 Pipeline run logged to Firestore`);
  } catch (logErr) {
    console.error("Warning: failed to log pipeline run:", logErr.message);
  }
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
