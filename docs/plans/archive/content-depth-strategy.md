> **ARCHIVED 2026-04-12:** Superseded by STRATEGY-BRIEF.md. Tiered depth approach replaced with service-specific pages (Track A).

# Content Depth Strategy — Tiered City Pages

**Date:** 2026-04-12
**Lighthouse city:** Aberdeen, MD
**Goal:** Define what "deep content" means, tier it by ROI, and spec the Tier 1 template using Aberdeen as the prototype.

---

## 1. CURRENT STATE AUDIT

### Our page: Aberdeen, MD

| Metric | Value |
|--------|-------|
| Word count | ~2,200 |
| Unique content ratio | ~35-40% (plumber synthesis is unique; FAQs, "About", emergency sections are city-name-swapped templates) |
| H2 sections | 6 |
| H3 sections | 5 |
| Zip codes mentioned | 0 |
| Neighborhoods/landmarks | 0 |
| County | "Harford County" — mentioned once |
| Service-specific content | Generic emergency list (burst pipes, water heater, sewer, drains, gas). No local pricing, no timing beyond FAQ generics |
| FAQ count | 6 |
| Schema types | BreadcrumbList, ItemList, FAQPage, Review (per plumber), Plumber with geo |

### Competitor comparison

| Metric | Us (Aberdeen) | Roto-Rooter | Catons | Benjamin Franklin |
|--------|---------------|-------------|--------|-------------------|
| Word count | ~2,200 | ~2,500 | ~1,300 | ~5,000 |
| Unique ratio | ~35% | ~40% | ~70% | ~50% |
| Zip codes | 0 | 0 | 0 | Zip finder tool |
| Landmarks | 0 | 0 | 2 (Susquehanna SP, Mt Felix) | 0 |
| County mention | 1x | 0 | Yes | URL-level |
| Pricing info | FAQ generic | None | None | None |
| Response time claims | FAQ generic | "Within 2 hours" | "Within 30 minutes" | None |
| Team/about content | None | Franchise brand | "60+ years" history | "Meet the Team" bios |
| Service taxonomy | 5 emergency types | Generic | 26 linked service pages | Carousel |
| FAQ count | 6 | FAQ section (unclear) | 4 | 5-8 |
| Images | 0 | Framework images | Map, badges | Hero images, team photos |
| Interactive elements | Sort/filter bar | Live chat, app promo | Scheduling, financing | Zip finder, service selector |
| Domain authority | Low (new domain) | ~70+ | ~40 | ~55 |

### Depth gap

1. **Local specificity:** Catons mentions Susquehanna State Park and Mount Felix Vineyard. We mention zero Aberdeen landmarks. This is the primary signal that tells Google "this page was made *for* Aberdeen residents, not generated for 2,250 cities."

2. **Content authenticity:** Benjamin Franklin has ~5,000 words with team bios, interactive tools, and blog integration. Our 2,200 words are higher than Catons' 1,300, but ~60% of ours is template filler. Google's helpful content system likely scores us below a shorter page with more genuine content.

3. **Service depth:** Competitors link to 8-26 dedicated service pages. We list 5 emergency types with 1-sentence descriptions. For service-specific queries ("water heater repair aberdeen md"), we have nothing to rank with.

---

## 2. QUERY LANDSCAPE FOR ABERDEEN

### All 36 GSC queries (90 days), clustered by intent

#### Cluster A: Emergency / Urgent (338 impressions, avg position 8.6)
Our strongest cluster — page 1 for most queries.

| Query | Impr | Pos | Gap? |
|-------|------|-----|------|
| emergency plumber near me | 77 | 8.9 | Position 8-9, need top 5 |
| emergency plumber | 71 | 7.8 | Good position, need clicks |
| emergency plumbing | 47 | 11.0 | Page 2 — content gap |
| emergency plumbing near me | 40 | 9.7 | Position 10 — borderline page 1 |
| emergency plumbing services near me | 21 | 14.1 | Page 2 |
| emergency plumbing services | 27 | 13.2 | Page 2 |
| emergency drain service | 7 | 6.6 | Strong |
| emergency home plumbing aberdeen md | 2 | 17.5 | Page 2 for branded |
| emergency plumbing services aberdeen | 1 | 52.0 | Page 5+ for branded! |

