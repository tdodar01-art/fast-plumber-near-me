/**
 * Active Experiments Registry — plumbers site.
 *
 * This is the ONLY place plumbers-web "knows" about experiments.
 * Each experiment maps to test/control slugs and variant config.
 *
 * When an experiment is shipped or killed, remove it from this file.
 * When a new experiment starts, add it here with slugs from the
 * control-center experiment .md file.
 */

export interface VariantConfig {
  [key: string]: unknown;
}

export interface ExperimentEntry {
  test_slugs: string[];
  control_slugs: string[];
  variants: {
    test: VariantConfig;
    control: VariantConfig;
  };
}

export const ACTIVE_EXPERIMENTS: Record<string, ExperimentEntry> = {
  "exp-001-nearby-cities-expansion": {
    test_slugs: [
      "texas/garland",
      "texas/mckinney",
      "texas/denton",
      "texas/round-rock",
      "texas/league-city",
    ],
    control_slugs: [
      "texas/irving",
      "texas/mesquite",
      "texas/carrollton",
      "texas/richardson",
      "texas/grand-prairie",
    ],
    variants: {
      test: { nearbyCityCount: 8 },
      control: { nearbyCityCount: 2 },
    },
  },
  "exp-002-aberdeen-title-urgency": {
    test_slugs: ["maryland/aberdeen"],
    control_slugs: [],
    variants: {
      test: {
        metaTitle:
          "Emergency Plumber Aberdeen, MD (24/7) — Fast, Local & Available Now",
      },
      control: {},
    },
  },
};

/**
 * Get the active variant config for a slug in a specific experiment.
 * Returns the variant config if the slug is in the experiment, null otherwise.
 */
export function getActiveVariant(
  stateSlug: string,
  citySlug: string,
  experimentKey: string
): VariantConfig | null {
  const experiment = ACTIVE_EXPERIMENTS[experimentKey];
  if (!experiment) return null;

  const slug = `${stateSlug}/${citySlug}`;

  if (experiment.test_slugs.includes(slug)) {
    return experiment.variants.test;
  }

  if (experiment.control_slugs.includes(slug)) {
    return experiment.variants.control;
  }

  return null;
}

/**
 * Get all unique slugs across all active experiments.
 * Used by the metrics publisher to know which slugs to track.
 */
export function getAllTrackedSlugs(): string[] {
  const slugs = new Set<string>();
  for (const exp of Object.values(ACTIVE_EXPERIMENTS)) {
    for (const slug of exp.test_slugs) slugs.add(slug);
    for (const slug of exp.control_slugs) slugs.add(slug);
  }
  return [...slugs];
}
