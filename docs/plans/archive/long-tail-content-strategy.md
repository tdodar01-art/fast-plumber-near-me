> **ARCHIVED 2026-04-12:** Superseded by STRATEGY-BRIEF.md. Content folded into strategy brief; implementation in progress.

# Long-Tail Content Strategy — Three Parallel Tracks

**Date:** 2026-04-12
**Status:** Plan for review — no code changes until approved
**Goal hierarchy:** Ranking surface area > Traffic volume > Backlinks > Conversion > Monetization

---

## 1. QUERY LANDSCAPE & OPPORTUNITY SIZING

### Current GSC performance (90 days, all pages)

| Metric | Value |
|--------|-------|
| Total queries with impressions | 313 |
| Total impressions | 3,587 |
| Total clicks | 2 |
| Overall CTR | 0.06% |
| Pages with impressions | 45 city pages |

### Impressions by intent cluster

| Cluster | Impressions | Avg Position | % of Total | Current coverage |
|---------|-------------|-------------|-----------|------------------|
| Emergency broad | ~1,400 | 10.5 | 39% | General city pages (Track C) |
| Generic "plumber near me" | ~900 | 11.8 | 25% | General city pages |
| 24-hour / same-day | ~700 | 11.0 | 20% | General city pages (partial) |
| Drain / sewer / rooter | ~150 | 13.0 | 4% | **No dedicated pages** |
| Water heater | ~140 | 16.5 | 4% | **No dedicated pages** |
| Local branded ("[city] plumber") | ~200 | 65.0 | 6% | City pages (ranking poorly) |
| Gas / heating | ~35 | 15.0 | 1% | **No dedicated pages** |
| Pipe / burst / leak | ~15 | 60.0 | <1% | **No dedicated pages** |
| Toilet / fixture | ~6 | 58.0 | <1% | **No dedicated pages** |

### Near-misses: queries with impressions but position 15-40

These are queries where Google considers us relevant but we're not ranking well enough to get clicks. A dedicated page targeting each cluster could close the gap.

| Query | Impressions | Position | Fix |
|-------|-------------|----------|-----|
| emergency plumbing services | 111 | 15.4 | Track C meta optimization |
| same day plumber | 81 | 12.6 | Track C — add "same day" language |
| emergency plumbing services near me | 83 | 14.5 | Track C meta |
| emergency drain service | 37 | 11.6 | **Track A: drain service pages** |
| plumbing repair near me | 28 | 18.7 | Track C content depth |
| water heater repair near me | 19 | 16.2 | **Track A: water heater pages** |
| sewer line repair near me | 9 | 21.3 | **Track A: sewer pages** |
| drain cleaning service near me | 8 | 21.0 | **Track A: drain pages** |
| water heater plumber near me | 8 | 15.8 | **Track A: water heater pages** |
| tankless water heater service near me | 7 | 38.1 | **Track A: water heater pages** |
| gas water heater repair near me | 6 | 20.8 | **Track A: water heater pages** |

### Queries we're NOT getting impressions for yet (gap analysis)

These are high-volume national queries where we have zero impressions. Dedicated service pages could enter this space.

| Service query pattern | National monthly volume | Our impressions | Gap |
|----------------------|------------------------|-----------------|-----|
| "drain cleaning near me" | 110,000 | 6 | Massive — we barely register |
| "water heater replacement near me" | ~50,000 (estimated) | 0 | Total gap |
| "clogged drain service" | 49,500 | 0 | Total gap |
| "sewer line repair" | 90,500 | 9 | Entering but weak |
| "emergency plumber" | 165,000 | 367 | 0.2% capture — room to grow |
| "burst pipe repair" | 3,600 | 2 | Nearly zero |
| "drain cleaning services" | 12,100 | 2 | Nearly zero |
| "emergency drain cleaning" | 2,900 | 1 | Nearly zero |
| "leak detection" | 22,200 | 4 | Nearly zero |
| "garbage disposal repair" | 22,200 | 0 | Total gap |
| "sump pump repair" (est.) | ~8,000 | 0 | Total gap |

**Addressable opportunity:** Service-specific queries represent ~500K+ monthly national search volume. Even capturing 0.1% = 500 monthly visits. Current city pages will never rank for "drain cleaning near me" because the title says "Emergency Plumbers" — intent mismatch.

### Service priority by search volume × data readiness

