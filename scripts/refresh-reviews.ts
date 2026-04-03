#!/usr/bin/env npx ts-node --esm
/**
 * Refresh reviews for existing plumbers — fetches only NEW reviews.
 *
 * Usage:
 *   npx ts-node scripts/refresh-reviews.ts [--budget 50] [--dry-run] [--max 20]
 */

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, addDoc,
  getDocs, query, where, orderBy, Timestamp, limit as firestoreLimit,
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
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

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const MONTHLY_BUDGET = 200;
const BUDGET_STOP_PCT = 0.9;
const REFRESH_AFTER_DAYS = 30;
const PLACE_DETAILS_COST_PER_1000 = 17;

function initFirebase() {
  if (getApps().length) return getFirestore();
  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  return getFirestore(app);
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function hashReviewId(authorName: string, text: string): string {
  const input = `${authorName}::${text.slice(0, 100)}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return `rev_${Math.abs(hash).toString(36)}`;
}

async function getMonthlyUsage(db: ReturnType<typeof getFirestore>) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const docRef = doc(db, "apiUsage", monthKey);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return { estimatedCost: 0 };
  return { estimatedCost: snapshot.data().estimatedCost || 0 };
}

async function recordApiUsage(db: ReturnType<typeof getFirestore>, count: number) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const docRef = doc(db, "apiUsage", monthKey);
  const addedCost = (count / 1000) * PLACE_DETAILS_COST_PER_1000;
  const existing = await getDoc(docRef);
  if (existing.exists()) {
    const data = existing.data();
    await updateDoc(docRef, {
      placeDetailsCalls: (data.placeDetailsCalls || 0) + count,
      totalCalls: (data.totalCalls || 0) + count,
      estimatedCost: (data.estimatedCost || 0) + addedCost,
      lastUpdatedAt: Timestamp.now(),
    });
  } else {
    await setDoc(docRef, {
      month: monthKey, year: now.getFullYear(),
      textSearchCalls: 0, placeDetailsCalls: count,
      totalCalls: count, estimatedCost: addedCost,
      lastUpdatedAt: Timestamp.now(),
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const budgetIdx = args.indexOf("--budget");
  const budgetOverride = budgetIdx >= 0 ? parseFloat(args[budgetIdx + 1]) : undefined;
  const maxIdx = args.indexOf("--max");
  const maxPlumbers = maxIdx >= 0 ? parseInt(args[maxIdx + 1]) : 50;

  if (!GOOGLE_API_KEY) {
    console.error("ERROR: GOOGLE_PLACES_API_KEY not set");
    process.exit(1);
  }

  const db = initFirebase();
  const budgetLimit = budgetOverride || MONTHLY_BUDGET;

  // Get plumbers needing refresh
  const plumbersSnap = await getDocs(query(collection(db, "plumbers"), where("cachedFromGoogle", "==", true)));
  const cutoff = new Date(Date.now() - REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000);

  // Sort by lead count (high-traffic first)
  const leadsSnap = await getDocs(collection(db, "leads"));
  const leadCounts: Record<string, number> = {};
  leadsSnap.docs.forEach((d) => {
    const pid = d.data().plumberId;
    leadCounts[pid] = (leadCounts[pid] || 0) + 1;
  });

  const needsRefresh = plumbersSnap.docs
    .filter((d) => {
      const data = d.data();
      if (!data.googlePlaceId) return false;
      const lastRefresh = data.lastReviewRefreshAt?.toDate?.();
      return !lastRefresh || lastRefresh < cutoff;
    })
    .sort((a, b) => (leadCounts[b.id] || 0) - (leadCounts[a.id] || 0))
    .slice(0, maxPlumbers);

  console.log(`📋 ${needsRefresh.length} plumbers need review refresh (of ${plumbersSnap.size} total)`);

  let refreshed = 0;
  let newReviews = 0;
  let apiCalls = 0;

  for (const plumberDoc of needsRefresh) {
    const data = plumberDoc.data();
    const placeId = data.googlePlaceId;

    // Budget check
    const usage = await getMonthlyUsage(db);
    if (usage.estimatedCost >= budgetLimit * BUDGET_STOP_PCT) {
      console.log(`⚠️  Budget guard hit at $${usage.estimatedCost.toFixed(2)}. Stopping.`);
      break;
    }

    console.log(`\n🔄 ${data.businessName} (${leadCounts[plumberDoc.id] || 0} leads)`);

    if (dryRun) {
      console.log("  [DRY RUN] Would fetch reviews");
      continue;
    }

    // Fetch reviews only
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": GOOGLE_API_KEY!,
        "X-Goog-FieldMask": "reviews,rating,userRatingCount",
      },
    });
    apiCalls++;
    const details = await res.json();
    if (details.error) {
      console.log(`  ❌ API error: ${details.error.message}`);
      continue;
    }

    const reviews = (details.reviews as Array<{
      authorAttribution?: { displayName?: string };
      rating?: number;
      text?: { text?: string };
      relativePublishTimeDescription?: string;
      publishTime?: string;
    }>) || [];

    let newForThisPlumber = 0;
    for (const review of reviews) {
      const authorName = review.authorAttribution?.displayName || "Anonymous";
      const text = review.text?.text || "";
      const googleReviewId = hashReviewId(authorName, text);

      // Check duplicate
      const q = query(
        collection(db, "reviews"),
        where("plumberId", "==", plumberDoc.id),
        where("googleReviewId", "==", googleReviewId),
        firestoreLimit(1)
      );
      const existing = await getDocs(q);
      if (!existing.empty) continue;

      await addDoc(collection(db, "reviews"), {
        plumberId: plumberDoc.id,
        googleReviewId,
        authorName,
        rating: review.rating || 0,
        text,
        relativeTimeDescription: review.relativePublishTimeDescription || "",
        publishedAt: review.publishTime || "",
        cachedAt: Timestamp.now(),
      });
      newForThisPlumber++;
      newReviews++;
    }

    // Update plumber
    await updateDoc(doc(db, "plumbers", plumberDoc.id), {
      lastReviewRefreshAt: Timestamp.now(),
      googleRating: details.rating || data.googleRating,
      googleReviewCount: details.userRatingCount || data.googleReviewCount,
    });

    // Rating snapshot
    if (details.rating) {
      await addDoc(collection(db, "ratingSnapshots"), {
        plumberId: plumberDoc.id,
        googleRating: details.rating,
        googleReviewCount: details.userRatingCount || 0,
        snapshotAt: Timestamp.now(),
      });
    }

    refreshed++;
    console.log(`  ✓ ${newForThisPlumber} new reviews (${reviews.length} total from Google)`);
    await sleep(200);
  }

  // Record usage
  if (!dryRun && apiCalls > 0) {
    await recordApiUsage(db, apiCalls);
  }

  console.log("\n📊 Summary:");
  console.log(`  Refreshed: ${refreshed} plumbers`);
  console.log(`  New reviews: ${newReviews}`);
  console.log(`  API calls: ${apiCalls}`);

  if (!dryRun) {
    const usage = await getMonthlyUsage(db);
    console.log(`  Monthly usage: $${usage.estimatedCost.toFixed(2)} / $${budgetLimit}`);
  }
}

main().catch(console.error);
