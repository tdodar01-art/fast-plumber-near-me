#!/usr/bin/env npx ts-node --esm
/**
 * Analyze cached reviews and generate synthesis (strengths, weaknesses, badges).
 * Uses keyword matching — no AI API calls needed.
 *
 * Usage:
 *   npx ts-node scripts/synthesize-reviews.ts [--dry-run] [--force]
 */

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, doc, getDocs, updateDoc, query, where, Timestamp,
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

// --- Keyword dictionaries ---
const FAST_KEYWORDS = ["fast", "quick", "rapid", "arrived within", "same day", "came right", "prompt", "timely", "on time", "responsive"];
const SLOW_KEYWORDS = ["slow", "took forever", "waited", "delayed", "late", "no-show", "didn't show", "never showed", "hours later"];
const PRICE_POSITIVE = ["fair price", "reasonable", "good value", "affordable", "great price", "honest price", "no surprise"];
const PRICE_NEGATIVE = ["expensive", "overcharged", "overpriced", "surprise fee", "hidden fee", "price gouging", "rip off", "ripoff", "too much"];
const PROFESSIONAL = ["professional", "courteous", "polite", "respectful", "clean", "tidy", "neat", "friendly", "thorough"];
const COMMUNICATION_GOOD = ["communicated", "explained", "kept us informed", "called ahead", "responsive", "returned my call", "answered the phone"];
const COMMUNICATION_BAD = ["hard to reach", "didn't return", "no callback", "never answered", "couldn't reach", "unreachable", "ghosted"];
const EMERGENCY_KEYWORDS = ["emergency", "urgent", "burst", "flood", "leak", "after hours", "weekend", "night", "2am", "3am", "middle of the night", "sunday", "holiday", "christmas", "thanksgiving"];
const QUALITY_BAD = ["botched", "made it worse", "had to call someone else", "came back", "still broken", "shoddy", "poor quality"];

function countMatches(texts: string[], keywords: string[]): number {
  return texts.filter((t) => keywords.some((k) => t.includes(k))).length;
}

interface ReviewData {
  rating: number;
  text: string;
}

