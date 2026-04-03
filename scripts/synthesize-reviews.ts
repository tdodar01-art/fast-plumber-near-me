#!/usr/bin/env npx ts-node --esm
/**
 * Analyze cached reviews and generate categorized synthesis.
 * Aggressive negative signal detection — treats hedged language, "but" clauses,
 * and low-star reviews as real complaints. Emergency red flags are disqualifying.
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
// KEYWORD DICTIONARIES
// ==========================================================================

const FAST_RESPONSE = ["fast", "quick", "rapid", "arrived within", "same day", "came right", "prompt", "timely", "responsive", "right away", "within an hour", "within 30 minutes", "dropped everything"];
const SLOW_RESPONSE = ["slow", "took forever", "waited", "delayed", "hours later", "next day", "books out", "days out", "weeks out", "long wait"];
const EMERGENCY_AVAIL = ["emergency", "urgent", "burst", "flood", "leak", "after hours", "weekend", "night", "2am", "3am", "middle of the night", "sunday", "holiday", "christmas", "thanksgiving", "midnight", "late night", "early morning", "24 hour", "24/7"];

const PRICE_POSITIVE = ["fair price", "reasonable", "good value", "affordable", "great price", "honest price", "no surprise", "competitive", "upfront pricing", "transparent pricing", "good deal", "worth every penny", "fair and honest"];
const PRICE_NEGATIVE = ["expensive", "overcharged", "overpriced", "surprise fee", "hidden fee", "price gouging", "rip off", "ripoff", "too much", "highway robbery", "cost more than", "double the quote", "bait and switch", "unexpected charge"];
const PRICE_BUDGET = ["cheapest", "lowest price", "best price", "saved us money", "budget friendly"];
const PRICE_PREMIUM = ["expensive but worth", "not cheap", "premium service", "you get what you pay for", "higher end"];

const QUALITY_POSITIVE = ["professional", "courteous", "polite", "respectful", "friendly", "thorough", "knowledgeable", "knew exactly", "diagnosed quickly", "expert", "experienced", "figured it out", "knew what", "professional opinion", "top notch", "excellent work", "quality work", "did a great job", "above and beyond"];
const QUALITY_NEGATIVE = ["botched", "made it worse", "had to call someone else", "came back", "still broken", "shoddy", "poor quality", "didn't know", "misdiagnosed", "couldn't fix", "incompetent", "unprofessional", "half-assed", "careless"];

const COMM_POSITIVE = ["great communication", "kept me updated", "called ahead", "texted", "easy to reach", "responsive", "returned my call", "explained everything", "walked me through", "communicated", "kept us informed", "answered the phone", "clear explanation", "patient", "took the time to explain"];
const COMM_NEGATIVE = ["hard to reach", "never called back", "no communication", "didn't update", "ghosted", "ignored my calls", "rude", "couldn't reach", "unreachable", "no callback", "didn't return", "wouldn't answer"];

const PUNCTUAL_POSITIVE = ["on time", "arrived early", "punctual", "showed up when", "right on schedule", "ahead of schedule", "arrived on time", "prompt arrival"];
const PUNCTUAL_NEGATIVE = ["late", "no-show", "didn't show", "stood me up", "hours late", "kept waiting", "never showed", "missed appointment", "way late"];

const HOME_POSITIVE = ["clean up", "cleaned up", "tidy", "spotless", "protected", "shoe covers", "drop cloth", "careful with", "respectful of", "left it clean", "cleaner than before", "cleaned up after", "neat and tidy", "covered the floor", "protected our floors"];
const HOME_NEGATIVE = ["mess", "left a mess", "didn't clean", "damaged", "stained", "dirty", "trashed", "left debris", "didn't clean up", "scratched"];

// HEDGED NEGATIVES — soft language that hides real complaints
const HEDGED_NEGATIVES: Array<{ pattern: string; category: string; signal: string }> = [
  { pattern: "a bit expensive", category: "pricing", signal: "Pricing concerns (described as 'a bit expensive')" },
  { pattern: "not the cheapest", category: "pricing", signal: "Pricing concerns (described as 'not the cheapest')" },
  { pattern: "took a while", category: "emergency", signal: "Slow response (described as 'took a while')" },
  { pattern: "took longer than expected", category: "emergency", signal: "Slower than expected response time" },
  { pattern: "wasn't the fastest", category: "emergency", signal: "Response time concerns" },
  { pattern: "had to wait", category: "emergency", signal: "Required waiting for service" },
  { pattern: "a little messy", category: "homeRespect", signal: "Minor cleanliness concerns" },
  { pattern: "bit of a runaround", category: "communication", signal: "Communication difficulties reported" },
  { pattern: "hard to get ahold of", category: "communication", signal: "Difficult to reach by phone" },
  { pattern: "could have been better", category: "quality", signal: "Quality described as 'could have been better'" },
  { pattern: "could have communicated better", category: "communication", signal: "Communication could be improved" },
  { pattern: "wish they had", category: "quality", signal: "Unmet expectations noted" },
  { pattern: "would have been nice if", category: "quality", signal: "Unmet expectations noted" },
];

// EMERGENCY DISQUALIFIERS — even 1 mention is a red flag for an emergency directory
const EMERGENCY_DISQUALIFIERS = [
  "didn't answer", "went to voicemail", "no answer", "never answered",
  "next day", "couldn't come today", "had to wait until tomorrow",
  "9 to 5", "business hours only", "not available on weekends", "closed on weekends",
  "had to call someone else", "called back the next day", "didn't pick up",
  "not 24", "not available after", "morning only", "weekdays only",
];

// "BUT" SIGNAL WORDS — everything after these words is likely a complaint
const BUT_SIGNALS = ["but ", "however ", "although ", "except ", "only issue", "only complaint", "only problem", "my only", "one downside", "one thing"];

// ==========================================================================
// ANALYSIS FUNCTIONS
// ==========================================================================

function countMatches(texts: string[], keywords: string[]): number {
  return texts.filter((t) => keywords.some((k) => t.includes(k))).length;
}

interface ReviewData { rating: number; text: string; }

/**
 * Extract complaints from "but" clauses.
 * "Great work but a bit pricey" → extracts "a bit pricey"
 */
