# fastplumbernearme.com — Ground-Up SEO Architecture & Backend Plan

**Date:** 2026-07-11 · **Author:** SEO architecture pass (rebuild track)
**Context:** June 2026 Spam Update demotion (scaled-content-abuse / doorway pattern). ~6,600 impr/day → <100. This document replaces patching with a first-principles page taxonomy grounded in the live Firestore inventory (6,211 plumbers; 6,154 with synthesis; 5,755 with verbatim evidence quotes) and the 20-mile coverage dump.

**Governing principle:** a URL exists only if it carries information no competitor page has — the review synthesis, the verbatim negative evidence, and the editorial judgment. Everything else is a section, a filter, or a redirect.

---

## 0. Data findings that drive every decision below

Computed today from `city-coverage-20mi.json` (9,708 cities) and `plumbers-dump.json` (6,211 plumbers):

| Threshold | Cities |
|---|---|
| ≥1 plumber in 20mi | 9,708 |
| ≥5 | 6,761 |
| ≥10 | 5,709 |
| ≥10 plumbers AND ≥5 withQuotes | 5,699 |
| ≥15 | 4,687 |
| ≥25 | 3,182 |

The raw threshold numbers hide the real problem: **the coverage list is metro-duplicated.** The top "cities" by 20-mile plumber count are Elk Grove Village (246), Villa Park (234), Palatine (214), Prospect Heights (206) — four Chicago suburbs whose 20-mile circles contain nearly the same plumber set. A page for each is a doorway set by construction, no matter how good the template is. That is exactly what SpamBrain demoted.

**Market clustering (greedy: sort candidates by plumber count desc, keep a city only if no already-kept city lies within R miles):**

| Cluster radius | Candidates (≥10 plumbers, ≥5 withQuotes) | Kept market pages |
|---|---|---|
| 5 mi | 5,699 | 2,798 |
| **8 mi** | **5,699** | **1,643** |
| 10 mi | 5,699 | 1,197 |

At R=8mi: **1,643 market pages across 32 states**, median 23 plumbers per page (p25=15, p75=42), median 21 plumbers with verbatim quotes per page. Distribution: TX 148, CA 131, VA 105, OH 103, FL 88, PA 83, TN 81, GA 76, SC 68, IN 62…

Emergency sub-page viability (24-hour plumbers *with synthesis* within 20mi of a kept market): ≥8 → 1,248 markets; **≥12 → 905**; ≥15 → 742.

Redirect mapping for the 8,065 non-kept coverage cities: **5,493 lie within 12mi of a kept market (301 targets); 2,572 do not (410)**.

---

## 1. URL structure from scratch

### 1.1 Decisions

**D1 — One canonical "market page" per real market, not one page per city name.**
Threshold: **≥10 plumbers in 20mi AND ≥5 plumbers with verbatim evidence quotes AND survives 8-mile market clustering** (highest-count city in its cluster wins; population/county-seat used as tiebreaker when counts are within 10%).

Why these numbers, specifically:
- **≥10 plumbers:** a ranked comparison needs a real field. With MAX 15 shown, 10 is the floor where "who we ranked #1 and why, and who we ranked last and why" is a genuine editorial act rather than "here is everyone we found." (The post-cliff patch of 5 still permitted comparison-shaped pages with no comparison in them.)
- **≥5 withQuotes:** the moat is verbatim, attributed quotes. A page whose listings can't render at least 5 quote-backed entries fails the information-gain bar — it degrades into the token-swap template that got demoted. Note from the data this filter is nearly free (5,709 → 5,699), which tells you quote coverage is strong where plumber coverage is strong — good.
- **8-mile clustering:** 20-mile service radii mean two cities 8 miles apart share ≳70% of their circle area — their plumber lists are near-identical. 8mi collapses the Chicago-suburb pathology (Elk Grove Village / Villa Park / Palatine become one market each anchored on the dominant city) while preserving genuinely separate markets 10+ miles apart. 5mi leaves too much duplication (2,798 pages); 10mi starts merging real markets (Ocala-class small metros vanish). Suppressed suburbs are not deleted from the product — they appear as "Areas served" entries and H2-level sections *on* the market page, and they 301 to it.