**Content gap:** "emergency plumbing services" queries (49 impressions, position 13-14) need dedicated service-list content. The word "services" in the query signals the user wants a service taxonomy, not just listings.

#### Cluster B: 24-Hour / Same-Day (155 impressions, avg position 7.6)
Second strongest cluster. Position is good but not clicking.

| Query | Impr | Pos |
|-------|------|-----|
| 24 hour plumbers near me | 35 | 6.7 |
| same day plumber near me | 32 | 7.1 |
| 24 7 plumber near me | 29 | 7.1 |
| same day plumber | 19 | 12.1 |
| 24 hour plumbers | 15 | 10.0 |
| 24 7 plumber | 10 | 5.8 |

**Content gap:** "same day" doesn't appear anywhere on our page. Adding "same-day service" language would improve relevance for 51 impressions worth of queries.

#### Cluster C: Service-Specific (31 impressions, avg position 13.5)
Ranking poorly — these are content depth opportunities.

| Query | Impr | Pos |
|-------|------|-----|
| water heater repair near me | 13 | 14.2 |
| sewer line repair near me | 8 | 14.3 |
| drain cleaning near me | 6 | 13.3 |
| hot water heater repair near me | 4 | 10.8 |

**Content gap:** We have no service-specific sections. A "Water Heater Repair in Aberdeen" H2 with local pricing ranges and plumber recommendations could capture these queries.

#### Cluster D: Generic Plumber (55 impressions, avg position 14.4)
Low intent alignment — these users may not need emergency service.

| Query | Impr | Pos |
|-------|------|-----|
| plumber near me | 20 | 12.2 |
| local plumbers near me | 9 | 19.0 |
| plumber | 7 | 13.3 |
| plumbing repair near me | 7 | 16.3 |
| plumbing company near me | 6 | 16.8 |
| plumbing repair | 6 | 14.0 |

**Content gap:** Our page title says "Emergency Plumbers" which is correct for our primary target. These generic queries are secondary — improving general content depth will help here without needing to change our focus.

#### Cluster E: Local Branded (13 impressions, avg position 55.2)
Worst performance — we're invisible for Aberdeen-specific searches.

| Query | Impr | Pos |
|-------|------|-----|
| plumber aberdeen | 5 | 51.8 |
| aberdeen plumbers | 1 | 96.0 |
| plumber in aberdeen md | 1 | 49.0 |
| plumbers aberdeen md | 1 | 43.0 |
| aberdeen emergency repairs | 1 | 48.0 |
| plumbers in aberdeen | 1 | 45.0 |

**Content gap:** Position 43-96 for branded queries means Google doesn't associate our page with Aberdeen specifically. This is the local depth problem — we need Aberdeen-specific content (zip codes, neighborhoods, landmarks, housing stock) to establish local relevance.

### Queries with position > 20 (content depth should close these gaps)

| Query | Impressions | Position | Fix |
|-------|-------------|----------|-----|
| plumber aberdeen | 5 | 51.8 | Local depth content |
| aberdeen emergency repairs | 1 | 48.0 | Local depth content |
| plumber in aberdeen md | 1 | 49.0 | Local depth content |
| plumbers aberdeen md | 1 | 43.0 | Local depth content |
| plumbers in aberdeen | 1 | 45.0 | Local depth content |
| aberdeen plumbers | 1 | 96.0 | Local depth content |
| emergency plumbing services aberdeen | 1 | 52.0 | Local depth + services |
| local plumbers near me | 9 | 19.0 | General content depth |

---

