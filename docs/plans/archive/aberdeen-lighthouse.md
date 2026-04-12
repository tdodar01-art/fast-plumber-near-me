> **ARCHIVED 2026-04-12:** Superseded by STRATEGY-BRIEF.md. Most fixes deferred; meta tag fix shipped in commit 708fde6.

# Aberdeen MD — Lighthouse City Diagnostic & Fix Plan

**Date:** 2026-04-12
**Goal:** Diagnose why Aberdeen gets 542 impressions and 0 clicks, then ship fixes that template across all 2,250+ city pages.

---

## 1. RANKING DIAGNOSTIC

### Our page: `/emergency-plumbers/maryland/aberdeen`

| Metric | Value |
|--------|-------|
| Title | `Emergency Plumbers in Aberdeen, MD — 24/7 Verified \| Fast Plumber Near Me` |
| Meta description | `Find verified 24/7 emergency plumbers in Aberdeen, MD. AI-verified for responsiveness. Burst pipes, water heaters, sewers & drains. Call now.` |
| H1 | `Emergency Plumbers in Aberdeen, MD` |
| H2s | 6: About Emergency Plumbing in Aberdeen, Common Plumbing Emergencies, FAQ, Nearby Cities, Plumbing Emergency Right Now?, Are You a Plumber? |
| H3s | 5: Burst/Frozen Pipes, Water Heater Failure, Sewer Backup, Clogged Drains, Gas Line Issues |
| Word count | ~2,200 |
| Plumber listings | 7 |
| Schema | BreadcrumbList, ItemList (7 plumbers), FAQPage (6 Qs), Review per plumber with positiveNotes/negativeNotes, Plumber type with geo + AggregateRating |
| Internal links out | ~50 (nav, 15+ nearby cities, 7 plumber profiles, footer) |
| Internal links in | State page, homepage, nearby city cross-links, sitemap |
| Images | Icons only (Lucide React components), no `<img>` tags with alt text |
| Local identifiers | City name, state, "Harford County" mentioned. No zip codes, no neighborhoods, no landmarks |
| FAQ | 6 questions covering cost, what-to-do, response time, DIY, 24/7 availability, common emergencies |

### Competitor #1: Roto-Rooter (`rotorooter.com/aberdeenmd/`)

| Metric | Value |
|--------|-------|
| Title | `Plumber Aberdeen MD \| Emergency Plumbing \| Roto-Rooter` |
| Word count | ~2,500 |
| Schema | LocalBusiness (implied), Organization |
| Local IDs | Minimal — no zip codes, no county, no landmarks |
| Trust signals | Franchise brand recognition, sticky phone CTA, live chat |
| Service content | Generic emergency plumbing — no pricing, no timing |
| Unique content | ~40% — mostly franchise template |
| Edge over us | Brand authority (domain authority ~70+), sticky conversion bar, live chat |
| We beat them on | Review depth, honest weakness display, schema richness, FAQ specificity |

### Competitor #2: Catons Plumbing (`callcatons.com/aberdeen-plumber/`)

| Metric | Value |
|--------|-------|
| Title | `Plumbers in Aberdeen, MD \| Catons Plumbing & Drain Service` |
| Word count | ~1,300 |
| Schema | BreadcrumbList, FAQPage (4 Qs), LocalBusiness |
| Local IDs | **Harford County, Susquehanna State Park, Mount Felix Vineyard** — landmarks we don't mention |
| Trust signals | "Trusted for Over 60 Years", BBB Accredited badge, 132 reviews, licensed plumbers |
| Service content | 18+ residential + 8 commercial service links, 30+ service area pages |
| Edge over us | Local landmark references, years-in-business credibility, extensive service taxonomy |
| We beat them on | Word count, FAQ depth, review synthesis quality, schema richness |

### Competitor #3: Benjamin Franklin Plumbing (`benjaminfranklinplumbing.com/harford-county/`)

| Metric | Value |
|--------|-------|
| Title | Harford County Plumbers (inferred) |
| Word count | ~4,000-6,000 |
| Schema | LocalBusiness, Organization |
| Local IDs | Harford County, zip code finder, interactive service area map |
| Trust signals | Forbes recognition badge, Google review integration, "Meet the Team" bios |
| Service content | Service carousel, interactive selector, expert tips blog |
| Edge over us | Massive content depth, team bios (E-E-A-T), interactive tools, blog integration |
| We beat them on | Schema richness, honest review presentation, mobile speed |

