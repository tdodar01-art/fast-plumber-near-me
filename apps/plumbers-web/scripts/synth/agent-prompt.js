/**
 * Build the prompt the subagent reads when processing a single batch.
 *
 * Mirrors the OUTPUT contract of score-plumbers.ts Pass 1 (which we're
 * replacing). Subagent produces:
 *   - aggregate dimension scores (0..100 or null per dimension)
 *   - per-service specialty strength (0..100 for each SPECIALTY_KEY)
 *   - synthesis display fields (summary, strengths, weaknesses, redFlags,
 *     emergencyNotes, platformDiscrepancy)
 *   - servicesMentioned with count/avgRating/topQuote per service slug
 *   - evidenceQuotes drawn verbatim from the batch input
 *
 * Code downstream derives badges, emergencyReadiness, pricingTier, bestFor,
 * cross-platform adjustment, then writes Firestore in Pass-1-compatible shape.
 */

const path = require("path");
const { DIMENSION_KEYS, SPECIALTY_KEYS } = require("./lib/synthesis-schema");

function buildBatchPrompt({ runDir, jobId, batchPath, resultPath, count }) {
  const absBatch = path.resolve(batchPath);
  const absResult = path.resolve(resultPath);

  const specialtyList = SPECIALTY_KEYS.map((k) => `"${k}"`).join(", ");
  const dimensionList = DIMENSION_KEYS.map((k) => `"${k}"`).join(", ");

  return `You are processing batch \`${jobId}\` for the plumber-directory synthesis pipeline.
This is a like-for-like replacement of score-plumbers.ts Pass 1 (Sonnet) — you
produce the same output shape, locally, without an API call.

READ the batch input file:
  ${absBatch}

It contains ${count} preprocessed plumbers. Each plumber has:
  - placeId, businessName, city, state
  - googleRating, googleReviewCount
  - bbb (accredited, rating, yearsInBusiness, complaintsTotal, complaintsPast3Years) — may be null
  - signals.ratingDistribution      {5,4,3,2,1} counts
  - signals.sentiment               {positive,neutral,negative} proportions ≈ 1
  - signals.reviewConsistency       0..1 (1 = uniform ratings)
  - signals.serviceMentions         { "water-heater": N, "drain-cleaning": N, ... }   (slug-cased)
  - signals.themeCounts             { "fast_response": N, "fair_pricing": N, "expensive": N, ... }
  - signals.totalReviewsAnalyzed
  - evidenceQuotes                  up to 12 selected review excerpts, each with
                                     {review_id, author_name, rating, publishedAt, source, themes[], services[], text}
                                     review_id is the cited identifier — copy it verbatim into
                                     evidenceQuotes[].review_id and into supporting_review_ids[].

PRODUCE one synthesis object per plumber.

WRITE a single JSON file to:
  ${absResult}

The file must be a JSON object:
  { "jobId": "${jobId}", "generatedAt": "<ISO timestamp>", "results": [ ... ] }

Each \`results[i]\` MUST match this exact schema:

{
  "placeId": "<copy from batch input>",

  // --- Display synthesis (drives PlumberCard copy) ---
  // Each claim (strength/weakness/redFlag) MUST cite the review_ids that
  // support it via supporting_review_ids[]. Use the review_id values from
  // input.evidenceQuotes — do not invent ids. Claims without at least one
  // valid cited id will be DROPPED by the validator.
  "summary": "≤220 chars, ONE specific punchy sentence. Reference real counts.",
  "strengths": [
    // 0-3 items. Each is { text, supporting_review_ids[] }
    // e.g. { "text": "Under-hour arrival cited in 4 of 18 reviews", "supporting_review_ids": ["rev_abc", "rev_def"] }
  ],
  "weaknesses": [
    // 0-2 items. Each is { text, supporting_review_ids[] }
    // Use { "text": "Not enough data to identify weaknesses", "supporting_review_ids": [] }
    // ONLY if every signal is positive — supporting_review_ids may be empty in that one case.
  ],
  "redFlags": [
    // 0-3 items. Each is { text, supporting_review_ids[] }
    // For <25 reviews even 1-2 mentions of the same complaint = a flag.
    // Empty array [] if genuinely none.
  ],
  "emergencyNotes": "≤200 chars about emergency capability signals (after-hours mentions, response time).",
  "platformDiscrepancy": "≤180 chars if Google vs. Yelp differ by 0.7+★ or BBB complaints contradict positive Google. Else null.",

  // --- Aggregate dimension scores (replaces what Pass 1's extraction step produces) ---
  // Each is a number 0..100, OR null if no review evidence addresses that dimension.
  // DO NOT GUESS — null is correct when reviews simply don't speak to a dimension.
  "dimensionScores": {
    ${dimensionList.split(", ").map((k) => `${k}: 0..100 | null`).join(",\n    ")}
  },

  // --- Specialty strength per service category, 0..100. NEVER null. ---
  // Score how well reviews support that this plumber handles this service WELL.
  //   100 = many strongly positive reviews specifically about this service
  //    50 = some evidence, mixed sentiment, or thin volume
  //     0 = no review evidence at all for this category
  // Read signals.serviceMentions for evidence counts. Reward both volume AND positive sentiment.
  "specialtyStrength": {
    ${specialtyList.split(", ").map((k) => `${k}: 0..100`).join(",\n    ")}
  },

  // --- Service mentions: COPY signals.serviceMentions, enrich with avgRating + topQuote ---
  // For every slug present in signals.serviceMentions with count >= 1.
  // avgRating: average star rating of reviews that mentioned this service.
  // topQuote: the most useful evidence quote from input that mentions this service (verbatim, ≤200 chars).
  "servicesMentioned": {
    "water-heater": { "count": N, "avgRating": 0..5, "topQuote": "..." }
    // ... one entry per non-zero service slug
  },

  // --- Evidence quotes — pick 2-4 highest-signal verbatim quotes from input.evidenceQuotes
  // Each MUST be verbatim or near-verbatim from input.evidenceQuotes[i].text.
  // dimension is one of: ${DIMENSION_KEYS.join(" | ")}.
  // ECHO the attribution fields (review_id, source, publishedAt, author_name)
  // from the source input quote verbatim — do not modify them.
  "evidenceQuotes": [
    {
      "dimension": "responsiveness",
      "quote": "Within an hour the tech was on site and unclogged the line.",
      "review_id": "<copy from input.evidenceQuotes[i].review_id>",
      "source": "<copy from input.evidenceQuotes[i].source>",
      "publishedAt": "<copy from input.evidenceQuotes[i].publishedAt>",
      "author_name": "<copy from input.evidenceQuotes[i].author_name>"
    }
    // ...
  ]
}

QUALITY BAR — non-negotiable

1. Be SPECIFIC. Reference signal counts ("8 of 14 reviews", "themeCounts.fast_response=14").
2. BANNED phrases (case-insensitive): "reliable and professional", "highly recommended",
   "satisfied customers", "trustworthy and reliable", "professional and courteous",
   "best in the business". Any generic praise that could apply to any plumber is banned.
3. evidenceQuotes you cite MUST be verbatim or near-verbatim from input.evidenceQuotes.
   Never invent quote text. The validator will reject hallucinated quotes.
4. supporting_review_ids[] on every strength/weakness/redFlag MUST be a subset of the
   review_id values in input.evidenceQuotes. Never invent review_ids. Claims with no
   valid supporting_review_ids will be DROPPED by the validator (except the explicit
   "Not enough data to identify weaknesses" case noted above).
5. Echo evidenceQuotes attribution (review_id, source, publishedAt, author_name) from
   input verbatim. Do not modify, summarize, or omit these fields.
6. For dimensions where the reviews don't address it AT ALL, return null in dimensionScores —
   do NOT guess. The aggregator handles nulls.
7. specialtyStrength is required for ALL ${SPECIALTY_KEYS.length} specialties (no nulls).
   When evidence is absent, return 0.
8. DO NOT produce rankings, city_rank, finalScore, tier, badges, pricingTier, or bestFor.
   Code computes those deterministically downstream.

ALLOWED TOOLS
- Read (to read the batch input file)
- Write (to write the result file)
- NO web access, no external API calls, no other tools.

WHEN DONE
Return a single short message:
  "done: <N> plumbers processed"
or one line beginning with "error: ..." for the orchestrator to requeue.

DO NOT include the result JSON in your return message — write it to the file.
`;
}

module.exports = { buildBatchPrompt };