## 3. TIERED DEPTH STRATEGY

### Tier 1: Lighthouse Cities (deep, hand-curated content)

**Selection criteria:**
- GSC impressions > 200 in last 90 days, OR
- Already ranking top 10 for emergency plumber queries, OR
- Manually selected as expansion beachhead

**Word count target:** 4,000-6,000
**Unique content ratio target:** 60%+

**Required unique sections:**
- Local plumbing context (climate, housing stock, common issues, water source)
- Neighborhood/zip code service area breakdown
- 3-5 service-specific subsections with local pricing ranges
- "Top Picks" hero with decision engine verdicts
- Local resources (water utility, county inspector, permit office)
- 8-12 FAQs with locally-grounded answers

**Required templated sections:**
- Full plumber directory with cards (synthesis, ratings, badges)
- Sort/filter bar
- Nearby cities links
- Schema markup (all types)
- Emergency CTA sections

**Schema types:** BreadcrumbList, ItemList, FAQPage, Plumber per listing with geo + AggregateRating + Review, Place for the city

**Estimated cost per page:**
- LLM generation: ~20K input tokens + ~4K output tokens = ~$0.15 at Sonnet pricing
- Human review/edit: 30-45 minutes
- Local data research (zip codes, utilities, landmarks): 15-20 minutes
- Total: ~1 hour human time + $0.15 API cost

**Current cities qualifying (based on GSC data):**

| City | Impressions | Avg Position | Status |
|------|-------------|-------------|--------|
| Aiken, SC | 602 | 20.7 | Qualifies |
| Nashville, TN | 590 | 20.7 | Qualifies |
| Aberdeen, MD | 542 | 11.4 | **Lighthouse** |
| Alameda, CA | 343 | 18.2 | Qualifies |
| Acworth, GA | 256 | 39.2 | Qualifies (also has full decision engine data) |
| Abilene, TX | 231 | 40.3 | Qualifies |
| Worcester, MA | 223 | 17.4 | Qualifies |
| Huntsville, AL | 134 | 32.1 | Qualifies |

**Estimated Tier 1 count: 8-12 cities**

### Tier 2: Growth Cities (semi-custom content)

**Selection criteria:**
- GSC impressions 20-200 in last 90 days, OR
- City population > 50,000 with existing plumber data, OR
- 10+ plumbers in database

**Word count target:** 2,500-3,500
**Unique content ratio target:** 45%+

**Required unique sections:**
- Local plumbing context (1-2 paragraphs, LLM-generated with city + state + climate seed data)
- Service area with zip codes (programmatic from geocoding data)
- 6-8 FAQs (2-3 locally seeded, rest templated)

**Required templated sections:**
- Full plumber directory
- Emergency types section
- Sort/filter, nearby cities, schema

**Estimated cost per page:**
- LLM generation: ~8K tokens = ~$0.06
- Human review: 10-15 minutes (spot-check, not deep edit)
- Total: ~15 min human + $0.06

**Estimated Tier 2 count: 30-50 cities** (based on GSC + population data)

### Tier 3: Long-Tail Cities (templated with data-driven uniqueness)

**Selection criteria:**
- Everything else — GSC impressions < 20, small population, thin plumber coverage

**Word count target:** 1,500-2,200 (current state)
**Unique content ratio target:** 30%+ (plumber synthesis provides the unique content)

**Required sections:**
- Current template (hero, plumber cards, FAQ, nearby cities, emergency types)
- Zip codes auto-populated from geocoding
- County name in hero and body copy

**No custom content generation.** Uniqueness comes from plumber-specific review synthesis.

**Estimated cost per page:** $0 incremental (current template)

**Estimated Tier 3 count: ~2,200 cities**

### Tier assignment summary

