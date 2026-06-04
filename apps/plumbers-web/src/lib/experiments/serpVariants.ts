/**
 * exp-003 — SERP title/description copy variants (VERTICAL: plumbing).
 *
 * Each arm pairs a title structure with a matching meta-description structure,
 * so we test full-snippet CTR by structure, controlling for ranking position.
 *
 * Round 1 arms: control, urgency, social_proof. (Round 2 will introduce
 * "pain" and "speed" against round-1's winner.)
 *
 * Length guidance (channels/seo-core.md): titles aim ≤ ~60 chars, descriptions
 * ≤ ~155 chars before the city name pushes them over — kept deliberately tight
 * so structure, not truncation, is what varies.
 */

export const SERP_ARMS = ["control", "urgency", "social_proof"] as const;
export type SerpArm = (typeof SERP_ARMS)[number];

export interface SerpMetaContext {
  cityName: string;
  stateAbbr: string;
  count: number;
  year: number;
}

export interface SerpMeta {
  title: string;
  description: string;
}

type Builder = (c: SerpMetaContext) => SerpMeta;

const BUILDERS: Record<SerpArm, Builder> = {
  // Current production copy — the holdout baseline.
  control: ({ cityName, stateAbbr, count, year }) => ({
    title: `${count} Emergency Plumbers in ${cityName}, ${stateAbbr} — Rated & Reviewed (${year})`,
    description: `Compare ${count} emergency plumbers in ${cityName}, ${stateAbbr} with real Google reviews, honest strengths & weaknesses, and 24-hour availability. Find who actually picks up.`,
  }),

  // Availability/urgency-led — the exp-002 (Aberdeen) direction, tested at scale.
  urgency: ({ cityName, stateAbbr }) => ({
    title: `Emergency Plumber ${cityName}, ${stateAbbr} — 24/7, Fast & Local`,
    description: `Need an emergency plumber in ${cityName}? Find 24/7 local pros who actually answer — real reviews, honest pros & cons, fast response. Tap to call now.`,
  }),

  // Social-proof/rating-led — leans on the reviews differentiator.
  social_proof: ({ cityName, stateAbbr, count, year }) => ({
    title: `Top ${count} Emergency Plumbers in ${cityName}, ${stateAbbr} (${year}) — Reviewed`,
    description: `See ${cityName}'s top-rated emergency plumbers — ranked by real Google reviews, with honest pros, cons & red flags. Compare ${count} verified local pros.`,
  }),
};

export function buildSerpMeta(arm: SerpArm, ctx: SerpMetaContext): SerpMeta {
  return BUILDERS[arm](ctx);
}
