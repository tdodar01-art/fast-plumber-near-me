#!/usr/bin/env npx ts-node --esm
/**
 * Aggressive review accumulation — continuously caches unique reviews.
 *
 * Google rotates which 5 reviews it returns per request. Every refresh
 * potentially surfaces 1-3 new reviews we haven't seen. We deduplicate
 * by hash and keep accumulating in Firestore forever.
 *
 * Priority queue: highest review gap first, then staleness, then engagement.
 * Saturation detection: backs off after 5 consecutive zero-new refreshes.
 *
 * Usage:
 *   npx ts-node scripts/refresh-reviews.ts [--budget 50] [--dry-run] [--max 50]
 */

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, addDoc,
  getDocs, query, where, Timestamp, limit as firestoreLimit,
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
const COST_PER_CALL = 0.017; // $17 per 1,000 place details calls
const REFRESH_BUDGET_PCT = 0.4; // 40% of budget for refreshes
const SATURATED_THRESHOLD = 5; // consecutive zero-new refreshes before deprioritize
const SATURATED_MIN_INTERVAL_DAYS = 14; // still refresh saturated plumbers every 14 days

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

function daysSince(timestamp: { toDate?: () => Date } | null): number {
  if (!timestamp?.toDate) return 999;
  return (Date.now() - timestamp.toDate().getTime()) / (1000 * 60 * 60 * 24);
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
  const addedCost = count * COST_PER_CALL;
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

// ==========================================================================
// PRIORITY QUEUE
// ==========================================================================

interface PlumberQueueEntry {
  docId: string;
  data: Record<string, unknown>;
  googlePlaceId: string;
  businessName: string;
  googleReviewCount: number;
  cachedReviewCount: number;
  reviewGap: number;
  daysSinceRefresh: number;
  leadCount: number;
  consecutiveZeros: number;
  isSaturated: boolean;
  priority: number;
}

function buildPriorityQueue(
  plumberDocs: Array<{ id: string; data: () => Record<string, unknown> }>,
  leadCounts: Record<string, number>,
  cachedCounts: Record<string, number>,
): PlumberQueueEntry[] {
  const queue: PlumberQueueEntry[] = [];

  for (const plumberDoc of plumberDocs) {
    const data = plumberDoc.data();
    const googlePlaceId = data.googlePlaceId as string;
    if (!googlePlaceId) continue;

    const googleReviewCount = (data.googleReviewCount as number) || 0;
    const cachedReviewCount = cachedCounts[plumberDoc.id] || (data.cachedReviewCount as number) || 0;
    const reviewGap = googleReviewCount - cachedReviewCount;
    const dsr = daysSince(data.lastReviewRefreshAt as { toDate?: () => Date } | null);
    const leadCount = leadCounts[plumberDoc.id] || 0;
    const consecutiveZeros = (data.consecutiveZeroRefreshes as number) || 0;
    const isSaturated = consecutiveZeros >= SATURATED_THRESHOLD;

    // Skip saturated plumbers unless it's been 14+ days
    if (isSaturated && dsr < SATURATED_MIN_INTERVAL_DAYS) continue;

    // Priority score: higher = refresh sooner
    // Primary: review gap (biggest data hole first)
    // Secondary: staleness + engagement
    let priority = reviewGap * 10; // gap dominates
    priority += Math.min(dsr, 30) * 2; // staleness (capped at 30 days)
    priority += Math.min(leadCount, 50); // engagement (capped)
    if (isSaturated) priority *= 0.3; // heavy deprioritization

    queue.push({
      docId: plumberDoc.id,
      data: data as Record<string, unknown>,
      googlePlaceId,
      businessName: (data.businessName as string) || "Unknown",
      googleReviewCount,
      cachedReviewCount,
      reviewGap,
      daysSinceRefresh: Math.round(dsr),
      leadCount,
      consecutiveZeros,
      isSaturated,
      priority,
    });
  }

  return queue.sort((a, b) => b.priority - a.priority);
}

// ==========================================================================
// MAIN
// ==========================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const budgetIdx = args.indexOf("--budget");
  const budgetOverride = budgetIdx >= 0 ? parseFloat(args[budgetIdx + 1]) : undefined;
  const maxIdx = args.indexOf("--max");

  if (!GOOGLE_API_KEY && !dryRun) {
    console.error("ERROR: GOOGLE_PLACES_API_KEY not set");
    process.exit(1);
  }

  const db = initFirebase();
  const budgetLimit = budgetOverride || MONTHLY_BUDGET;

  // Calculate max daily refreshes from budget
  const dailyBudget = (budgetLimit * REFRESH_BUDGET_PCT) / 30;
  const defaultMax = Math.floor(dailyBudget / COST_PER_CALL);
  const maxPlumbers = maxIdx >= 0 ? parseInt(args[maxIdx + 1]) : defaultMax;

  console.log(`📊 Budget: $${budgetLimit}/mo | Refresh allocation: $${(dailyBudget).toFixed(2)}/day | Max refreshes: ${maxPlumbers}`);

  // Load all plumbers
  const plumbersSnap = await getDocs(collection(db, "plumbers"));

  // Count cached reviews per plumber
  const reviewsSnap = await getDocs(collection(db, "reviews"));
  const cachedCounts: Record<string, number> = {};
  reviewsSnap.docs.forEach((d) => {
    const pid = d.data().plumberId as string;
    cachedCounts[pid] = (cachedCounts[pid] || 0) + 1;
  });

  // Count leads per plumber
  const leadsSnap = await getDocs(collection(db, "leads"));
  const leadCounts: Record<string, number> = {};
  leadsSnap.docs.forEach((d) => {
    const pid = d.data().plumberId as string;
    leadCounts[pid] = (leadCounts[pid] || 0) + 1;
  });

  // Build priority queue
  const queue = buildPriorityQueue(plumbersSnap.docs, leadCounts, cachedCounts);
  const toProcess = queue.slice(0, maxPlumbers);

  // Display priority queue
  console.log(`\n📋 Priority Queue (top ${Math.min(15, queue.length)} of ${queue.length}):`);
  queue.slice(0, 15).forEach((entry, i) => {
    const sat = entry.isSaturated ? " [SATURATED]" : "";
    console.log(`  ${i + 1}. ${entry.businessName} (gap: ${entry.reviewGap.toLocaleString()} | cached: ${entry.cachedReviewCount} | last: ${entry.daysSinceRefresh}d ago | leads: ${entry.leadCount})${sat}`);
  });

  if (dryRun) {
    console.log(`\n[DRY RUN] Would refresh ${toProcess.length} plumbers`);
    console.log(`Total review gap across all plumbers: ${queue.reduce((sum, e) => sum + e.reviewGap, 0).toLocaleString()}`);
    return;
  }

  let refreshed = 0;
  let newReviews = 0;
  let apiCalls = 0;

  for (const entry of toProcess) {
    // Budget check
    const usage = await getMonthlyUsage(db);
    if (usage.estimatedCost >= budgetLimit * 0.9) {
      console.log(`⚠️  Budget guard: $${usage.estimatedCost.toFixed(2)} used. Stopping.`);
      break;
    }

    console.log(`\n🔄 ${entry.businessName} (gap: ${entry.reviewGap.toLocaleString()} | cached: ${entry.cachedReviewCount})`);

    // Fetch reviews from Google
    const res = await fetch(`https://places.googleapis.com/v1/places/${entry.googlePlaceId}`, {
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

    // Deduplicate and cache new reviews
    let newForThis = 0;
    for (const review of reviews) {
      const authorName = review.authorAttribution?.displayName || "Anonymous";
      const text = review.text?.text || "";
      if (!text) continue;
      const googleReviewId = hashReviewId(authorName, text);

      const dupeCheck = query(
        collection(db, "reviews"),
        where("plumberId", "==", entry.docId),
        where("googleReviewId", "==", googleReviewId),
        firestoreLimit(1)
      );
      const existing = await getDocs(dupeCheck);
      if (!existing.empty) continue;

      await addDoc(collection(db, "reviews"), {
        plumberId: entry.docId,
        googleReviewId,
        authorName,
        rating: review.rating || 0,
        text,
        relativeTimeDescription: review.relativePublishTimeDescription || "",
        publishedAt: review.publishTime || "",
        cachedAt: Timestamp.now(),
      });
      newForThis++;
      newReviews++;
    }

    // Update plumber accumulation tracking
    const newCachedCount = entry.cachedReviewCount + newForThis;
    const newConsecutiveZeros = newForThis === 0 ? entry.consecutiveZeros + 1 : 0;

    await updateDoc(doc(db, "plumbers", entry.docId), {
      lastReviewRefreshAt: Timestamp.now(),
      googleRating: details.rating || entry.data.googleRating,
      googleReviewCount: details.userRatingCount || entry.googleReviewCount,
      cachedReviewCount: newCachedCount,
      lastRefreshNewCount: newForThis,
      consecutiveZeroRefreshes: newConsecutiveZeros,
      reviewGap: (details.userRatingCount || entry.googleReviewCount) - newCachedCount,
    });

    // Rating snapshot
    if (details.rating) {
      await addDoc(collection(db, "ratingSnapshots"), {
        plumberId: entry.docId,
        googleRating: details.rating,
        googleReviewCount: details.userRatingCount || 0,
        snapshotAt: Timestamp.now(),
      });
    }

    // Re-synthesize if new reviews were found
    if (newForThis > 0) {
      console.log(`  ✓ ${newForThis} new reviews cached (total: ${newCachedCount}) — re-synthesis needed`);
    } else {
      console.log(`  · 0 new (consecutive zeros: ${newConsecutiveZeros})`);
    }

    refreshed++;
    await sleep(200);
  }

  // Record API usage
  if (apiCalls > 0) {
    await recordApiUsage(db, apiCalls);
  }

  // Summary
  const usage = await getMonthlyUsage(db);
  console.log("\n📊 Summary:");
  console.log(`  Refreshed: ${refreshed} plumbers`);
  console.log(`  New unique reviews cached: ${newReviews}`);
  console.log(`  API calls: ${apiCalls} ($${(apiCalls * COST_PER_CALL).toFixed(2)})`);
  console.log(`  Monthly usage: $${usage.estimatedCost.toFixed(2)} / $${budgetLimit}`);
  console.log(`  Total review gap remaining: ${queue.reduce((sum, e) => sum + e.reviewGap, 0).toLocaleString()}`);
}

main().catch(console.error);