| Tier | Cities | Word count | Unique % | Cost/page | Total investment |
|------|--------|-----------|----------|-----------|-----------------|
| 1 | 8-12 | 4,000-6,000 | 60%+ | 1 hr + $0.15 | 10-12 hrs |
| 2 | 30-50 | 2,500-3,500 | 45%+ | 15 min + $0.06 | 8-12 hrs |
| 3 | ~2,200 | 1,500-2,200 | 30%+ | $0 | Already built |

---

## 4. ABERDEEN DEEP CONTENT SPEC (Tier 1 Template)

### Full page structure

#### Section 1: Hero with Top 3 Picks
**Purpose:** Conversion — immediate answer for users in crisis
**Content:**
- H1: "Emergency Plumbers in Aberdeen, MD"
- Aggregate trust bar: "17 plumbers, 26,000+ reviews analyzed, avg 4.8 stars"
- Top 3 cards with: plumber name, verdict badge (Strong Hire / Conditional Hire), 1-line summary from decision engine, phone CTA, Google rating
- "See all 17 plumbers" anchor link to full directory below

**Data source:** Decision engine verdicts + scores (Firestore `decision.verdict`, `scores`)
**Generated at scale:** Fully automated — top 3 by `city_rank.overall_percentile`
**Freshness:** Updates whenever scoring pipeline runs

#### Section 2: Local Plumbing Context
**Purpose:** Ranking — local relevance signals for Google
**Content (Aberdeen-specific example):**
- H2: "About Plumbing in Aberdeen, MD"
- 200-300 words covering:
  - Aberdeen's location in Harford County, proximity to Aberdeen Proving Ground
  - Housing stock: mix of military housing, 1960s-1980s single-family homes, newer developments
  - Common plumbing issues: aging galvanized pipes in older homes, well water in rural areas surrounding APG, hard water mineral buildup
  - Climate factor: freeze risk from late November through March, sump pump demand during spring thaw
  - Water utility: Harford County Department of Public Works, municipal water vs well water zones
- Zip codes served: 21001 (Aberdeen), 21005 (APG), 21009 (Bel Air), 21015 (Bel Air South), 21078 (Havre de Grace)
- Neighborhoods/areas: Aberdeen town center, APG housing, Perryman, Riverside

**Data source:** LLM-generated with structured prompt seeded by: city name, state, county, lat/lng (climate zone derivation), population, housing age data (Census), water utility (lookup table)
**Generated at scale:** LLM per city with structured prompt + human spot-check
**Freshness:** Static — refresh annually or when housing/infrastructure data changes
**Duplicate prevention:** Each city's climate, housing stock, and water issues are genuinely different. The structured prompt forces city-specific details rather than generic copy.

#### Section 3: Service Breakdown
**Purpose:** Ranking (service-specific queries) + Conversion (utility — what to expect)
**Content:**
- H2: "Common Plumbing Services in Aberdeen"
- 5-8 subsections (H3 each):
  - Water Heater Repair & Installation
  - Drain Cleaning & Sewer Service
  - Emergency Pipe Repair (Burst/Frozen)
  - Sump Pump Service
  - Gas Line Repair
  - Bathroom Remodel Plumbing
- Each subsection: 100-150 words covering:
  - What the service involves
  - Aberdeen-specific context (e.g., "Many Aberdeen homes built before 1985 have galvanized pipes prone to...")
  - Typical price range (sourced from review synthesis pricing signals + industry data)
  - What to do before the plumber arrives
  - Top-rated plumbers for this service (from `scores.specialty_strength`)

**Data source:** LLM-generated framework + decision engine `specialty_strength` data for plumber recommendations
**Generated at scale:** Template prompt per service, seeded with city-specific housing/climate data + plumber specialty scores
**Freshness:** Updates when specialty scores change

#### Section 4: Full Plumber Directory
**Purpose:** Conversion — the core listing
**Content:**
- H2: "All Emergency Plumbers in Aberdeen, MD"
- Sort/filter bar (Best Match, Fastest, Top Rated, Best Price)
- PlumberCard for each plumber with:
  - Current: name, rating, reviews, reliability score, badges, synthesis strengths/weaknesses, distance, phone CTA
  - **New with decision engine:** Verdict badge (color-coded), "Best for:" tags, evidence quotes toggle
