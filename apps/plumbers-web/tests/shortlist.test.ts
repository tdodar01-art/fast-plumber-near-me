import assert from "node:assert/strict";
import { test } from "node:test";
import { selectShortlist, type ShortlistCandidate } from "../src/lib/shortlist";
import { shortlistData } from "../src/lib/shortlist-data";
import { verdictInfo } from "../src/lib/profile-dossier";
import type { SynthesizedPlumber } from "../src/lib/plumber-data";
const candidate = (
  extra: Partial<ShortlistCandidate> = {},
): ShortlistCandidate => ({
  id: "a",
  name: "A",
  slug: "a",
  phone: "555",
  website: null,
  rating: 4.9,
  googleCount: 900,
  analyzed: 50,
  quotes: 5,
  evidenceCurrent: true,
  active: true,
  is24Hour: false,
  verdict: "strong_hire",
  score: 90,
  services: { "drain-cleaning": 3 },
  concern: null,
  updated: null,
  fairDealing: ["Two customers describe clear estimates."],
  repeatedSalesConcern: false,
  needsEditorialReview: false,
  reliability: 90,
  pricing: 85,
  ...extra,
});
test("volume and stars cannot override missing fair-dealing evidence or repeated sales concerns", () => {
  assert.equal(
    selectShortlist([candidate({ fairDealing: [] })], "any", false).length,
    0,
  );
  assert.equal(
    selectShortlist([candidate({ repeatedSalesConcern: true })], "any", false)
      .length,
    0,
  );
  assert.equal(
    selectShortlist([candidate({ needsEditorialReview: true })], "any", false)
      .length,
    0,
  );
  assert.equal(
    selectShortlist([candidate({ analyzed: 5 })], "any", false).length,
    0,
  );
});
test("job and after-hours filters require explicit matching evidence", () => {
  const p = candidate();
  assert.equal(selectShortlist([p], "heater", false).length, 0);
  assert.equal(selectShortlist([p], "drain", true).length, 0);
  assert.equal(
    selectShortlist([candidate({ is24Hour: true })], "drain", true).length,
    1,
  );
});
test("fair pricing outranks raw editorial score and input is not mutated", () => {
  const input = [
    candidate({ id: "high-stars", score: 99, pricing: 60 }),
    candidate({ id: "fair-dealing", score: 80, pricing: 95 }),
  ];
  assert.equal(selectShortlist(input, "any", false)[0].id, "fair-dealing");
  assert.equal(input[0].id, "high-stars");
});
test("missing evidence cannot produce an avoid verdict (MPT regression)", () => {
  const p = {
    reviews: [],
    evidence_quotes: [],
    scores: { method: "no_reviews", review_count_used: 0 },
    synthesis: { score: 88 },
    decision: { verdict: "avoid" },
  } as unknown as SynthesizedPlumber;
  assert.equal(verdictInfo(p), null);
});
test("fair-dealing claims require two distinct resolvable attributed quotes", () => {
  const p = {
    placeId: "a",
    name: "A",
    reviews: [],
    evidence_quotes: [
      {
        review_id: "one",
        quote: "Clear estimate.",
        author_name: "A",
        source: "google",
        published_at: "2026-01-01",
      },
    ],
    synthesis: {
      strengthsEvidence: [
        {
          text: "Honest upfront pricing",
          supporting_review_ids: ["one", "one", "missing"],
        },
      ],
    },
  } as unknown as SynthesizedPlumber;
  assert.deepEqual(shortlistData(p).fairDealing, []);
});

test("closed businesses and stale evidence cannot be affirmative suggestions", () => {
  assert.equal(
    selectShortlist([candidate({ active: false })], "any", false).length,
    0,
  );
  assert.equal(
    selectShortlist([candidate({ evidenceCurrent: false })], "any", false)
      .length,
    0,
  );
});

test("fair-dealing eligibility requires positive, attributed evidence rather than matching words alone", () => {
  const base = {
    placeId: "evidence",
    name: "Evidence",
    reviews: [],
    evidence_quotes: [
      {
        review_id: "a",
        quote: "The price was clear.",
        author_name: "A",
        source: "google",
        published_at: "2026-10-01",
        rating: 5,
      },
      {
        review_id: "b",
        quote: "They explained the estimate.",
        author_name: "B",
        source: "google",
        published_at: "2026-10-02",
        rating: 5,
      },
      {
        review_id: "c",
        quote: "Good work.",
        author_name: "C",
        source: "google",
        published_at: "2026-10-03",
        rating: 4,
      },
    ],
    synthesis: {
      strengthsEvidence: [
        { text: "Honest upfront pricing", supporting_review_ids: ["a", "b"] },
      ],
    },
  } as unknown as SynthesizedPlumber;
  assert.equal(shortlistData(base).fairDealing.length, 1);
  assert.equal(
    shortlistData({
      ...base,
      evidence_quotes: base.evidence_quotes!.map((q) => ({ ...q, rating: 1 })),
    }).fairDealing.length,
    0,
  );
  assert.equal(
    shortlistData({
      ...base,
      synthesis: {
        ...base.synthesis!,
        strengthsEvidence: [
          {
            text: "Not transparent pricing",
            supporting_review_ids: ["a", "b"],
          },
        ],
      },
    }).fairDealing.length,
    0,
  );
});
