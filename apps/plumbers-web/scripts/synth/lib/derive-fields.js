/**
 * Pure-function derivations from final adjusted scores.
 *
 * Ported (byte-for-byte intent) from score-plumbers.ts so the new synth
 * pipeline writes Firestore in the exact same shape Pass 1 does. If Pass 1's
 * helpers ever change, mirror the change here — or extract both to a single
 * shared module (see docs/plans/v2-directory-architecture.md).
 */

function deriveBadges(scores, redFlags) {
  const badges = [];
  const hasRedFlag = (keywords) =>
    redFlags.some((rf) => keywords.some((kw) => String(rf).toLowerCase().includes(kw)));

  // Fast Responder
  if (
    scores.responsiveness >= 85 &&
    !hasRedFlag(["slow", "late", "no-show", "didn't show", "waited", "response time"])
  ) {
    badges.push("Fast Responder");
  }
  // Fair Pricing
  if (
    scores.pricing_fairness >= 85 &&
    !hasRedFlag(["price", "pricing", "overcharg", "surprise fee", "hidden fee", "bill", "quote"])
  ) {
    badges.push("Fair Pricing");
  }
  // 24/7 Available
  if (
    (scores.specialty_strength?.emergency ?? 0) >= 75 &&
    scores.responsiveness >= 80
  ) {
    badges.push("24/7 Available");
  }
  // Clean & Professional
  if (
    scores.workmanship >= 85 &&
    !hasRedFlag(["unprofessional", "messy", "rude", "disrespect"])
  ) {
    badges.push("Clean & Professional");
  }
  // Great Communicator
  if (
    scores.communication >= 85 &&
    !hasRedFlag(["communicat", "didn't explain", "no update", "ghosted"])
  ) {
    badges.push("Great Communicator");
  }
  return badges;
}

function deriveEmergencyReadiness(scores, emergencyNotes) {
  const emergScore = scores.specialty_strength?.emergency ?? 0;
  const respScore = scores.responsiveness ?? 0;
  const signals = [];
  if (emergencyNotes) signals.push(emergencyNotes);

  if (emergScore >= 75 && respScore >= 80) return { readiness: "high", signals };
  if (emergScore >= 50 || respScore >= 75) return { readiness: "medium", signals };
  if (respScore < 55) return { readiness: "low", signals };
  return { readiness: "unknown", signals };
}

function derivePricingTier(scores) {
  if (scores.pricing_fairness >= 85) return "budget";
  if (scores.pricing_fairness >= 65) return "mid-range";
  if (scores.pricing_fairness < 50 && scores.workmanship >= 80) return "premium";
  return "unknown";
}

/**
 * Approximate variance from a 0..1 reviewConsistency signal so decision-engine
 * Pass 3 thresholds (which were tuned against per-review stddev) still work.
 *
 *   consistency 1.0 → variance 0   (uniform reviews)
 *   consistency 0.5 → variance 15  (mixed)
 *   consistency 0.0 → variance 30  (polarized)
 */
function approximateVariance(reviewConsistency) {
  const c = typeof reviewConsistency === "number" ? reviewConsistency : 1;
  return Math.round((1 - Math.max(0, Math.min(1, c))) * 30);
}

// Ported from decision-engine.ts (SPECIALTY_DISPLAY_NAMES + computeBestFor).
// Keep in sync if the TS version changes.
const SPECIALTY_DISPLAY_NAMES = {
  water_heater: "Water heater install/repair",
  drain: "Drain and sewer work",
  repipe: "Whole-house repiping",
  emergency: "Emergency and burst pipe repair",
  remodel: "Bathroom and kitchen remodel plumbing",
  sewer: "Sewer line repair and replacement",
  toilet: "Toilet repair and installation",
  fixture: "Faucet and fixture work",
  sump_pump: "Sump pump repair and installation",
  gas_line: "Gas line repair",
  slab_leak: "Slab leak detection and repair",
  water_line: "Water line repair and replacement",
};

function computeBestFor(scores) {
  const out = [];
  if (scores.reliability >= 85 && scores.responsiveness >= 80) {
    out.push("Emergency and same-day calls");
  }
  if (scores.pricing_fairness >= 85 && scores.workmanship >= 75) {
    out.push("Budget-conscious homeowners");
  }
  if (scores.workmanship >= 90 && scores.communication >= 85) {
    out.push("Complex installs and remodels");
  }
  for (const key of Object.keys(SPECIALTY_DISPLAY_NAMES)) {
    if ((scores.specialty_strength?.[key] ?? 0) >= 85) {
      out.push(SPECIALTY_DISPLAY_NAMES[key]);
    }
  }
  return out;
}

module.exports = {
  deriveBadges,
  deriveEmergencyReadiness,
  derivePricingTier,
  approximateVariance,
  computeBestFor,
  SPECIALTY_DISPLAY_NAMES,
};