### 3 Biggest Ranking Gaps

1. **Local depth is thin.** Competitors mention landmarks (Susquehanna State Park), specific service areas, and county context. We only say "Harford County" once. No zip codes (21001, 21005, 21009), no neighborhoods (APG, Riverside, Perryman), no Aberdeen-specific plumbing context (military housing stock, well water issues, aging infrastructure).

2. **No real images.** Zero `<img>` tags means zero image alt text, zero image search presence, zero visual E-E-A-T signals. Competitors have team photos, service photos, badge images. Google increasingly values visual content for local queries.

3. **Content is 2,200 words but ~60% is templated.** The "About Emergency Plumbing in Aberdeen" and FAQ sections use the same patterns across all cities with only the city name swapped. Google's helpful content system detects this. Competitors with 1,300 words of *genuinely local* content may outrank us with 2,200 words of mostly-templated content.

---

## 2. CTR DIAGNOSTIC

### Current SERP snippet

```
Emergency Plumbers in Aberdeen, MD — 24/7 Verified | Fast Plumber Near Me
fastplumbernearme.com › emergency-plumbers › maryland › aberdeen
Find verified 24/7 emergency plumbers in Aberdeen, MD. AI-verified for 
responsiveness. Burst pipes, water heaters, sewers & drains. Call now.
```

| Element | Length | Truncation risk |
|---------|--------|-----------------|
| Title | 72 chars (including brand suffix) | Truncated — Google cuts at ~60 chars. Users likely see: `Emergency Plumbers in Aberdeen, MD — 24/7 V...` |
| Description | 144 chars | Fits within 155 limit |
| URL path | Clean, readable, contains "emergency-plumbers" + "maryland" + "aberdeen" |

### Query-snippet alignment

| Query cluster (by volume) | Impressions | Our avg position | Query terms in title? | Query terms in description? |
|---------------------------|-------------|------------------|-----------------------|-----------------------------|
| "emergency plumber near me" | 77 | 8.9 | "Emergency Plumber" yes | "emergency plumbers" yes |
| "24 hour plumbers near me" | 35 | 6.7 | "24/7" partial match | "24/7" partial match |
| "same day plumber near me" | 32 | 7.1 | No "same day" | No "same day" |
| "24 7 plumber near me" | 29 | 7.1 | "24/7" yes | "24/7" yes |
| "emergency plumbing services near me" | 21 | 14.1 | No "services" | No "services" |
| "emergency plumber" | 71 | 7.8 | Yes | Yes |
| "same day plumber" | 19 | 12.1 | No "same day" | No "same day" |

### Why users skip our result

1. **"24/7 Verified" means nothing to them.** Roto-Rooter's snippet says "no extra charge on nights/weekends, arrive within 2 hours." That's a concrete promise. Ours is vague jargon.

2. **No social proof in the snippet.** "17 plumbers rated 4.7-5.0 stars from 26,000+ reviews" would be compelling. We show none of this.

3. **"AI-verified for responsiveness" is a red flag, not a trust signal.** To a homeowner with a burst pipe, "AI-verified" sounds like robot reviews, not human validation. Competitors say "Trusted for 60 years" or "BBB Accredited."

4. **No urgency hook.** "Call now" is generic. Competitors promise specific response times ("arrive within 2 hours", "within 30 minutes"). We don't commit to anything.

5. **"Fast Plumber Near Me" brand suffix wastes title space.** It's an unknown brand consuming 22 characters. Nobody searches for us by name yet.

---

## 3. ON-PAGE CONVERSION DIAGNOSTIC

### Above the fold (first viewport)

- Breadcrumb: Home > Emergency Plumbers > Maryland > Aberdeen
- H1: "Emergency Plumbers in Aberdeen, MD"
- Subheading: "Verified 24/7 plumbers ready to help right now"
- Badges: County name, plumber count
- Sort/filter bar: Best Match, Fastest, Top Rated, Best Price
- First plumber card begins (Len The Plumber)

**Verdict:** Decent but not great. The hero doesn't have a clear "here's the #1 pick, call them now" CTA. A user in crisis has to scan and decide. The sort bar adds cognitive load when they need simplicity.

### Trust signals present vs absent

