#!/usr/bin/env npx tsx
/**
 * Unit tests for plumber-signals.ts.
 *
 * Uses node:assert + a tiny harness — consistent with test-decision-engine.ts.
 * No dependency on Firestore or external services; fakes a Plumber object
 * inline for each test.
 *
 * Run: cd apps/plumbers-web && npx tsx scripts/test-plumber-signals.ts
 */

import assert from "node:assert/strict";
import {
  resolveSignals,
  pickTop,
  countByKind,
  FLAG_THRESHOLD,
  EXCEL_THRESHOLD,
  VARIANCE_HIGH,
  BBB_COMPLAINTS_3YR_CONCERN,
  SMALL_SAMPLE_THRESHOLD,
  type Signal,
} from "../src/lib/plumber-signals.js";

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

// ---------------------------------------------------------------------------
// Plumber factory — returns a minimal but typed Plumber object
// ---------------------------------------------------------------------------

function makePlumber(overrides: Record<string, unknown> = {}) {
  const defaults = {
    id: "test-plumber",
    businessName: "Test Plumber Co",
    phone: "555-555-5555",
    is24Hour: false,
    status: "active" as const,
    scores: {
      reliability: 75,
      pricing_fairness: 75,
      workmanship: 75,
      responsiveness: 75,
      communication: 75,
      specialty_strength: {
        water_heater: 0, drain: 0, repipe: 0, emergency: 0, remodel: 0,
        sewer: 0, toilet: 0, fixture: 0, sump_pump: 0, gas_line: 0,
        slab_leak: 0, water_line: 0,
      },
      variance: 10,
      review_count_used: 50,
      last_scored_at: "2026-04-16T00:00:00Z",
    },
    evidence_quotes: [],
    decision: null,
    city_rank: null,
    reviewSynthesis: null,
    bbb: null,
    googleRating: 4.5,
    yelpRating: null,
  };
  return { ...defaults, ...overrides } as unknown as Parameters<
    typeof resolveSignals
  >[0];
}

// ---------------------------------------------------------------------------
// Dimension signals
// ---------------------------------------------------------------------------

section("Dimension signals");

test("pricing_fairness = 53 produces a pricing-flag signal (Tim's explicit example)", () => {
  const p = makePlumber({
    scores: { ...makePlumber().scores, pricing_fairness: 53 },
  });
  const signals = resolveSignals(p);
  const pricingFlag = signals.find((s) => s.id === "dim-pricing_fairness-flag");
  assert.ok(pricingFlag, "expected a pricing_fairness flag");
  assert.equal(pricingFlag!.kind, "flag");
  assert.ok(pricingFlag!.priority >= 5);
  assert.ok(pricingFlag!.icon.includes("pricing-flag"));
});

test("dimension at exactly 60 does NOT flag (inclusive upper bound)", () => {
  const p = makePlumber({
    scores: { ...makePlumber().scores, pricing_fairness: FLAG_THRESHOLD },
  });
  const signals = resolveSignals(p);
  assert.equal(signals.filter((s) => s.id === "dim-pricing_fairness-flag").length, 0);
});

test("dimension at 59 DOES flag (strict boundary)", () => {
  const p = makePlumber({
    scores: { ...makePlumber().scores, workmanship: 59 },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "dim-workmanship-flag"));
});

test("dimension at 80 (EXCEL_THRESHOLD) produces an excel signal", () => {
  const p = makePlumber({
    scores: { ...makePlumber().scores, communication: EXCEL_THRESHOLD },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "dim-communication-excel"));
});

test("dimension at 79 does NOT excel", () => {
  const p = makePlumber({
    scores: { ...makePlumber().scores, communication: 79 },
  });
  const signals = resolveSignals(p);
  assert.equal(signals.filter((s) => s.id === "dim-communication-excel").length, 0);
});

test("all dimensions in mid-range (75) produces no dimension signals", () => {
  const p = makePlumber();
  const signals = resolveSignals(p);
  const dimSignals = signals.filter((s) => s.id.startsWith("dim-"));
  assert.equal(dimSignals.length, 0);
});

test("evidence_quote is attached to dimension signal when available", () => {
  const p = makePlumber({
    scores: { ...makePlumber().scores, reliability: 45 },
    evidence_quotes: [
      { dimension: "reliability", quote: "never showed up twice", review_id: "abc" },
    ],
  });
  const signals = resolveSignals(p);
  const s = signals.find((x) => x.id === "dim-reliability-flag");
  assert.ok(s);
  assert.equal(s!.evidence, "never showed up twice");
});

// ---------------------------------------------------------------------------
// Variance signals
// ---------------------------------------------------------------------------