| Priority | Service | National monthly volume | Our data quality | Track A viable? | Track B viable? |
|----------|---------|------------------------|------------------|-----------------|-----------------|
| 1 | Drain cleaning / sewer | 245,000+ (drain cleaning + sewer line + clogged drain) | `drain` specialty scores + servicesMentioned | Yes | Yes |
| 2 | Water heater repair/replace | 250,000+ (water heater + tankless + hot water) | `water_heater` specialty scores | Yes | Yes |
| 3 | Emergency / burst pipe | 170,000+ (emergency plumber + burst pipe) | `emergency` specialty scores | Yes | Yes |
| 4 | Gas line / leak | 22,000+ | Limited data | Partial | Not yet |
| 5 | Sump pump | ~8,000 | servicesMentioned only | Partial | Not yet |
| 6 | Toilet / fixture | ~15,000 (faucet + toilet + garbage disposal) | servicesMentioned only | Partial | Not yet |
| 7 | Bathroom remodel | ~5,000 | `remodel` specialty scores | Yes | Yes |
| 8 | Repiping | ~6,000 | `repipe` specialty scores | Yes | Yes |

---

## 2. DATA READINESS MATRIX

### Current state: only Acworth, GA has full decision engine data

The scoring pipeline is running for 8 additional cities (Aberdeen MD, Nashville TN, Aiken SC, Alameda CA, Abilene TX, Worcester MA, San Leandro CA, Bethesda MD) but hasn't completed yet. Provo UT completed with only 1 plumber scored (19 lacked cached reviews).

### Acworth, GA readiness (the only fully scored city)

| Service | Specialty key | Plumbers with score >= 70 | Ready for Track A? | Ready for Track B? |
|---------|---------------|--------------------------|--------------------|--------------------|
| Water heater | `water_heater` | 15 | **Yes** | **Yes** (top 3 clear) |
| Drain / sewer | `drain` | 12 | **Yes** | **Yes** |
| Repiping | `repipe` | 13 | **Yes** | **Yes** |
| Emergency | `emergency` | 15 | **Yes** | **Yes** |
| Remodel | `remodel` | 11 | **Yes** | **Yes** |

**Acworth verdict distribution:** 4 strong_hire, 4 conditional_hire, 10 caution, 1 avoid

**Acworth best_for distribution:** Emergency (13 plumbers), Water heater (12), Drain/sewer (7), Budget-conscious (5), Complex installs (1)

### Projected readiness after scoring completes (8 cities in progress)

Each city has 10-19 plumbers with 11-107 cached reviews. Expected outcome: most plumbers will score across all 5 specialty dimensions. Estimated readiness:

| City | Plumbers | Expected scored | Services likely ready (3+ qualified) |
|------|----------|----------------|--------------------------------------|
| Acworth, GA | 19 | 19 (done) | All 5 |
| Aberdeen, MD | 17 | 15-17 | 4-5 |
| Nashville, TN | 19 | 17-19 | 4-5 |
| Aiken, SC | 10 | 8-10 | 3-4 |
| Alameda, CA | 12 | 10-12 | 4-5 |
| Abilene, TX | 17 | 15-17 | 4-5 |
| Worcester, MA | 18 | 16-18 | 4-5 |
| San Leandro, CA | 16 | 14-16 | 4-5 |
| Bethesda, MD | 15 | 13-15 | 4-5 |

### Viable output today vs after scoring completes

| Content type | Producible now | After scoring completes |
|-------------|---------------|------------------------|
| Track A service pages | 5 (Acworth × 5 services) | ~45 (9 cities × 5 services) |
| Track B award posts | 5 (Acworth × 5 services) | ~45 (9 cities × 5 services) |
| Track C meta updates | All 2,250 city pages | Same |

### Top 5 highest-priority service × city combos to start

Based on GSC opportunity (impressions + improvable position) + data readiness:

| Priority | City | Service | Why |
|----------|------|---------|-----|
| 1 | Acworth, GA | Drain cleaning | Data ready now, 12 qualified plumbers, GSC shows drain queries |
| 2 | Acworth, GA | Water heater | Data ready now, 15 qualified, national volume 250K/mo |
| 3 | Acworth, GA | Emergency / burst pipe | Data ready now, 15 qualified, matches strongest GSC cluster |
| 4 | Acworth, GA | Repiping | Data ready now, 13 qualified, less competitive niche |
| 5 | Acworth, GA | Bathroom remodel | Data ready now, 11 qualified, long-tail + monetizable |

*After scoring completes, Aberdeen and Nashville jump to top priority due to GSC traction.*

---

## 3. TRACK A: SERVICE-SPECIFIC CITY PAGE SPEC

### Route structure

```
/[service]/[state]/[city]

Examples:
  /drain-cleaning/georgia/acworth
  /water-heater-repair/georgia/acworth
  /burst-pipe-repair/georgia/acworth
  /sewer-line-repair/georgia/acworth
  /repiping/georgia/acworth
  /bathroom-remodel-plumbing/georgia/acworth
```