function extractButComplaints(text: string): string[] {
  const complaints: string[] = [];
  const lower = text.toLowerCase();
  for (const signal of BUT_SIGNALS) {
    const idx = lower.indexOf(signal);
    if (idx >= 0) {
      const after = text.slice(idx + signal.length).trim();
      // Take the clause after "but" — up to period/end
      const clause = after.split(/[.!]/)[0].trim();
      if (clause.length > 5 && clause.length < 200) {
        complaints.push(clause);
      }
    }
  }
  return complaints;
}

/**
 * Categorize a "but" complaint by matching against keyword dictionaries.
 */
function categorizeComplaint(complaint: string): string | null {
  const lower = complaint.toLowerCase();
  if (PRICE_NEGATIVE.some((k) => lower.includes(k)) || lower.includes("expens") || lower.includes("pric") || lower.includes("cost")) return "pricing";
  if (SLOW_RESPONSE.some((k) => lower.includes(k)) || lower.includes("wait") || lower.includes("slow") || lower.includes("took")) return "emergency";
  if (COMM_NEGATIVE.some((k) => lower.includes(k)) || lower.includes("communicat") || lower.includes("reach") || lower.includes("rude")) return "communication";
  if (HOME_NEGATIVE.some((k) => lower.includes(k)) || lower.includes("mess") || lower.includes("clean") || lower.includes("dirty")) return "homeRespect";
  if (PUNCTUAL_NEGATIVE.some((k) => lower.includes(k)) || lower.includes("late") || lower.includes("time")) return "punctuality";
  if (QUALITY_NEGATIVE.some((k) => lower.includes(k)) || lower.includes("quality") || lower.includes("work")) return "quality";
  return null;
}

