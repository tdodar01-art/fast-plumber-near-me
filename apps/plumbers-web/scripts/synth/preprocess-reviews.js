/**
 * Compress a plumber's raw reviews into the signal block the synthesis agent
 * will reason over. No LLM here — algorithmic only.
 *
 * Why compress: a plumber with 100 cached reviews is ~30-50KB of raw text.
 * Agents lose specificity on huge prompts and we burn context. Compression
 * preserves the high-signal evidence (themed quote per topic) and aggregates
 * the rest into counts. The agent reasons over counts + 8-12 quotes instead
 * of a wall of text.
 */

const {
  STRENGTH_KEYS, WEAKNESS_KEYS,
  themesInText, servicesInText,
  sentimentFromRatings, ratingDistribution, reviewConsistency,
} = require("./lib/signal-extractors");
const { SERVICE_KEYWORDS } = require("./lib/service-keywords");

const MAX_EVIDENCE_QUOTES = 12;
const MAX_QUOTE_CHARS = 600;

/**
 * Pre-process one plumber's reviews into a signal block.
 *
 * @param {object} plumber              plumber doc data
 * @param {Array<{rating,text,publishedAt,source}>} reviews
 * @returns {object} compressed signal block
 */
function preprocessPlumber(plumber, reviews) {
  // Keep only reviews with rating + non-empty text.
  // review_id and author_name are carried through so each evidenceQuote can
  // be traced back to the cached review doc. Required by the cited-synthesis
  // schema introduced 2026-05-22; older review docs without these fields
  // degrade to null and surface in the audit pipeline as legacy un-cited.
  const cleaned = (reviews || [])
    .filter((r) => typeof r.text === "string" && r.text.trim().length > 0)
    .map((r) => ({
      review_id: r.id || r.googleReviewId || null,
      author_name: r.authorName || null,
      rating: Number(r.rating ?? 0),
      text: r.text.trim(),
      publishedAt: r.publishedAt || null,
      source: r.source || "unknown",
    }));

  // Per-review theme + service hits.
  const annotated = cleaned.map((r) => ({
    ...r,
    themes: themesInText(r.text),
    services: servicesInText(r.text, SERVICE_KEYWORDS),
  }));

  // Aggregate counts.
  const themeCounts = {};
  const serviceMentions = {};
  for (const r of annotated) {
    for (const t of r.themes) themeCounts[t] = (themeCounts[t] || 0) + 1;
    for (const s of r.services) serviceMentions[s] = (serviceMentions[s] || 0) + 1;
  }

  // Sort all reviews recency-desc for evidence picking.
  const sortedByRecency = [...annotated].sort((a, b) => {
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return String(b.publishedAt).localeCompare(String(a.publishedAt));
  });

  // Evidence selection: one most-recent review per unique theme that fired.
  // Tie-break for the most active themes by also pulling negatives.
  const evidenceQuotes = [];
  const usedReviewIds = new Set();

  function addEvidenceForTheme(themeKey) {
    const hit = sortedByRecency.find(
      (r) => r.themes.includes(themeKey) && !usedReviewIds.has(reviewKey(r)),
    );
    if (!hit) return;
    usedReviewIds.add(reviewKey(hit));
    evidenceQuotes.push({
      review_id: hit.review_id,
      author_name: hit.author_name,
      rating: hit.rating,
      publishedAt: hit.publishedAt,
      source: hit.source,
      themes: hit.themes,
      services: hit.services,
      text: hit.text.slice(0, MAX_QUOTE_CHARS),
    });
  }

  // Strengths first, then weaknesses (negatives matter more for trust signals).
  for (const k of STRENGTH_KEYS) {
    if (themeCounts[k] && evidenceQuotes.length < MAX_EVIDENCE_QUOTES) addEvidenceForTheme(k);
  }
  for (const k of WEAKNESS_KEYS) {
    if (themeCounts[k] && evidenceQuotes.length < MAX_EVIDENCE_QUOTES) addEvidenceForTheme(k);
  }
  // Fill remaining slots with the most recent unclaimed reviews to give the
  // agent breadth beyond just themed examples.
  for (const r of sortedByRecency) {
    if (evidenceQuotes.length >= MAX_EVIDENCE_QUOTES) break;
    if (usedReviewIds.has(reviewKey(r))) continue;
    usedReviewIds.add(reviewKey(r));
    evidenceQuotes.push({
      review_id: r.review_id,
      author_name: r.author_name,
      rating: r.rating,
      publishedAt: r.publishedAt,
      source: r.source,
      themes: r.themes,
      services: r.services,
      text: r.text.slice(0, MAX_QUOTE_CHARS),
    });
  }

  // Lowest-rated review if present and not already in evidence — these are
  // the highest-signal weakness cases.
  const lowest = annotated
    .filter((r) => r.rating <= 2)
    .sort((a, b) => a.rating - b.rating)[0];
  if (lowest && !usedReviewIds.has(reviewKey(lowest)) && evidenceQuotes.length < MAX_EVIDENCE_QUOTES) {
    evidenceQuotes.push({
      review_id: lowest.review_id,
      author_name: lowest.author_name,
      rating: lowest.rating,
      publishedAt: lowest.publishedAt,
      source: lowest.source,
      themes: lowest.themes,
      services: lowest.services,
      text: lowest.text.slice(0, MAX_QUOTE_CHARS),
    });
  }

  return {
    placeId: plumber.placeId || plumber.id || null,
    businessName: plumber.businessName || plumber.name || "(unnamed)",
    city: plumber.city || (Array.isArray(plumber.serviceCities) ? plumber.serviceCities[0] : "") || "",
    state: plumber.state || "",
    googleRating: plumber.googleRating ?? null,
    googleReviewCount: plumber.googleReviewCount ?? null,
    bbb: bbbView(plumber),
    signals: {
      totalReviewsAnalyzed: cleaned.length,
      ratingDistribution: ratingDistribution(cleaned),
      sentiment: sentimentFromRatings(cleaned),
      reviewConsistency: reviewConsistency(cleaned),
      serviceMentions,
      themeCounts,
    },
    evidenceQuotes,
  };
}

function reviewKey(r) {
  // Simple unique-enough key for the local de-dup map within one plumber.
  return `${r.rating}|${r.publishedAt || ""}|${(r.text || "").slice(0, 32)}`;
}

function bbbView(plumber) {
  const b = plumber.bbb;
  if (!b) return null;
  return {
    accredited: !!b.accredited,
    rating: b.rating || null,
    yearsInBusiness: b.yearsInBusiness ?? null,
    complaintsTotal: b.complaintsTotal ?? null,
    complaintsPast3Years: b.complaintsPast3Years ?? null,
  };
}

module.exports = { preprocessPlumber };
