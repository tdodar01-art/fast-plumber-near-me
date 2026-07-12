# /plumber/{slug} — Deep Profile Page Design (Ground-Up Rebuild)

Status: DESIGN SPEC — 2026-07-11
Companion mockup: `mock-plumber-page.html` (same directory; realistic data for Chisholm Plumbing, AC & Furnace Repair, Greer SC — a real record with a 4.9×1,691 Google rating, a 3.0×7 Yelp rating, four synthesized red flags, and verbatim 1-star quotes. Chosen deliberately: it is the exact case where our product beats every other directory.)

---

## 1. Page thesis

The profile page is an **editorial dossier**, not a listing. Its one-sentence pitch to the visitor:

> "We read all the reviews — including the ones other directories bury — and here is our honest take, with the receipts."

Every design decision follows from three rules:

1. **The judgment is the hero.** The verdict + summary is the first content block, above the fold, and is the LCP element (pure text — fast).
2. **Concerns get equal-or-greater visual weight than praise.** They are a first-class section with full verbatim quote cards rendered inline — never an accordion, never below the positive reviews, never gray-on-gray.
3. **No claim without a receipt.** Every synthesized sentence is visually chained to verbatim, attributed quotes (`supporting_review_ids` → quote cards). Anything we cannot chain to evidence, we do not say.

### What is deliberately KILLED from the current page

| Current element | Why it dies |
|---|---|
| "Trust Score: N/100" naked label | Reads as a verification claim. Replaced by "FPN Review Score" with a mandatory methodology link and explicit "derived from published reviews" framing. |
| `answerRate`, `totalCallAttempts`, `verificationStatus`, "24/7 Verified by Reviews" badge, VerdictSeal "verified" language | We never made verification calls. All UI that implies testing/verification is fabricated and is removed. Fields stay in the type for now but are never rendered. |
| Keyword-derived badges (`Fast Responder`, `Fair Pricing`, etc. re-derived in page.tsx from substring matches) | Client-side keyword re-derivation invents claims the synthesis pipeline never made. All display claims come from `reviewSynthesis` / `decision` only. |
| KPI 2×2 cards guessing "Response: Unknown" | Gray "Unknown" cards are filler. If we don't have a signal, we render nothing. |
| `filterByKeywords()` re-bucketing of strengths/weaknesses into 6 themed sections | Duplicates and mangles the synthesis. Strengths/concerns render verbatim from the pipeline, in pipeline order, with their evidence. |
| Page-level upsell keyword scanning of review text | Signal detection belongs in the pipeline where it is validated, not in a page component. |
| "Most helpful review" / "Customers report this" labels on quotes | Editorializing individual quotes invites deception claims. Quotes get neutral factual labels: source, author, date, star rating. |

---

## 2. Two journeys, one page

**Journey A — Emergency ("landed from city page / Google, water on the floor").**
Needs in <5 seconds: Is this plumber open now? Can they handle my thing? What's the catch? → Tap call.
Served by: header status line (open/closed + hours), verdict banner with one-line summary, primary Call button in first viewport, sticky bottom call bar on mobile after scroll.

**Journey B — Research ("got a quote from these guys / comparing 3 plumbers").**
Needs: the concerns other sites hide, pricing signals, the negative reviews verbatim, how they rank vs. neighbors, dispute-worthy history. Willing to scroll.
Served by: full concerns section with quote cards, platform-gap panel, rating distribution, evidence ledger, best-for/think-twice panel, city-rank cross-link ("#3 of 6 we've reviewed in Greer → see all").

The page order optimizes A first (verdict + call above fold), then B (everything else), because A converts and B builds the brand that makes A trust us.

---

## 3. Page architecture (top → bottom)

Desktop ≥1024px: two columns — main editorial column (~640px) + sticky right rail (facts panel + CTA). Mobile: single column; facts panel moves below the evidence ledger; sticky bottom call bar.

