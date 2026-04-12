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
  type Scores,
  type CityRankEntry,
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

section("computeVerdict");

test("strong_hire when percentile 90 + variance 10", () => {
  const v = computeVerdict(
    makeScores({ variance: 10 }),
    makeRank({ overall_percentile: 90 }),
  );
  assert.equal(v, "strong_hire");
});

test("boundary: percentile 80 + variance 19 -> strong_hire", () => {
  const v = computeVerdict(
    makeScores({ variance: 19 }),
    makeRank({ overall_percentile: 80 }),
  );
  assert.equal(v, "strong_hire");
});

test("boundary: percentile 80 + variance 20 -> conditional_hire (variance < 20 fails)", () => {
  const v = computeVerdict(
    makeScores({ variance: 20 }),
    makeRank({ overall_percentile: 80 }),
  );
  assert.equal(v, "conditional_hire");
});

test("high percentile but variance 30 -> conditional_hire", () => {
  const v = computeVerdict(
    makeScores({ variance: 30 }),
    makeRank({ overall_percentile: 95 }),
  );
  assert.equal(v, "conditional_hire");
});

test("boundary: percentile 60 -> conditional_hire", () => {
  const v = computeVerdict(makeScores(), makeRank({ overall_percentile: 60 }));
  assert.equal(v, "conditional_hire");
});

test("percentile 59 -> caution", () => {
  const v = computeVerdict(makeScores(), makeRank({ overall_percentile: 59 }));
  assert.equal(v, "caution");
});

test("boundary: percentile 40 -> caution", () => {
  const v = computeVerdict(makeScores(), makeRank({ overall_percentile: 40 }));
  assert.equal(v, "caution");
});

test("percentile 39 + composite >= 65 -> caution (absolute floor)", () => {
  // All dims at 75 -> composite = 75, above the 65 floor
  const v = computeVerdict(makeScores(), makeRank({ overall_percentile: 39 }));
  assert.equal(v, "caution");
});

test("percentile 0 + composite >= 65 -> caution (absolute floor)", () => {
  const v = computeVerdict(makeScores(), makeRank({ overall_percentile: 0 }));
  assert.equal(v, "caution");
});

test("percentile 39 + composite < 65 -> avoid (below floor)", () => {
  const v = computeVerdict(
    makeScores({
      reliability: 50,
      pricing_fairness: 50,
      workmanship: 50,
      responsiveness: 50,
      communication: 50,
    }),
    makeRank({ overall_percentile: 39 }),
  );
  assert.equal(v, "avoid");
});

test("percentile 0 + composite exactly 65 -> caution (floor boundary)", () => {
  const v = computeVerdict(
    makeScores({
      reliability: 65,
      pricing_fairness: 65,
      workmanship: 65,
      responsiveness: 65,
      communication: 65,
    }),
    makeRank({ overall_percentile: 0 }),
  );
  assert.equal(v, "caution");
});

test("percentile 0 + composite 64.9 -> avoid (just below floor)", () => {
  // Mean of 60,65,65,65,69 = 64.8
  const v = computeVerdict(
    makeScores({
      reliability: 60,
      pricing_fairness: 65,
      workmanship: 65,
      responsiveness: 65,
      communication: 69,
    }),
    makeRank({ overall_percentile: 0 }),
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

test("middling plumber -> caution verdict, hire_if still present, best_for empty", () => {
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
  assert.equal(d.verdict, "caution");
  assert.equal(d.hire_if.length, 2);
  assert.equal(d.best_for.length, 0);
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