### Service slug mapping (16 services from servicesMentioned → URL-friendly slugs)

| servicesMentioned key | URL slug | Target H1 pattern |
|----------------------|----------|-------------------|
| drain-cleaning | drain-cleaning | Drain Cleaning in {City}, {State} |
| sewer | sewer-line-repair | Sewer Line Repair in {City}, {State} |
| water-heater | water-heater-repair | Water Heater Repair in {City}, {State} |
| burst-pipe | burst-pipe-repair | Burst Pipe Repair in {City}, {State} |
| toilet | toilet-repair | Toilet Repair in {City}, {State} |
| sump-pump | sump-pump-repair | Sump Pump Repair in {City}, {State} |
| gas-leak | gas-line-repair | Gas Line Repair in {City}, {State} |
| flooding | water-damage-plumber | Water Damage Plumber in {City}, {State} |
| water-line | water-line-repair | Water Line Repair in {City}, {State} |
| slab-leak | slab-leak-repair | Slab Leak Repair in {City}, {State} |
| garbage-disposal | garbage-disposal-repair | Garbage Disposal Repair in {City}, {State} |
| faucet-fixture | faucet-repair | Faucet & Fixture Repair in {City}, {State} |
| backflow | backflow-testing | Backflow Testing in {City}, {State} |
| repiping | repiping | Repiping in {City}, {State} |
| water-softener | water-softener-service | Water Softener Service in {City}, {State} |
| bathroom-remodel | bathroom-remodel-plumbing | Bathroom Remodel Plumbing in {City}, {State} |

**Launch priority:** Start with top 6 services by search volume: drain-cleaning, water-heater-repair, sewer-line-repair, burst-pipe-repair, repiping, bathroom-remodel-plumbing.

### Page structure

```
[Breadcrumb: Home > {State} > {City} > {Service}]

H1: {Service} in {City}, {State}

[Hero section]
  - Pain point hook: "Clogged drain in {City}? Here's who to call."
  - Top 3 for this service (filtered by specialty_strength >= 70, sorted by score)
    - Name, verdict badge, specialty score, phone CTA
    - 1-line evidence quote from decision engine

H2: Best {Service} Plumbers in {City}
  [Full list of qualified plumbers for this service]
  - PlumberCard variant: shows specialty_strength score for this service
  - Decision engine verdict badge
  - Evidence quote relevant to this service (from evidence_quotes filtered by dimension)

H2: What to Know About {Service} in {City}
  - 150-200 words: service description, local context (housing stock, climate relevance)
  - Typical cost range (from review synthesis pricing signals + industry benchmarks)
  - What to do before the plumber arrives (service-specific)
  - When it's an emergency vs can wait

H2: Frequently Asked Questions
  - 4-6 FAQs targeting "[service] [city]" long-tail queries
  - "How much does {service} cost in {City}?"
  - "How long does {service} take?"
  - "Do I need a permit for {service} in {County}?"
  - "Best time to schedule {service}?"

[Internal links]
  - Back to general city page: /emergency-plumbers/{state}/{city}
  - Other services in this city: /[other-service]/{state}/{city}
  - Award post if exists: /blog/top-3-{service}-{city}-{state}-2026

[Schema: BreadcrumbList, ItemList (qualified plumbers), FAQPage, Service type]
```

### Minimum data threshold for page generation

A service page is only generated if:
- **3+ plumbers** in the city have `specialty_strength >= 70` for that service, AND
- At least 1 plumber has a `best_for` tag matching the service, AND
- The city has decision engine data (all 3 passes complete)

Below threshold → no page generated (avoids thin content). The general city page still covers the service tangentially.

### Sitemap integration

- Separate sitemap: `/sitemap-services.xml`
- Only includes pages that meet the data threshold
- Priority: 0.7 (below city pages at 0.8, above blog at 0.6)
- Submit to GSC via `request-indexing.js` after generation

### Content generation approach

| Section | Source | Human review? |
|---------|--------|---------------|
| Hero + top 3 | Decision engine data (automated) | No |
| Plumber list | Firestore + decision engine (automated) | No |
| "What to know" section | LLM (Claude Sonnet) seeded with city + service + housing data | Spot-check for Tier 1 cities |
| FAQ | LLM seeded with service + city + GSC queries | Spot-check for Tier 1 cities |
| Internal links | Automated from routing data | No |
| Schema | Automated | No |

### Build order

