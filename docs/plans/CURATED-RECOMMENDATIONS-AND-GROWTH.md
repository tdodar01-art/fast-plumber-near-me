# Curated recommendations and growth

October 23, 2026. Current product direction; supersedes the previous growth-first ingestion strategy. National scope is fixed.

## Promise

Find a good plumber for the right reasons: fair dealing, reliable work, clear estimates, repair advice without pressure. User's first-hand positive experience with MPT Plumbing Inc is the reference for the desired business behavior, not a blanket endorsement of its every service. Do not publish allegations about named competitors from conversation alone. Company size, ownership model, ad spend and star average are not proxies for integrity.

## Implemented first pass

- New homepage: deep green, warm paper, citrus accent; problem/urgency/location finder; real data preview, methodology, national browse.
- Shared curated shortlist on existing national market pages. Up to 3 qualifying companies, clear reasons/reservations, job filters, published 24-hour filter, direct calls, comparison table, shareable fragment URL and job-specific call question.
- Eligibility: phone, 10+ analyzed reviews, 3+ attributed evidence quotes, at least one positive fair-dealing claim backed by two distinct resolvable quotes; no avoid verdict or unresolved red flags. Repeated cited sales-pressure concerns with two resolvable supporting quotes also exclude. Missing evidence is not a negative verdict.
- Ordering: fair-dealing claim count, model pricing-fairness, model reliability, job mentions, model score, stable name tie-break. No paid position.
- Directory is preserved behind an explicit expansion. It uses legacy assessment criteria, distinct from shortlist eligibility. Filters are fragments; no new indexable URL combinations.
- Initial local inventory: 108 of 693 markets had a qualifying general suggestion; the subsequent attribution, operational-status and freshness checks reduced this to 97; merging newer main data yields 99 qualifying markets. This is an evidence gap, not proof that other markets have no good plumbers. Empty states retain directory research access.
- Found MPT's old no-review avoid verdict. Suppress evidence-free profile verdicts/decision grids; do not manufacture a good verdict either. Prioritize source review and first-hand evidence collection next.

## What must become original

Review synthesis alone is not the moat. Build dated, traceable records of how businesses deal with customers:

1. Written diagnostic/dispatch fee and after-hours policy, attributed to the business with date and coverage.
2. Written estimate process, approval of changed scope, repair-versus-replace explanation and warranty handling.
3. First-hand job accounts: job type, date, quoted scope, actual bill, follow-through. Publish with consent, attribution and disclosure of relationship; redact private information.
4. Customer outcomes after calls: reached, serves address, can schedule, job completed. Report denominator, freshness and moderation status.
5. Independent license checks where authoritative records exist. State exactly what was checked and when; never infer insurance or integrity from a license.

Separate unknown, business-stated, independently checked and customer-reported facts. AI/model scores are triage, not proof of honesty. Current rule matching is provisional; human review and richer explicit signals are needed before broad promotional claims.

## Traffic strategy

### 1. Decision-intent search

Develop substantive recommendations on existing market pages, not another service-by-city expansion. Target searches such as plumber recommendations in a market, honest plumber reviews, repair-versus-replace advice, and specific service comparisons only when the page genuinely answers them. Each page needs the reason for recommending, tradeoffs, sources, date and local service evidence. Avoid unsupported 'best' claims, mass comparison pages, and unnecessary URL changes.

Google says useful review content includes original research, important decision factors and evidence behind recommendations: https://developers.google.com/search/docs/appearance/reviews-system and https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews . This supports the editorial direction; it does not promise recovery or inclusion in AI answers.

### 2. Referral distribution

Prepare a shareable shortlist/checklist for realtors, home inspectors, property managers, neighborhood publications and homeowner communities. Lead with utility for their audience. No unsolicited messaging has been sent. Test partner placements using distinct referral tags and measure engaged visits and successful contact, not just backlinks. Do not require dofollow badges, purchase favorable reviews, or disguise paid promotion as organic recommendation.

### 3. Customer sharing

The shortlist copy-link action retains location, job and urgency. Later, allow people to save a comparison privately and return to the same job. Encourage sharing useful job questions and documented service facts; do not collect contact details to unlock a business phone number.

### 4. Original editorial assets

Prioritize a small number of evidence-rich assets: dispatch-fee questions; interpreting a sewer camera diagnosis; water-heater estimate inclusions; a repair-versus-replacement decision checklist reviewed by a named qualified practitioner. Connect them to relevant guides. Add genuine anonymized quote comparisons once submissions exist; no invented local price averages.

### 5. Paid discovery only after conversion validation

No ad spend authorized or launched. Once the product leads to suitable calls, propose a limited test around recommendation/problem intent, with budget, market selection and stopping rules for review. Do not buy nationwide emergency-plumber traffic into sparse data.

## 30-day execution sequence

Week 1: preview and validate this redesign; fix the existing TypeScript mapping blocker; complete source/date consistency, evidence confidence, MPT research and actual-analysis statistics. Repair export artifact growth before re-enabling ingestion.

Week 2: build factual-confirmation and first-hand evidence intake with a moderation process. Prioritize missing trust evidence nationally, including recommended companies currently missing review analysis. Use GSC plus onsite demand and evidence gaps to allocate enrichment.

Week 3: prepare the first original editorial asset and partner landing material; instrument shortlist shown, no match, job selection, comparison, copy link, and direct-call intent without retaining precise addresses. Distinguish clicks from completed calls.

Week 4: review outcome signals by acquisition source and evidence coverage. Expand what helps people successfully reach suitable companies. Search visibility is a parallel measure; do not restart scaled content generation because a city gets impressions.

## Validation and limits

Review-based eligibility can produce false exclusions and false reassurance. Do not claim 'no bait and switch', verified availability, verified integrity or guaranteed outcomes. Existing raw data contains stale dates and potentially misassigned geographic records; prioritise provenance before scale. Full production build/deployment are separate from local preview. No paid API work, workflow activation or production publication in this batch.

## Implementation verification

Nine regression tests pass, including fair-dealing eligibility, explicit job/hour filters, pricing-before-model-score ordering, citation resolution, selected-excerpt presentation, dates, and MPT's evidence-free avoid regression. Changed TS/TSX files pass ESLint. Browser checks exercised homepage search → market, job switching, comparison, shareable hash initialization; mobile 390px viewport has no document overflow. Comparison table scrolls within its container. A stale development bundle caused a hydration mismatch during edits on port 3100; refreshed preview uses port 3101. Screenshots saved in docs/previews/.

The initial preview had a legacy Plumber conversion type error. The follow-up launch-readiness batch fixes the mapping, enables production type checking, and passes a 7,585-page production build against the latest 6,437-business dataset. Production smoke checks confirm key pages and legacy redirects; source data is unchanged by lossless compaction. Human editorial review and additional original evidence remain ongoing. No production deployment completed.

## Evidence collection workflow — October 23

Prepared `../editorial/EVIDENCE-WORKFLOW.md` and reusable customer-job and business-policy templates. They define attribution, consent, scope-matched estimate/bill comparison, source labels, moderation, privacy and corrections. MPT is the first pending case under the same national standard. This is an internal collection kit, not a live submission form or published endorsement; no external contact, Firestore writes or ranking changes performed.
