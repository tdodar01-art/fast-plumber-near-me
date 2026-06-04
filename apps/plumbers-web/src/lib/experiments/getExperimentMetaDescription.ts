import { getSerpArm } from "./serpExperiment";
import { buildSerpMeta, type SerpMetaContext } from "./serpVariants";

/**
 * Resolve the experiment meta DESCRIPTION for a city page, or null to use the
 * default. Only exp-003 varies the description; "control" returns null.
 */
export function getExperimentMetaDescription(
  stateSlug: string,
  citySlug: string,
  ctx: SerpMetaContext
): string | null {
  const arm = getSerpArm(stateSlug, citySlug);
  if (!arm || arm === "control") return null;
  return buildSerpMeta(arm, ctx).description;
}