1. **Week 1:** Build `[service]/[state]/[city]/page.tsx` dynamic route with static generation
2. **Week 1:** Build service page generation script: query Firestore for cities with decision engine data → filter by specialty threshold → generate static params
3. **Week 1:** Generate 5 Acworth service pages (drain, water heater, emergency, repipe, remodel)
4. **Week 2:** As scoring completes for other cities, auto-queue their service pages
5. **Week 3+:** Systematize: scoring pipeline completion triggers service page eligibility check

---

## 4. TRACK B: AWARD BLOG POST SPEC

### Methodology & defensibility

**Public methodology page:** `/blog/how-we-rank-plumbers` (new, standalone)

Content:
- Data sources: Google reviews (with counts), Yelp, Angi, BBB
- 5-dimension scoring: reliability, pricing_fairness, workmanship, responsiveness, communication
- Recency weighting: recent reviews count more (1.0/0.5/0.25 decay)
- Per-city percentile ranking: plumbers are ranked against peers in the same city
- Verdict logic: percentile thresholds + variance + absolute floors
- Specialty scoring: how service-specific ratings work
- "We show weaknesses too": transparency commitment
- Update cadence: scores refresh every 30 days with new review data
- Appeals: plumber can request re-evaluation by emailing with new review evidence

This page serves double duty: E-E-A-T signal for Google + trust for plumbers considering backlink placement.

### Post template

**Route:** `/blog/top-3-[service]-[city]-[state]-[year]`
**Example:** `/blog/top-3-drain-cleaning-acworth-ga-2026`

```
H1: Top 3 {Service} Plumbers in {City}, {State} ({Year})

[Intro: 100-150 words]
  - City + service context: "Looking for drain cleaning in Acworth, GA?"
  - Methodology hook: "We analyzed {N} reviews across {M} plumbers..."
  - Link to methodology page

H2: #1 — {Plumber Name}
  - Verdict badge: Strong Hire / Conditional Hire
  - Specialty score: {service} = {score}/100
  - Why they won: 2-3 sentences from best_for + evidence_quotes
  - Pull quote from review (from evidence_quotes, dimension-matched)
  - Google rating + review count
  - Phone CTA + link to plumber profile page

H2: #2 — {Plumber Name}
  [Same structure]

H2: #3 — {Plumber Name}
  [Same structure]

H2: Runners-Up
  - 2-3 additional plumbers with brief mention
  - "Also worth considering: {name} (conditional_hire, specialty score {X})"

H2: How We Chose These Plumbers
  - Brief methodology summary (3-4 sentences)
  - Link to full methodology page
  - "Last evaluated: {date}. Scores refresh every 30 days."

H2: FAQ
  - "How much does {service} cost in {City}?"
  - "Who's the most affordable {service} plumber in {City}?"
  - "Do these plumbers offer 24/7 emergency {service}?"

[Internal links]
  - Service page: /{service}/{state}/{city}
  - General city page: /emergency-plumbers/{state}/{city}
  - Winner plumber profile pages: /plumber/{slug}

[Schema: Article, BreadcrumbList, ItemList (3 winners)]
```

### Badge image pipeline

**Tool:** Nano Banana (AI badge generator) or simple template-based SVG

**Badge variants:**
- `top-3-{service}-{city}-{year}.png` (email attachment, 600×400)
- `top-3-{service}-{city}-{year}.webp` (web embed, 300×200)
- `top-3-{service}-{city}-{year}-social.png` (social share, 1200×630)

**Badge content:**
```
🏆 Top 3 {Service} — {City}, {State}
{Plumber Name}
fastplumbernearme.com | {Year}
```

**Storage:** `/public/badges/` directory, served via Vercel CDN
**Embed code generator:** Simple page at `/badge/{slug}` that provides:
```html
<a href="https://fastplumbernearme.com/blog/top-3-{service}-{city}-{state}-{year}">
  <img src="https://fastplumbernearme.com/badges/top-3-{service}-{city}-{year}.webp" 
       alt="Top 3 {Service} in {City} — Fast Plumber Near Me {Year}" />
</a>
```

The link is **dofollow** — this is the backlink mechanism.

### Outreach pipeline

**Email template:**
```
Subject: Your business was named Top 3 for {Service} in {City} ({Year})

Hi {Plumber Name or "there"},

We analyzed {N} Google reviews across {M} plumbers in {City} and your 
business earned a Top 3 ranking for {Service}.

Your ranking is based on our 5-dimension scoring system that evaluates 
reliability, pricing, workmanship, responsiveness, and communication 
from real customer reviews.

See your full ranking: {post URL}

We've also created a badge you can add to your website:
{badge page URL}

Congratulations!
— Fast Plumber Near Me
```