### 3.1 Header (above fold, part of LCP)
- Breadcrumb: Home → Plumbers in {City}, {ST} → {Name}. (City crumb links to the city page — the profile's parent in the new IA.)
- **H1: `{Business Name}`** — plain business name, nothing appended. (Title tag carries the keywords; the H1 stays an entity name for disambiguation.)
- Subline: `Plumber · Greer, SC · Open today 7 AM – 10 PM` (open/closed computed from `workingHours`; `Open 24 hours` when `is24Hour`).
- **Cross-platform rating strip** — the single most honest element on the page and the hook: `Google ★4.9 (1,691) · Yelp ★3.0 (7) · BBB A+ Accredited`. Each links to the source profile (rel="nofollow noopener"). When platforms disagree materially (gap ≥1.0 stars), an inline amber chip: `⚠ platforms disagree — see why`, anchor-linking to §3.5.
- Primary CTA row: `Call (864) 865-5044` (tel:) + `Website ↗`. On mobile these are full-width stacked; the Call button repeats in the sticky bar.

Data: `name`, `city`, `state`, `workingHours`, `is24Hour`, `googleRating`, `googleReviewCount`, `yelpRating`, `yelpReviewCount`, `bbb.rating`, `bbb.accredited`, `phone`, `website`.

### 3.2 THE VERDICT (the page's reason to exist; first H2)
A single bordered banner, color-keyed to `decision.verdict`:

- strong_hire → green "HIRE — few reservations"
- conditional_hire → amber "HIRE, WITH CONDITIONS"
- caution → orange "PROCEED WITH CAUTION"
- avoid → red "WE'D LOOK ELSEWHERE"

Contents, in order:
1. Verdict label (visually loudest element on the page).
2. `synthesis.summary` — the one-sentence editorial judgment, set in serif display type. This is the LCP text node.
3. **Provenance line (mandatory, non-decorative):** `Our opinion, based on the {N} reviews we analyzed from Google, Yelp and BBB · Updated {date} · How we decide ↗`. N = `scores.review_count_used`; date = `scores.last_scored_at` (fallback `scrapedAt`). "How we decide" links to /methodology.
4. **FPN Review Score `{overall}/100`** with the five dimension bars (reliability / pricing fairness / workmanship / responsiveness / communication, from `scores.*`). The weakest dimension is visually flagged (e.g. pricing 58 renders amber with a "weakest area" tag). A one-line disclosure under the bars: "Scores are our editorial reading of published customer reviews — not a verification, license check, or guarantee."
5. City-rank line when `city_rank` exists: `#3 of 6 plumbers we've reviewed in Greer, SC → compare all` (links to city page). Uses the exact "we've reviewed" phrasing — never "#3 in Greer" (which would be an unverifiable factual claim about the market).

Legal note: the entire block is framed as opinion ("Our take", "we'd", "our reading"), grounded in disclosed inputs. This is the Section 230 / FTC net-impression posture: our synthesis is opinion-on-disclosed-facts, the facts are the quoted reviews.

### 3.3 What reviewers praise (H2)
Renders `synthesis.strengthsEvidence[]` (fallback: flat `strengths[]`). Each strength:
- The synthesized sentence, verbatim from the pipeline (these already carry counts: "7 reviews explicitly mention on-time or early arrival…").
- An **evidence chip**: `[{n} reviews cited ▸]` — a `<details>` disclosure that expands to the verbatim quote cards for its `supporting_review_ids` (resolved against cached reviews / `evidence_quotes`). Chip, not accordion-section: the claim is always visible, the receipts are one tap away.

### 3.4 What reviewers report — concerns (H2; THE MOAT SECTION)
Visual treatment: red-accented cards on the same hierarchy level as praise, positioned immediately after it, **never collapsed**.

Two sub-blocks:
1. **Concerns** — `weaknessesEvidence[]` + `redFlagsEvidence[]` merged, red flags first, each rendered like strengths (synthesized sentence + evidence chip), but with the strongest supporting quote **already expanded inline** as a full quote card (author, date, source badge, star rating, verbatim text — long reviews clamped to ~6 lines with "read full review" expanding in place). The reader must not have to click to see the first negative receipt.
2. **Fairness counterweight (mandatory whenever concerns render):** a small neutral note — "These concerns appear in {x} of the {N} reviews we analyzed. Most reviewers report positive experiences (see distribution below)." Numbers computed from evidence, not invented. This is both the honest framing and the defamation-safety valve: we never let a single 1-star review masquerade as the net impression.

Empty state (no weaknesses/red flags): render the section anyway with "We looked for patterns of complaints in {N} reviews and didn't find any. That's rare — but it's a reading of published reviews, not a guarantee."

### 3.5 The rating picture (H2) — distribution, platform gap, recency
Three sub-components in one section:

1. **Star distribution chart** of the reviews we analyzed, horizontal bars 5★→1★ with counts. **Labeled scrupulously:** "Distribution of the {N} reviews we analyzed — not all {googleReviewCount} Google reviews." (We do not have Google's full histogram; claiming it would fabricate. If Outscraper later supplies the true histogram, the label upgrades.) 1★/2★ bar rows are click-targets that jump to the negative quotes in the ledger.
2. **Platform comparison** when ≥2 platforms have data: side-by-side rating bars for Google / Yelp / BBB with review counts, plus `synthesis.platformDiscrepancy` prose rendered as the caption when present ("Google 4.9 vs Yelp 3.0 — a 1.9-star gap…"). This panel is the anchor target of the header's "platforms disagree" chip.
3. **Recency timeline**: quarterly bar strip of analyzed-review dates (from cached review timestamps) with the takeaway line computed, e.g. "Most recent review we analyzed: May 15, 2026 · 84 of 122 analyzed reviews are from the last 12 months." If the newest cached review is >12 months old, an amber staleness note: "We haven't pulled new reviews for this business since {date} — check Google for anything newer." Honest staleness is itself a differentiator.

### 3.6 The evidence ledger (H2) — verbatim quotes
The full `evidence_quotes[]` + selected cached negative reviews, rendered as attributed quote cards grouped **Positive / Critical** (critical group never hidden; on desktop the two groups are side-by-side columns so negatives aren't "below the fold of the section").

Quote card anatomy (one component reused everywhere on the page):
- Verbatim quote text (never paraphrased; ellipses allowed only mid-quote with "…"; long quotes clamp + expand).
- Attribution row: `{author} · ★{rating} · {source badge} · {date}`.
- Dimension tag when present (`pricing`, `reliability`, …) — small neutral chip.
- Source badge links to the platform profile where feasible.
- Footer of the section: "Quotes are reproduced verbatim from public reviews on the platforms shown. We select which quotes to feature; selection reflects our editorial judgment. Report a quote that doesn't match its source ↗."

This is the Section 230 core: third-party content, reproduced verbatim, attributed. Our only authored contribution is selection + the clearly-labeled opinion synthesis.

### 3.7 Should you hire them? (H2) — decision panel
From `decision`: four short lists in a 2×2 (stacked on mobile):
- **Best for** (`best_for` — specialty display names)
- **Hire if** (`hire_if`)
- **Think twice if** (`caution_if`)
- **Look elsewhere if** (`avoid_if`)
Framed as advice ("If you're highly price-sensitive, get competing quotes first"), sourced 1:1 from the decision engine, no page-side invention. Section footer repeats provenance: "Advice derived from the review analysis above."

### 3.8 Facts panel (right rail on desktop / after ledger on mobile; H2 "Business facts")
Only rows with data render; no "Unknown" filler.
- Phone (tel:), Website (favicon-less plain link), Street address.
- Hours: full 7-day table inside `<details>`, summary shows today + open/closed state. `is24Hour` renders "Open 24 hours" prominently — labeled `per their Google listing` (it is self-reported/Google data, not our verification).
- Services: chips from `services[]` (linking to service pages where those exist in the new IA).
- License # / Insured / Years in business: render **only when the field is non-null**, each with a source qualifier ("per state license lookup" / "self-reported"). Never render an "Insured ✓" default.
- BBB row: rating, accreditation, complaints (3yr) when present, linking to `bbbUrl`.
- **Service area**: "Based in {city}. Plumbers typically serve a ~20-mile radius — that covers: {6 nearest city links} (+n more)". Plus a tiny inline SVG: dot + radius circle + labeled nearby-city dots (pure SVG, no map tiles, no LCP cost). Explicitly framed as an assumption: "typical service radius — call to confirm they cover you."
- **Data freshness stamp** at panel foot: `Business data from Google · pulled {scrapedAt}. Review analysis updated {last_scored_at}.`

### 3.9 Own this business? (H2) — correction/dispute affordance
A visually distinct (but not loud) panel:
- "Own {Name}? You can respond to our analysis, correct business facts, or dispute a quote's accuracy. Responses that check out are published on this page and factual errors are corrected."
- Two actions: `Respond or dispute →` (form: /for-plumbers/dispute?biz={slug}) and `Update business info →`.
- When the owner has responded, their response renders directly beneath the concern it addresses, labeled `Owner response · {date}` — this is both fair and immensely trust-building for readers.
This affordance is a legal risk reducer (demonstrates good-faith process), a data-quality channel, and the top of the monetization funnel (the dispute form is where plumbers first talk to us).

### 3.10 Compare & continue (H2) — internal linking block
- "All {k} plumbers we've reviewed in {City}, {ST} →" (city page — the money page).
- 2–3 alternative profile cards (same city, ranked adjacent): name, verdict chip, one-line summary. Honest directional links ("ranked #2", "ranked #4") — never "better/worse than" prose.
- Nearby city links (from the 20-mi set) — small, footer-adjacent.

### 3.11 Methodology footer
One paragraph, every profile, verbatim template: what we do (read + synthesize public reviews from Google/Yelp/BBB), what we don't do (no verification calls, no license checks unless stated, no pay-for-ranking), how paid placement works elsewhere on the site (link to /advertising-disclosure), links to /methodology and the dispute form. Plus `Last full analysis: {date}`.

---

## 4. Data-conditional rendering tiers

Not all 6,211 records can support the full page. Render tier is computed at build:

| Tier | Condition (approx counts) | Renders | Indexable? |
|---|---|---|---|
| **A — Full dossier** | synthesis + ≥1 evidence_quote + ≥1 concern-or-strength with citations (~5,700) | Everything above | **Yes** |
| **B — Synthesis only** | synthesis, no evidence quotes (~400) | Verdict + strengths/concerns WITHOUT chips; provenance line notes "quote evidence not yet published"; distribution from cached reviews if ≥10 | Yes if summary + ≥3 strengths/concerns; else noindex |
| **C — Facts only** | no synthesis (~60 + inactive) | Header, facts panel, "analysis in progress" note, city cross-links | **noindex,follow** — exists for users navigating from city pages, contributes nothing to the index |

Tier C is the doorway-page firewall: no thin profile ever enters the sitemap. Sitemap emits Tier A + qualifying Tier B only.

---

## 5. SEO surface

- **Title:** `{Name} Reviews — Our Take on {googleReviewCount} Reviews | {City}, {ST}` (≤60 chars variant for long names: `{Name} Reviews | {City}, {ST}`).
- **Meta description:** first 155 chars of `synthesis.summary` prefixed `Our take: ` — unique per page by construction, because the summary is unique per plumber. Never the templated fallback sentence the current page uses.
- **H structure:** H1 name → H2s: Our verdict · What reviewers praise · What reviewers report · The rating picture · The evidence · Should you hire {Name}? · Business facts · Own this business? · More plumbers in {City}. (H2s phrased as the questions searchers ask; they are the long-tail surface.)
- **Above the fold / LCP:** header + verdict banner are pure server-rendered text; no hero image, no web-font blocking (font-display: swap; serif is for the summary line only). Target LCP <1.2s on 4G. Sticky bar and disclosure widgets are the only client JS.
- **Structured data:** BreadcrumbList; `Plumber` entity (address, geo, telephone, url, openingHours) with `aggregateRating` sourced from Google's figures (as today — attributed to the business entity, not to us); our editorial `Review` with `positiveNotes`/`negativeNotes` and **no reviewRating** (keep the current correct decision — we don't emit our 0-100 as a star rating); NO fabricated review markup for quoted third-party reviews (Google forbids marking up reviews not shown-and-collected first-party; the quotes render as HTML only).
- **Canonical:** self. Legacy name-only slugs keep the existing 308 redirect behavior.
- **Internal links in:** city pages (ranked list), service pages (specialty mentions), blog rankings posts. **Out:** city page (primary), adjacent profiles, nearby cities, methodology. The profile is a leaf that pumps authority back to city pages.

---

## 6. Legal-safe framing — consolidated rules (enforced by component design)

1. Site-authored prose about a plumber appears ONLY inside components that render pipeline output (`summary`, strengths/weaknesses/redFlags text, decision lists) — all of which are validated against source reviews upstream (anti-hallucination checks in `validate-synthesis.js`). No page-side string construction of claims.
2. Every synthesized claim shows its evidence chip; chips resolve to verbatim, attributed quotes. A claim whose `supporting_review_ids` resolve to zero quotes renders with "citation unavailable" styling in dev and is dropped in prod.
3. Opinion markers ("our take", "our reading", "we'd") appear in the verdict banner, score disclosure, decision panel, and methodology footer — 4 independent placements.
4. Full rating picture always accompanies concerns (distribution + platform comparison + fairness counterweight) → the net impression of the page matches the net impression of the review corpus. This is the FTC deceptive-net-impression defense, and it cuts both ways: we also never show only the negatives.
5. Attribution is machine-populated (`author_name`, `published_at`, `source` are attached from cached reviews at aggregation time, never LLM-extracted) — hallucinated attribution is structurally impossible.
6. Dispute affordance on every profile; owner responses published inline.
7. No verification/testing/calling language anywhere. "Verified" appears on this page zero times.
8. Sponsored placement does not exist on profile pages at all (city pages only). The profile is never pay-influenced, and the methodology footer says so.

---

## 7. Component inventory (new build)

| Component | Props (core) | Notes |
|---|---|---|
| `ProfileHeader` | plumber | H1, status line, rating strip, CTA row |
| `RatingStrip` | google/yelp/bbb figures | reused on city-page cards |
| `VerdictBanner` | verdict, summary, provenance, score, dims, cityRank | LCP block; server-only |
| `ScoreBars` | scores | flags weakest dimension |
| `ClaimWithEvidence` | text, quotes[], defaultOpen? | strengths + concerns; `<details>` chip |
| `QuoteCard` | quote (verbatim, attribution, dimension) | the single quote renderer, clamp+expand |
| `RatingPicture` | sampleDist, platforms, timeline, discrepancy | 3 sub-panels; pure SVG/CSS bars |
| `DecisionGrid` | decision | 2×2 advice lists |
| `FactsPanel` | plumber | right rail; renders-only-what-exists |
| `ServiceAreaMini` | location, nearbyCities | inline SVG radius |
| `OwnerPanel` | slug, ownerResponses[] | dispute affordance + inline responses |
| `CompareStrip` | cityRank, neighbors[] | internal links |
| `MethodologyFooter` | dates | static template |
| `StickyCallBar` | phone, name, verdict | mobile only, appears after verdict scrolls out |

Legacy components retired: VerdictSeal, SignalRow, TrustScoreRing, DimensionBars (folded into ScoreBars), PlatformAgreementStrip (folded into RatingPicture), DecisionPanel (split into VerdictBanner + DecisionGrid), KPICard, SynthesisSection.

---

## 8. Open items for build

- Owner-response data model (`ownerResponses` subcollection: {concernId, text, submittedAt, status}) + moderation flow — new.
- True Google rating histogram via Outscraper on deep-pull cities → upgrades §3.5 label from "reviews we analyzed" to full distribution.
- Compute + persist `scores.overall` (currently derivable but null in most records) so the score chip doesn't need page-side math.
- Evidence-quote depth: current records cap at ~5 quotes (one per dimension). The concerns section wants the worst-quote-inline pattern — pipeline should attach 1 verbatim quote per weakness/redFlag, not just per dimension.
- Cached-review timestamps are inconsistent (`2026-03-06T…` vs `05/12/2026 15:20:39`) — normalize at export.
