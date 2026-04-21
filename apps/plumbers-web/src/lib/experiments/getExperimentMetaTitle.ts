import { getActiveVariant } from "./activeExperiments";

const EXPERIMENT_KEY = "exp-002-aberdeen-title-urgency";

export function getExperimentMetaTitle(
  stateSlug: string,
  citySlug: string
): string | null {
  const variant = getActiveVariant(stateSlug, citySlug, EXPERIMENT_KEY);
  if (!variant) return null;
  const title = variant.metaTitle;
  return typeof title === "string" ? title : null;
}
