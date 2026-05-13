# Phase 1 Directory-Core Extraction

**Status:** complete for the existing plumbing app/pipeline foundation  
**Goal:** make the existing plumbing directory config-backed without changing live behavior.

## Guardrails

- Do not change Firestore collection names.
- Do not change public URLs.
- Do not change GitHub Actions cron behavior.
- Do not change scoring, ranking, or review synthesis prompts.
- Do not introduce the carpet-cleaning app in Phase 1.
- Keep `fastplumbernearme.com` building and publishing exactly as it does now.

## Extracted So Far

- `packages/directory-core`
  - generic page config types
  - generic business/review/synthesis/lead types
  - vertical config contract
  - route builder helpers
- `apps/plumbers-web/src/config/plumbing-directory.ts`
  - existing plumbing domain, collection names, routes, and primary search query as explicit config
- `apps/plumbers-web/src/config/plumbing-routes.ts`
  - plumbing-specific URL helpers backed by the shared route builders
- `apps/plumbers-web/src/config/plumbing-collections.ts`
  - existing app collection names exposed as config-backed constants
- `apps/plumbers-web/scripts/config/plumbing-directory.cjs`
  - CommonJS bridge exposing the same domain, route, and collection defaults to Node/TS pipeline scripts

## Wired So Far

- `services-config.ts` now uses shared page config types while keeping all plumbing page values local.
- `sitemap.ts`, `robots.ts`, and root metadata now read the plumbing domain/routes through config-backed helpers.
- Admin dashboard/activity counts now read collection names through config-backed constants.
- API origin checks now read the allowed site origin through config-backed helpers.
- App JSON-LD absolute URLs now read through config-backed route helpers.
- App Firestore helpers now read/write the current collections through config-backed constants.
- Major pipeline scripts now use config-backed collection/domain/route constants while preserving current defaults.

## Still Plumbing-Specific

- Firestore data shape (`Plumber`, `plumberId`, plumbing-specific fields)
- Sonnet synthesis prompt and scoring pipeline
- `Plumber` app type and UI component names
- GitHub Actions workflows
- Brand copy, emails, legal pages, and user-facing plumbing terminology

## Intentionally Not Changed

- Existing collection names remain `plumbers`, `reviews`, `leads`, and `cities`.
- Existing public routes remain `/emergency-plumbers/...`, `/[service]/...`, and `/plumber/...`.
- Existing GitHub Actions still pass the same `GSC_SITE_URL` values.
- Existing scoring/review synthesis prompt semantics are unchanged; only collection constants were introduced.

## Next Safe Slices

1. Decide the carpet-cleaning URL and domain strategy.
2. Add a carpet-cleaning vertical config without wiring it into cron.
3. Extract/refine `Business` types only where the carpet app needs them.
4. Scaffold the carpet app after URL/content strategy is settled.