**Automation:**
1. Post generation triggers outreach queue entry in Firestore `outreach` collection
2. Script sends emails via Resend/SendGrid (capped at 10/day to avoid spam flags)
3. Track: sent_at, opened_at (via pixel), badge_embedded (weekly crawl check), linked_back (weekly backlink check)

**Rate limits:** Max 10 outreach emails per day. Focus on plumbers with visible websites (have `website` field in Firestore). Skip plumbers without email (email collection is a gap — start with website contact form submission or manual lookup).

### Launch batch

First 5 posts (all Acworth, data ready now):
1. Top 3 Drain Cleaning in Acworth, GA (2026)
2. Top 3 Water Heater Repair in Acworth, GA (2026)
3. Top 3 Emergency Plumbers in Acworth, GA (2026)
4. Top 3 Repiping in Acworth, GA (2026)
5. Top 3 Bathroom Remodel Plumbing in Acworth, GA (2026)

---

## 5. TRACK C: GENERAL CITY PAGE IMPROVEMENTS

### Meta tag template (ship across all 2,250 city pages)

**Title:** `{count} Emergency Plumbers in {City}, {State} — Rated & Reviewed ({Year})`
- Example: `17 Emergency Plumbers in Aberdeen, MD — Rated & Reviewed (2026)`
- 62 chars for Aberdeen — fits within Google's ~60 char display

**Description:** `Compare {count} emergency plumbers in {City}, {State} with real reviews, honest strengths & red flags, and 24-hour availability. See who to call and who to avoid.`
- Example: 155 chars for Aberdeen — fits within limit

**Implementation:** Update `generateMetadata()` in `[city]/page.tsx`. Add dynamic plumber count from data. Year from `new Date().getFullYear()`.

### Schema additions

All general city pages already have: BreadcrumbList, ItemList, FAQPage, Review per plumber.

**Add:**
- Aggregate stats in ItemList description: "{count} plumbers, {totalReviews} reviews analyzed"
- `dateModified` on the page metadata (from latest plumber refresh timestamp)

### Internal link injection (once Track A and B exist)

Add to every general city page:
- "Looking for a specific service?" section above the plumber directory
- Links to all Track A service pages in that city
- Links to relevant Track B award posts

```
H2: Plumbing Services in {City}
  - [Drain Cleaning in {City}](/drain-cleaning/{state}/{city})
  - [Water Heater Repair in {City}](/water-heater-repair/{state}/{city})
  - [Sewer Line Repair in {City}](/sewer-line-repair/{state}/{city})
  ...
```

### "Same day" language addition

Add "same-day" to the page content (not just title). Our 2nd largest query cluster (700 impressions for 24-hour/same-day queries) partly matches but we never use the phrase "same day" on any page. Add it to:
- Hero subheading: "24/7 and same-day plumbers ready to help"
- FAQ: "Can I get a same-day plumber in {City}?"

---

## 6. CONTENT GENERATION PIPELINE (shared across Tracks A and B)

### Grounding strategy for unique content

Every generated page receives a **grounding packet** that ensures city-specific output:

```json
{
  "city": "Acworth",
  "state": "GA",
  "county": "Cobb",
  "zip_codes": ["30101", "30102"],
  "population": 22000,
  "climate_zone": "humid_subtropical",
  "avg_home_age": "1990s",
  "water_source": "municipal",
  "plumber_count": 19,
  "service": "drain-cleaning",
  "qualified_plumber_count": 12,
  "avg_specialty_score": 82,
  "top_plumber": "My Plumber LLC",
  "top_plumber_verdict": "strong_hire",
  "evidence_quote": "They are always on time and get the job done quickly"
}
```

### LLM prompt templates

**Track A — Service page "What to know" section:**
```
Write 150-200 words about {service} in {city}, {state} ({county} County).

Context:
- Housing stock: mostly {avg_home_age} homes
- Climate: {climate_zone}
- Water source: {water_source}
- {qualified_plumber_count} plumbers in the area specialize in this service

Cover:
1. Why this service is needed in this area (climate/housing specific)
2. Typical cost range ($X-$Y based on service type)
3. One thing to do before the plumber arrives
4. When this is an emergency vs can wait

Every sentence must contain a fact specific to {city} or {county}.
Do NOT say "beautiful city" or "growing community."
Do NOT repeat the H1 or any heading text.
```

**Track A — Service page FAQ:**
```
Write 4 FAQs about {service} in {city}, {state}.
Each answer: 60-100 words, grounded in local details.

Required questions:
1. "How much does {service} cost in {City}?"
2. "How long does {service} take?"
3. One question about local regulations/permits in {county}
4. One question about seasonal timing relevant to {climate_zone}
```

