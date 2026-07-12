# fastplumbernearme.com — Visual System & Core Directory Pages (Ground-Up Rebuild)

**Author:** design pass, 2026-07-11
**Companion mockups (the proof):** `mock-homepage.html`, `mock-city-page.html` (same directory — fully self-contained, real data for Elgin, IL drawn from the live Firestore export)

---

## 0. Design thesis

The old site was styled like every lead-gen directory: gradient hero, pulsing red CTA, trophy icons, "AI-Verified" badges (false), urgency copy. That aesthetic is *precisely* what Google's spam classifiers and skeptical users pattern-match against.

The rebuild's product truth is: **we read the reviews — including the ones other directories bury — and we tell you what we'd do.** The visual system that matches that truth is not an app and not a lead-gen page; it's a **field report**. Print-like, hairline-ruled, evidence-dense, with an authored editorial voice set in serif. Think Consumer Reports / Wirecutter review desk, compressed for a person standing in two inches of water.

Every visual decision below derives from three rules:

1. **Evidence over ornament.** If an element isn't data (a count, a quote, a distribution) or a judgment we can defend in writing, it doesn't render. No seals, no trophies, no shields, no fake badges.
2. **The negative is the brand.** Concerns, red flags, and 1-star quotes are first-class content with equal typographic dignity to strengths — this is our only real moat and the page must *look* like it.
3. **Call-first under stress.** 80%+ of traffic is mobile and often in an emergency. One thumb, one decision, one tap-to-call per card. Nothing blinks, pulses, or counts down.

---

## 1. Design system

### 1.1 Light vs dark — decision: light, paper-white

- Emergency use happens in bright kitchens, flooded basements with work lights, and outdoors — a light UI holds up in all ambient conditions; dark UIs die in glare.
- White + hairlines + serif reads *editorial/consumer-advocate*; dark reads *tool/startup* and undermines the honest-broker posture.
- Light pages screenshot and share better (SERP thumbnails, GBP posts, texts to a spouse: "call this one").
- Dark mode is a later `prefers-color-scheme` enhancement, not part of v1. Do not ship a half-tested dark theme on the money page.

### 1.2 Color palette

Semantics are strictly reserved: **green/amber/red belong to editorial judgment only.** The call-to-action never uses red (no fake urgency) and never uses green (would leak "endorsed" semantics into a button). Action = blue.

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#17293E` | Primary text, wordmark. Near-navy, warmer than black |
| `--ink-2` | `#47586C` | Secondary text, labels |
| `--ink-3` | `#7A899B` | Tertiary/meta text, attributions |
| `--paper` | `#FFFFFF` | Page background |
| `--surface` | `#F4F6F8` | Section tint, rating-bar troughs, chips |
| `--line` | `#E2E8EE` | Hairlines, card borders (1px, never heavier) |
| `--action` | `#1656C4` | Links, Call button fill, focus rings |
| `--action-deep` | `#0F418F` | Hover/active |
| `--good` / `--good-bg` / `--good-line` | `#157A4A` / `#EBF6F0` / `#BFDECC` | Strengths, positive quotes, "Top pick" tier |
| `--warn` / `--warn-bg` / `--warn-line` | `#8A5A00` / `#FBF3DF` / `#EAD9AE` | Concerns, "with caveats" tier |
| `--bad` / `--bad-bg` / `--bad-line` | `#B0301F` / `#FBEEEC` / `#EBC2BB` | Red flags, negative quotes, "We'd keep looking" tier |
| `--star` | `#E8A33D` | Star glyphs only. Never used for sponsorship or rank |
| `--spon` / `--spon-bg` | `#47586C` / `#EEF1F4` | Sponsored labeling — deliberately **neutral slate, not gold**. Paid ≠ premium-looking award |

Contrast: all text tokens ≥ 4.5:1 on their backgrounds (verified pairs above). Judgment colors are always paired with an icon + text label — never color alone (WCAG 1.4.1).

### 1.3 Typography

**No webfonts.** Zero render-blocking font requests on an emergency page; system stacks are instant and native-feeling.

- **UI/body sans:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Editorial serif:** `Georgia, "Iowan Old Style", "Times New Roman", serif` — used *only* for authored judgment: the page dek ("what we did") and each card's "Our take." The serif is the typographic signature of "a human-readable opinion lives here"; everything set in sans is data.

Scale (px, mobile → desktop where different):

