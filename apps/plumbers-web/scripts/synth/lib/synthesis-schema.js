/**
 * Schema for one plumber's agent-produced synthesis. Matches the Firestore
 * write shape from score-plumbers.ts Pass 1 (our drop-in replacement).
 *
 * Hand-rolled (no AJV) — schema is small, dependency footprint stays minimal.
 */

const DIMENSION_KEYS = [
  "reliability",
  "pricing_fairness",
  "workmanship",
  "responsiveness",
  "communication",
];

const SPECIALTY_KEYS = [
  "water_heater",
  "drain",
  "repipe",
  "emergency",
  "remodel",
  "sewer",
  "toilet",
  "fixture",
  "sump_pump",
  "gas_line",
  "slab_leak",
  "water_line",
];

const BANNED_PHRASES = [
  "reliable and professional",
  "highly recommended",
  "satisfied customers",
  "trustworthy and reliable",
  "professional and courteous",
  "best in the business",
];

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Normalize a string for anti-hallucination grounding comparison. Absorbs
 * legitimate formatting drift (typo corrections, whitespace collapse,
 * curly-quote vs straight-quote, etc.) so a verbatim-with-cleanup quote
 * still grounds, but a paraphrase / invention doesn't.
 */
function normalizeForGrounding(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")     // curly singles → straight
    .replace(/[“”„‟]/g, '"')      // curly doubles → straight
    .replace(/[^\w\s]/g, " ")                          // strip all punctuation
    .replace(/\s+/g, " ")                              // collapse whitespace
    .trim();
}

function isStringArray(v, maxLen = Infinity, maxItem = 500) {
  if (!Array.isArray(v)) return false;
  if (v.length > maxLen) return false;
  return v.every((x) => typeof x === "string" && x.length <= maxItem);
}

function isScoreOrNull(v) {
  if (v === null) return true;
  return typeof v === "number" && v >= 0 && v <= 100;
}

function isScore(v) {
  return typeof v === "number" && v >= 0 && v <= 100;
}