| Signal | Present? | Notes |
|--------|----------|-------|
| Google ratings per plumber | Yes | 4.7-5.0 stars shown |
| Review counts | Yes | 52-16,513 |
| Reliability scores | Yes | 78-92/100 |
| 24/7 badges | Yes | On select listings |
| Distance indicators | Yes | "5 mi away", "11 mi away" |
| Review synthesis (strengths) | Yes | Per-plumber |
| Review synthesis (weaknesses) | Yes | Per-plumber |
| "Last updated" timestamp | **No** | Page has no freshness signal |
| Decision engine verdicts | **No** | Not yet wired to city pages |
| Local zip codes | **No** | |
| Aberdeen landmarks/references | **No** | |
| BBB data display | **Partial** | Available in Firestore but not shown on city page cards |
| Plumber count in hero | Yes | But not prominent |
| "Based on X reviews" aggregate | **No** | No aggregate stat across all plumbers |

### Friction analysis

| Action | Clicks/scrolls required |
|--------|------------------------|
| See first plumber | 0 (above fold) |
| Call first plumber | 1 tap (tel: linked) |
| See concerns about first plumber | 0 (visible on card) |
| Compare 3 plumbers | 1-2 scrolls |
| Call any plumber | 1 tap per card |
| Filter by "fastest" | 1 tap |
| See full plumber profile | 1 tap (card is clickable) |
| **Sticky mobile CTA** | **Not on city page** — only on plumber profile page |

**Key friction:** No sticky bottom CTA on the city page. On mobile, once a user scrolls past the first card, they lose the phone number. Plumber profile pages have `StickyBottomBar.tsx` but the city page doesn't.

---

## 4. MONETIZATION READINESS

### Where paid placement fits

1. **Top-of-list "Sponsored" slot** — above the organic sort, clearly labeled. Lowest UX risk. The `listingTier` field (featured/premium/free) already exists in the data model but has no visual treatment on city pages today.

2. **Inline between position 3 and 4** — "Promoted Result" card with distinct background. Higher visibility but risks user trust if not clearly labeled.

3. **Sidebar (desktop only)** — "Featured Plumber" with larger card. Currently no sidebar exists; page is single-column. Would require layout change.

**Recommendation:** Slot #1 (top-of-list sponsored) is the lowest-effort, highest-trust approach. The `listingTier` sort priority already pushes "featured" plumbers to the top — we just need a visual badge and a monetization flow.

### Data we already capture

| Data point | Tracked? | Storage |
|------------|----------|---------|
| Phone click (tel:) per plumber | **Yes** | `leads` collection in Firestore, with plumberId, city, timestamp |
| Card impressions (time-on-card) | **Yes** | `plumberEngagement` collection (5s/15s/30s thresholds via IntersectionObserver) |
| Quick-bounce on profile page | **Yes** | `plumberEngagement` via sendBeacon |
| Website outbound clicks | **No** | `href={plumber.website} target="_blank"` with no tracking |
| Sort mode used | **No** | Client-side only |
| Which plumbers a user compared | **No** | No session tracking |

### Website click tracking gap

The `PlumberCard.tsx:369-370` has a plain `<a href={plumber.website} target="_blank">` with no click tracking. This is a monetization-critical gap — plumber website clicks are valuable lead data. Fix: add a tracking call (same pattern as `handleCallClick`) before navigating.

---

## 5. PROPOSED FIXES (prioritized)

### Tier 1: High Impact × Low Effort (ship this week)

| # | Fix | Scope | Impact | Effort | Needs decision engine? |
|---|-----|-------|--------|--------|----------------------|
| 1 | **New title template:** `{count} Emergency Plumbers in {city}, {state} — Rated & Reviewed ({year})` | All cities | High (CTR) | Low | No |
| 2 | **New description template:** `Compare {count} emergency plumbers in {city}, {state} with real reviews, honest strengths & red flags. See who's available 24/7 and who to avoid.` | All cities | High (CTR) | Low | No |
| 3 | **Add sticky bottom CTA on city pages** (reuse `StickyBottomBar.tsx` pattern) showing top-rated plumber's phone | All cities | High (conversion) | Low | No |
| 4 | **Track website outbound clicks** — add `handleWebsiteClick()` to PlumberCard mirroring `handleCallClick()` | All cities | High (monetization data) | Low | No |
| 5 | **Surface `sampleSizeWarning`** on plumber cards when coverage < 5% of total reviews | All cities | Med (trust) | Low | No |

