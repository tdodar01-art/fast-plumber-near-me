import type { SynthesizedPlumber } from "./plumber-data";
import type { ShortlistCandidate } from "./shortlist";
import { reviewsReadCount, newestReviewLabel } from "./report-card";
/** Keep review bodies and private data out of the client payload. */
export function shortlistData(p: SynthesizedPlumber): ShortlistCandidate {
  const concerns = [
    ...(p.synthesis?.redFlags ?? []),
    ...(p.synthesis?.weaknesses ?? []),
  ];
  const quotes = new Map(
    (p.evidence_quotes ?? [])
      .filter((q) => q.quote && q.author_name && q.source && q.published_at)
      .map((q) => [q.review_id, q]),
  );
  const cited = (claim: { supporting_review_ids: string[] }) =>
    new Set((claim.supporting_review_ids ?? []).filter((id) => quotes.has(id)))
      .size;
  const fairDealing = (p.synthesis?.strengthsEvidence ?? [])
    .filter(
      (c) =>
        cited(c) >= 2 &&
        /upfront|up.front|no.up.?sell|no.pressure|honest|transparent|fair pric|repair.{0,25}replac/i.test(
          c.text,
        ),
    )
    .map((c) => c.text)
    .filter((text) => !/_|themeCounts|[A-Za-z0-9]{20,}/.test(text))
    .slice(0, 2);
  const repeatedSalesConcern = [
    ...(p.synthesis?.redFlagsEvidence ?? []),
    ...(p.synthesis?.weaknessesEvidence ?? []),
  ].some(
    (c) =>
      cited(c) >= 2 &&
      /pressure|bait.and.switch|unnecessary|upsell|up.sell|surprise.fee|quote.{0,30}(grew|increas|chang)/i.test(
        c.text,
      ),
  );
  const scored =
    p.scores?.method !== "no_reviews" &&
    p.scores?.method !== "keyword_fallback" &&
    (p.scores?.review_count_used ?? 0) >= 10;
  const concern = concerns.find(
    (s) =>
      !/themeCounts|reviewConsistency|[A-Za-z0-9_-]{20,}|not enough|insufficient|\w+_\w+|\w+=/i.test(
        s,
      ),
  );
  return {
    id: p.placeId,
    name: p.name,
    slug: p.slug,
    phone: p.phone,
    website: p.website,
    rating: p.googleRating,
    googleCount: p.googleReviewCount,
    analyzed: reviewsReadCount(p),
    quotes: quotes.size,
    is24Hour: p.is24Hour,
    verdict: p.decision?.verdict ?? null,
    score: p.synthesis?.score ?? 0,
    services: Object.fromEntries(
      Object.entries(p.synthesis?.servicesMentioned ?? {}).map(
        ([key, value]) => [key, value?.count ?? 0],
      ),
    ),
    concern: concern ?? null,
    updated: newestReviewLabel(p),
    fairDealing,
    repeatedSalesConcern,
    // Existing red flags require human review before an affirmative recommendation.
    needsEditorialReview: (p.synthesis?.redFlags ?? []).some(
      (text) => !/^not enough|^insufficient/i.test(text),
    ),
    reliability: scored ? (p.scores?.reliability ?? null) : null,
    pricing: scored ? (p.scores?.pricing_fairness ?? null) : null,
  };
}