**D2 — Service-level city pages DO NOT EXIST. One exception: emergency.**
The 27 configs × cities matrix (the demoted set) is dead. Rationale:
- The plumber inventory does not differ by service finely enough to make `/drain-cleaning/il/palatine` a different *list* than `/il/palatine` — same businesses, reshuffled, plus templated FAQs. Zero information gain → doorway.
- Service intent is served **on the market page** as filterable sections (client-side filter + server-rendered "Best for drain cleaning / water heaters / sewer" sub-sections driven by `reviewSynthesis.servicesMentioned` — i.e., grounded in what reviewers actually said, which competitors cannot replicate). Filters never mint URLs (see §3.4).
- **Exception — `/plumbers/{st}/{city}/emergency`:** the brand's head term, and the one intent where the *list itself* is materially different (only `is24Hour` plumbers, ranked by after-hours review evidence, with "does this plumber actually answer at 2am per reviewers" synthesis). Exists only where **≥12 24-hour plumbers with synthesis** are in radius → **~905 pages**. Everywhere else, emergency is the top section of the market page and the URL 301s there.
- The 16 service + 5 intent + 6 symptom head terms get **~15 national editorial guides** (`/guides/{slug}`) — real articles (cost data aggregated from our review corpus, decision frameworks, red-flag patterns observed across 6,211 plumbers) that link down to market pages. These are linkable assets, not landing-page multipliers.

**D3 — Plumber profiles stay, gated on evidence.**
`/plumber/{slug}` is indexable only when the plumber is active, has `reviewSynthesis`, and has **≥3 evidence quotes**. ~5,700 qualify today; the remaining ~500 render but noindex until the synth pipeline catches them up. Profiles are the long-tail moat: business-name queries land on the only page on the internet that shows the plumber's strengths AND documented complaints with attributed quotes.

### 1.2 URL patterns (exact)

```
/                                        Home
/plumbers                                National index (browse states)
/plumbers/{st}                           State hub (two-letter, e.g. /plumbers/il)
/plumbers/{st}/{city}                    MARKET PAGE (the core template)
/plumbers/{st}/{city}/emergency          Emergency market page (905 markets only)
/plumber/{business-slug}                 Plumber profile
/guides/{guide-slug}                     National editorial guides (~15)
/blog, /blog/{slug}                      Editorial (kept, pruned to genuinely written posts)
/methodology                             Replaces /how-we-verify (see §5 — the false
                                         AI-call-verification page is deleted, 301 → /methodology)
/editorial-policy                        Review sourcing, quote rules, corrections
/advertising-disclosure                  Sponsored-slot mechanics, SPONSORED_QUALITY_THRESHOLD
/about, /contact, /add-your-business, /privacy-policy, /terms
```

Slug rules: lowercase kebab; two-letter state codes (shorter URLs, unambiguous, no `illinois` vs `il` dual-format drift); city slug from canonical city name; business slug via existing `businessProfileSlug()` (franchise-collision-safe). No trailing slashes; enforce via middleware 301.

### 1.3 Indexable page count (target)

| Template | Count |
|---|---|
| Market pages | ~1,643 |
| Emergency market pages | ~905 |
| Plumber profiles (evidence-gated) | ~5,700 |
| State hubs (states with ≥1 market) | 32 |
| National index, home | 2 |
| Guides | ~15 |
| Blog (pruned) | ~25 |
| Trust/static | ~9 |
| **Total indexable** | **~8,330** |

vs. 38,488 in the current sitemap and ~44,700 historical. **A ~78% cut**, with median unique-evidence density per page going from near-zero (token-swap FAQ pages) to 21 quote-backed listings per market page.

### 1.4 Legacy URL disposition (the recovery-critical part)

