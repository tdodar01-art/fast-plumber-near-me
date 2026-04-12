# Strategy Brief — Fast Plumber Near Me

**Date:** 2026-04-12
**Status:** In progress — approved 2026-04-12
**Read time:** ~10 minutes

---

## The Goal

**Rankings → Traffic → Backlinks → Conversion → Monetization**

We have 2,250 city pages generating 3,587 impressions and 2 clicks across 45 pages. The site is a verified directory with real review synthesis, honest weaknesses, and a working data pipeline — but Google doesn't yet trust us enough to send clicks, and we only rank for one query shape ("emergency plumber [city]"). The strategy is to massively expand our ranking surface area by targeting the service-specific and award-post queries we currently don't compete for, build backlinks through a badge/outreach program, then let the rising traffic unlock conversion optimization and monetization conversations.

---

## Three Tracks

**Track A — Service-specific city pages.** New route at `/[service]/[state]/[city]` (e.g., `/drain-cleaning/georgia/acworth`). Each page shows plumbers ranked by specialty score from the decision engine, with a "What to Know" section and FAQ grounded in local data. Pages only generate when 3+ plumbers score ≥70 on the relevant specialty. Launches with 6 service types × qualifying cities. **First deliverable:** 5 service pages for Acworth, GA (drain cleaning, water heater, emergency, repiping, bathroom remodel) — data is ready today.

**Track B — Award blog posts with badge outreach.** Blog posts at `/blog/top-3-[service]-[city]-[state]-[year]` ranking the top 3 plumbers per service per city, backed by our 5-dimension scoring methodology. Each winner gets a badge image and embed code linking back to us (dofollow). Outreach at 10 emails/day. Requires a public methodology page at `/blog/how-we-rank-plumbers`. **First deliverable:** 5 award posts for Acworth, GA + methodology page + badge pipeline.

**Track C — General city page improvements.** Update meta tags on all 2,250 city pages from the current title (`Emergency Plumbers in {City}, {State} — 24/7 Verified`) to `{count} Emergency Plumbers in {City}, {State} — Rated & Reviewed (2026)`. Add "same-day" language to hero and FAQ. Inject internal links to Track A/B pages as they go live. **First deliverable:** Meta tag template change across all pages — zero human time, instant deploy.

---

## Data Readiness Matrix

### What we can build today

| City | Decision Engine | Services Ready (3+ plumbers ≥70) | Track A pages | Track B posts |
|------|----------------|----------------------------------|---------------|---------------|
| Acworth, GA | **Complete** (19/19) | All 5 (drain, water heater, emergency, repipe, remodel) | 5 | 5 |
| Bethesda, MD | **Partial** (8/15) | TBD — need to check specialty scores for the 8 scored | 0-5 | 0-5 |

**Track C** (meta tag updates) is ready for all 2,250 pages — no decision engine data needed.

### What's blocked on scoring completion

| City | Plumbers | Pass 1 Done | Verdict | Scoring Status |
|------|----------|-------------|---------|----------------|
| Aberdeen, MD | 17 | 4 of 17 | None | **Re-running now (sequential)** |
| Nashville, TN | 19 | 4 of 19 | None | Queued |
| Aiken, SC | 10 | 5 of 10 | None | Queued |
| Alameda, CA | 12 | 3 of 12 | None | Queued |
| Abilene, TX | 17 | 4 of 17 | None | Queued |
| Worcester, MA | 18 | 5 of 18 | None | Queued |
| San Leandro, CA | 16 | 3 of 16 | None | Queued |

The scoring jobs are running sequentially right now. Each city takes ~30-60 minutes depending on plumber count and review volume. The skip logic handles already-scored plumbers, so these runs will pick up where the crashed parallel runs left off.

Once scored, each city unlocks ~5 Track A service pages + ~5 Track B award posts. Expected total after all scoring: ~45 service pages + ~45 award posts + 2,250 updated city pages.

### What's blocked on other prerequisites

| Prerequisite | Blocks | Status |
|-------------|--------|--------|
| `/[service]/[state]/[city]/page.tsx` route | All Track A pages | Not built |
| Award post generation script | All Track B posts | Not built |
| Methodology page | Track B outreach credibility | Not written |
| Badge generation pipeline | Track B outreach | Not built |
| Outreach email infrastructure (Resend/SendGrid) | Track B emails | Not configured |
| `sitemap-services.xml` | Track A indexing | Not built |

---

## First 10 Pages/Posts to Produce (Execution Order)

| # | Type | City | Service/Content | Track | Status |
|---|------|------|----------------|-------|--------|
| 1 | Meta update | All 2,250 cities | New title + description template | C | **SHIPPED** — commit `708fde6` |
| 2 | City page tweak | All 2,250 cities | Add "same-day" language to hero + FAQ | C | **SHIPPED** — commit `708fde6` |
| 3 | Blog post | — | `/blog/how-we-rank-plumbers` methodology page | B | Not started |
| 4 | Service page | Acworth, GA | `/drain-cleaning/georgia/acworth` | A | **SHIPPED** — commit `1367977` |
| 5 | Service page | Acworth, GA | `/water-heater-repair/georgia/acworth` | A | **SHIPPED** — commit `1367977` |
| 6 | Service page | Acworth, GA | `/burst-pipe-repair/georgia/acworth` | A | **SHIPPED** — commit `1367977` |
| 7 | Award post | Acworth, GA | Top 3 Drain Cleaning in Acworth (2026) | B | Not started |
| 8 | Award post | Acworth, GA | Top 3 Water Heater Repair in Acworth (2026) | B | Not started |
| 9 | Service page | Acworth, GA | `/repiping/georgia/acworth` | A | **SHIPPED** — commit `1367977` |
| 10 | Service page | Acworth, GA | `/bathroom-remodel-plumbing/georgia/acworth` | A | **SHIPPED** — commit `1367977` |