- Aggregate stat at bottom: "Showing 17 plumbers within 20 miles of Aberdeen, MD"

**Data source:** Firestore plumber docs + decision engine output
**Generated at scale:** Fully automated
**Freshness:** Updates with every Firestore export

#### Section 5: FAQ Section
**Purpose:** Ranking (long-tail query capture) + Conversion (reduces uncertainty)
**Content:**
- H2: "Frequently Asked Questions"
- 8-12 questions targeting GSC query clusters:
  - "How much does an emergency plumber cost in Aberdeen, MD?" (pricing cluster)
  - "Can I get a same-day plumber in Aberdeen?" (same-day cluster — not currently targeted!)
  - "What should I do while waiting for a plumber in Aberdeen?" (informational)
  - "Are there 24/7 plumbers in Aberdeen, MD?" (24-hour cluster)
  - "How fast can an emergency plumber get to Aberdeen?" (response time)
  - "What's the best plumber in Aberdeen for water heater repair?" (service-specific)
  - "How do I shut off my water main in an emergency?" (pure informational — E-E-A-T)
  - "Does homeowners insurance cover emergency plumbing in Maryland?" (state-specific informational)
  - "What are signs of a sewer line problem?" (diagnostic informational)
  - "How do I find a licensed plumber in Harford County?" (local regulatory)
- Answers: 80-150 words each, locally grounded where possible

**Data source:** GSC query data (what people actually search) + LLM generation with local grounding
**Generated at scale:** Query-seeded LLM generation per city. Top 4-6 questions are universal (template with city name). Bottom 4-6 are locally seeded (county regulations, climate, housing).
**Freshness:** Refresh when GSC shows new query patterns. FAQPage schema keeps these in rich results.

#### Section 6: Local Resources
**Purpose:** Ranking (E-E-A-T signal — shows expertise and local knowledge)
**Content:**
- H2: "Aberdeen Plumbing Resources"
- Water utility contact: Harford County Dept of Public Works, phone, website
- Building permits: Harford County Dept of Inspections, Licenses & Permits
- Emergency water shutoff: how-to for Aberdeen municipal water
- Maryland plumber licensing: DLLR requirements, license lookup link

**Data source:** Manual research for first 10 cities, then LLM-assisted with human verification
**Generated at scale:** Semi-manual — LLM finds candidates, human verifies phone numbers and URLs
**Freshness:** Annual review

#### Section 7: Nearby Cities
**Purpose:** Ranking (internal linking) + Navigation
**Content:** Current template — links to 15+ nearby city pages
**No changes needed.**

### Total estimated word count for Tier 1 Aberdeen page

| Section | Words |
|---------|-------|
| Hero + Top 3 | ~150 |
| Local context | ~300 |
| Service breakdown (6 services × 130 words) | ~780 |
| Plumber directory (17 cards) | ~1,700 (existing) |
| FAQ (10 × 120 words) | ~1,200 |
| Local resources | ~200 |
| Nearby cities + CTA | ~150 |
| **Total** | **~4,500** |

---

## 5. CONTENT GENERATION PIPELINE

### Generation approach

**Local context section:** LLM (Claude Sonnet) with structured prompt:
```
City: {city}, {state}
County: {county}
Lat/Lng: {lat}, {lng}
Population: {population}
Climate zone: {derived from lat}
Avg home age: {from Census if available, else estimate from region}
Water source: {municipal/well/mixed — from utility data if available}

Write 200-300 words about plumbing in {city}, {state} covering:
1. Geographic/demographic context (1-2 sentences)
2. Housing stock and common pipe materials
3. Climate-related plumbing risks (freeze dates, flood risk, heat stress)
4. Local water quality issues
5. Mention the county and 2-3 neighborhoods/landmarks

Do NOT use generic phrases like "beautiful community" or "growing city."
Every sentence must contain a fact specific to this city that would be
wrong if applied to a different city 50 miles away.
```