**Track B — Award post intro:**
```
Write 100-150 words introducing a "Top 3 {Service} in {City}" ranking.

Data: We analyzed reviews from {plumber_count} plumbers in {city}. 
The top 3 scored {top_scores} on our {service} specialty scale.
Winner: {winner_name} ({winner_score}/100).

Tone: Authoritative but approachable. Not marketing copy.
Must mention: {county} County, number of plumbers analyzed.
Do NOT say "without further ado" or "let's dive in."
```

### Variation and anti-duplication

1. **Data grounding:** Different cities have different climate zones, housing ages, water sources, and plumber counts. The LLM output varies because the input varies.

2. **Sentence structure variation:** Prompts include `"Vary your sentence structure from this example: {randomly_selected_previous_output}"` to prevent the LLM from settling into a pattern.

3. **Post-generation similarity check:** Compute sentence-level Jaccard similarity between the new page and all existing pages for the same service type. Flag if any section has > 0.7 overlap. Re-generate with a different random seed.

4. **Required local anchors:** Every "What to know" section must contain: the county name, at least one zip code, and a climate-specific fact. These vary by city and prevent generic output.

### Human review checkpoint

| Track | Content | Review level | Frequency |
|-------|---------|-------------|-----------|
| A (service pages) | "What to know" + FAQ sections | Spot-check: read 1 in 5 | Per batch |
| A (service pages) | Plumber data, rankings, schema | Automated validation | Every build |
| B (award posts) | Full post | Read every post for first 10, then 1 in 3 | Per batch |
| B (award posts) | Badge images | Visual check on first batch, then automated | First batch |
| C (city pages) | Meta tags | Automated length/format check | Deploy-time |

### Cost estimates

| Content type | API cost | Human time | Total per unit |
|-------------|----------|-----------|----------------|
| Track A service page | ~$0.10 (Sonnet: intro + FAQ) | 5 min spot-check (1 in 5) | ~$0.10 + 1 min avg |
| Track B award post | ~$0.08 (Sonnet: intro + "why they won") | 10 min per post (first 10) | ~$0.08 + 10 min |
| Track B badge image | ~$0.02 (template-based, not LLM) | 2 min visual check (first batch) | ~$0.02 + 0.5 min avg |
| Track C meta update | $0 (template) | 0 (automated) | $0 |

**First batch (Acworth, 5 services):**
- 5 service pages: $0.50 + 5 min review = ~15 min total
- 5 award posts: $0.40 + 50 min review = ~55 min total
- Meta update: 0 (template deploy)

---

## 7. SITE ARCHITECTURE & INTERNAL LINKING

### Hub-and-spoke structure

```
                    Homepage
                       |
              ┌────────┼────────┐
              ▼        ▼        ▼
         /emergency-  /drain-   /blog/
         plumbers/    cleaning/  
              |        |         |
         ┌────┤   ┌────┤    ┌────┤
         ▼    ▼   ▼    ▼    ▼    ▼
       /ga/  /md/ /ga/ /md/  top-3-drain-  top-3-water-
       acworth aberdeen acworth aberdeen  acworth-ga   acworth-ga
```

**Link flows:**
- General city page → all service pages in that city (hub → spokes)
- Service page → general city page (spoke → hub)
- Service page → other service pages in same city (spoke → spoke)
- Award post → service page + general city page + plumber profiles
- Plumber profile → service pages where they're top 3
- General city page → relevant award posts

**Link equity flow:** Award posts earn external backlinks from winning plumbers → equity flows to service pages and general city pages via internal links → rising tide lifts all pages.

### Breadcrumbs

| Route | Breadcrumb |
|-------|-----------|
| `/drain-cleaning/georgia/acworth` | Home > Georgia > Acworth > Drain Cleaning |
| `/blog/top-3-drain-cleaning-acworth-ga-2026` | Home > Blog > Top 3 Drain Cleaning in Acworth |
| `/emergency-plumbers/georgia/acworth` | Home > Emergency Plumbers > Georgia > Acworth |

### Sitemap strategy

| Sitemap | Contents | Priority | Submission |
|---------|----------|----------|-----------|
| `/sitemap.xml` (index) | Links to all sub-sitemaps | — | Auto-submitted |
| `/sitemap-cities.xml` | All `/emergency-plumbers/` pages | 0.8 | Already submitted |
| `/sitemap-services.xml` (new) | All Track A service pages | 0.7 | Submit on first build |
| `/sitemap-blog.xml` | All blog posts including Track B awards | 0.6 | Submit on first build |
| `/sitemap-plumbers.xml` | All `/plumber/[slug]` pages | 0.5 | Already submitted |

