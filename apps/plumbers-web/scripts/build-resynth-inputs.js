#!/usr/bin/env node

/**
 * Build per-batch input JSON files for the 2026-05-07 re-synthesis pass.
 *
 * Identifies plumbers whose synthesis prose still references BBB or
 * complaint-count claims, gathers everything a synthesis agent needs
 * (review text + existing dimension scores + cleaned BBB context), and
 * splits them into N parallel batches written to /tmp/resynth-inputs/.
 *
 * Why we re-synthesize this subset and not all 1,067 plumbers:
 *   Pass 1 (per-review dimension extraction in score-plumbers.ts) reads
 *   only review text and was never contaminated by BBB. The numeric
 *   dimension scores driving every plumber's percentile are clean. Only
 *   Pass 2 (synthesis prose) saw the bad BBB data, and only ~25% of
 *   plumbers have prose that quotes BBB — those are the ones to re-do.
 *
 * Usage:
 *   node scripts/build-resynth-inputs.js [--batches=20]
 *
 * Output:
 *   /tmp/resynth-inputs/batch-1.json … batch-N.json
 *   /tmp/resynth-inputs/meta.json (count + plumber→batch mapping)
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

const OUT_DIR = "/tmp/resynth-inputs";
const REVIEWS_PER_PLUMBER = 30;

function arg(name, def) {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split("=")[1] : def;
}

async function main() {
  const numBatches = parseInt(arg("batches", "20"), 10);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Clean previous outputs
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith(".json")) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  console.log("=== Build Re-synthesis Inputs ===\n");

  // Step 1: identify candidate plumbers — those whose synthesis prose
  // still references BBB or complaint counts. After the locality fix +
  // scrub, that prose is now describing data that may have changed.
  const snap = await db.collection(COLLECTIONS.businesses).where("isActive", "==", true).get();
  const candidates = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const synth = d.reviewSynthesis;
    if (!synth) return;
    const blob = JSON.stringify(synth).toLowerCase();
    if (/bbb|complaint/.test(blob)) candidates.push({ id: doc.id, data: d });
  });

  console.log(`Identified ${candidates.length} contaminated plumbers needing re-synthesis.\n`);

  if (candidates.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  // Step 2: fetch top reviews for each plumber.
  // Mirror score-plumbers.ts behavior: sort by recency desc, take top N.
  console.log(`Fetching up to ${REVIEWS_PER_PLUMBER} reviews per plumber...`);
  const inputs = [];
  let totalReviews = 0;
  let plumbersWithoutReviews = 0;

  for (let i = 0; i < candidates.length; i++) {
    const { id, data } = candidates[i];
    if (i % 25 === 0) console.log(`  ${i}/${candidates.length}...`);

    // Reviews live in the root /reviews collection keyed by plumberId
    // (the plumber's placeId), NOT in a subcollection. publishedAt is a
    // formatted string so we can't ORDER BY it server-side reliably —
    // fetch the lot keyed by plumberId, then sort + slice client-side.
    const reviewsSnap = await db
      .collection(COLLECTIONS.reviews)
      .where("plumberId", "==", id)
      .limit(200) // conservative upper bound per plumber
      .get();

    if (reviewsSnap.empty) {
      plumbersWithoutReviews++;
      continue;
    }

    const allReviews = [];
    reviewsSnap.forEach((rdoc) => {
      const r = rdoc.data();
      allReviews.push({
        review_id: rdoc.id,
        rating: r.rating ?? null,
        text: r.text ?? "",
        publishedAt: r.publishedAt ?? null,
        source: r.source ?? "google",
      });
    });
    // publishedAt is a string like "MM/DD/YYYY HH:MM:SS" — turn into Date
    // for stable sort, falling back to 0 (oldest) when missing/unparseable.
    allReviews.sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db_ = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db_ - da; // newest first
    });
    const reviews = allReviews.slice(0, REVIEWS_PER_PLUMBER);

    if (reviews.length === 0) {
      plumbersWithoutReviews++;
      continue;
    }

    totalReviews += reviews.length;

    inputs.push({
      placeId: id,
      businessName: data.businessName || "",
      address: {
        city: data.address?.city || "",
        state: data.address?.state || "",
      },
      googleRating: data.googleRating ?? null,
      googleReviewCount: data.googleReviewCount ?? 0,
      yelpRating: data.yelpRating ?? null,
      yelpReviewCount: data.yelpReviewCount ?? 0,
      // Pass through existing dimension scores — agents must NOT recompute
      // these. Pass 1 (extraction) was BBB-free and is canonical.
      scores: data.scores
        ? {
            reliability: data.scores.reliability,
            pricing_fairness: data.scores.pricing_fairness,
            workmanship: data.scores.workmanship,
            responsiveness: data.scores.responsiveness,
            communication: data.scores.communication,
            variance: data.scores.variance,
            review_count_used: data.scores.review_count_used,
            specialty_strength: data.scores.specialty_strength || {},
          }
        : null,
      // Cleaned BBB data — may be null if scrubbed or never matched.
      bbb: data.bbb
        ? {
            accredited: data.bbb.accredited ?? null,
            rating: data.bbb.rating ?? null,
            complaintsPast3Years: data.bbb.complaintsPast3Years ?? null,
            yearsInBusiness: data.bbb.yearsInBusiness ?? null,
            bbbCity: data.bbb.bbbCity ?? null,
            bbbState: data.bbb.bbbState ?? null,
          }
        : null,
      reviews,
    });
  }

  console.log(`\nGathered review data for ${inputs.length} plumbers (${totalReviews} reviews total).`);
  if (plumbersWithoutReviews > 0) {
    console.log(`Skipped ${plumbersWithoutReviews} plumbers with no reviews — synthesis can't be regenerated for these.`);
  }

  // Step 3: split into batches.
  const batchSize = Math.ceil(inputs.length / numBatches);
  const batches = [];
  for (let i = 0; i < numBatches && i * batchSize < inputs.length; i++) {
    batches.push(inputs.slice(i * batchSize, (i + 1) * batchSize));
  }

  for (let i = 0; i < batches.length; i++) {
    const fname = path.join(OUT_DIR, `batch-${i + 1}.json`);
    fs.writeFileSync(fname, JSON.stringify(batches[i], null, 2));
    console.log(`Wrote ${fname}: ${batches[i].length} plumbers`);
  }

  // Meta file
  fs.writeFileSync(
    path.join(OUT_DIR, "meta.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalPlumbers: inputs.length,
        totalReviews,
        batches: batches.map((b, i) => ({
          file: `batch-${i + 1}.json`,
          plumbers: b.length,
        })),
      },
      null,
      2,
    ),
  );

  console.log(`\nDone. ${inputs.length} plumbers across ${batches.length} batches.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
