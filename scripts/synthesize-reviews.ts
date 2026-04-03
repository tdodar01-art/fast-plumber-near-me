#!/usr/bin/env npx ts-node --esm
/**
 * Analyze cached reviews and generate categorized synthesis.
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

// ==========================================================================
// KEYWORD DICTIONARIES — organized by category
// ==========================================================================

// Emergency & Response
const FAST_RESPONSE = ["fast", "quick", "rapid", "arrived within", "same day", "came right", "prompt", "timely", "responsive", "right away", "within an hour", "within 30 minutes", "dropped everything"];
const SLOW_RESPONSE = ["slow", "took forever", "waited", "delayed", "hours later", "next day", "books out", "days out", "weeks out", "long wait"];

// Emergency availability
const EMERGENCY_AVAIL = ["emergency", "urgent", "burst", "flood", "leak", "after hours", "weekend", "night", "2am", "3am", "middle of the night", "sunday", "holiday", "christmas", "thanksgiving", "midnight", "late night", "early morning", "24 hour", "24/7"];

// Pricing
const PRICE_POSITIVE = ["fair price", "reasonable", "good value", "affordable", "great price", "honest price", "no surprise", "competitive", "upfront pricing", "transparent pricing", "good deal", "worth every penny", "fair and honest"];
const PRICE_NEGATIVE = ["expensive", "overcharged", "overpriced", "surprise fee", "hidden fee", "price gouging", "rip off", "ripoff", "too much", "highway robbery", "cost more than", "double the quote", "bait and switch", "unexpected charge"];
const PRICE_BUDGET = ["cheapest", "lowest price", "best price", "saved us money", "budget friendly"];
const PRICE_PREMIUM = ["expensive but worth", "not cheap", "premium service", "you get what you pay for", "higher end"];

// Quality & Professionalism
const QUALITY_POSITIVE = ["professional", "courteous", "polite", "respectful", "friendly", "thorough", "knowledgeable", "knew exactly", "diagnosed quickly", "expert", "experienced", "figured it out", "knew what", "professional opinion", "top notch", "excellent work", "quality work", "did a great job", "above and beyond"];
const QUALITY_NEGATIVE = ["botched", "made it worse", "had to call someone else", "came back", "still broken", "shoddy", "poor quality", "didn't know", "misdiagnosed", "couldn't fix", "incompetent", "unprofessional", "half-assed", "careless"];

// Communication
const COMM_POSITIVE = ["great communication", "kept me updated", "called ahead", "texted", "easy to reach", "responsive", "returned my call", "explained everything", "walked me through", "communicated", "kept us informed", "answered the phone", "clear explanation", "patient", "took the time to explain"];
const COMM_NEGATIVE = ["hard to reach", "never called back", "no communication", "didn't update", "ghosted", "ignored my calls", "rude", "couldn't reach", "unreachable", "no callback", "didn't return", "wouldn't answer"];

// Punctuality
const PUNCTUAL_POSITIVE = ["on time", "arrived early", "punctual", "showed up when", "right on schedule", "ahead of schedule", "arrived on time", "prompt arrival"];
const PUNCTUAL_NEGATIVE = ["late", "no-show", "didn't show", "stood me up", "hours late", "kept waiting", "never showed", "missed appointment", "way late"];

// Home & Property Respect
const HOME_POSITIVE = ["clean up", "cleaned up", "tidy", "spotless", "protected", "shoe covers", "drop cloth", "careful with", "respectful of", "left it clean", "cleaner than before", "cleaned up after", "neat and tidy", "covered the floor", "protected our floors"];
const HOME_NEGATIVE = ["mess", "left a mess", "didn't clean", "damaged", "stained", "dirty", "trashed", "left debris", "didn't clean up", "scratched"];

// ==========================================================================
// ANALYSIS FUNCTIONS
// ==========================================================================

function countMatches(texts: string[], keywords: string[]): number {
  return texts.filter((t) => keywords.some((k) => t.includes(k))).length;
}

function getMatchingTexts(texts: string[], keywords: string[]): string[] {
  return texts.filter((t) => keywords.some((k) => t.includes(k)));
}

interface ReviewData { rating: number; text: string; }

interface CategorySignals {
  strengths: string[];
  weaknesses: string[];
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

  // Category-specific signals
  const categories = {
    emergency: { strengths: [] as string[], weaknesses: [] as string[] },
    pricing: { strengths: [] as string[], weaknesses: [] as string[] },
    quality: { strengths: [] as string[], weaknesses: [] as string[] },
    communication: { strengths: [] as string[], weaknesses: [] as string[] },
    homeRespect: { strengths: [] as string[], weaknesses: [] as string[] },
    punctuality: { strengths: [] as string[], weaknesses: [] as string[] },
  };

  // --- EMERGENCY & RESPONSE ---
  const fastCount = countMatches(texts, FAST_RESPONSE);
  if (fastCount / total >= 0.3) {
    const msg = `${fastCount} of ${total} reviewers mention fast response times`;
    strengths.push(msg);
    categories.emergency.strengths.push(msg);
    badges.push("Fast Responder");
  } else if (fastCount > 0) {
    const msg = `Some reviewers note quick arrival times`;
    strengths.push(msg);
    categories.emergency.strengths.push(msg);
  }

  const slowCount = countMatches(texts, SLOW_RESPONSE);
  if (slowCount / total >= 0.15) {
    const msg = `${slowCount} of ${total} reviewers mention delays or slow response`;
    weaknesses.push(msg);
    categories.emergency.weaknesses.push(msg);
    redFlags.push("slow-response");
  } else if (slowCount > 0) {
    const msg = `A few reviewers mention wait times`;
    weaknesses.push(msg);
    categories.emergency.weaknesses.push(msg);
  }

  const emergencyCount = countMatches(texts, EMERGENCY_AVAIL);
  if (emergencyCount / total >= 0.2) {
    const msg = `${emergencyCount} of ${total} reviews mention emergency or after-hours work`;
    emergencySignals.push(msg);
    categories.emergency.strengths.push(msg);
    badges.push("24/7 Verified by Reviews");
  } else if (emergencyCount > 0) {
    const msg = `Some reviews mention emergency situations`;
    emergencySignals.push(msg);
    categories.emergency.strengths.push(msg);
  } else {
    const msg = `No reviews mention after-hours or emergency work`;
    weaknesses.push(msg);
    categories.emergency.weaknesses.push(msg);
  }

  // --- PRICING ---
  const priceGoodCount = countMatches(texts, PRICE_POSITIVE);
  if (priceGoodCount / total >= 0.2) {
    const msg = `Reviewers frequently praise fair and transparent pricing`;
    strengths.push(msg);
    categories.pricing.strengths.push(msg);
    badges.push("Fair Pricing");
  } else if (priceGoodCount > 0) {
    categories.pricing.strengths.push(`Some reviewers mention fair pricing`);
  }

  const priceBadCount = countMatches(texts, PRICE_NEGATIVE);
  if (priceBadCount / total >= 0.15) {
    const msg = `Multiple reviewers mention unexpected or high pricing`;
    weaknesses.push(msg);
    categories.pricing.weaknesses.push(msg);
    redFlags.push("pricing-complaints");
  } else if (priceBadCount > 0) {
    const msg = `A few reviewers note pricing concerns`;
    weaknesses.push(msg);
    categories.pricing.weaknesses.push(msg);
  }

  // Pricing tier detection
  let pricingTier: "budget" | "mid-range" | "premium" | "mixed" | "unknown" = "unknown";
  const budgetCount = countMatches(texts, PRICE_BUDGET);
  const premiumCount = countMatches(texts, PRICE_PREMIUM);
  if (budgetCount > premiumCount && budgetCount > 0) pricingTier = "budget";
  else if (premiumCount > budgetCount && premiumCount > 0) pricingTier = "premium";
  else if (priceGoodCount > priceBadCount && priceGoodCount > 0) pricingTier = "mid-range";
  else if (priceBadCount > 0 && priceGoodCount > 0) pricingTier = "mixed";

  // --- QUALITY & PROFESSIONALISM ---
  const qualGoodCount = countMatches(texts, QUALITY_POSITIVE);
  if (qualGoodCount / total >= 0.3) {
    const msg = `Consistently described as professional and knowledgeable`;
    strengths.push(msg);
    categories.quality.strengths.push(msg);
    badges.push("Clean & Professional");
  } else if (qualGoodCount > 0) {
    categories.quality.strengths.push(`Some reviewers praise their expertise`);
  }

  const qualBadCount = countMatches(texts, QUALITY_NEGATIVE);
  if (qualBadCount / total >= 0.1) {
    const msg = `Some reviewers report quality issues with completed work`;
    weaknesses.push(msg);
    categories.quality.weaknesses.push(msg);
    redFlags.push("quality-concerns");
  } else if (qualBadCount > 0) {
    categories.quality.weaknesses.push(`Isolated quality complaints in reviews`);
  }

  // --- COMMUNICATION ---
  const commGoodCount = countMatches(texts, COMM_POSITIVE);
  if (commGoodCount / total >= 0.2) {
    const msg = `Good communication — explains work and returns calls`;
    strengths.push(msg);
    categories.communication.strengths.push(msg);
    badges.push("Good Communicator");
  } else if (commGoodCount > 0) {
    categories.communication.strengths.push(`Some reviewers praise their communication`);
  }

  const commBadCount = countMatches(texts, COMM_NEGATIVE);
  if (commBadCount / total >= 0.15) {
    const msg = `Some reviewers report difficulty reaching them`;
    weaknesses.push(msg);
    categories.communication.weaknesses.push(msg);
    redFlags.push("communication-issues");
  } else if (commBadCount > 0) {
    categories.communication.weaknesses.push(`A few reviewers had communication issues`);
  }

  // --- PUNCTUALITY ---
  const punctGoodCount = countMatches(texts, PUNCTUAL_POSITIVE);
  if (punctGoodCount / total >= 0.2) {
    const msg = `${punctGoodCount} of ${total} reviewers say they arrived on time or early`;
    strengths.push(msg);
    categories.punctuality.strengths.push(msg);
  } else if (punctGoodCount > 0) {
    categories.punctuality.strengths.push(`Some reviewers note punctual arrivals`);
  }

  const punctBadCount = countMatches(texts, PUNCTUAL_NEGATIVE);
  if (punctBadCount / total >= 0.1) {
    const msg = `${punctBadCount} of ${total} reviewers mention late arrivals or no-shows`;
    weaknesses.push(msg);
    categories.punctuality.weaknesses.push(msg);
    redFlags.push("punctuality-issues");
  } else if (punctBadCount > 0) {
    categories.punctuality.weaknesses.push(`A few reviewers mention lateness`);
  }

  // --- HOME & PROPERTY RESPECT ---
  const homeGoodCount = countMatches(texts, HOME_POSITIVE);
  if (homeGoodCount / total >= 0.15) {
    const msg = `${homeGoodCount} of ${total} reviewers mention they cleaned up after the job`;
    strengths.push(msg);
    categories.homeRespect.strengths.push(msg);
    badges.push("Respects Your Home");
  } else if (homeGoodCount > 0) {
    categories.homeRespect.strengths.push(`Some reviewers note good cleanup habits`);
  }

  const homeBadCount = countMatches(texts, HOME_NEGATIVE);
  if (homeBadCount > 0) {
    const msg = `${homeBadCount} reviewer${homeBadCount > 1 ? "s" : ""} mention${homeBadCount === 1 ? "s" : ""} mess or property concerns`;
    weaknesses.push(msg);
    categories.homeRespect.weaknesses.push(msg);
    if (homeBadCount / total >= 0.1) redFlags.push("property-concerns");
  }

  // --- RATING-BASED SIGNALS ---
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / total;
  if (avgRating >= 4.5 && total >= 10) {
    strengths.push(`Consistently high ratings across ${total} reviews`);
  } else if (avgRating < 3.5 && total >= 5) {
    weaknesses.push(`Below-average ratings — review details for specifics`);
  }

  if (total < 5) {
    weaknesses.push(`Only ${total} reviews — limited data to assess reliability`);
  }

  return {
    strengths: strengths.slice(0, 6),
    weaknesses: weaknesses.slice(0, 5),
    emergencySignals: emergencySignals.slice(0, 3),
    redFlags,
    badges: badges.slice(0, 6),
    reviewCount: total,
    synthesizedAt: Timestamp.now(),
    categories,
    pricingTier,
  };
}

// ==========================================================================
// MAIN
// ==========================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  const db = initFirebase();

  const plumbersSnap = await getDocs(collection(db, "plumbers"));
  let synthesized = 0;
  let warnings = 0;

  for (const plumberDoc of plumbersSnap.docs) {
    const data = plumberDoc.data();

    if (!force && data.reviewSynthesis?.synthesizedAt) {
      const latestReviewSnap = await getDocs(query(
        collection(db, "reviews"),
        where("plumberId", "==", plumberDoc.id),
      ));
      if (latestReviewSnap.size <= (data.reviewSynthesis.reviewCount || 0)) {
        continue;
      }
    }

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

    console.log(`📝 ${data.businessName}: ${synthesis.badges.join(", ") || "no badges"} | ${synthesis.redFlags.length} red flags | pricing: ${synthesis.pricingTier}`);

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