Items 1-2 ship immediately (template changes). Item 3 requires ~2 hours of writing. Items 4-10 require building the route infrastructure first (~1 day), then content generation (~1 day for the batch).

After this first batch, the next 10 pages come from the first city to finish scoring (likely Aberdeen or Aiken based on remaining plumber count).

---

## Open Decisions

**1. Service page route pattern: `/[service]/[state]/[city]` or `/plumber-services/[service]/[state]/[city]`?**

Recommended: `/[service]/[state]/[city]`. Shorter URLs, service keyword in the first path segment (slight SEO benefit), and matches competitor patterns. The longer prefix adds nothing. If we later consolidate under a prefix, redirects are simple.

**2. Award post route: `/blog/top-3-...` or dedicated `/awards/...` section?**

Recommended: `/blog/top-3-...`. Blog posts get the existing blog sitemap, blog index page, and blog schema. A separate `/awards/` section requires new infrastructure for no clear benefit. The blog route also makes the content feel editorial rather than algorithmic, which helps with both user trust and Google's helpful content evaluation.

**3. Badge generation: Nano Banana AI service vs template SVG?**

Recommended: Template SVG. It's free, consistent, doesn't depend on a third-party service, and for a "Top 3 Plumber" badge, visual simplicity is better than AI-generated flair. Build a single SVG template, swap city/service/plumber name/year via string interpolation, render to PNG with sharp or canvas.

**4. Outreach email service: Resend or SendGrid?**

Recommended: Resend. Simpler API, lower cost for low volume (10/day), modern developer experience. SendGrid is overkill at this scale. Either way, set up SPF/DKIM/DMARC on the fastplumbernearme.com domain first.

**5. Should Bethesda get content with only 8/15 plumbers scored?**

Recommended: No. Wait for the re-run to complete all plumbers. Partial scoring means the specialty rankings and "top 3" designations could change. Producing award posts with incomplete data risks publishing inaccurate rankings that we'd need to correct — bad for credibility with plumbers receiving (or not receiving) awards.

**6. When do we run `export-firestore-to-json.js` to update the committed JSON?**

Recommended: After all 7 re-runs complete. One export, one Vercel rebuild. Running it per city would trigger 7 rebuilds and 7 git commits for data that isn't user-facing yet (decision engine data isn't rendered on city pages until we build the UI).

**7. Minimum viable Track B: do we need the full badge pipeline before sending outreach?**

Recommended: Yes, include the badge. The badge IS the outreach value proposition. "Congratulations, you're top 3" without a badge is just an email. "Here's a badge for your website" gives the plumber something tangible, and the embed code is the backlink mechanism. Ship badge pipeline in Week 1 alongside the first posts.

**8. Do we build the weekly GSC reporting script in Week 1 or defer?**

Recommended: Defer to Week 3. In Week 1, manual GSC checks are fine — you're looking at 10 new URLs. The reporting script becomes valuable once we have 50+ pages across tracks and need automated trend detection. Building it earlier is premature infrastructure.

---

## What We Are Explicitly NOT Doing

**Not upgrading city page content depth yet.** The aberdeen-lighthouse.md plan proposes 4,500-word Tier 1 city pages with local context, service breakdowns, and local resources. We're deferring this. Track A service pages address the service-depth gap more efficiently (dedicated pages rank better than H2 sections within a city page). Track C meta updates address the CTR gap. Local depth content for city pages is a Month 2 initiative — after we see whether Track A pages cannibalize or complement city page rankings.

**Not building the decision engine UI on city pages yet.** Verdict badges, "Top 3 Picks" hero sections, and evidence quote toggles on PlumberCard are high-impact but require UI development time. The decision engine data is the foundation — it powers Track A and B content. The city page UI upgrade comes after the content tracks are live and generating impressions.

**Not fixing the website click tracking gap yet.** PlumberCard has an untracked `<a href={plumber.website}>` at line 369. This is a monetization-critical data gap but monetization is last in the goal hierarchy. We'll fix it when we start the conversion optimization phase.

**Not building the sticky bottom CTA for city pages.** Same reasoning — conversion optimization is premature when we're generating 2 clicks total.

**Not expanding the Outscraper cap or adding star-rating stratification.** The Black Diamond data quality audit identified a coverage gap (5 of 6,632 reviews cached). Fixing this improves data quality but doesn't directly generate new ranking surface area. The scoring pipeline works with the reviews we have. Outscraper improvements are a Month 2 data quality initiative.

**Not scaling beyond 9 cities in Month 1.** The scoring pipeline, content generation, and outreach all need to prove themselves before we scale. If Acworth's 5 service pages + 5 award posts generate zero impressions after 30 days, scaling to 50 cities would waste time. Prove the model, then scale.

**Not building the plumber self-service portal or Stripe integration.** Monetization is real but premature. We need traffic and demonstrable lead value before the first revenue conversation. The data we're collecting (phone clicks, engagement, now website clicks if we add tracking) builds the case for future paid placements.

---

## References

- [Aberdeen Lighthouse Plan](aberdeen-lighthouse.md) — ranking/CTR/conversion diagnostic, 15 proposed fixes, success metrics
- [Content Depth Strategy](content-depth-strategy.md) — tiered city page approach, Tier 1 template spec, generation pipeline
- [Long-Tail Content Strategy](long-tail-content-strategy.md) — full Track A/B/C specs, data readiness, measurement framework, execution plan
