#!/usr/bin/env npx tsx
/**
 * Unit tests for the decision-engine rules.
 *
 * Usage:
 *   cd apps/plumbers-web
 *   npx tsx scripts/test-decision-engine.ts
 *
 * No test runner dep — node:assert + a tiny harness. Intentional: keeps the
 * engine trivially testable without locking the repo into vitest/jest before
 * we know what else needs tests.
 */

import assert from "node:assert/strict";
import {
  computeDecision,
  computeVerdict,
  computeBestFor,
  computeAvoidIf,
  computeCautionIf,
  computeHireIf,
  overallComposite,
  computeCrossPlatformSignals,
  computeAdjustmentPenalty,
  applyAdjustment,
  type Scores,
  type CityRankEntry,
  type CrossPlatformSignals,
} from "../src/lib/decision-engine.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}`);
    console.error(`    ${(err as Error).message}`);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n${name}`);
}

function makeScores(overrides: Partial<Scores> = {}): Scores {
  return {
    reliability: 75,
    pricing_fairness: 75,
    workmanship: 75,
    responsiveness: 75,
    communication: 75,
    specialty_strength: {
      water_heater: 50,
      drain: 50,
      repipe: 50,
      emergency: 50,
      remodel: 50,
    },
    variance: 10,
    review_count_used: 30,
    last_scored_at: "2026-04-11T00:00:00Z",
    ...overrides,
  };
}

function makeRank(overrides: Partial<CityRankEntry> = {}): CityRankEntry {
  return {
    rank: "#5 of 20 in Testville, IL",
    overall_percentile: 75,
    best_dimension: "reliability",
    worst_dimension: "pricing_fairness",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeVerdict
// ---------------------------------------------------------------------------

section("computeVerdict (absolute composite + signal-clean)");

// NOTE: cityRank is preserved in the signature for forward compat / tie-breaks
// but no longer drives the verdict. Verdict is derived from absolute composite
// score + variance + cross-platform signals. See decision-engine.ts.

test("composite 90 + variance 10 + clean signals -> strong_hire", () => {
  const v = computeVerdict(
    makeScores({ reliability: 90, pricing_fairness: 90, workmanship: 90, responsiveness: 90, communication: 90, variance: 10 }),
    makeRank({ overall_percentile: 50 }), // city percentile no longer matters
  );
  assert.equal(v, "strong_hire");
});

test("boundary: composite exactly 80 + variance 19 -> strong_hire", () => {
  const v = computeVerdict(
    makeScores({ variance: 19 }), // makeScores defaults to all 75s -> composite 75; lift to 80
    makeRank(),
    undefined,
  );
  // makeScores composites to 75, not 80 — explicitly raise to 80
  const at80 = makeScores({
    reliability: 80, pricing_fairness: 80, workmanship: 80, responsiveness: 80, communication: 80, variance: 19,
  });
  assert.equal(computeVerdict(at80, makeRank()), "strong_hire");
});

test("composite 80 + variance 20 -> conditional_hire (variance gate)", () => {
  const v = computeVerdict(
    makeScores({
      reliability: 80, pricing_fairness: 80, workmanship: 80, responsiveness: 80, communication: 80, variance: 20,
    }),
    makeRank(),
  );
  assert.equal(v, "conditional_hire");
});

test("composite 90 + variance 30 -> conditional_hire (high variance)", () => {
  const v = computeVerdict(
    makeScores({
      reliability: 90, pricing_fairness: 90, workmanship: 90, responsiveness: 90, communication: 90, variance: 30,
    }),
    makeRank(),
  );
  assert.equal(v, "conditional_hire");
});

test("composite 80 + clean signals + MAJOR platform discrepancy -> conditional_hire", () => {
  const sigs: CrossPlatformSignals = { platform: "major", bbb: "none" };
  const scores = makeScores({
    reliability: 80, pricing_fairness: 80, workmanship: 80, responsiveness: 80, communication: 80,
  });
  assert.equal(computeVerdict(scores, makeRank(), sigs), "conditional_hire");
});

test("composite 80 + clean signals + RED BBB -> conditional_hire", () => {
  const sigs: CrossPlatformSignals = { platform: "none", bbb: "red" };
  const scores = makeScores({
    reliability: 80, pricing_fairness: 80, workmanship: 80, responsiveness: 80, communication: 80,
  });
  assert.equal(computeVerdict(scores, makeRank(), sigs), "conditional_hire");
});

test("composite 80 + MINOR platform discrepancy -> still strong_hire (minor not major)", () => {
  const sigs: CrossPlatformSignals = { platform: "minor", bbb: "none" };
  const scores = makeScores({
    reliability: 80, pricing_fairness: 80, workmanship: 80, responsiveness: 80, communication: 80,
  });
  assert.equal(computeVerdict(scores, makeRank(), sigs), "strong_hire");
});

test("composite 70 -> conditional_hire (below strong_hire threshold)", () => {
  const v = computeVerdict(
    makeScores({
      reliability: 70, pricing_fairness: 70, workmanship: 70, responsiveness: 70, communication: 70,
    }),
    makeRank(),
  );
  assert.equal(v, "conditional_hire");
});

test("composite 60 -> caution", () => {
  const v = computeVerdict(
    makeScores({
      reliability: 60, pricing_fairness: 60, workmanship: 60, responsiveness: 60, communication: 60,
    }),
    makeRank(),
  );
  assert.equal(v, "caution");
});

test("composite 59 -> avoid", () => {
  const v = computeVerdict(
    makeScores({
      reliability: 59, pricing_fairness: 59, workmanship: 59, responsiveness: 59, communication: 59,
    }),
    makeRank(),
  );
  assert.equal(v, "avoid");
});

test("city percentile no longer affects verdict (composite is canonical)", () => {
  // Same scores, different city percentile -> same verdict
  const scores = makeScores({
    reliability: 75, pricing_fairness: 75, workmanship: 75, responsiveness: 75, communication: 75,
  });
  const v1 = computeVerdict(scores, makeRank({ overall_percentile: 99 }));
  const v2 = computeVerdict(scores, makeRank({ overall_percentile: 1 }));
  assert.equal(v1, "conditional_hire");
  assert.equal(v2, "conditional_hire");
});

// ---------------------------------------------------------------------------
// Cross-platform signals (deterministic detector)
// ---------------------------------------------------------------------------

section("computeCrossPlatformSignals");

test("severe platform: 1.5+ star Google/Yelp gap with adequate sample", () => {
  const s = computeCrossPlatformSignals({
    googleRating: 4.8, googleReviewCount: 200,
    yelpRating: 3.2, yelpReviewCount: 50,
    platformDiscrepancyText: null, bbb: null,
  });
  assert.equal(s.platform, "severe");
});

test("major platform: 1.0-1.5 star gap", () => {
  const s = computeCrossPlatformSignals({
    googleRating: 4.7, googleReviewCount: 1800,
    yelpRating: 3.4, yelpReviewCount: 28,
    platformDiscrepancyText: null, bbb: null,
  });
  assert.equal(s.platform, "major");
});

test("minor platform: 0.7-1.0 star gap", () => {
  const s = computeCrossPlatformSignals({
    googleRating: 4.7, googleReviewCount: 100,
    yelpRating: 3.9, yelpReviewCount: 30,
    platformDiscrepancyText: null, bbb: null,
  });
  assert.equal(s.platform, "minor");
});

test("none: gap below 0.7", () => {
  const s = computeCrossPlatformSignals({
    googleRating: 4.7, googleReviewCount: 100,
    yelpRating: 4.4, yelpReviewCount: 30,
    platformDiscrepancyText: null, bbb: null,
  });
  assert.equal(s.platform, "none");
});

test("insufficient sample: gap is large but Yelp <10 reviews -> none", () => {
  const s = computeCrossPlatformSignals({
    googleRating: 4.8, googleReviewCount: 500,
    yelpRating: 1.0, yelpReviewCount: 5,
    platformDiscrepancyText: null, bbb: null,
  });
  assert.equal(s.platform, "none");
});

test("synthesizer-detected discrepancy promotes 'none' to 'major'", () => {
  const s = computeCrossPlatformSignals({
    googleRating: 4.8, googleReviewCount: 100,
    yelpRating: 4.5, yelpReviewCount: 20, // numeric gap is small
    platformDiscrepancyText: "Google glowing, Yelp 1-stars cite billing disputes",
    bbb: null,
  });
  assert.equal(s.platform, "major");
});

test("BBB red: 1.0%+ complaint rate", () => {
  const s = computeCrossPlatformSignals({
    googleRating: 4.7, googleReviewCount: 200, yelpRating: null, yelpReviewCount: 0,
    platformDiscrepancyText: null,
    bbb: { complaintsPast3Years: 5 }, // 5/200 = 2.5%
  });
  assert.equal(s.bbb, "red");
});

test("BBB amber: 0.5-1.0% complaint rate", () => {
  const s = computeCrossPlatformSignals({
    googleRating: 4.7, googleReviewCount: 800, yelpRating: null, yelpReviewCount: 0,
    platformDiscrepancyText: null,
    bbb: { complaintsPast3Years: 5 }, // 5/800 = 0.625%
  });
  assert.equal(s.bbb, "amber");
});

test("BBB none: below 3 absolute complaints (1-2 don't fire)", () => {
  const s = computeCrossPlatformSignals({
    googleRating: 4.7, googleReviewCount: 50, yelpRating: null, yelpReviewCount: 0,
    platformDiscrepancyText: null,
    bbb: { complaintsPast3Years: 2 },
  });
  assert.equal(s.bbb, "none");
});

// ---------------------------------------------------------------------------
// Adjustment penalty + apply
// ---------------------------------------------------------------------------

section("computeAdjustmentPenalty + applyAdjustment");

test("clean signals -> 0 penalty", () => {
  assert.equal(computeAdjustmentPenalty({ platform: "none", bbb: "none" }), 0);
});

test("major platform alone -> 6 point penalty", () => {
  assert.equal(computeAdjustmentPenalty({ platform: "major", bbb: "none" }), 6);
});

test("severe platform + red BBB -> capped at 15", () => {
  assert.equal(computeAdjustmentPenalty({ platform: "severe", bbb: "red" }), 15);
});

test("applyAdjustment subtracts uniformly from each dimension", () => {
  const raw = makeScores({
    reliability: 90, pricing_fairness: 80, workmanship: 75, responsiveness: 85, communication: 70,
  });
  const adj = applyAdjustment(raw, 6);
  assert.equal(adj.reliability, 84);
  assert.equal(adj.pricing_fairness, 74);
  assert.equal(adj.workmanship, 69);
  assert.equal(adj.responsiveness, 79);
  assert.equal(adj.communication, 64);
});

test("applyAdjustment preserves variance and other non-dim fields", () => {
  const raw = makeScores({ variance: 14, review_count_used: 42 });
  const adj = applyAdjustment(raw, 5);
  assert.equal(adj.variance, 14);
  assert.equal(adj.review_count_used, 42);
});

test("applyAdjustment clamps to [0, 100]", () => {
  const raw = makeScores({
    reliability: 5, pricing_fairness: 95, workmanship: 50, responsiveness: 50, communication: 50,
  });
  const adj = applyAdjustment(raw, 10);
  assert.equal(adj.reliability, 0); // 5 - 10 clamped
  assert.equal(adj.pricing_fairness, 85);
});

// ---------------------------------------------------------------------------
// Roto-Rooter Huntsville regression: the case the rework was driven by
// ---------------------------------------------------------------------------

test("Roto-Rooter Huntsville scenario: high raw composite + major platform → conditional_hire", () => {
  // Real numbers from production: 1758 Google reviews 4.7★, 28 Yelp 3.3★
  const sigs = computeCrossPlatformSignals({
    googleRating: 4.7, googleReviewCount: 1758,
    yelpRating: 3.3, yelpReviewCount: 28,
    platformDiscrepancyText: "Google 4.7 vs Yelp 3.3",
    bbb: { complaintsPast3Years: null },
  });
  assert.equal(sigs.platform, "major");

  const rawScores = makeScores({
    reliability: 89, pricing_fairness: 91, workmanship: 91, responsiveness: 89, communication: 87, variance: 5,
  });
  const penalty = computeAdjustmentPenalty(sigs);
  assert.equal(penalty, 6);

  const adjustedScores = applyAdjustment(rawScores, penalty);
  // Adjusted composite = (83 + 85 + 85 + 83 + 81) / 5 = 83.4
  // Above strong_hire threshold (80), but signal-clean check fails
  const verdict = computeVerdict(adjustedScores, makeRank(), sigs);
  assert.equal(verdict, "conditional_hire");
});

test("low composite 60 with mixed dims -> caution (≥60 floor)", () => {
  // Mean of 55, 65, 65, 65, 69 = 63.8 — above 60 caution floor
  const v = computeVerdict(
    makeScores({
      reliability: 55, pricing_fairness: 65, workmanship: 65, responsiveness: 65, communication: 69,
    }),
    makeRank(),
  );
  assert.equal(v, "caution");
});

test("composite below 60 -> avoid", () => {
  const v = computeVerdict(
    makeScores({
      reliability: 50, pricing_fairness: 50, workmanship: 50, responsiveness: 50, communication: 50,
    }),
    makeRank(),
  );
  assert.equal(v, "avoid");
});

// ---------------------------------------------------------------------------
// computeBestFor
// ---------------------------------------------------------------------------

section("computeBestFor");

test("empty when all scores mid-range", () => {
  assert.deepEqual(computeBestFor(makeScores()), []);
});

test("emergency + same-day rule fires (reliability 85, responsiveness 80)", () => {
  const out = computeBestFor(
    makeScores({ reliability: 85, responsiveness: 80 }),
  );
  assert.ok(out.includes("Emergency and same-day calls"));
});

test("boundary: reliability 84 does NOT fire emergency rule", () => {
  const out = computeBestFor(
    makeScores({ reliability: 84, responsiveness: 95 }),
  );
  assert.ok(!out.includes("Emergency and same-day calls"));
});

test("budget-conscious rule fires (pricing 85, workmanship 75)", () => {
  const out = computeBestFor(
    makeScores({ pricing_fairness: 85, workmanship: 75 }),
  );
  assert.ok(out.includes("Budget-conscious homeowners"));
});

test("complex installs rule fires (workmanship 90, communication 85)", () => {
  const out = computeBestFor(
    makeScores({ workmanship: 90, communication: 85 }),
  );
  assert.ok(out.includes("Complex installs and remodels"));
});

test("boundary: workmanship 89 does NOT fire complex installs rule", () => {
  const out = computeBestFor(
    makeScores({ workmanship: 89, communication: 99 }),
  );
  assert.ok(!out.includes("Complex installs and remodels"));
});

test("water heater specialty >= 85", () => {
  const out = computeBestFor(
    makeScores({
      specialty_strength: {
        water_heater: 85,
        drain: 0,
        repipe: 0,
        emergency: 0,
        remodel: 0,
      },
    }),
  );
  assert.ok(out.includes("Water heater install/repair"));
});

test("drain specialty >= 85", () => {
  const out = computeBestFor(
    makeScores({
      specialty_strength: {
        water_heater: 0,
        drain: 90,
        repipe: 0,
        emergency: 0,
        remodel: 0,
      },
    }),
  );
  assert.ok(out.includes("Drain and sewer work"));
});

test("multiple rules can fire at once", () => {
  const out = computeBestFor(
    makeScores({
      reliability: 95,
      responsiveness: 90,
      pricing_fairness: 90,
      workmanship: 92,
      communication: 90,
    }),
  );
  assert.ok(out.length >= 3);
});

// ---------------------------------------------------------------------------
// computeAvoidIf
// ---------------------------------------------------------------------------

section("computeAvoidIf");

test("price-sensitive warning when pricing_fairness 59", () => {
  const out = computeAvoidIf(makeScores({ pricing_fairness: 59 }));
  assert.ok(out.includes("You're highly price-sensitive"));
});

test("boundary: pricing_fairness exactly 60 -> no rule", () => {
  const out = computeAvoidIf(makeScores({ pricing_fairness: 60 }));
  assert.equal(out.length, 0);
});

test("complex-install warning when workmanship 64", () => {
  const out = computeAvoidIf(makeScores({ workmanship: 64 }));
  assert.equal(out.length, 1);
  assert.ok(out[0].toLowerCase().includes("complex"));
});

test("boundary: workmanship exactly 65 -> no rule", () => {
  const out = computeAvoidIf(makeScores({ workmanship: 65 }));
  assert.equal(out.length, 0);
});

test("both avoid rules fire when both thresholds crossed", () => {
  const out = computeAvoidIf(
    makeScores({ pricing_fairness: 50, workmanship: 50 }),
  );
  assert.equal(out.length, 2);
});

test("relative pricing rule fires when dim_percentiles.pricing_fairness <= 25", () => {
  const rank = makeRank({
    dim_percentiles: { pricing_fairness: 20 },
  });
  const out = computeAvoidIf(makeScores({ pricing_fairness: 70 }), rank);
  assert.ok(out.some((s) => s.includes("better-priced")));
});

test("relative pricing rule does NOT fire when pricing_fairness < 60 (no double-up)", () => {
  const rank = makeRank({
    dim_percentiles: { pricing_fairness: 10 },
  });
  const out = computeAvoidIf(makeScores({ pricing_fairness: 55 }), rank);
  assert.ok(out.some((s) => s.includes("price-sensitive"))); // absolute fires
  assert.ok(!out.some((s) => s.includes("better-priced"))); // relative suppressed
});

test("relative pricing rule does NOT fire when percentile > 25", () => {
  const rank = makeRank({
    dim_percentiles: { pricing_fairness: 30 },
  });
  const out = computeAvoidIf(makeScores({ pricing_fairness: 70 }), rank);
  assert.equal(out.length, 0);
});

test("relative pricing rule fires at boundary percentile 25", () => {
  const rank = makeRank({
    dim_percentiles: { pricing_fairness: 25 },
  });
  const out = computeAvoidIf(makeScores({ pricing_fairness: 65 }), rank);
  assert.ok(out.some((s) => s.includes("better-priced")));
});

// ---------------------------------------------------------------------------
// computeCautionIf
// ---------------------------------------------------------------------------

section("computeCautionIf");

test("variance 26 fires consistency caution", () => {
  const out = computeCautionIf(makeScores({ variance: 26 }));
  assert.ok(out.some((s) => s.includes("predictable")));
});

test("boundary: variance exactly 25 -> no variance entry", () => {
  const out = computeCautionIf(makeScores({ variance: 25 }));
  assert.ok(!out.some((s) => s.includes("predictable")));
});

test("communication 59 fires upfront-explanations caution", () => {
  const out = computeCautionIf(makeScores({ communication: 59 }));
  assert.ok(out.some((s) => s.includes("upfront explanations")));
});

test("communication rule suppresses templated communication weakness (no duplicate)", () => {
  const out = computeCautionIf(
    makeScores({
      reliability: 90,
      pricing_fairness: 90,
      workmanship: 90,
      responsiveness: 90,
      communication: 40,
    }),
  );
  // the rule-based "upfront explanations" line fires
  assert.ok(out.some((s) => s.includes("upfront explanations")));
  // but the templated "detailed walkthroughs and written estimates" is suppressed
  assert.ok(!out.some((s) => s.includes("written estimates")));
});

test("templated caution pulls from weakest dims when no rule fires", () => {
  const out = computeCautionIf(
    makeScores({
      reliability: 40,
      pricing_fairness: 90,
      workmanship: 90,
      responsiveness: 90,
      communication: 90,
      variance: 10,
    }),
  );
  assert.ok(out.some((s) => s.toLowerCase().includes("scheduling")));
  assert.equal(out.length, 2);
});

// ---------------------------------------------------------------------------
// computeHireIf
// ---------------------------------------------------------------------------

section("computeHireIf");

test("exactly 2 templated entries from strongest dims", () => {
  const out = computeHireIf(
    makeScores({
      reliability: 95,
      pricing_fairness: 50,
      workmanship: 50,
      responsiveness: 92,
      communication: 50,
    }),
  );
  assert.equal(out.length, 2);
});

test("strongest dim phrase appears first", () => {
  const out = computeHireIf(
    makeScores({
      reliability: 95,
      pricing_fairness: 50,
      workmanship: 50,
      responsiveness: 80,
      communication: 50,
    }),
  );
  assert.ok(out[0].includes("shows up")); // reliability phrase
});

// ---------------------------------------------------------------------------
// computeDecision (end-to-end)
// ---------------------------------------------------------------------------

section("computeDecision end-to-end");

test("realistic strong plumber -> strong_hire + multiple best_for + no avoid_if", () => {
  const scores = makeScores({
    reliability: 92,
    pricing_fairness: 86,
    workmanship: 88,
    responsiveness: 87,
    communication: 85,
    variance: 12,
    specialty_strength: {
      water_heater: 90,
      drain: 70,
      repipe: 50,
      emergency: 80,
      remodel: 60,
    },
  });
  const rank = makeRank({ overall_percentile: 92 });
  const d = computeDecision(scores, rank);
  assert.equal(d.verdict, "strong_hire");
  assert.ok(d.best_for.length >= 2);
  assert.equal(d.hire_if.length, 2);
  assert.equal(d.avoid_if.length, 0);
});

test("weak plumber -> avoid verdict + avoid_if + caution_if populated", () => {
  const scores = makeScores({
    reliability: 40,
    pricing_fairness: 45,
    workmanship: 50,
    responsiveness: 42,
    communication: 45,
    variance: 35,
  });
  // composite = (40+45+50+42+45)/5 = 44.4, below 65 floor -> avoid stands
  const rank = makeRank({ overall_percentile: 20 });
  const d = computeDecision(scores, rank);
  assert.equal(d.verdict, "avoid");
  assert.ok(d.avoid_if.length >= 1);
  assert.ok(d.caution_if.length >= 1);
});

test("middling plumber (composite 70.2) -> conditional_hire, hire_if present, best_for empty", () => {
  // Composite = (70+72+68+70+71)/5 = 70.2 — at the conditional_hire threshold.
  // Previously this test asserted "caution" because the 45th percentile mapped
  // there; now the absolute composite drives the verdict.
  const scores = makeScores({
    reliability: 70,
    pricing_fairness: 72,
    workmanship: 68,
    responsiveness: 70,
    communication: 71,
    variance: 15,
  });
  const rank = makeRank({ overall_percentile: 45 });
  const d = computeDecision(scores, rank);
  assert.equal(d.verdict, "conditional_hire");
  assert.equal(d.hire_if.length, 2);
  assert.equal(d.best_for.length, 0);
});

test("genuinely middling plumber (composite 64) -> caution", () => {
  const scores = makeScores({
    reliability: 64, pricing_fairness: 64, workmanship: 64, responsiveness: 64, communication: 64, variance: 15,
  });
  const d = computeDecision(scores, makeRank());
  assert.equal(d.verdict, "caution");
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
