/**
 * Algorithmic theme extractors. No LLM, no API. Pure string matching over
 * review text + numeric aggregation over ratings.
 *
 * The strength/weakness lexicons are deliberately small and high-signal — we
 * want false positives to be rare. A hit in any of these themes is taken at
 * face value by downstream synthesis as a "pattern worth referencing."
 */

const STRENGTH_THEMES = {
  fast_response: [
    "within an hour", "within minutes", "30 minutes", "45 minutes",
    "same day", "same-day", "right away", "promptly", "showed up fast",
    "quick to respond", "quickly diagnosed", "arrived on time", "on time",
  ],
  fair_pricing: [
    "fair price", "reasonable price", "fair quote", "didn't charge",
    "no charge", "no hidden", "transparent pricing", "honest pricing",
    "didn't try to upsell", "no upsell",
  ],
  professional: [
    "professional", "polite", "courteous", "respectful", "tidy",
    "cleaned up", "explained everything", "knowledgeable", "expert",
    "expertise", "walked me through", "very helpful",
  ],
  weekend_or_emergency: [
    "on a sunday", "on a saturday", "weekend", "after hours", "after-hours",
    "midnight", "2am", "3am", "in the middle of the night",
    "emergency call", "answered after hours",
  ],
  communication: [
    "called when", "called before", "kept me informed", "let me know",
    "communicated", "great communication", "easy to reach", "called back",
    "responsive",
  ],
  workmanship: [
    "quality work", "excellent work", "great work", "did a great job",
    "thorough", "double-checked", "fixed it right", "first time",
    "no leaks since",
  ],
};

const WEAKNESS_THEMES = {
  slow_response: [
    "took forever", "days later", "no-show", "didn't show", "never showed",
    "no call back", "no callback", "weeks", "had to call multiple times",
    "left me waiting", "still waiting",
  ],
  expensive: [
    "expensive", "overpriced", "rip off", "ripoff", "too much",
    "way too much", "highway robbery", "outrageous", "not worth",
  ],
  surprise_fees: [
    "surprise fee", "hidden fee", "hidden charge", "didn't tell me",
    "didn't disclose", "added on", "tacked on", "more than the quote",
    "more than the estimate", "scam",
  ],
  unprofessional: [
    "rude", "argumentative", "disrespectful", "yelled",
    "dismissive", "condescending", "wouldn't listen",
  ],
  poor_workmanship: [
    "had to call back", "still leaking", "didn't fix", "made it worse",
    "broke something else", "left a mess", "didn't clean up",
    "had to redo", "didn't work", "still doesn't work",
  ],
};

const ALL_THEMES = { ...STRENGTH_THEMES, ...WEAKNESS_THEMES };
const STRENGTH_KEYS = Object.keys(STRENGTH_THEMES);
const WEAKNESS_KEYS = Object.keys(WEAKNESS_THEMES);

/**
 * Find which themes a single review hits.
 * Returns: array of theme keys.
 */
function themesInText(text) {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  const hits = [];
  for (const [theme, phrases] of Object.entries(ALL_THEMES)) {
    if (phrases.some((p) => lower.includes(p))) hits.push(theme);
  }
  return hits;
}

/**
 * Find which services a single review mentions.
 * Returns: array of service slugs.
 */
function servicesInText(text, serviceKeywords) {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  const hits = [];
  for (const [service, phrases] of Object.entries(serviceKeywords)) {
    if (phrases.some((p) => lower.includes(p))) hits.push(service);
  }
  return hits;
}

/**
 * Sentiment buckets by star rating.
 * Returns: { positive, neutral, negative } as proportions summing to 1.
 */
function sentimentFromRatings(reviews) {
  let pos = 0, neu = 0, neg = 0;
  for (const r of reviews) {
    const rating = Number(r.rating ?? 0);
    if (rating >= 4) pos++;
    else if (rating === 3) neu++;
    else if (rating >= 1) neg++;
  }
  const total = pos + neu + neg;
  if (!total) return { positive: 0, neutral: 0, negative: 0 };
  return {
    positive: +(pos / total).toFixed(3),
    neutral: +(neu / total).toFixed(3),
    negative: +(neg / total).toFixed(3),
  };
}

/**
 * Rating distribution: counts of each star value.
 */
function ratingDistribution(reviews) {
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) {
    const k = Number(r.rating ?? 0);
    if (dist[k] !== undefined) dist[k]++;
  }
  return dist;
}

/**
 * Review-rating consistency = 1 - normalized variance over the 1-5 scale.
 * 1.0 = all reviews agree. 0 = max disagreement.
 */
function reviewConsistency(reviews) {
  const ratings = reviews
    .map((r) => Number(r.rating ?? 0))
    .filter((r) => r >= 1 && r <= 5);
  if (ratings.length < 2) return 1;
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance =
    ratings.reduce((s, r) => s + (r - mean) ** 2, 0) / ratings.length;
  // Max variance on 1-5 scale ≈ 4 (e.g. half 1s and half 5s).
  const normalized = Math.min(1, variance / 4);
  return +(1 - normalized).toFixed(3);
}

module.exports = {
  STRENGTH_THEMES, WEAKNESS_THEMES, STRENGTH_KEYS, WEAKNESS_KEYS,
  themesInText, servicesInText,
  sentimentFromRatings, ratingDistribution, reviewConsistency,
};