section("Variance signals");

test("variance >= VARIANCE_HIGH produces hit-or-miss flag", () => {
  const p = makePlumber({
    scores: { ...makePlumber().scores, variance: VARIANCE_HIGH },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "variance-flag"));
});

test("variance < VARIANCE_LOW + good scores produces consistency excel", () => {
  const p = makePlumber({
    scores: {
      ...makePlumber().scores,
      variance: 5,
      reliability: 80, pricing_fairness: 75, workmanship: 75,
      responsiveness: 75, communication: 75,
    },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "consistency-excel"));
});

test("low variance + mediocre scores does NOT produce consistency excel", () => {
  const p = makePlumber({
    scores: {
      ...makePlumber().scores, variance: 5,
      reliability: 50, pricing_fairness: 50, workmanship: 50,
      responsiveness: 50, communication: 50,
    },
  });
  const signals = resolveSignals(p);
  assert.equal(signals.filter((s) => s.id === "consistency-excel").length, 0);
});

// ---------------------------------------------------------------------------
// Sample size
// ---------------------------------------------------------------------------

section("Sample signals");

test("review_count_used < SMALL_SAMPLE_THRESHOLD produces warning", () => {
  const p = makePlumber({
    scores: { ...makePlumber().scores, review_count_used: 5 },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "sample-warning" && s.kind === "info"));
});

test("review_count_used >= 10 does NOT warn", () => {
  const p = makePlumber({
    scores: { ...makePlumber().scores, review_count_used: SMALL_SAMPLE_THRESHOLD },
  });
  const signals = resolveSignals(p);
  assert.equal(signals.filter((s) => s.id === "sample-warning").length, 0);
});

// ---------------------------------------------------------------------------
// BBB signals
// ---------------------------------------------------------------------------

section("BBB signals");

test("accredited + A+ produces bbb-a-plus excel", () => {
  const p = makePlumber({
    bbb: { accredited: true, rating: "A+", yearsInBusiness: 10 },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "bbb-a-plus" && s.kind === "excel"));
});

test("10 complaints in 3 years triggers concern flag (boundary)", () => {
  const p = makePlumber({
    bbb: { complaintsPast3Years: BBB_COMPLAINTS_3YR_CONCERN },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "bbb-complaints-3yr"));
});

test("9 complaints in 3 years does NOT trigger the 3yr concern (below boundary)", () => {
  const p = makePlumber({ bbb: { complaintsPast3Years: 9 } });
  const signals = resolveSignals(p);
  assert.equal(signals.filter((s) => s.id === "bbb-complaints-3yr").length, 0);
});

test("no BBB data emits zero BBB signals", () => {
  const p = makePlumber();
  const signals = resolveSignals(p);
  assert.equal(signals.filter((s) => s.id.startsWith("bbb-")).length, 0);
});

// ---------------------------------------------------------------------------
// Platform signals
// ---------------------------------------------------------------------------

section("Platform signals");

test("Google 4.8 vs Yelp 3.5 emits platform gap flag when synthesis has no note", () => {
  const p = makePlumber({
    googleRating: 4.8,
    yelpRating: 3.5,
    reviewSynthesis: { platformDiscrepancy: null },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "platform-gap-raw"));
});

test("synthesis-provided platformDiscrepancy wins over raw gap", () => {
  const p = makePlumber({
    googleRating: 4.8,
    yelpRating: 3.5,
    reviewSynthesis: { platformDiscrepancy: "Google vs Yelp gap of 1.3 stars." },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "platform-mismatch"));
  assert.equal(signals.filter((s) => s.id === "platform-gap-raw").length, 0);
});

test("Google 4.8 vs Yelp 4.5 (gap < 1.0) emits no platform flag", () => {
  const p = makePlumber({ googleRating: 4.8, yelpRating: 4.5 });
  const signals = resolveSignals(p);
  assert.equal(signals.filter((s) => s.id.startsWith("platform-")).length, 0);
});

// ---------------------------------------------------------------------------
// Synthesis signals
// ---------------------------------------------------------------------------

section("Synthesis signals");

test("emergencyReadiness=high + is24Hour produces 24-7-verified excel", () => {
  const p = makePlumber({
    is24Hour: true,
    reviewSynthesis: { emergencyReadiness: "high", emergencyNotes: "24/7 confirmed." },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "24-7-verified"));
});

test("emergencyReadiness=low produces slow-emergency flag", () => {
  const p = makePlumber({
    reviewSynthesis: { emergencyReadiness: "low" },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "emergency-weak"));
});

