# Search decline diagnosis

Investigated October 23, 2026. Read-only Search Console API, Search Console UI, Git history and GitHub Actions. No data pipelines, paid API jobs, email reports or deployments triggered.

## Findings

Existing service-account access works for the historical URL-prefix property https://www.fastplumbernearme.com/. The newly verified domain property is still processing; no need to wait for it to begin diagnosis.

Daily finalized web-search data shows an abrupt collapse on June 26:

| Window | Impressions | Clicks |
| --- | ---: | ---: |
| June 19–25 (7 days) | 31,551 | 9 |
| June 27–July 3 (7 days) | 402 | 1 |

Impressions declined 98.7%. June 25 alone had 4,899 impressions; June 26 had 228. Page-dimensional results returned 2,872 URLs with impressions before, versus 275 after. These are returned performance rows, not indexed-page totals. Query results omit anonymized queries and should not be summed to infer property totals. Even before the collapse, visibility produced very few clicks; product usefulness and conversion need attention alongside recovery.

Google's official June spam-update incident began June 24 and ended June 26: https://status.search.google.com/incidents/YUX1peHev5a4fkxLDiUQ . Timing strongly supports an update-associated decline but does not establish site-specific causation.

Confounder: June 25 commit d28c9d2 added self canonicals and switched emitted origins to www; commit 3d673f7 changed business-profile slugs. Historical deployment timing and host-wide data need review before attributing everything to the update. The July market rebuild followed the initial collapse and cannot explain its start.

October 1–20: 371 impressions and 3 clicks in daily property totals. Low visibility persists.

## Current checks

Search Console UI, domain property: Manual actions = No issues detected; Security issues = No issues detected. This establishes current status, not absence of any past action.

URL Inspection API (indexed snapshot, not live test):

- Homepage: submitted and indexed, fetch successful, allowed, canonical matches; last crawled October 15.
- /plumbers/ma/worcester: submitted and indexed, fetch successful, allowed, canonical matches; last crawled October 10.
- /plumbers/il/evanston: submitted and indexed, fetch successful, allowed, canonical matches; last crawled September 10.
- Legacy /emergency-plumbers/massachusetts/worcester: crawled, currently not indexed; snapshot last crawled June 26, before July redirects. Do not use this old inspection snapshot as evidence of current redirect failure.

Three current indexed examples do not establish site-wide index health. The domain property's aggregate index report is still processing.

## Pipeline status

GitHub API reports all eight workflows disabled_manually. Latest runs returned are August 10. Do not automatically re-enable: these jobs can incur cost, send email and publish data.

Last failed Daily Plumber Scrape, August 9, run 31310880876: push rejected by GitHub GH001 because apps/plumbers-web/data/synthesized/plumbers-synthesized.json grew to 102.69 MB, exceeding the 100 MB file limit. This is a concrete publishing failure, separate from the earlier June decline. Local checkout data is not assumed to match live Firestore.

## Execution order

1. Finish evidence accuracy and confidence presentation; avoid expanding page inventory as a recovery tactic.
2. Repair export artifact growth before resuming refresh: design a compact build artifact, retain Firestore as source of truth and the existing exporter as sole writer, add size checks before paid ingestion, and verify on representative data. Do not delete review evidence to pass a size cap or enable paid pipelines without review.
3. Reconcile list/population scopes, remove internal analysis fields and validate supporting evidence before publication.
4. Ship national job/urgency matching and comparison using existing market coverage; explicitly state evidence limits and service-area uncertainty.
5. Review historical deployment and broader canonical/indexation data; collect a representative URL inspection cohort. Recheck aggregate indexing once domain property processing completes.
6. Measure suitable-call intent and reported successful contact alongside clicks and impressions. Do not promise ranking recovery.

## Evidence files

Data under data/2026-10-23/: daily property totals; equal-length before/after page and query rows; current URL Inspection snapshots. Read-only queries used webmasters.readonly. No credentials copied to these files. Preserve query data as internal project analytics.