**Service breakdown:** Template structure + LLM fills city-specific details:
- Template: service name, description, "what to do before" (universal)
- LLM addition: local pricing context, housing-stock relevance, climate relevance
- Decision engine injection: "Top-rated for this service in {city}: {plumber names}" from `specialty_strength`

**FAQ section:** Hybrid:
- Universal questions (4-6): templated answers with city name, county, and state-specific regulatory info
- Local questions (4-6): LLM-generated from GSC query data + city context
- All answers grounded in data: pricing from review synthesis, timing from plumber data, regulations from state lookup

### Preventing AI duplicate content

1. **Structured data grounding:** Every LLM prompt includes city-specific facts (lat/lng, population, climate zone, housing age, water source). The output must reference these facts. Two cities at different latitudes will get different freeze-risk content. Two cities with different housing ages will get different pipe-material content.

2. **Landmark injection:** For Tier 1 cities, manually identify 2-3 landmarks and inject them into the prompt. LLM must reference at least one.

3. **GSC query seeding:** FAQ questions are seeded by actual search queries for that city. Different cities have different query patterns → different FAQ content.

4. **Post-generation duplicate check:** Run a cosine similarity check between generated content for nearby cities. Flag anything >0.85 similarity for human rewrite.

5. **Human edit pass:** Every Tier 1 page gets a 30-45 minute human review. Editor checks for: generic language, factual accuracy of local claims, natural reading flow, any sentence that would be equally true for a different city.

### Human review checkpoint

| Tier | What gets checked | By whom | Time per page |
|------|-------------------|---------|---------------|
| Tier 1 | Full read of all unique sections. Fact-check local claims (zip codes, utility contacts, landmarks). Rewrite any generic sentences. | Tim (or designated editor) | 30-45 min |
| Tier 2 | Spot-check local context paragraph. Verify zip codes. Skim FAQs for hallucinations. | Tim | 10-15 min |
| Tier 3 | No human review — template only. Quality comes from plumber synthesis (already reviewed in scoring pipeline). | N/A | 0 min |

### Cost per Tier 1 page

| Item | Cost |
|------|------|
| Claude Sonnet: local context (~20K input + 4K output) | ~$0.10 |
| Claude Sonnet: service breakdown (6 calls × ~5K tokens) | ~$0.08 |
| Claude Sonnet: FAQ generation (~15K tokens) | ~$0.08 |
| Duplicate check (embedding comparison) | ~$0.01 |
| Human review (45 min @ imputed cost) | Time cost |
| Local research (landmarks, utilities, zips) | 15-20 min |
| **Total API cost** | **~$0.27** |
| **Total human time** | **~60-65 min** |

---

## 6. ROLLOUT PLAN

### Week 1: Aberdeen as Tier 1 prototype
- Build out all 7 sections for Aberdeen manually (Tim + Claude)
- Deploy, measure baseline: position, impressions, clicks, on-page engagement
- Document every decision, every prompt, every manual edit for template reuse
- Run scoring pipeline for Aberdeen (in progress) — decision engine data unlocks hero Top 3 and service recommendations

### Weeks 2-4: Learn from Aberdeen
- Monitor GSC daily for position changes (expect 1-2 week lag for Google to re-crawl and re-rank)
- Track which sections get the most engagement (scroll depth, time-on-section if trackable)
- Identify: Did local content improve branded query rankings ("plumber aberdeen")? Did service sections capture new queries?
- Refine the generation prompts based on what worked
- **Decision gate:** If Aberdeen shows measurable improvement (position gain OR first clicks), proceed with rollout. If not, diagnose before replicating.