function synthesize(reviews: ReviewData[]) {
  const total = reviews.length;
  if (total === 0) return null;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const emergencySignals: string[] = [];
  const redFlags: string[] = [];
  const badges: string[] = [];

  const categories = {
    emergency: { strengths: [] as string[], weaknesses: [] as string[] },
    pricing: { strengths: [] as string[], weaknesses: [] as string[] },
    quality: { strengths: [] as string[], weaknesses: [] as string[] },
    communication: { strengths: [] as string[], weaknesses: [] as string[] },
    homeRespect: { strengths: [] as string[], weaknesses: [] as string[] },
    punctuality: { strengths: [] as string[], weaknesses: [] as string[] },
  };

  // Track negative signal counts across reviews for frequency thresholds
  const negativeCounts: Record<string, number> = {};
  function trackNegative(key: string) {
    negativeCounts[key] = (negativeCounts[key] || 0) + 1;
  }

  // Emergency disqualifier flag
  let hasEmergencyDisqualifier = false;

  // Process each review individually (star-weighted)
  for (const review of reviews) {
    const text = review.text.toLowerCase();
    const isLowStar = review.rating <= 2;
    const isMidStar = review.rating === 3;
    const isHighStar = review.rating >= 4;
    const isPerfect = review.rating === 5;

    // --- Check emergency disqualifiers (immediate red flag, even 1 mention) ---
    for (const disqualifier of EMERGENCY_DISQUALIFIERS) {
      if (text.includes(disqualifier)) {
        hasEmergencyDisqualifier = true;
        trackNegative(`emergency:${disqualifier}`);
      }
    }

    // --- "But" extraction ---
    const butComplaints = extractButComplaints(review.text);
    for (const complaint of butComplaints) {
      const cat = categorizeComplaint(complaint);
      if (cat) {
        trackNegative(`but:${cat}`);
        if (cat in categories) {
          const catKey = cat as keyof typeof categories;
          if (!categories[catKey].weaknesses.includes(complaint)) {
            categories[catKey].weaknesses.push(complaint);
          }
        }
      }
    }

    // --- Hedged negatives ---
    for (const hedge of HEDGED_NEGATIVES) {
      if (text.includes(hedge.pattern)) {
        trackNegative(`hedge:${hedge.category}`);
        const catKey = hedge.category as keyof typeof categories;
        if (catKey in categories && !categories[catKey].weaknesses.includes(hedge.signal)) {
          categories[catKey].weaknesses.push(hedge.signal);
        }
      }
    }

    // --- Low-star reviews: extract ALL negatives ---
    if (isLowStar || isMidStar) {
      // Check every negative category
      for (const kw of SLOW_RESPONSE) { if (text.includes(kw)) trackNegative("slow"); }
      for (const kw of PRICE_NEGATIVE) { if (text.includes(kw)) trackNegative("price-negative"); }
      for (const kw of QUALITY_NEGATIVE) { if (text.includes(kw)) trackNegative("quality-negative"); }
      for (const kw of COMM_NEGATIVE) { if (text.includes(kw)) trackNegative("comm-negative"); }
      for (const kw of PUNCTUAL_NEGATIVE) { if (text.includes(kw)) trackNegative("punctual-negative"); }
      for (const kw of HOME_NEGATIVE) { if (text.includes(kw)) trackNegative("home-negative"); }
    }

    // --- 4-star with negatives: still flag ---
    if (isHighStar && !isPerfect) {
      for (const kw of PRICE_NEGATIVE) { if (text.includes(kw)) trackNegative("price-negative"); }
      for (const kw of COMM_NEGATIVE) { if (text.includes(kw)) trackNegative("comm-negative"); }
      for (const kw of SLOW_RESPONSE) { if (text.includes(kw)) trackNegative("slow"); }
    }
  }

  // Now do standard keyword analysis across all texts
  const texts = reviews.map((r) => r.text.toLowerCase());

  // --- EMERGENCY & RESPONSE ---
  const fastCount = countMatches(texts, FAST_RESPONSE);
  // Only award Fast Responder if NO emergency disqualifiers
  if (!hasEmergencyDisqualifier && fastCount / total >= 0.3) {
    const msg = `${fastCount} of ${total} reviewers mention fast response times`;
    strengths.push(msg);
    categories.emergency.strengths.push(msg);
    badges.push("Fast Responder");
  } else if (!hasEmergencyDisqualifier && fastCount > 0) {
    const msg = `Some reviewers note quick arrival times`;
    strengths.push(msg);
    categories.emergency.strengths.push(msg);
  }

  if (hasEmergencyDisqualifier) {
    const disqualifierMentions = Object.entries(negativeCounts)
      .filter(([k]) => k.startsWith("emergency:"))
      .reduce((sum, [, v]) => sum + v, 0);
    const msg = `${disqualifierMentions} review${disqualifierMentions > 1 ? "s" : ""} mention${disqualifierMentions === 1 ? "s" : ""} not answering or unavailability`;
    weaknesses.push(msg);
    categories.emergency.weaknesses.push(msg);
    redFlags.push("emergency-unavailable");
  }

  const slowCount = countMatches(texts, SLOW_RESPONSE);
  const hedgedSlowCount = (negativeCounts["hedge:emergency"] || 0) + (negativeCounts["slow"] || 0);
  const totalSlowSignals = slowCount + hedgedSlowCount;
  if (totalSlowSignals >= 2) {
    const msg = `Multiple reviewers mention slow response times`;
    weaknesses.push(msg);
    categories.emergency.weaknesses.push(msg);
    redFlags.push("slow-response");
  } else if (totalSlowSignals > 0) {
    const msg = `Response time concerns noted in reviews`;
    weaknesses.push(msg);
    categories.emergency.weaknesses.push(msg);
  }

  const emergencyCount = countMatches(texts, EMERGENCY_AVAIL);
  if (!hasEmergencyDisqualifier && emergencyCount / total >= 0.2) {
    const msg = `${emergencyCount} of ${total} reviews mention emergency or after-hours work`;
    emergencySignals.push(msg);
    categories.emergency.strengths.push(msg);
    badges.push("24/7 Verified by Reviews");
  } else if (emergencyCount > 0) {
    emergencySignals.push(`Some reviews mention emergency situations`);
  } else {
    weaknesses.push(`No reviews mention after-hours or emergency work`);
    categories.emergency.weaknesses.push(`No reviews mention after-hours or emergency work`);
  }

  // --- PRICING ---
  const priceGoodCount = countMatches(texts, PRICE_POSITIVE);
  const priceBadCount = countMatches(texts, PRICE_NEGATIVE);
  const hedgedPriceCount = negativeCounts["hedge:pricing"] || 0;
  const totalPriceNeg = priceBadCount + hedgedPriceCount + (negativeCounts["price-negative"] || 0);

  if (totalPriceNeg >= 2) {
    const msg = `Multiple reviewers mention pricing concerns`;
    weaknesses.push(msg);
    categories.pricing.weaknesses.push(msg);
    redFlags.push("pricing-complaints");
  } else if (totalPriceNeg > 0) {
    const msg = `Pricing concerns noted in reviews`;
    weaknesses.push(msg);
    categories.pricing.weaknesses.push(msg);
  }

  if (priceGoodCount / total >= 0.2 && totalPriceNeg === 0) {
    strengths.push(`Reviewers frequently praise fair and transparent pricing`);
    categories.pricing.strengths.push(`Reviewers frequently praise fair and transparent pricing`);
    badges.push("Fair Pricing");
  }

  let pricingTier: "budget" | "mid-range" | "premium" | "mixed" | "unknown" = "unknown";
  const budgetCount = countMatches(texts, PRICE_BUDGET);
  const premiumCount = countMatches(texts, PRICE_PREMIUM);
  if (budgetCount > premiumCount && budgetCount > 0) pricingTier = "budget";
  else if (premiumCount > budgetCount && premiumCount > 0) pricingTier = "premium";
  else if (priceGoodCount > totalPriceNeg && priceGoodCount > 0) pricingTier = "mid-range";
  else if (totalPriceNeg > 0 && priceGoodCount > 0) pricingTier = "mixed";

  // --- QUALITY ---
  const qualGoodCount = countMatches(texts, QUALITY_POSITIVE);
  const qualBadTotal = countMatches(texts, QUALITY_NEGATIVE) + (negativeCounts["quality-negative"] || 0) + (negativeCounts["hedge:quality"] || 0);

  if (qualGoodCount / total >= 0.3 && qualBadTotal === 0) {
    strengths.push(`Consistently described as professional and knowledgeable`);
    categories.quality.strengths.push(`Consistently described as professional and knowledgeable`);
    badges.push("Clean & Professional");
  } else if (qualGoodCount > 0) {
    categories.quality.strengths.push(`Some reviewers praise their expertise`);
  }
  if (qualBadTotal >= 2) {
    weaknesses.push(`Multiple reviewers report quality issues`);
    categories.quality.weaknesses.push(`Multiple reviewers report quality issues`);
    redFlags.push("quality-concerns");
  }

  // --- COMMUNICATION ---
  const commGoodCount = countMatches(texts, COMM_POSITIVE);
  const commBadTotal = countMatches(texts, COMM_NEGATIVE) + (negativeCounts["comm-negative"] || 0) + (negativeCounts["hedge:communication"] || 0);

  if (commGoodCount / total >= 0.2 && commBadTotal === 0) {
    strengths.push(`Good communication — explains work and returns calls`);
    categories.communication.strengths.push(`Good communication — explains work and returns calls`);
    badges.push("Good Communicator");
  }
  if (commBadTotal >= 2) {
    weaknesses.push(`Multiple reviewers report communication difficulties`);
    categories.communication.weaknesses.push(`Multiple reviewers report communication difficulties`);
    redFlags.push("communication-issues");
  } else if (commBadTotal > 0) {
    categories.communication.weaknesses.push(`Communication concerns noted`);
  }

  // --- PUNCTUALITY ---
  const punctGoodCount = countMatches(texts, PUNCTUAL_POSITIVE);
  const punctBadTotal = countMatches(texts, PUNCTUAL_NEGATIVE) + (negativeCounts["punctual-negative"] || 0);

  if (punctGoodCount / total >= 0.2 && punctBadTotal === 0) {
    strengths.push(`${punctGoodCount} of ${total} reviewers say they arrived on time or early`);
    categories.punctuality.strengths.push(`Arrives on time — confirmed by reviewers`);
  }
  if (punctBadTotal >= 2) {
    weaknesses.push(`Multiple reviewers mention late arrivals or no-shows`);
    categories.punctuality.weaknesses.push(`Late arrivals or no-shows reported`);
    redFlags.push("punctuality-issues");
  }

  // --- HOME RESPECT ---
  const homeGoodCount = countMatches(texts, HOME_POSITIVE);
  const homeBadTotal = countMatches(texts, HOME_NEGATIVE) + (negativeCounts["home-negative"] || 0) + (negativeCounts["hedge:homeRespect"] || 0);

  if (homeGoodCount / total >= 0.15 && homeBadTotal === 0) {
    strengths.push(`Reviewers note they clean up after the job`);
    categories.homeRespect.strengths.push(`Cleans up after the job — confirmed by reviewers`);
    badges.push("Respects Your Home");
  }
  if (homeBadTotal >= 2) {
    weaknesses.push(`Property/cleanliness concerns reported`);
    categories.homeRespect.weaknesses.push(`Property/cleanliness concerns reported`);
    redFlags.push("property-concerns");
  }

  // --- RATING-BASED ---
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / total;
  if (avgRating >= 4.5 && total >= 10) {
    strengths.push(`Consistently high ratings across ${total} reviews`);
  } else if (avgRating < 3.5 && total >= 5) {
    weaknesses.push(`Below-average ratings — review details for specifics`);
  }
  if (total < 5) {
    weaknesses.push(`Only ${total} reviews — limited data to assess reliability`);
  }

  // --- "But" extracted complaints → add to weaknesses if 2+ mentions ---
  const butCategoryCounts: Record<string, number> = {};
  for (const [key, count] of Object.entries(negativeCounts)) {
    if (key.startsWith("but:")) {
      const cat = key.replace("but:", "");
      butCategoryCounts[cat] = (butCategoryCounts[cat] || 0) + count;
    }
  }
  for (const [cat, count] of Object.entries(butCategoryCounts)) {
    if (count >= 2) {
      const msg = `Recurring concern in "${cat}" — mentioned in "but" clauses by ${count} reviewers`;
      if (!weaknesses.includes(msg)) weaknesses.push(msg);
    }
  }

  return {
    strengths: strengths.slice(0, 6),
    weaknesses: weaknesses.slice(0, 6),
    emergencySignals: emergencySignals.slice(0, 3),
    redFlags: [...new Set(redFlags)],
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