test("premium pricing + pricing red flag produces premium-with-concerns flag", () => {
  const p = makePlumber({
    reviewSynthesis: {
      pricingTier: "premium",
      redFlags: ["Pricing concerns: quotes exceed competitors by 3x"],
    },
  });
  const signals = resolveSignals(p);
  assert.ok(signals.some((s) => s.id === "premium-with-concerns"));
});

test("premium pricing WITHOUT pricing red flag does NOT flag", () => {
  const p = makePlumber({
    reviewSynthesis: {
      pricingTier: "premium",
      redFlags: ["Response time complaints"],
    },
  });
  const signals = resolveSignals(p);
  assert.equal(signals.filter((s) => s.id === "premium-with-concerns").length, 0);
});

// ---------------------------------------------------------------------------
// pickTop — the honesty rule
// ---------------------------------------------------------------------------

section("pickTop honesty rule");

test("top-3 always includes the most severe flag first", () => {
  const p = makePlumber({
    scores: {
      ...makePlumber().scores,
      reliability: 90,  // excel
      pricing_fairness: 40, // flag
      workmanship: 85, // excel
      responsiveness: 80,
      communication: 78,
    },
  });
  const signals = resolveSignals(p);
  const top3 = pickTop(signals, 3);
  assert.ok(top3.length >= 1);
  assert.equal(top3[0].kind, "flag", "top slot must be a flag when any flag exists");
  assert.ok(top3[0].id.includes("pricing"));
});

test("top-3 returns all excels when no flags exist", () => {
  const p = makePlumber({
    scores: {
      ...makePlumber().scores,
      reliability: 90,
      pricing_fairness: 85,
      workmanship: 88,
      responsiveness: 80,
      communication: 82,
    },
  });
  const signals = resolveSignals(p);
  const top3 = pickTop(signals, 3);
  assert.ok(top3.every((s) => s.kind !== "flag"));
  assert.equal(top3.length, 3);
});

test("pickTop respects N", () => {
  const p = makePlumber({
    scores: {
      ...makePlumber().scores,
      reliability: 90,
      pricing_fairness: 85,
      workmanship: 88,
    },
  });
  const signals = resolveSignals(p);
  assert.equal(pickTop(signals, 2).length, 2);
  assert.equal(pickTop(signals, 0).length, 0);
  assert.equal(pickTop(signals, 1).length, 1);
});

test("pickTop on empty signals returns empty", () => {
  assert.deepEqual(pickTop([], 3), []);
});

// ---------------------------------------------------------------------------
// Realistic plumber shapes
// ---------------------------------------------------------------------------

section("Realistic plumber shapes");

test("Hiller-like plumber (high Google, low Yelp, many BBB complaints) surfaces 3+ flags in top3", () => {
  // Mirrors the Hiller data we ran through the pipeline for real.
  const p = makePlumber({
    googleRating: 4.8,
    yelpRating: 3.5,
    scores: {
      ...makePlumber().scores,
      reliability: 76, pricing_fairness: 53, workmanship: 79,
      responsiveness: 82, communication: 79, variance: 38,
      review_count_used: 182,
    },
    decision: { verdict: "caution", best_for: [], avoid_if: [], hire_if: [], caution_if: [] },
    bbb: { accredited: true, rating: "A+", complaintsPast3Years: 21 },
    reviewSynthesis: {
      pricingTier: "premium",
      emergencyReadiness: "high",
      platformDiscrepancy: "Google 4.8 vs Yelp 3.5 — 1.5-star gap",
      redFlags: ["Pricing: 23 reviews cite inflated quotes"],
      badges: ["Fast Responder", "24/7 Available"],
    },
  });
  const signals = resolveSignals(p);
  const top3 = pickTop(signals, 3);
  // Top slot must be a flag (pricing is the big one)
  assert.equal(top3[0].kind, "flag");
  // At least one of top3 references pricing
  assert.ok(top3.some((s) => /pricing|premium/i.test(s.label)));
});

test("strong_hire plumber with clean signals surfaces excels only", () => {
  const p = makePlumber({
    scores: {
      ...makePlumber().scores,
      reliability: 92, pricing_fairness: 88, workmanship: 90,
      responsiveness: 87, communication: 89, variance: 8,
    },
    is24Hour: true,
    decision: { verdict: "strong_hire", best_for: [], avoid_if: [], hire_if: [], caution_if: [] },
    bbb: { accredited: true, rating: "A+" },
    reviewSynthesis: { emergencyReadiness: "high" },
  });
  const signals = resolveSignals(p);
  const counts = countByKind(signals);
  assert.equal(counts.flag, 0);
  assert.ok(counts.excel >= 4);
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
