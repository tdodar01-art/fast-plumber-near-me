/**
 * exp-003 — SERP CTR experiment assignment.
 *
 * Reads the committed, frozen eligible-slug snapshot
 * (data/experiments/exp-003-eligible-slugs.json) which maps each city-page slug
 * to its arm. Assignment was computed once at setup (stratified greedy-balance
 * by impressions) and committed, so it never drifts across builds.
 *
 * Loaded via fs from process.cwd() — same pattern as plumber-data.ts, which
 * guarantees data/ ships to the Vercel build/serverless runtime.
 */
import fs from "fs";
import path from "path";
import type { SerpArm } from "./serpVariants";

export const SERP_EXPERIMENT_KEY = "exp-003-serp-ctr-structure";
// Extended 2026-06-22 from the original 2026-07-04 end: round 1 ran at avg
// position ~15 (page 2), so CTR was unmeasurable. Held open another ~3 months to
// let rankings climb into clickable positions before reading results.
export const SERP_WINDOW = { start: "2026-06-04", end: "2026-10-04" };

interface Snapshot {
  experiment: string;
  count: number;
  assignment: Record<string, SerpArm>;
}

let cached: Snapshot | null = null;

function load(): Snapshot {
  if (cached) return cached;
  try {
    const filePath = path.join(process.cwd(), "data", "experiments", "exp-003-eligible-slugs.json");
    cached = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Snapshot;
  } catch {
    // Snapshot absent (e.g. experiment retired) → no-op experiment.
    cached = { experiment: SERP_EXPERIMENT_KEY, count: 0, assignment: {} };
  }
  return cached;
}

/** Returns the arm for a city page, or null if the page isn't in the experiment. */
export function getSerpArm(stateSlug: string, citySlug: string): SerpArm | null {
  return load().assignment[`${stateSlug}/${citySlug}`] ?? null;
}

/** All slugs (state/city) tracked by the experiment — for the metrics publisher. */
export function getSerpTrackedSlugs(): string[] {
  return Object.keys(load().assignment);
}
