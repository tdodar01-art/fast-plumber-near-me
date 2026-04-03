#!/usr/bin/env npx ts-node --esm
/**
 * Fetch plumbers from Google Places API (New) and cache in Firestore.
 *
 * Usage:
 *   npx ts-node scripts/fetch-plumbers-v2.ts --state IL --cities "Crystal Lake,McHenry"
 *   npx ts-node scripts/fetch-plumbers-v2.ts --state IL --all-cities
 *   npx ts-node scripts/fetch-plumbers-v2.ts --state IL --cities "Aurora" --dry-run
 *   npx ts-node scripts/fetch-plumbers-v2.ts --state IL --cities "Aurora" --budget 50
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

// Load .env.local manually (no dotenv dependency)
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

// --- Config ---
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const MONTHLY_BUDGET = 200; // $200 free tier
const BUDGET_STOP_PCT = 0.9;

const TEXT_SEARCH_COST_PER_1000 = 32;
const PLACE_DETAILS_COST_PER_1000 = 17;
const CACHE_FRESHNESS_DAYS = 30;

// --- Firebase init ---
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

// --- API usage tracking ---
let apiCallsThisRun = { textSearch: 0, placeDetails: 0 };

async function getMonthlyUsage(db: ReturnType<typeof getFirestore>): Promise<{ totalCalls: number; estimatedCost: number }> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const docRef = doc(db, "apiUsage", monthKey);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return { totalCalls: 0, estimatedCost: 0 };
  const data = snapshot.data();
  return { totalCalls: data.totalCalls || 0, estimatedCost: data.estimatedCost || 0 };
}

async function recordApiUsage(db: ReturnType<typeof getFirestore>, type: "textSearch" | "placeDetails", count: number) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const docRef = doc(db, "apiUsage", monthKey);
  const costPer1000 = type === "textSearch" ? TEXT_SEARCH_COST_PER_1000 : PLACE_DETAILS_COST_PER_1000;
  const addedCost = (count / 1000) * costPer1000;

  const existing = await getDoc(docRef);
  if (existing.exists()) {
    const data = existing.data();
    await updateDoc(docRef, {
      [`${type}Calls`]: (data[`${type}Calls`] || 0) + count,
      totalCalls: (data.totalCalls || 0) + count,
      estimatedCost: (data.estimatedCost || 0) + addedCost,
      lastUpdatedAt: Timestamp.now(),
    });
  } else {
    await setDoc(docRef, {
      month: monthKey,
      year: now.getFullYear(),
      textSearchCalls: type === "textSearch" ? count : 0,
      placeDetailsCalls: type === "placeDetails" ? count : 0,
      totalCalls: count,
      estimatedCost: addedCost,
      lastUpdatedAt: Timestamp.now(),
    });
  }
}

async function checkBudget(db: ReturnType<typeof getFirestore>, budgetOverride?: number): Promise<boolean> {
  const usage = await getMonthlyUsage(db);
  const limit = budgetOverride || MONTHLY_BUDGET;
  if (usage.estimatedCost >= limit * BUDGET_STOP_PCT) {
    console.log(`⚠️  Budget guard: $${usage.estimatedCost.toFixed(2)} used of $${limit} limit (${(BUDGET_STOP_PCT * 100)}% threshold). Stopping.`);
    return false;
  }
  return true;
}

// --- Google Places API (New) ---
const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_BASE = "https://places.googleapis.com/v1/places/";

const TEXT_SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.currentOpeningHours";
const DETAILS_FIELDS = "id,displayName,formattedAddress,location,rating,userRatingCount,nationalPhoneNumber,internationalPhoneNumber,websiteUri,businessStatus,currentOpeningHours,reviews,types,primaryType";

async function textSearch(queryText: string): Promise<Array<{ id: string; [key: string]: unknown }>> {
  const res = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY!,
      "X-Goog-FieldMask": TEXT_SEARCH_FIELDS,
    },
    body: JSON.stringify({ textQuery: queryText, languageCode: "en" }),
  });
  apiCallsThisRun.textSearch++;
  const data = await res.json();
  if (data.error) {
    console.error(`  API error: ${data.error.message}`);
    return [];
  }
  return data.places || [];
}

async function getPlaceDetails(placeId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${PLACE_DETAILS_BASE}${placeId}`, {
    headers: {
      "X-Goog-Api-Key": GOOGLE_API_KEY!,
      "X-Goog-FieldMask": DETAILS_FIELDS,
    },
  });
  apiCallsThisRun.placeDetails++;
  const data = await res.json();
  if (data.error) {
    console.error(`  Details error for ${placeId}: ${data.error.message}`);
    return null;
  }
  return data;
}

// --- Helpers ---
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatPhone(raw: string | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function hashReviewId(authorName: string, text: string): string {
  const input = `${authorName}::${text.slice(0, 100)}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return `rev_${Math.abs(hash).toString(36)}`;
}

function is24Hour(hours: { periods?: Array<{ open?: { hour: number }; close?: { hour: number } }> } | undefined): boolean {
  if (!hours?.periods) return false;
  return hours.periods.some((p) =>
    p.open?.hour === 0 && (!p.close || p.close.hour === 0)
  );
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const stateIdx = args.indexOf("--state");
  const citiesIdx = args.indexOf("--cities");
  const dryRun = args.includes("--dry-run");
  const budgetIdx = args.indexOf("--budget");
  const budgetOverride = budgetIdx >= 0 ? parseFloat(args[budgetIdx + 1]) : undefined;

  const state = stateIdx >= 0 ? args[stateIdx + 1] : null;
  const citiesArg = citiesIdx >= 0 ? args[citiesIdx + 1] : null;

  if (!state) {
    console.error("Usage: --state IL --cities 'Crystal Lake,McHenry' [--dry-run] [--budget 50]");
    process.exit(1);
  }
  if (!GOOGLE_API_KEY) {
    console.error("ERROR: GOOGLE_PLACES_API_KEY not set in .env.local");
    process.exit(1);
  }

  const cities = citiesArg ? citiesArg.split(",").map((c) => c.trim()) : [];
  if (cities.length === 0 && !args.includes("--all-cities")) {
    console.error("Provide --cities 'City1,City2' or --all-cities");
    process.exit(1);
  }

  const db = initFirebase();

  if (!dryRun && !(await checkBudget(db, budgetOverride))) {
    process.exit(0);
  }

  let newPlumbers = 0;
  let updatedPlumbers = 0;
  let cachedReviews = 0;

  const citiesToSearch = cities.length > 0 ? cities : ["(all cities via state search)"];

  for (const city of citiesToSearch) {
    const searchQuery = cities.length > 0
      ? `emergency plumber in ${city}, ${state}`
      : `emergency plumber in ${state}`;

    console.log(`\n🔍 Searching: "${searchQuery}"`);

    if (dryRun) {
      console.log("  [DRY RUN] Would search Google Places API");
      continue;
    }

    // Check budget before each search
    if (!(await checkBudget(db, budgetOverride))) break;

    const places = await textSearch(searchQuery);
    console.log(`  Found ${places.length} results`);
    await sleep(200);

    for (const place of places) {
      const placeId = place.id as string;
      if (!placeId) continue;

      // Check if already cached and fresh
      const existingRef = doc(db, "plumbers", placeId);
      const existing = await getDoc(existingRef);

      if (existing.exists()) {
        const data = existing.data();
        const cachedAt = data.updatedAt?.toDate?.();
        if (cachedAt) {
          const daysSinceCached = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceCached < CACHE_FRESHNESS_DAYS) {
            // Append city to serviceCities if not already there
            const citySlug = slugify(`${city}-${state}`);
            const serviceCities: string[] = data.serviceCities || [];
            if (!serviceCities.includes(citySlug)) {
              await updateDoc(existingRef, { serviceCities: [...serviceCities, citySlug] });
              console.log(`  ↳ ${data.businessName}: added ${citySlug} to service cities`);
            }
            continue;
          }
        }
      }

      // Check budget before details call
      if (!(await checkBudget(db, budgetOverride))) break;

      const details = await getPlaceDetails(placeId);
      if (!details) continue;
      await sleep(200);

      const displayName = (details.displayName as { text?: string })?.text || "";
      const phone = formatPhone(details.nationalPhoneNumber as string);
      if (!phone) {
        console.log(`  ⏭ ${displayName}: no phone number, skipping`);
        continue;
      }

      const citySlug = slugify(`${city}-${state}`);
      const location = details.location as { latitude?: number; longitude?: number } | undefined;
      const address = details.formattedAddress as string || "";

      const plumberData = {
        businessName: displayName,
        ownerName: "",
        phone,
        website: (details.websiteUri as string) || null,
        email: null,
        address: {
          street: "",
          city: city,
          state: state,
          zip: "",
          lat: location?.latitude || 0,
          lng: location?.longitude || 0,
          full: address,
        },
        serviceCities: existing.exists()
          ? [...new Set([...(existing.data().serviceCities || []), citySlug])]
          : [citySlug],
        services: ["emergency", "pipe-repair", "leak-detection"],
        is24Hour: is24Hour(details.currentOpeningHours as { periods?: Array<{ open?: { hour: number }; close?: { hour: number } }> }),
        licenseNumber: null,
        insured: false,
        yearsInBusiness: null,
        verificationStatus: "unverified" as const,
        reliabilityScore: 0,
        lastVerifiedAt: null,
        totalCallAttempts: 0,
        totalCallAnswered: 0,
        answerRate: 0,
        avgResponseTime: 0,
        listingTier: "free" as const,
        googleRating: (details.rating as number) || null,
        googleReviewCount: (details.userRatingCount as number) || null,
        googlePlaceId: placeId,
        googleId: null,
        googleVerified: true,
        workingHours: null,
        category: (details.primaryType as string) || "plumber",
        isAreaService: false,
        photoUrl: null,
        logoUrl: null,
        description: null,
        businessStatus: (details.businessStatus as string) || "OPERATIONAL",
        bookingLink: null,
        social: { facebook: null, instagram: null },
        yelpRating: null,
        isActive: true,
        createdAt: existing.exists() ? existing.data().createdAt : Timestamp.now(),
        updatedAt: Timestamp.now(),
        notes: `Cached from Google Places API on ${new Date().toISOString().slice(0, 10)}`,
        lastReviewRefreshAt: Timestamp.now(),
        reviewSynthesis: null,
        cachedFromGoogle: true,
      };

      // Upsert plumber (use placeId as document ID for deduplication)
      await setDoc(existingRef, plumberData);
      if (existing.exists()) {
        updatedPlumbers++;
        console.log(`  ↻ Updated: ${displayName}`);
      } else {
        newPlumbers++;
        console.log(`  ✓ New: ${displayName} (${phone})`);
      }

      // Cache reviews
      const reviews = (details.reviews as Array<{
        authorAttribution?: { displayName?: string };
        rating?: number;
        text?: { text?: string };
        relativePublishTimeDescription?: string;
        publishTime?: string;
      }>) || [];

      for (const review of reviews) {
        const authorName = review.authorAttribution?.displayName || "Anonymous";
        const text = review.text?.text || "";
        const googleReviewId = hashReviewId(authorName, text);

        // Check for duplicate
        const reviewQ = query(
          collection(db, "reviews"),
          where("plumberId", "==", placeId),
          where("googleReviewId", "==", googleReviewId),
          firestoreLimit(1)
        );
        const existingReview = await getDocs(reviewQ);
        if (!existingReview.empty) continue;

        await addDoc(collection(db, "reviews"), {
          plumberId: placeId,
          googleReviewId,
          authorName,
          rating: review.rating || 0,
          text,
          relativeTimeDescription: review.relativePublishTimeDescription || "",
          publishedAt: review.publishTime || "",
          cachedAt: Timestamp.now(),
        });
        cachedReviews++;
      }

      // Save rating snapshot
      if (plumberData.googleRating) {
        await addDoc(collection(db, "ratingSnapshots"), {
          plumberId: placeId,
          googleRating: plumberData.googleRating,
          googleReviewCount: plumberData.googleReviewCount || 0,
          snapshotAt: Timestamp.now(),
        });
      }
    }
  }

  // Record API usage
  if (!dryRun) {
    if (apiCallsThisRun.textSearch > 0) await recordApiUsage(db, "textSearch", apiCallsThisRun.textSearch);
    if (apiCallsThisRun.placeDetails > 0) await recordApiUsage(db, "placeDetails", apiCallsThisRun.placeDetails);
  }

  console.log("\n📊 Summary:");
  console.log(`  New plumbers: ${newPlumbers}`);
  console.log(`  Updated plumbers: ${updatedPlumbers}`);
  console.log(`  Cached reviews: ${cachedReviews}`);
  console.log(`  API calls: ${apiCallsThisRun.textSearch} text search + ${apiCallsThisRun.placeDetails} details`);

  if (!dryRun) {
    const usage = await getMonthlyUsage(db);
    console.log(`  Monthly usage: $${usage.estimatedCost.toFixed(2)} / $${MONTHLY_BUDGET}`);
  }

  return { newPlumbers, updatedPlumbers, cachedReviews, apiCalls: apiCallsThisRun.textSearch + apiCallsThisRun.placeDetails, cities: citiesToSearch };
}

const startedAt = Timestamp.now();
const startTime = Date.now();

main()
  .then(async (result) => {
    if (!process.argv.includes("--dry-run")) {
      try {
        const db = initFirebase();
        await addDoc(collection(db, "pipelineRuns"), {
          script: "fetch-plumbers",
          startedAt,
          completedAt: Timestamp.now(),
          durationSeconds: Math.round((Date.now() - startTime) / 1000),
          status: "success",
          summary: {
            newPlumbers: result?.newPlumbers ?? 0,
            updatedPlumbers: result?.updatedPlumbers ?? 0,
            citiesSearched: result?.cities ?? [],
            apiCalls: result?.apiCalls ?? 0,
          },
          triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
        });
      } catch { /* logging failure shouldn't crash the script */ }
    }
  })
  .catch(async (err) => {
    console.error(err);
    try {
      const db = initFirebase();
      await addDoc(collection(db, "pipelineRuns"), {
        script: "fetch-plumbers",
        startedAt,
        completedAt: Timestamp.now(),
        durationSeconds: Math.round((Date.now() - startTime) / 1000),
        status: "error",
        summary: {},
        error: String(err),
        triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
      });
    } catch { /* */ }
    process.exit(1);
  });
