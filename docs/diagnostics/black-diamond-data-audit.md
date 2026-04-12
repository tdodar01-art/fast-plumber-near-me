> **Findings deferred per STRATEGY-BRIEF.md.** Outscraper expansion and star-rating stratification are Month 2 data quality initiatives.

# Black Diamond Plumbing & Mechanical — Data Quality Audit

**Date:** 2026-04-12
**Subject:** Black Diamond Plumbing & Mechanical Inc. (Woodstock, IL)
**Place ID:** `ChIJgZWOWi4ND4gRKmO1_H4v9qE`
**Slug:** `black-diamond-plumbing-mechanical-inc`
**Reported issue:** 4.9 stars / 6,632 reviews but only "1 concern" and thin "What to Watch Out For" — almost certainly wrong for a business this size.

---

## 1. RAW DATA CHECK

### Stored record

| Field | Value |
|-------|-------|
| Google rating | 4.9 |
| Google review count (displayed) | 6,632 |
| **Actual cached review objects** | **5** |
| Star distribution | 5x 5-star, 0x 4-star, 0x 3-star, 0x 2-star, 0x 1-star |
| Source | All Google (Places API) |
| Last scraped | 2026-04-01 |

**Files:**
- Raw: `apps/plumbers-web/data/raw/plumbers-latest.json` (lines 683-757)
- Synthesized: `apps/plumbers-web/data/synthesized/plumbers-synthesized.json` (lines 980-1078)

### The 5 cached reviews (all 5-star)

1. Kitchen drain cleaning by Mario — on-time, thorough
2. Roadside tire help from a Black Diamond rep — "life savers"
3. Long-term Diamond Member — home repair/maintenance since 2019
4. Electrician visit — "knowledgeable, patient, professional"
5. Well water system — family unfamiliar with well water, BDP helped

### Root cause: massive coverage gap