| Token | Size / line | Use |
|---|---|---|
| `display` | 30/1.15 → 38/1.1, -0.5px tracking, 800 | Homepage H1 |
| `h1` | 26/1.2 → 32/1.15, 800 | City page H1 |
| `h2` | 21/1.25, 700 | Section heads, tier headers |
| `h3` | 18/1.3, 700 | Business names |
| `lead` (serif) | 17/1.55 → 18/1.6 | Dek, "Our take" |
| `body` | 15/1.55 → 16/1.6 | Default |
| `meta` | 13/1.45 | Counts, attributions, distances |
| `caption` | 12/1.4, 600, +0.4px, uppercase | Labels: STRENGTHS, CONCERNS, SPONSORED |

Numbers (ratings, counts, distances) use `font-variant-numeric: tabular-nums`.

### 1.4 Spacing, radii, elevation

- **4px base grid.** Card padding 16 (mobile) / 20–24 (desktop). Between cards: 16/20. Section rhythm: 48/64. Content column max-width **760px** — the list is single-column at every breakpoint; comparison is vertical, like an article, not a grid of tiles.
- **Radii:** 6px (chips, buttons, quote blocks), 12px (cards). Nothing pill-shaped except tiny status chips (999px).
- **Elevation:** borders-first. Cards are `1px solid var(--line)` with **no resting shadow** (print-like). Two shadow tiers only: `--shadow-hover: 0 2px 8px rgba(23,41,62,.08)` (card hover, desktop) and `--shadow-float: 0 -4px 16px rgba(23,41,62,.12)` (sticky elements, popovers). Judgment tiers get a 3px left rule on the card (`--good`/`--warn`/`--bad`) instead of tinted backgrounds — flags without shouting.

### 1.5 Iconography

- Inline SVG, `stroke-width: 1.75`, 16px in meta / 20px in buttons, `currentColor`.
- **Allowed set (functional only):** phone, map-pin, clock, star, magnifier, crosshair (geolocate), check-circle (strength bullet), alert-triangle (concern), alert-octagon (red flag), chevron, external-link, quote-mark.
- **Banned:** trophies, medals, podiums, ribbons, shields, seals, checkmark-in-badge — anything that fabricates institutional authority. (The current PODIUM_ICONS and VerdictSeal are removed.)
- Stars render as filled glyphs in `--star` for the Google rating only; our own judgment never renders as stars (avoids misattributing our opinion as an aggregate rating — matches the JSON-LD rule already in the codebase).

---

## 2. Homepage

### 2.1 The 5-second job

A user with a burst pipe needs exactly one thing in 5 seconds: **the list for their town.** Everything else on the homepage exists for the researcher (the 20% who compare) and for Google. Order of the page = order of user urgency.