/**
 * Validate a single synthesis result object from a subagent.
 *
 * @param {object} result   the candidate object
 * @param {object} batchPlumber  the corresponding plumber block from the batch input
 *                               (for evidence grounding + cross-checks)
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateSynthesisResult(result, batchPlumber) {
  const errors = [];

  if (!isPlainObject(result)) {
    return { ok: false, errors: ["result is not an object"] };
  }
  if (typeof result.placeId !== "string" || !result.placeId) {
    errors.push("placeId missing or empty");
  } else if (batchPlumber && result.placeId !== batchPlumber.placeId) {
    errors.push(`placeId mismatch: result=${result.placeId} batch=${batchPlumber.placeId}`);
  }

  // --- Display synthesis fields ----------------------------------------
  if (typeof result.summary !== "string" || result.summary.length === 0) {
    errors.push("summary missing");
  } else if (result.summary.length > 320) {
    errors.push(`summary too long (${result.summary.length} > 320)`);
  } else {
    const lower = result.summary.toLowerCase();
    for (const banned of BANNED_PHRASES) {
      if (lower.includes(banned)) errors.push(`summary contains banned phrase: "${banned}"`);
    }
  }
  if (!isStringArray(result.strengths, 5)) errors.push("strengths must be a string[] of length <= 5");
  if (!isStringArray(result.weaknesses, 5)) errors.push("weaknesses must be a string[] of length <= 5");
  if (!isStringArray(result.redFlags, 5)) errors.push("redFlags must be a string[] of length <= 5");
  if (typeof result.emergencyNotes !== "string") errors.push("emergencyNotes must be a string");
  if (result.platformDiscrepancy !== null && typeof result.platformDiscrepancy !== "string") {
    errors.push("platformDiscrepancy must be string or null");
  }

  // --- Dimension scores (replaces what extraction pass produces) -------
  if (!isPlainObject(result.dimensionScores)) {
    errors.push("dimensionScores must be an object");
  } else {
    for (const k of DIMENSION_KEYS) {
      if (!isScoreOrNull(result.dimensionScores[k])) {
        errors.push(`dimensionScores.${k} must be number 0..100 or null`);
      }
    }
  }

  // --- Specialty strength (per-service 0-100) --------------------------
  if (!isPlainObject(result.specialtyStrength)) {
    errors.push("specialtyStrength must be an object");
  } else {
    for (const k of SPECIALTY_KEYS) {
      if (!isScore(result.specialtyStrength[k])) {
        errors.push(`specialtyStrength.${k} must be number 0..100`);
      }
    }
  }

  // --- servicesMentioned: keyed by service slug, with count + avgRating + topQuote
  // Tolerate the zero-review case where the agent returns [] instead of {} —
  // both signal "no service mentions" which is semantically the same.
  if (Array.isArray(result.servicesMentioned) && result.servicesMentioned.length === 0) {
    result.servicesMentioned = {};
  }
  if (!isPlainObject(result.servicesMentioned)) {
    errors.push("servicesMentioned must be an object");
  } else {
    for (const [slug, info] of Object.entries(result.servicesMentioned)) {
      if (!isPlainObject(info)) {
        errors.push(`servicesMentioned.${slug} must be an object`);
        continue;
      }
      if (typeof info.count !== "number" || info.count < 0) {
        errors.push(`servicesMentioned.${slug}.count must be a non-negative number`);
      }
      if (typeof info.avgRating !== "number" || info.avgRating < 0 || info.avgRating > 5) {
        errors.push(`servicesMentioned.${slug}.avgRating must be 0..5`);
      }
      if (typeof info.topQuote !== "string") {
        errors.push(`servicesMentioned.${slug}.topQuote must be a string`);
      }
    }
  }

  // --- evidenceQuotes — anti-hallucination check -----------------------
  if (!Array.isArray(result.evidenceQuotes)) {
    errors.push("evidenceQuotes must be an array");
  } else if (batchPlumber && Array.isArray(batchPlumber.evidenceQuotes)) {
    // Anti-hallucination: substring match between agent's quote and ANY source
    // text in the batch input, after normalization to absorb legitimate
    // formatting drift (typo corrections, whitespace collapse, punctuation cleanup).
    const sourceTexts = batchPlumber.evidenceQuotes.map(
      (q) => normalizeForGrounding(String(q.text || "")),
    );
    for (let i = 0; i < result.evidenceQuotes.length; i++) {
      const q = result.evidenceQuotes[i];
      if (!isPlainObject(q) || typeof q.quote !== "string") {
        errors.push(`evidenceQuotes[${i}] must be {dimension, quote} object`);
        continue;
      }
      if (typeof q.dimension !== "string" || !DIMENSION_KEYS.includes(q.dimension)) {
        errors.push(`evidenceQuotes[${i}].dimension must be one of ${DIMENSION_KEYS.join("|")}`);
      }
      const candidate = normalizeForGrounding(q.quote);
      // Need a substring of at least 40 normalized characters that appears
      // somewhere in some source. Window over the candidate so a quote starting
      // mid-source is still caught.
      const NEEDLE = 40;
      let grounded = false;
      if (candidate.length < NEEDLE) {
        grounded = sourceTexts.some((s) => s.includes(candidate));
      } else {
        for (let start = 0; start <= candidate.length - NEEDLE; start += 10) {
          const needle = candidate.slice(start, start + NEEDLE);
          if (sourceTexts.some((s) => s.includes(needle))) {
            grounded = true;
            break;
          }
        }
      }
      if (!grounded) errors.push(`evidenceQuotes[${i}] quote not grounded in batch input`);
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  DIMENSION_KEYS,
  SPECIALTY_KEYS,
  BANNED_PHRASES,
  validateSynthesisResult,
};