function synthesize(reviews: ReviewData[]) {
  const total = reviews.length;
  if (total === 0) return null;

  const texts = reviews.map((r) => r.text.toLowerCase());
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const emergencySignals: string[] = [];
  const redFlags: string[] = [];
  const badges: string[] = [];

  // Fast response
  const fastCount = countMatches(texts, FAST_KEYWORDS);
  if (fastCount / total >= 0.3) {
    strengths.push(`${fastCount} of ${total} reviewers mention fast response times`);
    badges.push("Fast Responder");
  } else if (fastCount > 0 && fastCount / total >= 0.15) {
    strengths.push(`Some reviewers note quick arrival times`);
  }

  // Slow / no-show
  const slowCount = countMatches(texts, SLOW_KEYWORDS);
  if (slowCount / total >= 0.15) {
    weaknesses.push(`${slowCount} of ${total} reviewers mention delays or slow response`);
    redFlags.push("slow-response");
  } else if (slowCount > 0) {
    weaknesses.push(`A few reviewers mention wait times`);
  }

  // Pricing — positive
  const priceGoodCount = countMatches(texts, PRICE_POSITIVE);
  if (priceGoodCount / total >= 0.2) {
    strengths.push(`Reviewers frequently praise fair and transparent pricing`);
    badges.push("Fair Pricing");
  }

  // Pricing — negative
  const priceBadCount = countMatches(texts, PRICE_NEGATIVE);
  if (priceBadCount / total >= 0.15) {
    weaknesses.push(`Multiple reviewers mention unexpected or high pricing`);
    redFlags.push("pricing-complaints");
  } else if (priceBadCount > 0) {
    weaknesses.push(`A few reviewers note pricing concerns`);
  }

  // Professionalism
  const proCount = countMatches(texts, PROFESSIONAL);
  if (proCount / total >= 0.3) {
    strengths.push(`Consistently described as professional and courteous`);
    badges.push("Clean & Professional");
  }

  // Communication
  const commGoodCount = countMatches(texts, COMMUNICATION_GOOD);
  if (commGoodCount / total >= 0.2) {
    strengths.push(`Good communication — explains work and returns calls`);
    badges.push("Good Communicator");
  }

  const commBadCount = countMatches(texts, COMMUNICATION_BAD);
  if (commBadCount / total >= 0.15) {
    weaknesses.push(`Some reviewers report difficulty reaching them by phone`);
    redFlags.push("communication-issues");
  }

  // Emergency signals
  const emergencyCount = countMatches(texts, EMERGENCY_KEYWORDS);
  if (emergencyCount / total >= 0.2) {
    emergencySignals.push(`${emergencyCount} of ${total} reviews mention emergency or after-hours work`);
    badges.push("24/7 Verified by Reviews");
  } else if (emergencyCount > 0) {
    emergencySignals.push(`Some reviews mention emergency situations`);
  } else {
    weaknesses.push(`No reviews mention after-hours or emergency work`);
  }

  // Quality issues
  const qualityBadCount = countMatches(texts, QUALITY_BAD);
  if (qualityBadCount / total >= 0.1) {
    weaknesses.push(`Some reviewers report quality issues with completed work`);
    redFlags.push("quality-concerns");
  }

  // Rating-based signals
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / total;
  if (avgRating >= 4.5 && total >= 10) {
    strengths.push(`Consistently high ratings across ${total} reviews`);
  } else if (avgRating < 3.5 && total >= 5) {
    weaknesses.push(`Below-average ratings — review details for specifics`);
  }

  // Low review count warning
  if (total < 5) {
    weaknesses.push(`Only ${total} reviews — limited data to assess reliability`);
  }

  return {
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 4),
    emergencySignals: emergencySignals.slice(0, 3),
    redFlags,
    badges: badges.slice(0, 5),
    reviewCount: total,
    synthesizedAt: Timestamp.now(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  const db = initFirebase();

  // Get all plumbers with cached reviews
  const plumbersSnap = await getDocs(collection(db, "plumbers"));
  let synthesized = 0;
  let warnings = 0;

  for (const plumberDoc of plumbersSnap.docs) {
    const data = plumberDoc.data();

    // Skip if already synthesized and not forced
    if (!force && data.reviewSynthesis?.synthesizedAt) {
      // Check if there are newer reviews
      const latestReviewSnap = await getDocs(query(
        collection(db, "reviews"),
        where("plumberId", "==", plumberDoc.id),
      ));
      if (latestReviewSnap.size <= (data.reviewSynthesis.reviewCount || 0)) {
        continue; // No new reviews
      }
    }

    // Get all reviews for this plumber
    const reviewsSnap = await getDocs(query(
      collection(db, "reviews"),
      where("plumberId", "==", plumberDoc.id),
    ));

    if (reviewsSnap.empty) continue;

    const reviews: ReviewData[] = reviewsSnap.docs.map((d) => ({
      rating: d.data().rating || 0,
      text: d.data().text || "",
    }));

    const synthesis = synthesize(reviews);
    if (!synthesis) continue;

    console.log(`📝 ${data.businessName}: ${synthesis.badges.join(", ") || "no badges"} | ${synthesis.redFlags.length} red flags`);

    if (synthesis.redFlags.length > 0) warnings++;

    if (!dryRun) {
      await updateDoc(doc(db, "plumbers", plumberDoc.id), {
        reviewSynthesis: synthesis,
        updatedAt: Timestamp.now(),
      });
    }

    synthesized++;
  }

  console.log("\n📊 Summary:");
  console.log(`  Synthesized: ${synthesized} plumbers`);
  console.log(`  With warnings/red flags: ${warnings}`);
}

main().catch(console.error);