1. **Header** (56px): wordmark ("FastPlumber *near me*" — wordmark only, no logo mark needed), links: *How we rank* · *For plumbers*. No nav bloat.
2. **Hero = the search.** H1: **"Find a plumber who'll actually show up."** Serif sub-line states the honest-broker promise in one sentence: *"We read the reviews — including the ones other sites bury — and rank plumbers like a friend who's done the research. Rankings are never for sale."* Then a single oversized search field (city or ZIP, autocomplete → city page) + **Use my location** secondary button (geolocates → nearest covered city page). That's the whole hero. No gradient, no stock photo of a smiling technician, no phone-number bait.
3. **Proof strip** (real, computed numbers only): "6,211 plumbers reviewed · 9,708 cities & towns covered · 0 rankings sold." Each number is derived from the dataset at build time; if we can't compute it, we don't show it.
4. **"What you actually get" — a real card.** The single most persuasive element: an *actual* rendered plumber card (S and J Plumbing, real synthesis, real 1-star quote) with three annotation callouts: "the concerns other directories hide," "verbatim quotes, attributed," "the rating mix, not just the average." Show, don't claim.
5. **The three commitments** (manifesto, 3 short blocks): **We show you the bad reviews** / **Rankings are not for sale** (paid placement exists, it's always labeled, and it never changes the ranking) / **Every quote is verbatim and attributed.** This section replaces — and repudiates — the old "We Actually Call Them" section. **No verification-call claims anywhere.**
6. **Find your city:** state-grouped popular-cities grid (real counts per city: "Elgin, IL — 14 reviewed"), + full A–Z state index link.
7. **For plumbers band:** "You can pay to be seen. You can't pay to be trusted." → /for-plumbers.
8. **Footer:** methodology, about, contact, terms, privacy, "How we make money" (plain-language disclosure page).

### 2.2 What is deliberately absent

- No "24/7 EMERGENCY" flashing strip, no countdowns, no "3 people are viewing" — fake urgency destroys the one asset we have.
- No AI-verification/answer-rate claims (false), no "Licensed & Insured" blanket badge (unverifiable at directory level), no aggregate star self-award.
- No 44k-link footer. Homepage links only to real hub pages.

---

## 3. City page — the money page

Mock: `mock-city-page.html` (Elgin, IL — every business, rating, count, synthesis line, and quote is real data from the export).

### 3.1 Page anatomy (top → bottom)

1. **Breadcrumb** (IL → Elgin) + **H1:** "The 14 emergency plumbers serving Elgin, ranked." The count is the real rendered count; "ranked" asserts the editorial act.
2. **The methods byline** — the credibility device, styled like a report header (serif dek):
   *"We read 447 reviews across Google, Yelp and BBB for the plumbers serving Elgin — including every 1-star review — and ranked them the way we'd rank them for a friend. 4 answer 24/7. Rankings are not for sale."*
   Followed by meta row: `Updated Jun 15, 2026 · 20-mile radius of downtown Elgin · How we rank ↓`. Every number is computed (sum of `review_count_used`, count of `is24Hour`, `last_scored_at` max).
3. **Emergency triage strip:** one quiet row, not a siren: "**Water everywhere right now?** Skip to the 24/7 plumbers ↓ — and shut off your main valve first." Anchor-jumps to first 24/7-flagged card. This serves the burst-pipe user without a fake-urgency banner.
4. **Sponsored slot (top-1)** — see 3.3.
5. **Ranked list in tiers** — see 3.2 / 3.4.
6. **Unranked listings** ("Not enough reviews to rank") — see 3.6.
7. **Methodology block** (full text of "How we rank," same content the affordance opens) + the verbatim-quote disclosure line.
8. **Nearby covered cities** (real counts), footer.

Killed from the old template: token-swap "About Emergency Plumbing in {city}" essay, generic "Common Plumbing Emergencies" 5-pack, templated FAQ accordion. The unique content of this page **is the synthesis**; boilerplate around it is the doorway-page signal we're deleting. (Data-driven FAQ can return later only if every answer is computed from page-local data.)

### 3.2 The plumber card — review-synthesis presentation (THE core component)

Card structure, top to bottom (every element maps to a field we actually have):

| Zone | Content | Source / rule |
|---|---|---|
| **A. Identity row** | Rank numeral (plain square, tabular) · Business name (h3) · verdict chip | `city_rank`, `decision.verdict` |
| **B. Fact row** | ★4.9 **(4,190 Google reviews)** · 16.2 mi from downtown Elgin · `Open 24/7` chip | `googleRating/-Count` (always attributed to Google), haversine vs city center, `is24Hour` from hours data. Yelp rating appears here when present |
| **C. Our take** (serif) | 1–2 sentence authored judgment, e.g. *"The strongest all-rounder within 20 miles — but two reviewers describe surprise fees, so get the number in writing before work starts."* Label: "OUR TAKE" caption + `?` link to methodology | Written from `synthesis.summary`; framed as opinion; every factual clause must be traceable to a quoted/cited review (legal guardrail) |
| **D. Rating mix** | 5 horizontal bars with counts, labeled **"Rating mix — of the 100 reviews we analyzed"** + link "All 4,190 on Google →" | Computed over the cached/analyzed review set only. We never render Google's full histogram (we don't have it) or imply we do. This satisfies the FTC net-impression requirement: the negative mass is visible on every card |
| **E. Evidence columns** | **STRENGTHS** (max 3, check icon, each with its count: "workmanship cited in 33 of 100 reviews") and **CONCERNS** (amber triangle; red-flag items get red octagon and sort first). **If red flags exist, the concerns column renders before/left of strengths** — concern-forward is the honesty signal | `synthesis.strengths/weaknesses/redFlags` (cited form). Counts come from the synthesis's own theme counts — defensible numbers, not invented |
| **F. Quote pair** | One positive + one negative **verbatim** quote, each in a tinted figure block with star-rating of that review + attribution "K B · ★1 · Google · Jun 2026". Negative quote is **never optional when one exists**. If zero negative reviews exist in the analyzed set, render the honest absence: *"No critical reviews in the 33 we analyzed."* | `evidence_quotes` (attributed, Section 230-protected republication). Selection: most recent ≥4★ and most recent ≤2★ |
| **G. Provenance line** | "We read 100 of 4,190 reviews · newest from Jun 2026" | `review_count_used`, max `published_at`. This is the recency cue — honest ("newest review analyzed"), never "verified on {date}" |
| **H. Action row** | **Call (630) 429-8704** — full-width blue button on mobile, 52px tall, `tel:` · "Full report →" (profile page) · website (plain text link; `rel="sponsored"` when in paid slot) | phone; profile slug |

