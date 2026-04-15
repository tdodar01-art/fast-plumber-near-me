/**
 * Experiment-aware nearby city count helper.
 *
 * Checks active experiments to determine how many nearby cities
 * to render for a given page slug. Returns null if the slug is
 * not in any experiment (use default behavior).
 */

import { getActiveVariant } from "./activeExperiments";

const DEFAULT_EXPERIMENT_KEY = "exp-001-nearby-cities-expansion";

/**
 * Get the number of nearby cities to render for a given city page.
 * Returns null if the slug isn't in any experiment — caller should use default.
 */
export function getExperimentNearbyCityCount(
  stateSlug: string,
  citySlug: string
): number | null {
  const variant = getActiveVariant(stateSlug, citySlug, DEFAULT_EXPERIMENT_KEY);
  if (!variant) return null;

  const count = variant.nearbyCityCount;
  if (typeof count === "number") return count;

  return null;
}
