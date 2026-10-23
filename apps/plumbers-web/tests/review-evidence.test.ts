import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ratingMix, newestReviewLabel, reviewsReadCount, quotePair } from '../src/lib/report-card';
import type { SynthesizedPlumber } from '../src/lib/plumber-data';

function record(overrides: Partial<SynthesizedPlumber> = {}): SynthesizedPlumber {
  return { reviews: [], evidence_quotes: [], ...overrides } as SynthesizedPlumber;
}

test('selected-excerpt counts remain distinct from the analysis count', () => {
  const p = record({
    reviews: [{ author: 'A', rating: 5, text: 'A detailed positive review of the service.', time: '2025-12-01', relativeTime: '', source: 'google' }],
    scores: { review_count_used: 85 } as SynthesizedPlumber['scores'],
  });
  assert.equal(reviewsReadCount(p), 85);
  assert.equal(ratingMix(p)?.analyzed, 1);
  assert.match(quotePair(p).absenceNote!, /selected excerpts/);
  assert.match(quotePair(p).absenceNote!, /does not mean/);
});

test('freshness includes newer evidence quotes and ignores invalid dates', () => {
  const p = record({
    reviews: [{ time: '2025-12-01' }, { time: 'invalid' }] as SynthesizedPlumber['reviews'],
    evidence_quotes: [{ published_at: '2026-04-01' }] as SynthesizedPlumber['evidence_quotes'],
  });
  assert.equal(newestReviewLabel(p), 'Apr 2026');
});

test('freshness compares timestamps rather than lexical order', () => {
  const p = record({ reviews: [{ time: '2026-02-01T00:00:00Z' }, { time: '2026-01-31T23:30:00-02:00' }] as SynthesizedPlumber['reviews'] });
  assert.equal(newestReviewLabel(p), 'Feb 2026');
  assert.equal(newestReviewLabel(record()), null);
  assert.equal(newestReviewLabel(record({ reviews: [{ time: 'invalid' }] as SynthesizedPlumber['reviews'] })), null);
});

test('rating chart discloses selected excerpts instead of claiming the full analysis', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: RatingMix } = await import('../src/components/rebuild/RatingMix');
  const markup = renderToStaticMarkup(createElement(RatingMix, {
    mix: { counts: [1, 0, 0, 0, 4], analyzed: 5, smallSample: true, disagreesWithAverage: false },
    googleReviewCount: 500,
  }));
  assert.match(markup, /5 selected reviews/);
  assert.match(markup, /does not represent all reviews or the full analysis sample/);
  assert.doesNotMatch(markup, /we analyzed/);
});
