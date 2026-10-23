# National utility plan

Date: 2026-10-23
Status: Execution started on codex/national-utility-plan.

## Direction

Build a national plumbing decision service: location + problem + urgency → a useful shortlist, supporting evidence, and questions to ask before hiring. Preserve national coverage; small test cohorts validate changes before national rollout, not a geographically limited business.

This plan supersedes the April STRATEGY-BRIEF for product priorities. The July rebuild specification remains the architectural baseline. Follow existing Firestore single-source and JSON single-writer contracts.

## Milestone 1: Evidence accuracy (in progress)

- [x] Identify export selection bias: up to 15 excerpts chosen by rating, date, and length; charts previously called this the analysis sample.
- [x] Label charts as selected excerpts and explain selection limits on cards, profiles, and methodology.
- [x] Compute newest available evidence date from both exported reviews and evidence quotes, ignoring invalid dates.
- [x] Separate multi-source analysis count from Google total in card provenance.
- [x] Clarify that no critical excerpt does not establish absence of complaints.
- [ ] Export actual analysis-population statistics and source breakdown only when scoring input identity is traceable. Never infer a full histogram from selected excerpts.
- [ ] Add source URLs when present in intake data; never fabricate review links.
- [ ] Reconcile city introduction totals with ranked-list totals using explicit scope labels.
- [ ] Add publication validation for internal analysis fields, unsupported claims, and conflicting dates.

Acceptance: every displayed count states its population; chart limitations are explicit; available newer evidence is reflected in freshness labels. Regression tests cover different analysis/excerpt counts and invalid/mixed evidence dates.

## Milestone 2: Transparent recommendation confidence

Introduce a shared confidence calculation based on analyzed coverage, evidence attribution, and freshness. Distinguish limited evidence from negative evidence. Apply it consistently to cards and profiles before changing ranking or paid eligibility. Review example businesses across high/low coverage and positive/negative assessments. Do not treat a larger sample alone as proof of quality.

Acceptance: visitors can see why an assessment is limited; sparse data cannot silently look as confident as deep evidence.

## Milestone 3: National problem-based matching

Extend existing market search with problem and urgency choices. Use existing service-category evidence to filter and explain matches within the current market dataset. Show missing evidence and require service-area confirmation; distance alone does not establish coverage. Keep filters client-side with no new indexable URL permutations. Read the SEO doctrine before changes to page types, metadata or routing.

Acceptance: users can find relevant businesses for their problem, see why each matches, and recover from no-match states. No invented availability, prices, license status or response-time guarantees.

## Milestone 4: Compare and prepare to call

Allow comparison of up to three businesses with service evidence, freshness, confidence, pricing concerns and published after-hours claims. Add a job-specific call checklist and optional local notes. Reuse existing styling and direct-call model. Instrument calls and website clicks consistently on all public surfaces; clicks are intent, not completed calls or appointments.

Acceptance: mobile users can compare, prepare questions and call without supplying personal details.

## Milestone 5: Learn from actual outcomes

Offer optional post-call reports: answered, serves address, could schedule. Moderate and label user reports; keep reports distinct from verified facts. Add dated business confirmations and owner corrections. Prioritize enrichment nationally using demand plus evidence gaps, not location favoritism.

Acceptance: useful outcome feedback can be collected without silently converting anecdotes into authoritative claims.

## Search diagnosis and measurement (parallel investigation)

Inspect existing read-only Search Console access and reporting before requesting exports. Compare daily pages/queries before and after the actual decline; separate ranking, impression, CTR, indexation and migration changes. Check whether scheduled workflows are active and succeeding; workflow files alone do not prove operation. Do not run email-report scripts, paid scraping, data mutations, or publishing scripts as diagnostics.

Measure relevant shortlist use, comparison engagement, call/website intent, reported successful contact and scheduling. Establish denominators and a baseline before setting numerical targets. Monitor search alongside product outcomes, not as the sole success criterion.

## Delivery

Implement and validate milestones in reviewable batches. No production deployment has occurred. For each batch record changed behavior, checks, unresolved limitations and next work. Avoid bulk URL deletion or geographic contraction as an automatic recovery tactic.

## Execution log — 2026-10-23

First batch implemented: selected-excerpt chart disclosures, matching homepage and methodology copy, available-evidence freshness, critical-excerpt absence wording, and separate analysis/Google totals. No export, Firestore mutation, commit, push, or deployment performed.

Validation: four regression tests passed (including server-rendered chart copy); changed-file ESLint and git diff whitespace checks passed. App-wide TypeScript check is blocked by an existing incompatible Plumber conversion in src/lib/plumber-data.ts:269 (that file is unchanged). Full build and browser QA remain unverified.

Next batch: reconcile city list scopes and introduce evidence-confidence presentation; inspect read-only Search Console access for decline diagnosis. Full-population export statistics require tracing scoring input identity first.

### Search diagnosis completed — October 23

Historical www property access works. June 26 is the initial collapse; 7-day impressions fell from 31,551 to 402 (98.7%), coinciding with Google's June spam update. June 25 canonical/slug changes are a confounder. Current manual-action/security reports are clear; three inspected current URLs are indexed. All eight workflows are manually disabled; last scrape publishing failure exceeded GitHub's 100 MB JSON limit. See ../audits/2026-10-23-search-decline.md and its saved evidence. Pipeline artifact repair is now a prerequisite to resuming automatic refresh. No workflows re-enabled.

### Curation redesign — October 23

User clarified the purpose: promote MPT-type fair-dealing and reliable companies nationally, avoid optimizing for review volume or ad budgets. Current direction is now detailed in CURATED-RECOMMENDATIONS-AND-GROWTH.md. Implemented homepage redesign and job/urgency/location → curated shortlist → comparison and call-preparation flow on existing market routes. Includes a conservative fair-dealing eligibility bar and explicit empty states. No unsupported competitor allegations published. MPT missing-evidence/avoid-verdict regression covered.