**Indexing strategy:** After each batch deploy, run `request-indexing.js` for new URLs. Google Indexing API has 200/day quota — submit service pages first (higher ranking potential), then award posts.

### URL structure notes

- No changes needed to existing routes. Track A and B are additive.
- Service slugs are lowercase-hyphenated, consistent with existing URL patterns.
- No redirects needed.
- If we later build `/plumber-services/[service]/[city]` (from ROADMAP Phase 3), we'd redirect Track A routes to those. But for now, the simpler route pattern is fine.

---

## 8. MEASUREMENT & LEARNING LOOPS

### Instrumentation

| Metric | Source | Frequency |
|--------|--------|-----------|
| Pages indexed per track | GSC API (`siteUrl:` + path filter) | Weekly |
| Impressions per track | GSC API grouped by URL prefix | Weekly |
| Queries ranked for per track | GSC API dimension=query, filtered by page | Weekly |
| Position distribution per track | GSC API | Weekly |
| Clicks per track | GSC API | Weekly |
| Backlinks acquired per award post | GSC API (links to site) or manual badge crawl check | Weekly |
| Badge embeds detected | Crawl check: search for badge URL in outreach plumber websites | Weekly |

### Weekly report format

```
Week of {date}

Track A (Service Pages):
  Pages live: {N}
  Pages indexed: {N}
  Total impressions: {N} (delta from last week)
  Queries ranked for: {N}
  Best performing: {page} — {impressions} imp, position {pos}
  
Track B (Award Posts):
  Posts live: {N}
  Posts indexed: {N}
  Total impressions: {N}
  Outreach sent: {N}, Opened: {N}, Badges embedded: {N}
  Backlinks detected: {N}

Track C (City Pages):
  Meta update status: {N} of 2,250 updated
  Impression delta: {N} vs last week
  Click delta: {N} vs last week
  CTR delta: {%} vs last week
```

**Implementation:** Script that runs weekly (or add to `gsc-pull-test.js` as a reporting mode), saves to Firestore `weeklyReports` collection, viewable in admin dashboard.

### Kill criteria

| Signal | Threshold | Action |
|--------|-----------|--------|
| Service page not indexed after 30 days | 0 impressions at day 30 | Re-submit to indexing API, check for crawl errors |
| Service page indexed but 0 impressions after 60 days | 0 impressions at day 60 | Audit content quality, check for cannibalization with city page |
| Service page has impressions but position > 40 after 90 days | Not improving | Consolidate: add content to city page instead, redirect service URL |
| Award post has 0 backlinks after 60 days | No outreach response | Re-send outreach, try different plumber contact method |
| Track A overall: <100 total impressions after 60 days across all service pages | Aggregate check | Reassess strategy — may need more content depth or different service focus |

### Leading indicators (before conversions matter)

1. **Impressions on target query:** A service page getting impressions for "drain cleaning acworth ga" confirms Google associates the page with the query.
2. **Position improvement:** Week-over-week position improvement for target queries.
3. **Pages-per-session from service pages:** If users land on a service page and navigate to the general city page or a plumber profile, the hub-and-spoke structure is working.
4. **Index rate:** What % of submitted pages get indexed? If < 50%, Google may be treating them as thin content.
5. **Badge embed rate:** What % of outreach emails result in badge embeds? Target: 15-20% (industry standard for award badge programs).

---

## 9. EXECUTION PLAN — PARALLEL TRACKS

### Week 1: Acworth + infrastructure

| Day | Track A | Track B | Track C |
|-----|---------|---------|---------|
| 1 | Build `/[service]/[state]/[city]/page.tsx` route + `generateStaticParams` | Build award post template + generation script | Ship meta tag template to all city pages |
| 2 | Generate 5 Acworth service pages | Generate 5 Acworth award posts | Add "same-day" language to city page template |
| 3 | Generate "What to know" + FAQ content for 5 pages | Create methodology page `/blog/how-we-rank-plumbers` | Submit new sitemap-services.xml to GSC |
| 4 | Review, deploy, submit to indexing API | Review all 5 posts, deploy | Internal link injection from Acworth city page to new service pages |
| 5 | Badge generation pipeline (template-based SVG/PNG) | Send first 5 outreach emails | Monitor GSC for index status |

### Week 2: Expand to cities as scoring completes

- As each city's scoring pipeline finishes:
  1. Run data readiness check (which services have 3+ qualified plumbers?)
  2. Queue service page generation for qualifying service × city combos
  3. Queue award post generation
  4. Deploy in batches of 5-10 pages
  5. Begin outreach for new award winners

- Expected: 3-5 cities complete scoring → 15-25 new service pages + 15-25 new award posts