### Month 2: Roll Tier 1 to top GSC cities
- **Rollout order** (by GSC impressions × inverse position — most leverage first):
  1. Aberdeen, MD (done — lighthouse)
  2. Aiken, SC (602 impressions, position 20.7 — high impressions, improvable position)
  3. Nashville, TN (590 impressions, position 20.7)
  4. Alameda, CA (343 impressions, position 18.2)
  5. Acworth, GA (256 impressions, has decision engine data)
  6. Worcester, MA (223 impressions, position 17.4)
  7. Abilene, TX (231 impressions, position 40.3 — high impressions but deep position)
  8. Huntsville, AL (134 impressions, position 32.1)
- Run scoring pipeline for all Tier 1 cities (in progress for most)
- Generate + review content: 8 cities × 1 hour = ~1 full day of work
- Deploy in 2 batches (4 cities each) with 1-week gap to monitor

### Month 3+: Tier 2 template build-out
- Build Tier 2 generation pipeline (automated LLM + spot-check)
- Roll to 30-50 cities with GSC traction or population > 50K
- Begin Tier 3 improvements: add zip codes and county names programmatically to all 2,200 cities (zero human cost, small ranking boost)

---

## 7. RISKS

### AI content detection / Google quality signals
**Risk:** Google's helpful content system penalizes "content created primarily for search engines." If our LLM-generated local sections read as SEO filler, we could lose ranking rather than gain it.

**Mitigation:**
- Every generated sentence must contain a verifiable local fact. "Aberdeen homes built in the 1970s often have galvanized pipes" is useful. "Aberdeen is a great place to live with many plumbing needs" is filler.
- Human review catches generic language before publish.
- Cosine similarity check prevents cross-city duplication.
- Our primary content value (plumber review synthesis, decision engine verdicts) is genuinely unique data — not AI-generated opinion. The local context sections are supplementary, not the core.
- **Monitor for:** Position drops within 2 weeks of content deployment. If any Tier 1 city drops, roll back its local content immediately and diagnose.

### Maintenance burden at scale
**Risk:** 20 Tier 1 cities × annual local content review = 20+ hours/year. Utility contact numbers change. Landmarks close. Housing data shifts.

**Mitigation:**
- Local resources section (utility contacts, permit offices) is the most maintenance-intensive. Consider linking to official county websites rather than embedding phone numbers that go stale.
- Climate and housing stock content changes slowly — annual review is sufficient.
- Plumber data (the core content) maintains itself via the automated pipeline.
- **What breaks first:** Utility phone numbers and permit office URLs. These are the highest-churn items. Solution: link to the county's plumbing permit page rather than embedding specific contact details that go stale.

### Cannibalization with future service pages
**Risk:** A deep Aberdeen city page with a "Water Heater Repair" H2 section could compete with a future `/plumber-services/water-heater/aberdeen` page for the same queries.

**Mitigation:**
- The city page's service sections should be 100-150 words each — enough for relevance, not enough to be a standalone ranking page.
- Future service pages would be 1,500-2,500 words of deep service-specific content with a different intent: "how to choose" vs "here are your options."
- When service pages launch, add canonical cross-references: city page links to service page, service page links back to city page's plumber directory.
- **Architecture decision:** The city page is the *directory* (who to call). The service page is the *guide* (what to know). Different user intents, minimal overlap if lengths are managed.

### Cost escalation
**Risk:** 50 Tier 2 cities × $0.06 API + 15 min review = $3 API + 12 hours human. Manageable. But if we expand Tier 1 to 30 cities, that's 30 hours of human review.

**Mitigation:**
- Keep Tier 1 small (8-12 cities) and expand only cities with proven GSC traction.
- Invest human time where ROI is measurable: if a city has 500+ impressions and position < 20, the content investment is justified. If a city has 10 impressions at position 40, it's Tier 3 until it proves otherwise.
- GSC data drives tier promotion — cities graduate from Tier 3 → 2 → 1 based on impression growth, not speculation.
