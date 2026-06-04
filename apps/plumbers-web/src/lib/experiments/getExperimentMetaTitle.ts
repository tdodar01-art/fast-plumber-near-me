import { getActiveVariant } from "./activeExperiments";
import { getSerpArm } from "./serpExperiment";
import { buildSerpMeta, type SerpMetaContext } from "./serpVariants";

// Legacy single-city title test (Aberdeen). exp-003 supersedes it on overlapping
// pages, but they're kept disjoint (aberdeen is excluded from exp-003's snapshot).
const LEGACY_KEY = "exp-002-aberdeen-title-urgency";

/**
 * Resolve the experiment meta TITLE for a city page, or null to use the default.
 * exp-003 (SERP structure test) takes precedence on its tracked pages; "control"
 * returns null (holdout = default copy). Falls back to legacy exp-002.
 */
export function getExperimentMetaTitle(
  stateSlug: string,
  citySlug: string,
  ctx: SerpMetaContext
): string | null {
  const arm = getSerpArm(stateSlug, citySlug);
  if (arm) {
    return arm === "control" ? null : buildSerpMeta(arm, ctx).title;
  }

  const variant = getActiveVariant(stateSlug, citySlug, LEGACY_KEY);
  const title = variant?.metaTitle;
  return typeof title === "string" ? title : null;
}