| Legacy pattern | Disposition |
|---|---|
| `/emergency-plumbers/{state}/{city}` — city is a kept market | 301 → `/plumbers/{st}/{city}/emergency` if it exists, else `/plumbers/{st}/{city}` |
| `/emergency-plumbers/{state}/{city}` — suburb within 12mi of a market | 301 → that market page (5,493 cities; the market page genuinely lists the suburb under Areas Served) |
| `/emergency-plumbers/{state}/{city}` — no market within 12mi | **410** (2,572 cities). Do not 301 doorway pages at nothing-equivalent destinations; that funnels spam signals into the new site. |
| `/{service}/{state}/{city}` — all 27 configs | 301 → market page for kept/suburb cities; **410** otherwise. Never 301 to `/guides/*` (not equivalent content; soft-doorway echo). |
| `/emergency-plumbers/{state}` (state pages) | 301 → `/plumbers/{st}` |
| `/plumber/{slug}` | Unchanged (no redirect churn on the healthiest template) |
| `/how-we-verify` | 301 → `/methodology` |
| `/plumbers` (old index) | Unchanged path, new content |

Implementation: a build-time generated redirect map (city → market assignment is already computable from the coverage dump; ship it as `redirects.json` consumed by Next middleware; 410 via middleware returning `new Response(null, {status: 410})`). Keep the map permanently — never expire the 301s.

---

## 2. Schema.org plan (JSON-LD, exact types per template)

### 2.0 The Review-markup rule (non-negotiable)

Google's structured-data guidelines for review snippets: **ratings must be sourced directly from users of YOUR site; pages must not mark up reviews aggregated from other websites.** Our ratings/quotes come from Google/Yelp/BBB. Therefore:

> **Emit NO `Review`, no `AggregateRating`, and no `positiveNotes/negativeNotes` structured data anywhere, on any template, until first-party reviews collected on our own site exist.** Visible content shows ratings, distributions, and verbatim quotes freely (that's Section 230-protected editorial content); the *markup* stays clean. The old city-page `Review`-per-plumber and FAQPage markup is deleted. This also removes a standing manual-action risk (self-serving/aggregated review markup is a documented penalty vector), which is the last thing a demoted site needs.

When first-party reviews launch (Phase 2+), `AggregateRating`/`Review` may be added ONLY from first-party submissions, on `/plumber/{slug}` only.

### 2.1 Per template

**Home `/`**
- `Organization` — `name`, `url`, `logo`, `sameAs` (GBP, social), `contactPoint`. `@id: {origin}/#org` referenced site-wide via `publisher`.
- `WebSite` + `SearchAction` (`potentialAction` targeting `/plumbers?q={search_term_string}`).

**State hub `/plumbers/{st}`**
- `BreadcrumbList` (Home → Plumbers → {State}).
- `CollectionPage` with `ItemList` of market-page URLs (`itemListElement: ListItem{position, name, url}` — URL-only items, no nested LocalBusiness; this is a list of *pages*, not businesses).

**Market page `/plumbers/{st}/{city}`**
- `BreadcrumbList` (Home → Plumbers → {State} → {City}).
- `ItemList` of the ranked listings. Each `ListItem.item` is a `Plumber` **summary entity** whose `@id`/`url` points at `/plumber/{slug}` (entity consolidation on the profile). Fields per item — mapped from `Plumber` (src/lib/types.ts):

| JSON-LD field | Firestore field |
|---|---|
| `@type` | `"Plumber"` (subtype of LocalBusiness) |
| `@id` / `url` | `absoluteUrl(businessProfilePath(slug))` |
| `name` | `businessName` |
| `telephone` | `phone` |
| `address` (`PostalAddress`) | `address.street/city/state/zip` |
| `geo` (`GeoCoordinates`) | `address.lat/lng` |
| `openingHours` | `workingHours` (mapped to spec strings); `is24Hour` → `"Mo-Su 00:00-24:00"` |
| `areaServed` (`GeoCircle`) | `geo{lat,lng}` + `geoRadius: 32187` (20mi in meters) |
| `sameAs` | `website`, `social.facebook`, `social.instagram` (non-null only) |
| `image` | `photoUrl` (only if we render it) |

- **No FAQPage.** The templated FAQs are gone from markup and mostly from the page (see §5).

**Emergency market page** — same as market page (BreadcrumbList adds → Emergency; ItemList filtered to `is24Hour`).

**Plumber profile `/plumber/{slug}`**
- `BreadcrumbList` (Home → Plumbers → {State} → {City} → {Business}).
- Full `Plumber` entity (`@id: {url}#business`): all mappings above **plus** `description` ← first sentence of `reviewSynthesis.summary` prefixed "Editorial summary:" (opinion framing), `foundingDate`/`yearsInBusiness` only if non-null, `hasCredential` omitted unless `licenseNumber` verified. **No aggregateRating, no review** (per §2.0) even though the visible page shows the full rating distribution and quotes.
- If we publish the synthesis as a dated, authored review of the business later, that is an `Article`/`Review` authored by the Organization — hold this until legal sign-off; ship without it.

**Guides `/guides/{slug}` and blog posts**
- `Article` (`headline`, `datePublished`, `dateModified` = real edit dates, `author` → `Person` (named editor) or the `Organization` `@id`, `publisher` → `#org`) + `BreadcrumbList`.
- `FAQPage` allowed ONLY here, only for hand-written Q&As unique to the guide (genuine-FAQ rule), max 1 template.

**Methodology / editorial-policy / disclosure pages** — `WebPage` + `BreadcrumbList` only.

### 2.2 Validation gates (see checklist §6)
Every template validated in Rich Results Test + Schema.org validator in CI (build emits one sample JSON-LD per template to `__schema-fixtures__/`; CI posts them to the validator or runs `structured-data-testing-tool` locally). Fail build on ERROR-level.

---

## 3. Indexation policy

### 3.1 Decision table — market pages

| Condition | Directive |
|---|---|
| Kept market (≥10 plumbers, ≥5 withQuotes, cluster winner) | `index,follow`, self-canonical, in sitemap |
| Falls below 10 plumbers OR below 5 withQuotes after data refresh | Stays live, flips `noindex,follow`, drops from sitemap; restored automatically when back over threshold (hysteresis: require 2 consecutive weekly snapshots below/above before flipping, to stop churn) |
| Suburb / non-kept city requested | No page. 301 (≤12mi) or 410 |
| Emergency page, market has ≥12 24h-with-synthesis | `index,follow`, self-canonical |
| Emergency page below 12 | Route 301s to market page (page never renders thin) |

### 3.2 Decision table — plumber profiles

| Condition | Directive |
|---|---|
| `isActive && status=="active" && reviewSynthesis && evidence_quotes.length>=3` | `index,follow`, self-canonical, in sitemap |
| Active but synthesis/quotes below bar | Renders, `noindex,follow`, not in sitemap |
| `status=="inactive"` or closed (`closedAt`) | Keep URL live for 90 days with prominent "appears closed" notice + `noindex`; then **410**. Never silently delete (users may hold the URL). |
| Duplicate/franchise slug collisions | One canonical slug via `businessProfileSlug()`; alternates 301 |

### 3.3 Decision table — everything else

| Page | Directive |
|---|---|
| Home, state hubs, /plumbers, guides, blog, trust pages | index, self-canonical |
| `/admin`, `/api` | robots disallow + `noindex` header |
| Search results (`/plumbers?q=`) | `noindex,follow` |
| OG-image endpoints | `X-Robots-Tag: noindex` |
| Any page rendered from radius-fallback with 0 listings | must be impossible by construction (route 404s) — no more "coming soon" shells, even noindexed ones |

### 3.4 Pagination & faceting

- Market pages show **max 15 ranked listings, no pagination.** We are an editorial shortlist, not an exhaustive directory — this is both the product position and the thin-page killer. "See all N plumbers near {city}" expands client-side (no URL change).
- Service filters on market pages are client-side only (`?filter=` never emitted; if deep-linking is wanted use `#drain-cleaning` fragments — fragments don't create crawlable URLs).
- State hubs list all markets on one page grouped by metro region (max ~148 links for TX — fine).
- Rule: **query strings never produce indexable states.** Canonical always strips params; middleware 301s known-junk params (`utm_*` kept for analytics but canonicalized).

### 3.5 Sitemap strategy

Segmented sitemap index (`/sitemap.xml` → children), one file per template so GSC coverage reports isolate problems per template:

```
/sitemaps/static.xml        (~50 URLs: home, hubs, guides, blog, trust)
/sitemaps/markets.xml       (~1,643)
/sitemaps/emergency.xml     (~905)
/sitemaps/plumbers-1.xml    (≤2,500 each → 3 files)
```

**lastmod discipline (current sitemap.ts violates this — it stamps `new Date()` on every build, which trains Google to ignore our lastmod):**
- Market pages: `max(updatedAt of listed plumbers, last ranking change)` — persisted at export time by `export-firestore-to-json.js` into the derived JSON.
- Plumber profiles: `plumber.updatedAt` (or `reviewSynthesis.synthesizedAt` if later).
- Static/guides: git-derived or hand-set edit date.
- Never emit `changefreq`/`priority` (ignored; noise).
- Only URLs that render `index` may appear — enforced by a single shared predicate (`isIndexable(entity)`) used by BOTH the page `metadata.robots` and the sitemap generator, so they cannot drift (today's code duplicates the threshold check in two places).

### 3.6 robots.txt

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: https://www.fastplumbernearme.com/sitemap.xml
```

Keep it minimal — indexation control lives in meta robots/410s, not robots.txt (blocked-but-linked URLs still index; never use robots.txt to hide thin pages). Explicitly do NOT block AI crawlers (GPTBot etc.) — LLM answer engines citing an honest-broker directory is upside.

### 3.7 Canonical rules

- Every page emits exactly one absolute self-canonical on the www origin (`SITE_ORIGIN`), apex 307→www stays (upgrade to 308/301).
- No cross-canonicals as a dedup patch — the June remediation's canonical-dedup hacks are obsolete because the duplicate URLs no longer exist. Canonicals only ever point to self; consolidation is done with 301/410, not canonical hints (hints get ignored on doorway sets — Google demonstrably ignored ours).

---

## 4. Internal linking architecture

**Topology: hub-and-spoke with geo-honest cross-links.** Every link answers "would a user in this city click this?"

1. **Home →** national index, top ~20 markets by inventory depth, guides, methodology. No 50-state footer dump.
2. **State hub →** every market page in the state, grouped by metro region (derive groups from the 8mi clusters' parent metros), each with `{plumber count, quote-backed count}` shown — links carry data, not just anchors.
3. **Market page →**
   - **Plumbers (spokes):** each of the ≤15 listings links to its profile.
   - **Nearby markets:** 5–8 *kept markets* sorted by real haversine distance, rendered with distances ("Aurora — 12 mi west"). Only kept markets — never link to redirects. Computed from cluster centroids at export time; no boilerplate "nearby cities" lists of noindexed pages (the old pattern linked into thin pages, spending crawl budget on the doorway set).
   - **Areas served block:** suppressed suburbs in this cluster listed as *plain text* (crawlable content, not links — their URLs are 301s).
   - **Emergency page** (if it exists) and back.
   - 1–2 contextually relevant guides (e.g., water-heater guide only if the market's `servicesMentioned` density supports the section).
4. **Plumber profile →** its primary market page (breadcrumb + inline), other kept markets within its 20mi radius (max 4, by distance), and 2–3 same-market competitor profiles ("Compare with…" — genuinely useful, increases crawl mesh among the strongest template).
5. **Emergency page →** parent market page (canonical-adjacent hierarchy), profiles listed, nearest 3 markets' emergency pages.
6. **Guides →** top 10 relevant markets (by inventory for that service per `servicesMentioned` aggregation) — data-driven deep links, refreshed at export.
7. **Breadcrumbs (visible + BreadcrumbList):** `Home › Plumbers › IL › Palatine › {Business}`. Every level is a real, indexable page.
8. **Global footer:** trust pages, guides index, top 10 states only. No mega-footer of city links (classic doorway tell).

Depth guarantee: every indexable page ≤3 clicks from home (home → state hub → market → profile = 3).

---

## 5. E-E-A-T + spam-recovery specifics

### 5.1 What structurally signals "not a doorway site" to SpamBrain

The demotion classifier keys on: near-duplicate content across URL sets, low added value vs. sources, and scaled generation patterns. Each is answered structurally:

**Per-page information-gain minimums (enforced in code — the page cannot render `index` without them):**

Market page must contain ALL of:
1. ≥10 ranked plumbers, ≥5 rendering an attributed verbatim quote (author, source, date — from `evidence_quotes`);
2. an editorial verdict block — "our #1 pick and why / who to avoid and why" — citing `supporting_review_ids` evidence;
3. a **"What reviewers complain about here"** section: negative quotes competitors bury (the moat, above the fold);
4. full rating-distribution display for each expanded listing (FTC net-impression guardrail);
5. per-market aggregates only computable from our corpus (e.g., "9 of 23 plumbers here have review-documented after-hours response"; median rating; % with pricing complaints);
6. data-freshness stamp ("Listings reviewed {date}; based on {n} reviews across Google/Yelp/BBB") wired to real `synthesizedAt` maxima;
7. ZERO templated token-swap prose. The 27-config `faqTemplates`/`heroHook`/`emergencyTypes` boilerplate in `services-config.ts` is deleted from rendering. If a sentence would be identical on another city's page with the city name swapped, it doesn't ship.

Plumber profile must contain: synthesis (strengths AND weaknesses/redFlags), ≥3 attributed quotes, rating distribution, sample-size warning when applicable (`sampleSizeWarning`), review-source breakdown.

**Truthfulness purge (launch-blocking):** every claim of AI call verification, "we call every plumber," answer-rate testing — on /how-we-verify, privacy policy, badges ("24/7 Verified" copy), and the `VerificationCall`-era UI — is removed. The `verificationStatus`/`answerRate` fields stop rendering anywhere user-visible. A directory recovering from a spam demotion cannot carry falsifiable fake-verification claims; it's also an FTC exposure.

### 5.2 Trust page set

- **/methodology** — honest and specific: where reviews come from (Google/Yelp/BBB via named tooling), how synthesis works (LLM-assisted analysis, human-defined rubric, anti-hallucination validation: quotes verbatim-checked against source), what scores mean, what we do NOT do (we do not call plumbers; we do not accept payment for ranking), update cadence. This page is the anti-doorway artifact — link it from every market page footer ("How we rank").
- **/editorial-policy** — verbatim-quote rule, attribution rule, opinion framing ("our synthesis is opinion grounded in the quoted evidence"), corrections process, how a plumber disputes a listing (email + documented SLA).
- **/advertising-disclosure** — the sponsored slot: one per market, labeled "Sponsored", `rel="sponsored"` on its outbound links, never re-orders organic ranking, quality-gated (`SPONSORED_QUALITY_THRESHOLD=65` — "you can pay to be seen, not to be trusted", stated in these words).
- **/about** — who runs this (real name/entity, photo, contact), why it exists (the honest-broker story). Named `author`/`editor` entity reused in Article schema.

### 5.3 Recovery mechanics

- The spam-update demotion is algorithmic (SpamBrain), not a manual action — there is nothing to file; recovery = the classifier re-evaluating the site, typically at the next spam/core update after the offending pattern is gone. Therefore: **ship the deletion (410s + 301s) as one decisive event, not a slow bleed.** A site that removes 78% of its URL inventory and re-launches with dense pages is a categorically different crawl footprint.
- Submit all new sitemaps; use URL Inspection on ~20 exemplar pages per template; keep the Indexing API pings only for pages that qualify (it's officially for JobPosting/Broadcast — deprioritize; sitemaps + internal links suffice at 8k URLs).
- Expect the 410'd URLs to show as "Not found (404)" and the 301s as "Redirect" in GSC coverage — that's the desired shape. Do not resubmit legacy URLs.
- Keep CTR honest: pre-cliff CTR of 0.04% is itself evidence pages didn't deserve impressions. The new success metric is clicks and click-through-rate on market pages, not impression recovery (see §6.6).

---

## 6. Full SEO checklist (checkable)

### 6.1 Metadata & titles

- [ ] **Title formulas** (≤60 chars, measured, no keyword doubling):
  - Market: `{N} Best Plumbers in {City}, {ST} — Ranked by Real Reviews` (N = rendered count, real)
  - Emergency: `Emergency Plumbers in {City}, {ST} — {M} Open 24/7 (Reviewed)`
  - Profile: `{Business} — {City}, {ST} Plumber Review: Strengths & Complaints`
  - State: `Plumbers in {State} — {K} Local Markets Ranked`
  - Guide: hand-written per guide
- [ ] Meta descriptions hand-formulated per template from real data ("Includes what reviewers complain about."); unique per page because the data is unique; ≤155 chars.
- [ ] H1 unique per page, matches intent, contains real counts.
- [ ] OG: `og:title`, `og:description`, `og:url` (canonical), `og:type` (`website`/`article`/`business.business`), `og:image` via existing edge OG generator (per-template designs; profile OG shows rating distribution — differentiated share card).
- [ ] Twitter: `summary_large_image`, `twitter:title/description/image`.
- [ ] `metadataBase` = `SITE_ORIGIN` (www); verify no page emits apex URLs.
- [ ] No `meta keywords`. `viewport`, `theme-color`, favicon + `icon-192/512` (currently missing — ship them).

### 6.2 Canonical / robots discipline

- [ ] Every route's `metadata.robots` and canonical derive from the single shared `isIndexable()` predicate.
- [ ] Sitemap generator imports the same predicate (grep-level CI check: only one definition site).
- [ ] Apex→www 301/308 (not 307); http→https; trailing-slash strip; lowercase redirect for uppercase paths.
- [ ] `?q=`, tracking params canonicalized; no indexable query-string states (site: search spot-check post-launch).
- [ ] Legacy redirect map deployed in middleware; unit test: 20 sample URLs per legacy pattern → expected 301 target or 410.

### 6.3 Status-code policy

- [ ] 410 (not 404) for deliberately removed doorway URLs and >90-day closed plumber profiles.
- [ ] 404 page: helpful, links to nearest-market search, `noindex` implied by status; no soft-404s (every rendered page has real content or a non-200).
- [ ] 301s are permanent and single-hop (no chains: legacy → final URL directly; test with curl loop).
- [ ] Monitor GSC Crawl Stats for 5xx; Vercel ISR/on-demand revalidation must not serve 200 shells during builds.

### 6.4 Performance (CWV budgets — the "fastest directory" edge)

- [ ] LCP ≤1.8s p75 mobile (budget: HTML ≤50KB gz for market pages; hero is text, no hero image).
- [ ] INP ≤150ms p75 (filters are the risk — virtualize the expanded list; no hydration of below-fold listing cards until interaction).
- [ ] CLS ≤0.05 (reserve space for OG images/badges; no late-loading ad slot shifts — sponsored slot server-rendered).
- [ ] JS budget ≤130KB gz per template; no third-party scripts beyond GA4 (loaded `afterInteractive`).
- [ ] Static generation for all indexable pages (`generateStaticParams`); data from committed JSON export — zero runtime Firestore on the crawl path.
- [ ] Images: `next/image`, AVIF/WebP, explicit dimensions; plumber photos lazy below fold.
- [ ] Verify in CrUX/GSC CWV report monthly; PageSpeed CI gate on the 4 core templates.

### 6.5 Content & accessibility

- [ ] Image alt policy: plumber photos `alt="{businessName} — plumber in {city}, {ST}"`; decorative icons `alt=""`; OG images n/a; CI lint: no `<img>` without alt.
- [ ] Every verbatim quote rendered with author name, source (Google/Yelp/BBB), and date — visible attribution, `<blockquote cite>` where source URL exists.
- [ ] Rating distributions rendered wherever an average rating is shown (FTC net-impression).
- [ ] Sponsored slot: visible "Sponsored" label, `rel="sponsored"` outbound, disclosed on /advertising-disclosure.
- [ ] No site-authored factual claims about a plumber that aren't grounded in a quoted review (lint the synthesis renderer: strengths/weaknesses render WITH their `supporting_review_ids` evidence toggle).
- [ ] Purge check (launch gate): repo-wide grep for `verification call|we call every|answer rate|AI call|Verified by phone` in rendered copy returns zero.

### 6.6 Structured data validation

- [ ] CI: JSON-LD fixtures per template validated (Rich Results Test API / schema validator); build fails on errors.
- [ ] Grep-gate: no `AggregateRating|"Review"|FAQPage` in market/profile template output (guides excepted for FAQPage).
- [ ] GSC Enhancements reports (Breadcrumbs, Sitelinks searchbox) checked at day 14 / day 45.
- [ ] Spot-check 5 live URLs per template in Rich Results Test after first deploy.

### 6.7 GSC monitoring plan (recovery baseline: pre-cliff ~6,600 impr/day; cliff <100/day)

- [ ] **Day 0:** annotate deploy date; submit 4 segmented sitemaps; URL-inspect 20 exemplars/template.
- [ ] **Weekly dashboard (existing GSC API plumbing reused):** impressions/day, clicks/day, CTR *per template* (regex filters on the 4 URL patterns), indexed-count per sitemap segment, crawl-stats 4xx/5xx/redirect share.
- [ ] **Success metrics, in order:** (1) clicks/day (baseline ~2–3/day at 0.04% CTR — target 50/day at 90 days post-reindex); (2) CTR ≥1.5% on market pages (below that, titles/snippets fail); (3) indexed-vs-submitted ≥90% per segment by day 45; (4) impressions last — do NOT chase the 6,600 vanity baseline; a healthy site at 2,000 impr/day × 2% CTR = 40 clicks/day beats the old site's 2.6.
- [ ] **Kill-switch monitoring:** if a template's indexed count stalls <50% at day 45 → inspect for quality flags; if "Crawled — currently not indexed" dominates a segment, raise that segment's threshold (e.g., markets ≥15 plumbers) rather than adding pages.
- [ ] **Spam-update watch:** subscribe to Google Search Status dashboard; recovery verdict is only readable after the next spam/core update rolls through — annotate those dates on the dashboard.
- [ ] Track 410 pool draining (GSC "Not found" count rising then flattening = old set flushed).
- [ ] Quarterly: re-run coverage export → threshold sweep → market list diff reviewed by a human before any page additions (growth is earned, not scaled).

### 6.8 Backend/pipeline hooks (what the export must now emit)

- [ ] `markets.json` — the 1,643 kept markets: `{slug, state, name, lat, lng, clusterCities[], plumberIds[], counts{plumbers,withQuotes,emergency}, lastmod}`. Single writer: `export-firestore-to-json.js` (per repo invariant).
- [ ] `redirects.json` — legacy URL → target/410 map (build-time generated from coverage dump + market list).
- [ ] `isIndexable()` predicates for market/profile live in `directory-core` (SHARED per monorepo principle — HVAC/electrician verticals reuse the same taxonomy engine with different thresholds).
- [ ] Hysteresis state (2-snapshot rule, §3.1) persisted in Firestore `cities`/`markets` docs.
- [ ] lastmod fields persisted at export, not computed at request time.

---

## Appendix A — threshold sensitivity (for future re-tuning)

| Rule set | Market pages | Note |
|---|---|---|
| ≥10 & 5q, R=5mi | 2,798 | too much metro duplication survives |
| **≥10 & 5q, R=8mi** | **1,643** | **chosen** — median 23 plumbers, 21 quote-backed per page |
| ≥10 & 5q, R=10mi | 1,197 | merges distinct small metros |
| ≥15 & 10q, R=8mi | 1,267 | fallback if "crawled-not-indexed" persists post-launch |

Emergency sub-pages: ≥8 24h+synth → 1,248; **≥12 → 905 (chosen)**; ≥15 → 742 (fallback tier).

Redirect economics: 5,493 suburb 301s / 2,572 410s of the 8,065 non-kept coverage cities.