### Week 3+: Systematize

- Scoring pipeline completion → automatic eligibility check → content generation queue
- Weekly deploy cycle: generate Monday, review Tuesday, deploy Wednesday, index Thursday, measure Friday
- Outreach: 10 emails/day cadence, Monday-Friday
- Weekly GSC report generation

### Ongoing

- **New city scoring:** As new cities get scraped and reviews accumulate, run scoring pipeline → new service pages and award posts auto-queue
- **Annual refresh:** Re-run scoring for all cities in January → update award posts with new year → re-send outreach
- **Service expansion:** Add services 7-16 (gas, sump pump, toilet, etc.) as data coverage improves

---

## 10. RISKS

### AI content at scale

**Risk:** Google's helpful content system penalizes "content created primarily for search engines."

**Mitigations baked in:**
- Core content (plumber rankings, scores, evidence quotes) is derived from real review data — not AI-generated opinion
- AI-generated sections ("What to know", FAQ) are grounded in city-specific data packets (climate, housing, water source) that make each page factually different
- Post-generation similarity check catches duplicates before deploy
- Human review catches generic language
- Every page has a clear user intent match: someone searching "drain cleaning acworth ga" gets exactly what they need

**Monitor for:** Index rate < 50% (signal Google considers pages thin), position drops on existing city pages after service page deploy (cannibalization).

### Duplicate content across similar cities

**Risk:** "What to know about drain cleaning in Acworth, GA" reads identically to "...in Kennesaw, GA" (nearby, same climate, same housing).

**Mitigations:**
- Grounding packets include different zip codes, population, housing age, and plumber data for each city
- Required local anchors: county name, zip code, climate fact must differ
- Sentence-level Jaccard similarity check: > 0.7 triggers re-generation
- For nearby cities in the same county: use different neighborhood references, different "what makes this area unique" angles

**Fallback:** If two cities are genuinely too similar to differentiate, consolidate into one page targeting both (e.g., "Drain Cleaning in Acworth & Kennesaw, GA").

### Plumber disputes on award rankings

**Risk:** A plumber ranked #4 disagrees with the methodology. Or a plumber with a "caution" verdict demands removal.

**Mitigations:**
- Public methodology page with clear, defensible criteria
- Rankings based on aggregate review data, not editorial opinion — defensible under CDA Section 230
- Appeals process: plumber can request re-evaluation by emailing with evidence of new reviews
- "Last evaluated" date on every post — rankings are temporal, not permanent
- We never say a plumber is "bad" — we say "caution if you need X" which is conditional advice, not defamation

### Crawl budget

**Risk:** 16 services × 2,250 cities = 36,000 potential URLs. Google won't crawl and index all of them quickly.

**Mitigations:**
- Only generate pages that meet the data threshold (3+ qualified plumbers). This caps initial URL count at ~50-100 pages.
- Prioritized sitemaps: service pages with GSC-traction cities first
- `request-indexing.js` actively pushes high-priority URLs to Google (200/day quota)
- Service pages are statically generated at build time (no SSR crawl delay)
- As the scoring pipeline expands to more cities, pages are added gradually — not 36,000 at once

**Realistic URL count trajectory:**
- Week 1: ~5 service pages + 5 award posts (Acworth)
- Month 1: ~50 service pages + 50 award posts (9 cities × 5-6 services)
- Month 3: ~200 service pages + 200 award posts (scaling with scoring pipeline)
- Month 6+: ~500-1,000 pages (dependent on city expansion and scoring)

### Email deliverability for outreach

**Risk:** Outreach emails land in spam or get ignored.

**Mitigations:**
- Use a dedicated sending domain (awards@fastplumbernearme.com) with proper SPF/DKIM/DMARC
- Personalize: include plumber name, city, specific ranking data
- Keep volume low (10/day) to maintain sender reputation
- Provide value (badge + ranking) before asking for anything (backlink)
- Follow up once at 7 days, then stop — no aggressive sequences

### Cannibalization between Track A and Track C

**Risk:** `/drain-cleaning/georgia/acworth` steals rankings from `/emergency-plumbers/georgia/acworth` for drain-related queries.

**Mitigations:**
- Different intent targeting: service pages target "[service] [city]" queries; city pages target "emergency plumber [city]" queries
- Clear title differentiation: "Drain Cleaning in Acworth" vs "Emergency Plumbers in Acworth"
- Internal linking binds them together (hub-and-spoke), signaling to Google that they're related but distinct
- **Monitor:** If a city page loses position on a query after a service page launches for that query, the service page is working as intended — it's a better match for that query. The city page should hold its position for broad "emergency plumber" queries.
