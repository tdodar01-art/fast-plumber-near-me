# 00-REBUILD-SPEC — fastplumbernearme.com Ground-Up Rebuild (Unified Build Spec)

**Date:** 2026-07-11 · **Status:** AUTHORITATIVE — supersedes conflicting statements in 01–05.
**Reading order:** this spec resolves conflicts; the five source docs remain the detail reference:
`01-seo-architecture.md` (taxonomy/schema/indexation) · `02-site-design.md` (visual system, home + city page) · `03-plumber-page-design.md` (profile) · `04-copy-rebuild.md` (voice + full copy) · `05-transition-plan.md` (redirects/launch).

**Repo:** `/Users/timothydodaro/code/directory-sites/fast-plumber-near-me` (pnpm monorepo; app = `apps/plumbers-web`, shared = `packages/directory-core`).

---

## 1. Conflicts found across the five docs — and resolutions

Precedence rule applied: **01 owns URL/indexation/schema · 02 owns city-page/visual system · 03 owns profile page · 04 owns copy · 05 owns redirects/launch.** Where two owners collide, the resolution below is final.

| # | Conflict | Docs | Resolution |
|---|---|---|---|
| C1 | **Review/AggregateRating structured data on profiles.** 03 §5 keeps `aggregateRating` from Google figures + an editorial `Review` with `positiveNotes/negativeNotes`. 01 §2.0 bans ALL `Review`/`AggregateRating`/`positiveNotes` markup site-wide (Google forbids marking up reviews aggregated from other sites; standing manual-action risk on a demoted site). | 01 vs 03 | **01 wins. Zero review markup anywhere** until first-party reviews exist (then profile-only). Visible HTML shows ratings/distributions/quotes freely; JSON-LD stays clean. 03's schema section is overridden. |
| C2 | **0–100 score display.** 02 §3.2 bans dimension-score bars on city cards ("model outputs we can't defend as displayed metrics"); 03 §3.2 shows "FPN Review Score {overall}/100" + five dimension bars on profiles; 04 writes a score tooltip and a methodology "What our score means" section. | 02 vs 03 vs 04 | **Split by surface:** city-page cards show NO numeric score (tiers + rank numerals only, per 02). Profile verdict banner shows the 0–100 + dimension bars WITH the mandatory disclosure line (per 03). 04's score tooltip applies on the profile score only, not on cards. Methodology's score section stays (it documents the profile display and the ranking input). Note: `scores.overall` is null in most records — must be computed+persisted at export before profile launch (03 §8). |
| C3 | **Non-market ("thin") city pages.** 02 §3.6 designs rendered-but-noindex thin-city and zero-plumber shells; 04 §6 writes thin-market copy. 01 §3.1/3.3 + 05 say non-kept cities get NO page at all (301 within 12mi, else 410); zero-listing renders "impossible by construction." | 01/05 vs 02/04 | **01/05 win: non-kept cities have no URL.** 02/04's thin-state design is retained for exactly one case: a *kept market* that falls below threshold after a data refresh (hysteresis state, 01 §3.1) — it stays live, renders the honest thin-state, flips `noindex,follow`. It is never a launch-time page class. |
| C4 | **Trust-page inventory.** 01 §1.2/§5.2 specifies three pages: `/methodology`, `/editorial-policy`, `/advertising-disclosure`. 04 writes ONE `/methodology` page that already contains the editorial policy (corrections/disputes, `#corrections`) and the sponsorship rules (`#sponsored`). 02's footer references a "How we make money" page. | 01 vs 04 vs 02 | **04 wins for launch: single `/methodology` page with anchors** `#what-we-do-not-do`, `#score`, `#sponsored`, `#corrections`. All sponsored labels link `/methodology#sponsored`; concerns headers link `/methodology`; footer "How we make money" points at `/methodology#sponsored`. `/editorial-policy` and `/advertising-disclosure` are NOT created at launch (fewer, denser trust pages; no near-duplicate policy stubs on a recovering site). If counsel later requires a standalone ad-disclosure URL, add it and swap the anchor links — additive change. |
| C5 | **Plumber-profile indexation gate.** 01 §1.1 D3: synthesis + **≥3 evidence quotes** (~5,700). 03 §4: Tier A = synthesis + ≥1 quote + ≥1 cited claim (~5,700), and Tier B (synthesis, zero quotes, ~400) *may index* if ≥3 strengths/concerns. | 01 vs 03 | **01's stricter gate wins:** indexable = active + synthesis + ≥3 attributed evidence quotes. 03's Tier B always renders `noindex,follow` until the pipeline backfills quotes (its "yes if…" clause is void). Tier C stays noindex. Single predicate `isIndexablePlumber()` in `packages/directory-core`, shared by metadata + sitemap. |
| C6 | **Suburb redirect target for emergency URLs.** 01 §1.4: suburb `/emergency-plumbers/{state}/{city}` → market page. 05 §3: → market **emergency** page when one exists (intent-preserving). | 01 vs 05 | **05 wins** (owner of redirects): emergency-intent legacy URLs 301 to the market's `/emergency` page when it exists, else the market page. Service-intent legacy URLs always 301 to the market page (never `/emergency`, never `/guides/*`). |
| C7 | **Homepage H1 + hero copy.** 02 §2.1: "Find a plumber who'll actually show up." 04 §2: "A burst pipe doesn't leave time to read 200 reviews. We already did." | 02 vs 04 | **04 wins (copy owner).** 02's layout stands (search-first hero, proof strip, real-card demo); 04 supplies all strings. Proof strip uses 04's wording, with 02's "Rankings are never for sale" moved to the subhead (drop the cutesy "0 rankings sold" stat — the third stat is "Reviews read from Google, Yelp & BBB"). |
| C8 | **Market-page H1/title.** 01 title: "{N} Best Plumbers in {City}, {ST} — Ranked by Real Reviews". 02 H1: "The 14 emergency plumbers serving Elgin, ranked." 04's dense example headlines a market page "Emergency plumbers in Nashville…". | 01 vs 02 vs 04 | Market pages are NOT emergency-framed (emergency is the sub-page, 01 D2). **H1: "The {N} plumbers serving {City}, ranked."** (02's pattern, minus "emergency"). Emergency sub-page H1: "The {M} 24/7 plumbers serving {City}" style. Title tags follow 01's formulas. 04's city-intro *framework* (data slots, tier skeletons, mandatory caution) stands; its example headlines are re-generated to match. |
| C9 | **Profile title tag.** 01: `{Business} — {City}, {ST} Plumber Review: Strengths & Complaints`. 03: `{Name} Reviews — Our Take on {googleReviewCount} Reviews | {City}, {ST}`. | 01 vs 03 | **03 wins** (profile owner; the review-count is differentiated and honest), with 03's own ≤60-char fallback `{Name} Reviews | {City}, {ST}`. |
| C10 | **Rating-distribution caption.** 04 §5: "All [N] ratings, not just the average." 02 zone D / 03 §3.5: distribution is of the **analyzed set only**, explicitly "not all {googleReviewCount} Google reviews" (we don't have Google's histogram). | 04 vs 02/03 | **02/03 win — analyzed-set framing everywhere:** "Rating mix — of the {N} reviews we analyzed." 04's caption is amended; claiming the full histogram would be fabrication. Label upgrades if/when Outscraper supplies true histograms (03 §8). |
| C11 | **Plumber-facing path.** 02 links `/for-plumbers` (+ 03's dispute form at `/for-plumbers/dispute`). 01/04/05 keep `/add-your-business` unchanged. | 02/03 vs 01/04/05 | **Keep `/add-your-business`** (existing indexed path; 04's full copy is written for it). Header link text "For plumbers" → `/add-your-business`. Dispute form lives at `/add-your-business/dispute?biz={slug}`. No `/for-plumbers` URL is created. |
| C12 | **Blog page count.** 01 §1.3 budgets "~25 pruned posts"; 05 §1.1 verified only **9 hand-written posts** exist in `blog-data.ts` (AI city-cluster posts get 410). | 01 vs 05 | **05's repo-verified count wins: 9 posts + /blog index.** Indexable total adjusted (see §2). Unknown/generated blog slugs → 410 via middleware allowlist branch. |
| C13 | **Service chips linking to "service pages."** 03 §3.8 links services to "service pages where those exist in the new IA" — no such pages exist (01 D2 killed them). | 03 vs 01 | Service chips render as plain text (or anchor to the market page's service section). Only guide links (`/guides/*`, Phase 2) may be used where topically exact. |
| C14 | **Test fixtures assume Palatine is a kept market.** 05 §6.3 curl suite expects `/emergency-plumbers/illinois/palatine → /plumbers/il/palatine/emergency`, but 01 §0 shows Palatine is inside the Chicago-suburb cluster where the highest-count city wins (Elk Grove Village 246 > Villa Park 234 > Palatine 214) — Palatine likely classifies *suburb*, not market. | 05 vs 01 | Curl-suite fixtures are **generated from the actual `redirect-map.json`** at build time (pick one real example per rule class), not hand-written. 05's examples are illustrative only. |
| C15 | **"Verify/verified" vocabulary.** 04 bans the word site-wide (except the methodology sentence saying we do NOT verify); 02's old-component list and 03 §3.8 use phrases like "per their Google listing" — fine — but any residual "Verified" badge strings must die. | 04 governs | 04's banned-vocabulary appendix is a **CI grep gate** (see §5). The only permitted occurrence: `/methodology` "What we do NOT do" section. |
| C16 | **Market indexation vs rankable count.** 01 gates markets on ≥10 plumbers & ≥5 withQuotes; 02's card contract requires `review_count_used ≥ 10` + synthesis to *rank* a card — so a kept market could render <10 *ranked* cards (rest unranked rows). | 01 vs 02 | Gate refined: kept market requires **≥10 listed plumbers AND ≥5 quote-backed rankable cards** (rankable per 02 §6 data contract). Encoded in `isIndexableMarket()`; the clustering script counts rankable, not merely present, plumbers. Expect the 1,643 figure to move slightly (±) when computed — the computed number is canonical. |

---

## 2. Authoritative URL taxonomy

Final indexable-page count: **~8,300 at launch** (≈8,315 steady-state once Phase-2 guides ship). Down from 38,488 sitemap URLs / ~44,700 crawled (−78%).

| URL pattern | Template / renderer | Indexable count | JSON-LD (nothing else) | Copy source |
|---|---|---|---|---|
| `/` | Home (02 §2 layout) | 1 | `Organization` + `WebSite`+`SearchAction` | 04 §2 verbatim (per C7) |
| `/plumbers` | National index (browse states) | 1 | `CollectionPage` + `BreadcrumbList` | 04 voice rules |
| `/plumbers/{st}` | State hub, markets grouped by metro | 32 | `BreadcrumbList` + `CollectionPage`/`ItemList` (URL-only items) | data-driven; counts shown per market |
| `/plumbers/{st}/{city}` | **Market page** (02 §3; the money page) | **~1,643** (computed; C16) | `BreadcrumbList` + `ItemList` of `Plumber` summary entities (01 §2.1 field map). **No FAQPage, no Review/AggregateRating** | 04 §4 city-intro framework (slots S1–S10, 3 tier skeletons, mandatory caution) + synthesis/quotes from data |
| `/plumbers/{st}/{city}/emergency` | Emergency market page (≥12 24h-with-synthesis) | **~905** (computed) | Same as market, ItemList filtered `is24Hour` | Same framework, emergency lead; 04 §5 24-hour honesty pair |
| `/plumber/{slug}` | Profile dossier (03) | **~5,700** (gate per C5; Tier B/C render noindex) | `BreadcrumbList` + full `Plumber` entity — **no aggregateRating/Review** (C1) | 03 structure; 04 §5 microcopy; synthesis fields verbatim from pipeline |
| `/guides/{slug}` | National editorial guides — **Phase 2, post-launch** | ~15 (not at launch) | `Article` (+ hand-written `FAQPage` allowed here only) | hand-written, data-informed |
| `/blog`, `/blog/{slug}` | 9 hand-written posts + index (C12) | 10 | `Article` + `BreadcrumbList` | existing, pruned |
| `/methodology` | Single trust page w/ anchors (C4) | 1 | `WebPage` + `BreadcrumbList` | 04 §3 FULL copy, verbatim |
| `/about` | About | 1 | `WebPage` (+ `Person` if Tim approves — §6 D1) | 04 §6 full copy |
| `/add-your-business` (+`/dispute` form, noindex) | Plumber-facing (C11) | 1 | `WebPage` | 04 §6 full copy |
| `/contact`, `/privacy-policy`, `/terms` | Static | 3 | `WebPage` | privacy per 04 §7 red-lines R1–R5 |
| `/sitemap.xml` → `/sitemaps/{static,markets,emergency,plumbers-N}.xml` | Segmented index, real lastmod | n/a | — | — |
| **Total at launch** | | **≈8,298** | | |

Legacy space: 100% mapped by 05's disposition matrix (R1–R20) — ~1,100 city 301s + suburb 301s (5,493 cities), ~2,572 gone cities + unknown tail → **410**, `/how-we-verify` → 301 `/methodology`, `/plumber/{slug}` untouched. Never expire 301s; single-hop guarantee per 05 §4.2.

Hard rules carried forward: query strings never index; filters are client-side/fragments only; max 15 ranked listings, no pagination; canonicals are self-only; robots.txt stays minimal; AI crawlers not blocked.

---

## 3. Implementation plan — ordered epics with file-level pointers

All paths relative to `apps/plumbers-web/` unless noted.

### EPIC 0 — DAY-1 HOTFIX: truthfulness purge on the LIVE site (do not wait for the rebuild)
The false AI-call-verification claims are live FTC exposure and anti-recovery signal today. Ship as an immediate patch to current templates:
- `src/app/page.tsx` — lines ~41 (meta), 55–59 (hero), 122, 132 (steps), 145/153 (badges), 166, 201–213 (why-us): replace with 04 §0/§2 replacement lines.
- `src/app/how-we-verify/page.tsx` — replace content with an interim honest methodology stub (full `/methodology` comes in Epic 4; add the 301 then).
- `src/app/about/page.tsx` — lines ~9, 41–45, 53 per 04 §0.
- `src/app/privacy-policy/page.tsx` — red-lines R1–R5 (04 §7): delete §3 "AI Verification Calls" wholesale; bump Last-updated.
- Stop rendering: `src/components/VerifiedBadge.tsx`, `ReliabilityBadge.tsx`, any `verificationStatus`/`answerRate` display (`grep -r "answerRate\|verificationStatus\|AI-Verified\|Licensed & Insured" src/`).
- Add the CI grep gate now (§5, gate 1).

### EPIC 1 — Data & export layer (build-time truth)
- `scripts/generate-markets.js` (NEW): 8-mile greedy clustering over `data/city-coverage-20mi` equivalents → emits `data/synthesized/markets.json` `{slug, st, name, lat, lng, clusterCities[], plumberIds[], counts{plumbers, rankable, withQuotes, emergency}, lastmod}` per 01 §6.8 + C16.
- `scripts/generate-redirects.js` (NEW; code drafted in 05 §4.1): → `src/lib/generated/redirect-map.json` (~9,708 keys, committed, append-only) + `market-states.json`.
- `scripts/export-firestore-to-json.js` (EXISTING, single-writer invariant): persist `lastmod` maxima, computed `scores.overall` (C2), normalized review timestamps (03 §8), city aggregate slots S1–S10 (04 §4).
- `packages/directory-core` (EXISTING pkg): add `isIndexableMarket()`, `isIndexablePlumber()` — the ONLY definition sites; imported by metadata, sitemap, and tests. Hysteresis state (2 consecutive weekly snapshots) persisted per 01 §3.1.
- Disable `scripts/request-indexing.js` step in the daily workflow (05 §5 T-7 item; never ping legacy URLs).

### EPIC 2 — Routing & redirect infrastructure
- `src/middleware.ts` (NEW — none exists): full implementation in 05 §4.2 (state-name→abbr map, 27-slug closed set, junk-param strip, single-hop lowercase+resolve, 410 via `new NextResponse(null,{status:410})`, blog-slug allowlist branch).
- `next.config.ts`: add `redirects()` (2 static rules, 05 §4.3); verify `trailingSlash:false`.
- Vercel dashboard: apex→www 307 → 308.
- **DELETE route trees:** `src/app/[service]/` (entire doorway set), `src/app/emergency-plumbers/`, `src/app/how-we-verify/`.
- **CREATE routes:** `src/app/plumbers/[st]/page.tsx` (state hub), `src/app/plumbers/[st]/[city]/page.tsx` (market), `src/app/plumbers/[st]/[city]/emergency/page.tsx`, `src/app/methodology/page.tsx`. All static via `generateStaticParams` from committed JSON — zero runtime Firestore on the crawl path.
- Delete from rendering path: `src/lib/cities-generated.ts` boilerplate, `src/lib/services-config.ts` `faqTemplates`/`heroHook`/`emergencyTypes` rendering (config may remain for the middleware slug set only).

### EPIC 3 — Component system (02 §5 + 03 §7)
- **DELETE:** `src/components/VerdictSeal.tsx`, `VerifiedBadge.tsx`, `ReliabilityBadge.tsx`, `SignalRow.tsx`, `SignalChip.tsx`, `DimensionBars.tsx` (public), `PlatformAgreementStrip.tsx`, `StrengthsVsConcerns.tsx`, `src/components/profile/TrustScoreRing.tsx`, `DecisionPanel.tsx`, PODIUM_ICONS/pulse-animation styles.
- **CREATE (city):** `ReportHeader`, `TriageStrip`, `SponsoredSlot`, `RankTier`, `PlumberReportCard` (zones A–H, 02 §3.2), `RatingMix`, `EvidenceList`, `QuotePair`, `UnrankedRow`, `StickyCallBar`.
- **CREATE (profile):** `ProfileHeader`, `RatingStrip`, `VerdictBanner`, `ScoreBars`, `ClaimWithEvidence`, `QuoteCard` (the single quote renderer), `RatingPicture`, `DecisionGrid`, `FactsPanel`, `ServiceAreaMini`, `OwnerPanel`, `CompareStrip`, `MethodologyFooter`.
- Design tokens per 02 §1 (light-only v1, no webfonts, borders-first). `PlumberCard.tsx` and `src/components/profile/*` legacy files retired as their replacements land.
- Rewrite `src/app/plumber/[slug]/page.tsx`: kill page-side keyword re-derivation (`filterByKeywords`, badge substring matches, upsell scanning — 03 §1 kill list); render pipeline output only.

### EPIC 4 — Copy & trust surface
- `/methodology`: 04 §3 copy verbatim; anchors `#what-we-do-not-do`, `#score`, `#sponsored`, `#corrections`; 301 from `/how-we-verify`.
- Home, `/about`, `/add-your-business` (+dispute form route), 404 page: 04 §2/§6 copy.
- City-intro composer (NEW `src/lib/city-intro.ts` or in directory-core): slots S1–S10, three tier skeletons, lead-fact rule, mandatory caution sentence, per-city stable seed (04 §4 rules 1–7).
- Microcopy pass per 04 §5 (section labels, quote attribution format, sponsored disclosure, call-button subtext, 24-hour honesty pair).
- Sponsored slot: keep `SPONSORED_QUALITY_THRESHOLD=65` gating + `rel="sponsored"` (existing behavior), new slate visual treatment + on-card disclosure copy (02 §3.3, 04 §5).

### EPIC 5 — SEO surface & sitemaps
- `src/app/sitemap.ts` → sitemap **index** + `src/app/sitemaps/*` segment routes; real lastmod from export (kill `new Date()`); only `isIndexable*()`-true URLs.
- JSON-LD components per §2 table; CI schema fixtures per template (01 §2.2); grep-gate: no `AggregateRating|"Review"|FAQPage` outside guides.
- Metadata formulas per C8/C9; OG images via existing `src/app/api/og` per template.
- Internal linking per 01 §4: nearby-markets (real distances, kept markets only), areas-served plain text, profile→market authority pumping, breadcrumbs everywhere; footer top-10 states only.

### EPIC 6 — Launch (05 §5 sequencing, atomic single deploy)
- T-7: freeze pipeline sitemap steps; export GSC top-500 equity CSV → `data/launch/legacy-equity-urls.csv`; preview deploy; run generated curl suite (C14) + 20-per-pattern unit tests.
- T-0: one deploy (new routes + middleware + deleted legacy dirs + sitemaps); flip apex 308; smoke-verify; GSC annotate + submit + URL-inspect 20/template.
- T+1..7: triage middleware GONE-log; watch crawl stats. Rollback = Vercel Instant Rollback, availability-only triggers (05 §5).

### EPIC 7 — Post-launch (Phase 2)
- ~15 `/guides/{slug}` editorial assets (01 D2) — only after index stabilizes.
- Owner-response data model + moderation (`ownerResponses` subcollection, 03 §8).
- Outscraper true rating histograms on deep-pull cities → upgrade RatingMix labels (C10).
- Evidence-quote depth: 1 verbatim quote per weakness/redFlag in pipeline (03 §8).
- First-party review collection → only then revisit Review/AggregateRating markup (profile-only, C1).
- Quarterly: re-run coverage export → threshold sweep → human-reviewed market-list diff (growth is earned).

---

## 4. Launch-gate checklist (merged 01 §6 + 05 §6, deduped)

**A. Truthfulness (blocking, also Epic 0)**
- [ ] Repo-wide grep gate green: `verif|reliability score|AI call|answer rate|we call|Licensed & Insured|pre-screened` → zero hits in rendered copy/metadata/OG/JSON-LD (only permitted: methodology "we do NOT" sentence).
- [ ] `verificationStatus`/`answerRate`/`totalCallAttempts` render nowhere; no badge implies testing/verification.
- [ ] Privacy policy R1–R5 applied; Last-updated bumped; `/terms` grepped for "verification".

**B. Data & redirects**
- [ ] `markets.json` computed; counts sane (markets ≈1,600s; emergency ≈900s; median rankable ≥15); human spot-review of cluster winners (Chicago suburbs collapse correctly).
- [ ] `redirect-map.json` ≈9,708 keys; `g` ≈2,572; 10 known suburbs map to expected markets.
- [ ] Unit tests: 20 sample URLs per legacy pattern → expected 301 target or 410; edge cases (cross-state suburb, market w/o emergency, unknown city, uppercase, junk params, `/emergency-plumbers/illinois/`).
- [ ] Preview curl suite (generated from real map, C14) green incl. single-hop assertion (`--max-redirs 2` lands 200) and no 301→3xx chains.
- [ ] GSC legacy-equity CSV exported/archived; every priority-1 URL asserts 301→200 or documented 410.
- [ ] `request-indexing.js` disabled; apex 307→308 flipped at T-0.

**C. Indexation & sitemaps**
- [ ] `isIndexableMarket()`/`isIndexablePlumber()` single definition site (CI grep); metadata.robots + sitemap both import it.
- [ ] Sitemaps: index + 4+ segments, <50k/file, XML-valid, ONLY index-eligible URLs, real lastmod (no `new Date()`), no changefreq/priority.
- [ ] Every page: one absolute self-canonical on www; no indexable query-string states; trailing-slash/lowercase/junk-param normalization verified.
- [ ] 410 (not 404) for removed doorway URLs and >90-day-closed profiles; helpful 404 page; no soft-404 shells renderable.

**D. Content integrity (per-template information-gain minimums, 01 §5.1)**
- [ ] Market page cannot render `index` without: ≥10 listed, ≥5 quote-backed ranked cards, editorial verdict block, "what reviewers complain about" section, rating-mix per expanded card, per-market computed aggregates, freshness stamp, zero token-swap prose.
- [ ] Profile: synthesis strengths AND concerns, ≥3 attributed quotes, rating mix, sample-size warning, review-source breakdown; every synthesized claim chains to `supporting_review_ids` (claims with zero resolvable quotes drop in prod).
- [ ] Every quote verbatim + attributed (author, source, date, star given); rating distribution shown wherever an average shows; analyzed-set framing on all distributions (C10).
- [ ] Sponsored slot: visible label, on-card disclosure, `rel="sponsored"`, quality-gated, never re-orders organic, absent when unsold.
- [ ] City intros: ≥4 data slots, tier-distinct skeletons, mandatory caution sentence, S10 standout fact, no weather/county filler.

**E. Schema & metadata**
- [ ] CI JSON-LD fixtures validate per template; build fails on ERROR.
- [ ] Grep-gate: no `AggregateRating`/`Review`/`FAQPage` in market/profile output (guides excepted later).
- [ ] Titles/descriptions per C8/C9 formulas, measured ≤60/≤155; H1s carry real counts; favicon/icon-192/512 shipped.

**F. Performance**
- [ ] LCP ≤1.8s p75 mobile (text LCP, no webfonts, no above-fold images); INP ≤150ms; CLS ≤0.05; JS ≤130KB gz/template; PageSpeed CI on 4 core templates.
- [ ] All indexable pages statically generated; zero runtime Firestore on crawl path.

**G. Post-launch monitoring (not gates, but scheduled before launch)**
- [ ] Day 0: GSC annotate, submit sitemap index, URL-inspect 20/template + 10/legacy pattern.
- [ ] Weekly dashboard: clicks/day (target 50/day at 90 days post-reindex), market CTR ≥1.5%, indexed-vs-submitted ≥90% by day 45 per segment, crawl-stats 410-pool drain + redirect decay, 5xx ≈0.
- [ ] Kill-switch: segment stalls <50% indexed at day 45 → raise that segment's threshold (markets ≥15), never add pages.
- [ ] Spam/core-update watch annotated; do NOT use GSC Removals for the 410 set; never resubmit legacy URLs.

---

## 5. CI gates to add (mechanical, from the checklists)

1. Truthfulness grep gate (checklist A) — add in Epic 0.
2. Single-definition-site grep for `isIndexable` predicates.
3. JSON-LD fixture validation per template.
4. Schema banned-type grep (`AggregateRating|"Review"|FAQPage`).
5. Redirect unit suite (20/pattern) + generated curl suite on preview.
6. `<img>` without alt lint; banned-vocabulary lint on copy files (04 appendix).

---

## 6. Open decisions for Tim (only what agents cannot decide)

1. **Publish your real identity?** 04's `/methodology` + `/about` copy names "Tim Dodaro, Crystal Lake, Illinois" as operator (strong E-E-A-T + honest-broker signal; also permanent public association with the site). Approve, or substitute a business-entity name (and if so, which entity).
2. **Provision `corrections@fastplumbernearme.com` (and confirm `info@`)** — the methodology/dispute copy depends on these mailboxes existing and being monitored. Needs DNS/mailbox setup you control.
3. **Epic 0 timing:** approve deploying the truthfulness hotfix to the live site immediately (days before the full rebuild), vs. holding everything for the single launch deploy. Recommendation: ship Epic 0 now — every day the false verification claims stay up is legal exposure and anti-recovery signal.
4. **Sponsored-slot commercial terms:** per-city monthly pricing (copy currently says "contact us for your city's rate") and whether any existing sponsor arrangements (e.g., Advantage Plumbing) carry over into the new slate-labeled slot under the new disclosure copy.

Everything else in the five documents is resolved by this spec and buildable without further owner input.
