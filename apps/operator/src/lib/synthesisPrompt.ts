/**
 * Build the Sonnet synthesis prompt for a single plumber.
 *
 * Mirrors `apps/plumbers-web/scripts/score-plumbers.ts` →
 * `buildSynthesisPrompt()` but collapses the two-pass flow (extraction +
 * synthesis) into a single ask. This is the prompt the operator pastes
 * into their Claude.ai tab — no API spend.
 *
 * Quality bar (CLAUDE.md): specific and punchy, never generic.
 * "Reliable and professional" is banned. Reference actual review patterns.
 */

import type { SynthesisCandidate, PlumberReview } from "./synthesisReader";

const MAX_REVIEWS_IN_PROMPT = 30;

function sortReviewsRecent(reviews: PlumberReview[]): PlumberReview[] {
  return [...reviews].sort((a, b) => {
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

export function buildSynthesisPrompt(c: SynthesisCandidate): string {
  const sorted = sortReviewsRecent(c.reviews).slice(0, MAX_REVIEWS_IN_PROMPT);
  const reviewBlock = sorted
    .map(
      (r) =>
        `[${r.rating ?? "?"}/5${r.publishedAt ? ` — ${r.publishedAt.slice(0, 10)}` : ""}] ${r.text ?? ""}`,
    )
    .join("\n\n---\n\n");

  return `You are synthesizing reviews for an emergency plumber directory. Your output helps homeowners decide who to call at 2am with a burst pipe.

Plumber: ${c.name}
Location: ${c.city}, ${c.state}
Google rating: ${c.googleRating ?? "N/A"}/5 (${c.googleReviewCount ?? 0} reviews on Google)
Reviews cached for synthesis: ${sorted.length} of ${c.reviews.length}

QUALITY BAR — non-negotiable:
- Be SPECIFIC and PUNCHY. Reference actual review patterns with counts ("4 of 12 reviews mention…").
- BANNED phrases: "reliable and professional", "highly recommended", "satisfied customers", any generic praise that could apply to any plumber.
- Good: "Answers calls fast but books out 2-3 days — not ideal for true emergencies"
- Good: "Multiple reviews mention surprise fees after the initial quote"
- Good: "Highly rated for water heater installs, but no reviews mention after-hours work"
- For <25 reviews, even 1-2 mentions of the same complaint = a pattern worth flagging.
- Emergency-specific signals matter most: response time, after-hours mentions, weekend availability, burst-pipe experience.

Reviews:
${reviewBlock || "(no reviews)"}

Respond in JSON only. No markdown, no preamble, no backticks.
{
  "summary": "One specific, punchy sentence a friend would say. ≤140 chars.",
  "strengths": ["2-3 specific strengths with evidence counts."],
  "weaknesses": ["1-2 specific weaknesses from reviews. 'Not enough data to identify weaknesses' is acceptable ONLY if every review is positive."],
  "redFlags": ["Concerning patterns with specifics. Empty array [] if genuinely none."],
  "emergencyNotes": "One sentence about emergency capability signals. If reviews mention fast response even during business hours, note it.",
  "emergencyReadiness": "ready" | "partial" | "unknown",
  "bestFor": ["Specific service categories where reviews praise this plumber, e.g. 'water-heater', 'sewer', 'after-hours'. Empty array if no clear pattern."],
  "topQuote": "The most useful direct quote from reviews (≤200 chars). Empty string if no standout quote.",
  "worstQuote": "The most damning direct quote, if any (≤200 chars). Empty string if reviews are uniformly positive.",
  "trustLevel": "high" | "medium" | "low",
  "priceSignal": "transparent" | "premium" | "mixed" | "complaints" | "unknown"
}`;
}

/**
 * Parse Claude's pasted-back response. Tolerates a leading ```json fence
 * because operators sometimes copy the whole code block from the chat UI.
 */
export interface ParsedSynthesis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  emergencyNotes: string;
  emergencyReadiness?: string;
  bestFor: string[];
  topQuote: string;
  worstQuote: string;
  trustLevel?: string;
  priceSignal?: string;
}

export function parsePastedSynthesis(text: string): ParsedSynthesis | { error: string } {
  if (!text || !text.trim()) return { error: "No text pasted." };
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || "",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      emergencyNotes: parsed.emergencyNotes || "",
      emergencyReadiness: parsed.emergencyReadiness,
      bestFor: Array.isArray(parsed.bestFor) ? parsed.bestFor : [],
      topQuote: parsed.topQuote || "",
      worstQuote: parsed.worstQuote || "",
      trustLevel: parsed.trustLevel,
      priceSignal: parsed.priceSignal,
    };
  } catch (e) {
    return {
      error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