### Tier 2: High Impact × Medium Effort (ship within 2 weeks)

| # | Fix | Scope | Impact | Effort | Needs decision engine? |
|---|-----|-------|--------|--------|----------------------|
| 6 | **Hero "Top 3 Picks" section** — show top 3 plumbers by verdict/score with 1-line summary + call CTA before the full list | All cities | High (conversion) | Med | **Yes** — needs verdict data |
| 7 | **Add "last updated" date** visible on page (from latest plumber refresh timestamp) | All cities | Med (freshness signal for both users and Google) | Low | No |
| 8 | **Local content depth for Tier 1 cities** — zip codes, neighborhoods, housing stock, local plumbing issues | Aberdeen + top 10 | High (ranking) | Med | No |
| 9 | **Add aggregate trust bar** in hero: "{count} plumbers, {totalReviews} reviews analyzed, avg {avgRating} stars" | All cities | Med (CTR + trust) | Low | No |
| 10 | **Decision engine verdict badges on city page cards** — "Strong Hire", "Caution", etc. with color coding | All cities | High (conversion + differentiation) | Med | **Yes** |

### Tier 3: Medium Impact × Higher Effort (month 2)

| # | Fix | Scope | Impact | Effort | Needs decision engine? |
|---|-----|-------|--------|--------|----------------------|
| 11 | **Service-specific sub-sections** — water heater, drain, sewer, emergency with per-service plumber rankings | Aberdeen first | Med (ranking for service queries) | High | **Yes** — needs specialty_strength |
| 12 | **Local resources section** — county inspector, water utility, permit office contacts | Tier 1 cities | Med (E-E-A-T) | Med | No |
| 13 | **Real images** — plumber logos, service area map, or stock photos with proper alt text | All cities | Med (ranking + image search) | Med | No |
| 14 | **Paid placement UX** — "Sponsored" badge on featured-tier cards, distinct visual treatment | All cities | High (monetization) | Med | No |

### Aberdeen-only vs template-able

- Fixes 1-7, 9-10, 13-14 are **templated across all cities** — no Aberdeen-specific work needed.
- Fix 8 (local content depth) starts as **Aberdeen-only** and defines the template for Tier 1 cities.
- Fix 11-12 start as **Aberdeen-only** prototypes before scaling.

---

## 6. SUCCESS METRICS

### 30-day targets (after shipping Tier 1 fixes)

| Metric | Current | Target | How measured |
|--------|---------|--------|-------------|
| Aberdeen CTR | 0% (0 clicks / 542 impressions) | >1% (5+ clicks) | GSC |
| Aberdeen avg position for "emergency plumber" | 7.8 | <7.0 | GSC |
| Aberdeen avg position for branded queries ("aberdeen plumber") | 51.8 | <30 | GSC |
| Outbound website clicks tracked | 0 (not tracked) | Tracking live | Firestore `leads` collection |

### 60-day targets (after Tier 2 fixes + local content)

| Metric | Target | How measured |
|--------|--------|-------------|
| Aberdeen CTR | >2.5% | GSC |
| Aberdeen clicks/month | 15+ | GSC |
| Aberdeen position for "emergency plumber near me" | <6.0 | GSC |
| Top 10 cities combined CTR | >1% | GSC aggregate |
| Phone leads tracked per week (all cities) | 10+ | Firestore `leads` count |
| Website clicks tracked per week | Baseline established | Firestore |

### 90-day targets (Tier 1 template rolled out to 10 cities)

| Metric | Target | How measured |
|--------|--------|-------------|
| Total monthly clicks (all cities) | 50+ | GSC |
| Cities with >0 clicks | 5+ | GSC |
| Phone leads per month | 40+ | Firestore |
| First monetization conversation | 1 plumber paying | Manual outreach |
| Pages with decision engine data | 50+ cities | Firestore query |

### Measurement plan

- **Rankings/CTR:** GSC API pull already automated in `gsc-pull-test.js`. Add a weekly snapshot script that saves city-level GSC data to Firestore for trend tracking.
- **On-page conversion:** Phone clicks already tracked in `leads` collection. Add website click tracking (fix #4). Add sort-mode tracking to `plumberEngagement`.
- **Content quality:** Monitor for "thin content" signals — if a city page drops in ranking after a template change, check if Google is penalizing templated content.
