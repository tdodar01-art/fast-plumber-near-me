export function calculateReliabilityScore(data: {
  answerRate: number;
  avgResponseTime: number;
  availabilityRate: number;
  avgArrivalMin: number;
}): number {
  const answerScore = data.answerRate; // 0-100
  const responseScore = Math.max(0, 100 - data.avgResponseTime * 2); // Lower = better
  const availabilityScore = data.availabilityRate; // 0-100
  const arrivalScore = Math.max(0, 100 - (data.avgArrivalMin - 15) * 2); // 15 min = perfect

  const weighted =
    answerScore * 0.4 +
    responseScore * 0.2 +
    availabilityScore * 0.3 +
    arrivalScore * 0.1;

  return Math.round(Math.min(100, Math.max(0, weighted)));
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
 * Blends Google rating, review volume, emergency signals, and badges.
 * Returns 0-1 score (higher = better).
 */
export function calculateQualityScore(plumber: {
  googleRating: number | null;
  googleReviewCount: number | null;
  reviewSynthesis?: {
    emergencySignals?: string[];
    badges?: string[];
  } | null;
  phone: string;
}, maxReviewCount: number): number {
  // No phone = bottom of the list
  if (!plumber.phone) return -1;

  const rating = plumber.googleRating ?? 0;
  const reviewCount = plumber.googleReviewCount ?? 0;
  const normalizedReviews = maxReviewCount > 0 ? reviewCount / maxReviewCount : 0;
  const hasEmergencySignals = (plumber.reviewSynthesis?.emergencySignals?.length ?? 0) > 0 ? 1 : 0;
  const badgeCount = plumber.reviewSynthesis?.badges?.length ?? 0;
  const normalizedBadges = badgeCount / 5;

  return (
    (rating / 5) * 0.4 +
    normalizedReviews * 0.3 +
    hasEmergencySignals * 0.2 +
    normalizedBadges * 0.1
  );
}