We display `googleReviewCount: 6632` (Google's total) but only have **5 review objects** cached — a **99.92% gap**. The 5 reviews we have are what the Google Places API (New) returns per call: a rotating sample of ~5 reviews, almost always positive.

**There are zero 1-star, 2-star, or 3-star reviews in our data.** We literally cannot identify concerns because we have no negative reviews to analyze.

---

## 2. SYNTHESIS PIPELINE AUDIT

### How `synthesize-reviews.ts` processed this plumber

1. **Review fetch** (line 292): queries Firestore `reviews` collection by `plumberId` — returned 5 docs.
2. **Threshold check** (line 306): `reviews.length < 3` → false (5 >= 3), so it proceeds to Claude AI synthesis (not keyword fallback).
3. **Claude prompt** (line 324): all 5 reviews are passed to Claude Haiku. The prompt tells Claude:
   - `Google Rating: 4.9/5 (6632 reviews)`
   - `We have 5 cached reviews.`
4. **Claude output**: score 90, trust "high", redFlags `[]`, weaknesses `["Not enough data to identify weaknesses"]`

### Review batching and caps

- **No cap on total reviews.** `score-plumbers.ts` processes ALL cached reviews, batched 15 at a time (`REVIEWS_PER_BATCH = 15` at line 72). A plumber with 200 cached reviews gets 14 batches.
- **But Black Diamond only has 5 reviews to process.** The bottleneck is upstream — we never fetched more.

### Star-rating stratification in sampling

**None.** Both the synthesis pipeline and the scoring pipeline use reviews purely by recency. There is no logic to preferentially include low-star reviews or ensure negative voices are represented.

### Recency decay (`score-plumbers.ts:160-164`)

```
<= 12 months old: weight 1.0
12-24 months old: weight 0.5
> 24 months old:  weight 0.25
```

Irrelevant for Black Diamond because all 5 reviews are from the same Places API call — they don't have meaningful date diversity.

### Sample size warning

The synthesis pipeline *does* have a warning mechanism (`synthesize-reviews.ts:369-371`):

```typescript
...(googleReviewCount > 50 && reviews.length / googleReviewCount < 0.05
  ? { sampleSizeWarning: `Based on 5 of 6632 reviews` }
  : {})
```

Black Diamond triggers this (6632 > 50, and 5/6632 = 0.075% < 5%), so the Firestore doc should have `sampleSizeWarning: "Based on 5 of 6632 reviews"`. **However, this warning does not appear to surface in the UI or affect scoring.**

---

## 3. RED FLAG DETECTION

### Where red flags are generated

**Primary path** — Claude AI synthesis (`synthesize-reviews.ts:120`):
- The prompt says: `"redFlags": ["Concerning patterns. Empty array if none."]`
- Claude analyzes the cached reviews and decides what's concerning.
- With 5 glowing 5-star reviews as input, Claude correctly returns `[]` — there are no concerning patterns *in the data it was given*.

**Keyword fallback** (only for plumbers with <3 reviews) — not triggered here.

**User report auto-flagging** (`refresh-reviews.ts:338-352`):
- 3+ negative user reports (bad-number or seems-closed) in 90 days → status = "flagged"
- Independent of review synthesis — driven by user reports.

### What Black Diamond's synthesis produced

```json
{
  "redFlags": [],
  "weaknesses": ["Not enough data to identify weaknesses"],
  "strengths": [
    "Consistent on-time arrival and fast service...",
    "Honest, transparent pricing with no surprises...",
    "Goes above and beyond the job description..."
  ]
}
```

### What got filtered before reaching UI

Nothing was filtered — there was nothing to filter. The synthesis produced zero red flags because it only saw 5-star reviews. The "1 concern" visible in the UI likely comes from the generic weakness: "Not enough data to identify weaknesses."

### Concern surfacing rules

There are no hard thresholds (e.g., "3+ mentions = flag"). Red flags are entirely Claude's judgment call based on the review text provided. The scoring penalty is -5 per red flag, max -20 (`scoring.ts:99-100`). With zero red flags, Black Diamond gets no penalty.

---

## 4. OUTSCRAPER COVERAGE

### Has Outscraper been run for this plumber?

**No.** Woodstock, IL has not been processed by the deep review pull workflow yet.

The `deep-review-pull.yml` workflow (7 AM Central daily) selects cities based on:
- GSC tier of "medium" or "high" (10+ impressions)
- Plumbers in that city lacking fresh Outscraper data
- Cap: 3 cities per workflow run

Woodstock hasn't hit the priority threshold yet.

### Outscraper caps

`outscraper-reviews.js` (line 33): `MAX_REVIEWS_PER_SOURCE = 100`

Even when Outscraper runs, it pulls **max 100 Google reviews + 100 Yelp reviews + 100 Angi reviews** per plumber. For a business with 6,632 Google reviews, that's still only 1.5% coverage from Google alone.

### Current review sources

| Source | Reviews cached | Reviews available |
|--------|---------------|-------------------|
| Google Places API | 5 (rotating sample) | 6,632 |
| Outscraper (Google) | 0 (not yet run) | up to 100 |
| Outscraper (Yelp) | 0 (not yet run) | unknown |
| Outscraper (Angi) | 0 (not yet run) | unknown |

---

## 5. DIAGNOSIS SUMMARY

### The problem is not the synthesis logic — it's the input data

The entire pipeline is working as designed. Claude correctly identifies no red flags because it was only given 5-star reviews. The scoring formula correctly gives a high score. The sample size warning triggers correctly. The issue is:

1. **Google Places API returns ~5 reviews per call**, biased toward recent positives. For a business with 6,632 reviews, this is a 99.92% blind spot.
2. **Outscraper hasn't run for Woodstock, IL** — so we don't have the deep pull of 100 reviews that would include negative ones.
3. **Even Outscraper caps at 100 reviews per source** — for a 6,632-review business, that's still only ~1.5% of Google reviews.
4. **There is no star-rating stratification** in review selection. Neither the Places API (which we can't control) nor Outscraper (which we configure) ensures negative reviews are included.
5. **The `sampleSizeWarning` field exists in Firestore** but does not surface in the UI, so users see a confident "90 score / high trust" with no caveat.

### Impact

This is likely not unique to Black Diamond. Any plumber with:
- High Google review count (100+)
- Only 5 cached reviews from Places API
- No Outscraper deep pull yet

...will have the same problem: an incomplete and positively-skewed synthesis.

---

## 6. POTENTIAL FIXES (for discussion, not yet implemented)

### Immediate
1. **Run Outscraper for Woodstock, IL** manually: `node scripts/outscraper-reviews.js woodstock-il`
2. **Surface the `sampleSizeWarning` in the UI** — show "Based on 5 of 6,632 reviews" on the plumber card and detail page when this field exists.
3. **Suppress trust badges when sample < 5%** of total reviews — a "high trust" verdict from 5/6,632 reviews is misleading.

### Structural
4. **Increase Outscraper cap for high-review businesses.** Scale `MAX_REVIEWS_PER_SOURCE` based on `googleReviewCount` — e.g., min(500, googleReviewCount * 0.1) for businesses with 1000+ reviews.
5. **Add star-rating stratification to Outscraper requests.** Outscraper supports `sort=lowest_rating` — pull 50 lowest-rated + 50 most recent instead of 100 most recent.
6. **Add a data confidence score** that factors in `cachedReviews / googleReviewCount` ratio. Flag synthesis as "low confidence" below a threshold (e.g., 10% coverage).
7. **Prioritize Outscraper deep pulls for high-review businesses** regardless of city GSC tier — a 6,632-review business with only 5 cached reviews should be flagged for immediate deep pull.
