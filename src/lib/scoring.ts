/**
 * Reliability score calculated from available plumber data.
 * Returns 0-100.
 */
export function calculateReliabilityScore(data: {
  hasPhone: boolean;
  hasWebsite: boolean;
  googleRating: number | null;
  cachedReviewCount: number;
  redFlagCount: number;
  refreshedInLast60Days: boolean;
}): number {
  let score = 0;
  if (data.hasPhone) score += 20;
  if (data.hasWebsite) score += 10;
  if ((data.googleRating ?? 0) >= 4.0) score += 20;
  else if ((data.googleRating ?? 0) >= 3.0) score += 10;
  if (data.cachedReviewCount >= 10) score += 20;
  else if (data.cachedReviewCount >= 5) score += 10;
  if (data.redFlagCount === 0) score += 15;
  if (data.refreshedInLast60Days) score += 15;
  return Math.min(100, Math.max(0, score));
}

/**
 * Determine verification status from reliability score and data freshness.
 */
export function calculateVerificationStatus(
  reliabilityScore: number,
  refreshedInLast60Days: boolean
): "verified" | "partially_verified" | "unverified" {
  if (reliabilityScore >= 70 && refreshedInLast60Days) return "verified";
  if (reliabilityScore >= 40) return "partially_verified";
  return "unverified";
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
}

/**
 * Composite quality score for sorting plumbers on city pages.
 * Blends Google rating, review volume, emergency signals, badges,
 * reliability score, red flag penalties, and status penalties.
 * Returns 0-100 score (higher = better).
 */
export function calculateQualityScore(plumber: {
  googleRating: number | null;
  googleReviewCount: number | null;
  reviewSynthesis?: {
    emergencySignals?: string[];
    badges?: string[];
    redFlags?: string[];
  } | null;
  phone: string;
  reliabilityScore?: number;
  status?: string;
}, maxReviewCount: number): number {
  // Inactive plumbers are hidden, don't score
  if (plumber.status === "inactive") return 0;

  // No phone = bottom of the list
  if (!plumber.phone) return 0;

  const rating = plumber.googleRating ?? 0;
  const reviewCount = plumber.googleReviewCount ?? 0;
  const normalizedReviews = maxReviewCount > 0 ? reviewCount / maxReviewCount : 0;
  const hasEmergencySignals = (plumber.reviewSynthesis?.emergencySignals?.length ?? 0) > 0 ? 1 : 0;
  const badgeCount = plumber.reviewSynthesis?.badges?.length ?? 0;
  const normalizedBadges = badgeCount / 5;
  const reliability = (plumber.reliabilityScore ?? 0) / 100;

  // Base score: 0-100
  let score = (
    (rating / 5) * 0.35 +
    normalizedReviews * 0.25 +
    hasEmergencySignals * 0.20 +
    normalizedBadges * 0.10 +
    reliability * 0.10
  ) * 100;

  // Red flag penalties: -5 per flag, max -20
  const redFlagCount = plumber.reviewSynthesis?.redFlags?.length ?? 0;
  score -= Math.min(20, redFlagCount * 5);

  // Flagged plumber penalty
  if (plumber.status === "flagged") score -= 20;

  // Floor at 0, cap at 100
  return Math.min(100, Math.max(0, Math.round(score)));
}