Notes:
- The card is **not** click-anywhere-navigates (old behavior). In an emergency, accidental navigation between thumb and call button is a real cost. Only the name and "Full report" navigate; Call is the only filled button.
- No dimension-score bars (reliability 88, etc.) on the card. Those 0–100s are model outputs we can't defend as displayed metrics; their *content* surfaces as counted themes and quotes instead. (They keep working internally as the ranking input.)
- Tinted quote blocks use `--good-bg`/`--bad-bg`; synthesis bullets sit on white — quotes are *theirs* (tinted = sourced material), bullets are *ours*.

### 3.3 The sponsored slot (top-1) — clearly labeled, still premium, FTC-clean

Design goal: a sponsor gets **position and polish**, never borrowed authority.

- Sits above the ranked list in its own bordered container with a **slate (not gold) header strip**: caption `SPONSORED` + inline plain-language disclosure: *"Advantage Plumbing paid for this placement. The ranking below is not for sale, and this review summary is the same one we'd publish if they hadn't paid."* A "What's this?" link goes to the money-disclosure page.
- The card inside is the **identical component with identical honesty** — same rating mix, same concerns column (the sponsor's pricing complaints stay visible), same negative quote. You pay to be *seen*, not to be *sanitized*. This is both the FTC posture and the sales pitch to plumbers ("our credibility is why the slot is worth buying").
- No rank numeral (it is outside the ranking), no verdict-tier left rule; instead a neutral slate left rule. Verdict chip still renders (it's earned, not bought) — but eligibility is gated: `SPONSORED_QUALITY_THRESHOLD = 65` and never `verdict === "avoid"`.
- Outbound links: visible label + `rel="sponsored"` (already the code's behavior — keep).
- Empty behavior: when no sponsor, slot renders nothing (no "advertise here" placeholder on the money page; the sales pitch lives at /for-plumbers).

### 3.4 Ranking presentation — "we made a judgment," nothing fabricated

- **Editorial rank numerals** (1, 2, 3…) in plain squares — an author's ordering, not a scoreboard. No trophies/medals/podiums.
- **Tier headers group the list**, mapped 1:1 to the decision engine's defensible verdicts:
  - **Our top picks** (`strong_hire`) — green micro-rule
  - **Worth a look — with caveats** (`conditional_hire` / `caution`) — amber micro-rule
  - **We'd keep looking** (`avoid`) — red micro-rule. **These stay on the page**, ranked last, with full synthesis. Showing who we *wouldn't* hire is the most credible thing on the page and no competitor dares render it.
- Each tier header carries a one-line reason template driven by data ("Consistent evidence of showing up, fair pricing, and work that lasts").
- **"Why we ranked these" affordance:** a `<details>` disclosure directly under the byline ("How we rank — 60-second version") + a full block at list end. Content (plain language): what we read (counts, sources), what moves a plumber up (consistent multi-review evidence on reliability/pricing/workmanship/responsiveness), what moves them down (repeated complaint patterns, cross-platform disagreement), what never moves them (money — paid placement is labeled and separate), and what we are (an opinion service: "our take is our opinion, grounded in the quotes we show you"). No formulas, no weights, no 0–100 scores promised.

### 3.5 What communicates judgment visually

Serif "Our take" + rank numerals + tier language ("we'd keep looking") + first-person methodology = an *author*. Everything countable is attributed (Google's stars labeled Google's, our counts labeled "of the N we analyzed"). The design never renders a number we generated as if a third party measured it.

### 3.6 Empty & thin states

- **Unranked section** (plumber has <10 analyzed reviews or no synthesis): compact one-line rows under header **"Also serving Elgin — not enough reviews for us to rank"**: name, ★rating *(n reviews — attributed)*, distance, call link. No fake synthesis, no invented judgment. Explicit copy: *"We don't rank a plumber until we've read enough reviews to have an opinion."*
- **Thin city (<5 plumbers in 20 mi):** page renders headline "We haven't finished reviewing {city} yet," an honest explainer, the N real listings we do have in unranked format, and links to the nearest **covered** cities with real counts ("Rockford — 22 reviewed, 24 mi away"). `noindex,follow` (keeps the June-2026 doorway footprint dead). No "coming soon" fake listings.
- **Zero-plumber city:** same shell, no listings, nearest-covered-cities module only, `noindex`.
- **No-negative-quote state:** render the absence honestly (see 3.2 F) — an all-5-star mix with "no critical reviews found in the N we analyzed" is itself information (and a subtle small-sample caveat when N is low: "only 5 of 22,975 reviews analyzed so far — treat this as a first read").

### 3.7 URL note (for the IA workstream)

This design assumes one canonical indexable city page per covered city (`/plumbers/il/elgin` or the retained `/emergency-plumbers/il/elgin`) that carries the full synthesis payload. Service-intent variants should be filters/anchors on this page, not separate indexable token-swap URLs.

---

## 4. Responsive behavior — call-first mobile

- **Mobile-first CSS**; single breakpoint at 720px (layout) + minor one at 1024px (spacing). The list is one column everywhere — no card grids.
- **Tap targets:** Call button 52px min-height, full-width on mobile, real `tel:`. All other interactive elements ≥44px. Quote blocks and bars are non-interactive (no tooltip-only content on mobile — attributions are always visible text).
- **Quote pair:** stacked on mobile (negative directly below positive), 2-col ≥720px. Strengths/concerns: stacked mobile, 2-col desktop; when red flags exist, concerns render first in both layouts.
- **Rating mix** stays visible on mobile (legal + trust) but compresses: 6px bars, counts right-aligned; ~92px total height.
- **Sticky mobile footer bar** appears only after the user scrolls past the first ranked card: `☎ Call {current top pick} · #1 our pick` — contextual to the *ranked #1* (never the sponsor; a sticky sponsored call would be an undisclosed ad impression). Dismissible; hidden ≥720px; safe-area padded (`env(safe-area-inset-bottom)`).
- **Performance budget:** zero webfonts, zero JS required for first render (details/summary for disclosures; sticky bar is the only scripted element and is progressive enhancement), inline SVG only, no images above the fold anywhere on the site. Target: LCP = H1 text paint.
- Triage strip and tier headers use anchors — deep links like `#open-24-7` work in shared texts.

---

## 5. Component inventory (rebuild targets)

| Component | Replaces | Notes |
|---|---|---|
| `ReportHeader` (H1 + serif byline + meta) | hero section | all numbers computed |
| `TriageStrip` | emergency CTA banner | anchor jump, no urgency theatre |
| `SponsoredSlot` | sponsored PlumberCard wrapper | slate treatment, disclosure copy, gating |
| `RankTier` | Top-3 podium section | tier header + grouped cards |
| `PlumberReportCard` | PlumberCard | zones A–H above |
| `RatingMix` | (new) | analyzed-set distribution, labeled |
| `EvidenceList` | StrengthsVsConcerns | counted claims, concern-forward rule |
| `QuotePair` | evidence excerpt figures | verbatim + attribution + review-star |
| `UnrankedRow` | thin PlumberCard | one-liner, no judgment |
| `Methodology` | how-we-verify page content | **rewrite: all verification-call claims deleted site-wide** (page copy, privacy policy, badges) |
| `StickyCallBar` | (new) | ranked-#1 only, mobile only |

Deleted: `VerdictSeal`, `PODIUM_ICONS`, `ReliabilityBadge`, `VerifiedBadge`, `DimensionBars` (public UI), pulse animation, red accent system.

---

## 6. Data contract per rendered card (what the page must be able to compute)

Required to rank: `googleRating`, `googleReviewCount`, `review_count_used ≥ 10`, `synthesis.summary`, ≥1 strength with count, `evidence_quotes` with ≥1 attributed quote, `decision.verdict`, coordinates (distance), max `published_at`. Missing any → UnrankedRow. `is24Hour` chip only from hours data (`Open 24 hours`), never from the business name. Rating-mix counts computed from the analyzed review set; if the analyzed set < 10, the mix renders with the small-sample caveat line.
