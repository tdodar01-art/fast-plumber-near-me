# Fast Plumber Near Me — ROADMAP

## Vision

An emergency plumber directory at fastplumbernearme.com that connects people with plumbers who actually pick up and show up. We synthesize real Google review data and display each plumber's strengths and weaknesses honestly — no fake badges, no pay-to-play rankings. When someone has a burst pipe at 2am, we help them find a plumber they can trust, fast.

Start local (northern IL suburbs), scale nationally. Monetize through premium listings and/or pay-per-lead.

## Tech Stack

- **Framework:** Next.js 16 (App Router) on Vercel
- **Database:** Firebase Firestore
- **Auth:** Firebase Auth (admin panel + future plumber self-service)
- **Domain:** fastplumbernearme.com
- **Data Source:** Google Places API (free monthly credits — max them out each month, never exceed them)
- **Analytics:** GA4 + Google Search Console
- **Future (Phase 4):** ElevenLabs + Twilio + Claude API for AI verification calls

---

## Known Risks & Mitigations

### 🚨 Google Dependency (BIGGEST RISK)
Everything depends on Google — Places API for data, reviews for our differentiator, rankings for traffic. If Google throttles, reprices, or restricts review access, our data layer breaks.

**Mitigations (non-negotiable):**
- **Cache everything for plumbers in our system.** When a plumber enters our system via Google Places API, their record and reviews get cached permanently in Firestore. We don't proactively scrape every plumber in America — we cache as we grow, city by city. Firestore is the source of truth. Google is just the intake pipe.
- **Build our own dataset over time.** First-party signals (click-to-call events, user reports, call tracking data) reduce Google dependency with every interaction.
- **Add first-party signals ASAP.** Track clicks, calls, time-on-page per plumber. These become our own quality signals that don't depend on Google.
- **Review text gets cached permanently.** Even if Google restricts review API access tomorrow, we still have every review we've ever pulled, and our synthesis of it.
- **Review refresh cycle keeps data fresh.** Existing plumbers get checked for new reviews on a regular cadence. We only fetch reviews newer than our latest cached review — never re-fetch old ones.

### ❌ Review Synthesis Can Become Generic Fast
If we're not careful, every plumber gets "Customers say they are reliable and professional." That's useless and makes us no different than anyone else.

**The bar for review synthesis:**
- Summaries must be SPECIFIC and PUNCHY — not generic praise
- Good example: "Answers calls fast but often books out 2–3 days — not ideal for true emergencies"
- Good example: "Multiple reviewers mention surprise fees after the initial quote"
- Good example: "Highly rated for water heater installs, but no reviews mention after-hours work"
- Bad example: "Customers say they are reliable and professional"
- Bad example: "Highly recommended by many satisfied customers"
- The synthesis should read like advice from a friend who's done the research, not like a marketing blurb
- Emergency-specific signals matter most: Does this plumber actually show up at 2am? Do reviewers mention fast response? Or do they all say "great work" but only during business hours?

### ⚠️ SEO Will Be a Grind
Emergency plumbing is one of the most competitive local SEO spaces on earth. We're up against Google's own local pack, Yelp, Angi, HomeAdvisor, and individual plumber sites with years of domain authority.

**Our edge must be:**
- Speed — fastest-loading directory pages on the internet (we already have 99 PageSpeed)
- UX — mobile-first, zero friction, one-tap calling
- Trust signals — honest review synthesis, not just star ratings
- Differentiation — we show weaknesses too. Nobody else does that. That's why people trust us.

### ⚠️ Monetization Timing Risk
Directories die when they monetize too early (no traffic) or too late (no revenue loop). Our plan puts monetization in Phase 2 after traffic grows — that's correct. BUT we should test monetization early on a small scale. Even 1 plumber paying $50/month = validation that the model works. Don't wait for perfect traffic numbers to have the first revenue conversation.

---

## Current Status (updated April 5, 2026)

### What's Built

**Site & Pages:**
- 2250+ city pages with plumber listings, SEO meta, JSON-LD (breadcrumb + FAQ + AggregateRating), OG images
- City pages use static JSON fallback with 20-mile Haversine radius matching — works at build time without Firestore
- 135+ plumber profile pages with full AI synthesis, cached reviews, KPI cards, red flags, badges, JSON-LD
- PlumberCard is tappable — links to plumber detail page at `/plumber/[slug]`
- Red flags displayed on PlumberCard (red pills with warning icon) — same on mobile and desktop
- 51 state pages
- Homepage with search + geolocation (fuzzy matching across all 2,300+ cities, handles "City, ST" format, St./Saint and Mt./Mount normalization)
- Blog (8 posts with custom markdown renderer + HTML sanitization)
- Directory index + plumber directory with filters
- Admin dashboard (Firebase Auth, plumber/city/lead/submission management, pagination, confirmation dialogs)
- Business submission form (dynamic CITY_LIST, all available cities)
- Contact form (writes to Firestore, success/error states)
- OG image generation (edge runtime)
- PWA manifest
- Firestore security rules (firestore.rules)

**Data Pipeline:**
- `scripts/daily-scrape.js` — scrapes new cities, synthesizes with Claude Sonnet, commits JSON to git
- `scripts/upload-to-firestore.js` — uploads synthesized JSON to Firestore plumbers collection (firebase-admin SDK)
- `scripts/refresh-reviews.ts` — review accumulation, closure detection, auto-flagging, reliability scoring (firebase-admin SDK)
- `scripts/synthesize-reviews.ts` — Claude AI (Haiku) synthesis with keyword fallback for <3 reviews (firebase-admin SDK)
- GitHub Actions daily pipeline fully operational — all 4 phases: scrape → Firestore upload → review refresh → AI synthesis
- All scripts use firebase-admin SDK with service-account.json (bypasses Firestore security rules)
- 246 plumbers scraped across 27 cities (21 IL + 6 out-of-state: Alameda CA, Nashville TN, Acworth GA, Yukon OK, Aiken SC, Mundelein IL)
- 100+ reviews cached in Firestore reviews collection via refresh cycle
- Pipeline activity logged to `pipelineRuns` collection (viewable in admin Activity tab)
- Budget guard hardened: shared module `scripts/lib/budget-guard.ts`, hard stop at 90%, per-phase allocation (expansion 60%, refresh 30%, reserve 10%)
- Expansion queue: `scripts/seed-expansion-queue.ts` ready, Firestore-based, priority IL → adjacent states → population
- API usage tracking in Firestore `apiUsage` collection
- All IL-only hardcoding removed from pipeline scripts (daily-scrape, upload-to-firestore, seed-from-outscraper)

**GSC Expansion System (fully automated):**
- GSC API access verified and working (service account has siteFullUser permission)
- `scripts/gsc-pull-test.js` — test GSC API access, display 90-day page data
- `scripts/gsc-expansion.js` — pull GSC data, find cities with impressions but no plumber data, create stub docs in cities collection, write `data/gsc-expansion-queue.json`
- `scripts/gsc-prepend-queue.js` — geocode new cities (Google Maps Geocoding API), add coords to `city-coords.ts`, prepend to scrape queue
- `scripts/seed-cities-collection.js` — seed Firestore `cities` collection from synthesized data (run once — done, 27 cities seeded)
- `googleapis` npm package installed
- `daily-scrape.js` auto-updates Firestore `cities` collection after each successful scrape (non-blocking)
- Firestore `cities` collection: 2257 docs total, 28 scraped, single source of truth for city tracking
- First GSC-driven scrape completed: Ardmore, OK (found via impressions, scraped, live)
- **GitHub Actions automated:** daily workflow runs GSC expansion → prepend → scrape → upload → refresh → synthesize → commit (all GSC steps continue-on-error so normal scrape is never blocked)

**Review Synthesis:**
- Claude AI (Haiku) synthesis engine with keyword fallback for plumbers with <3 reviews
- New fields: `summary`, `emergencyReadiness`, `emergencyNotes`, `aiSynthesizedAt`, `synthesisVersion`
- PlumberCard shows AI summary and emergency readiness indicator
- Badges earned from review data: Fast Responder, Fair Pricing, 24/7 Verified, Clean & Professional, Good Communicator
- Strengths/weaknesses displayed on PlumberCard (green/amber text)
- Red flags tracked: pricing complaints, slow response, communication issues, quality concerns

**First-Party Signals:**
- Click-to-call lead tracking (persists to Firestore leads collection with plumberName, plumberPhone, city, state, citySlug, pageUrl, referrer)
- User report button on every PlumberCard + plumber detail page
- Reports saved to plumberReports collection
- Engagement tracking: time-on-card (5s/15s/30s thresholds via IntersectionObserver)
- Quick-bounce detection on plumber detail page (leaves within 10s)
- All engagement events saved to plumberEngagement collection
- Auto-flagging: 3+ negative user reports in 90 days → flagged with amber warning
- `reliabilityScore` calculated from real data (phone, website, rating, reviews, red flags, freshness)
- `verificationStatus` auto-updated (verified/partially_verified/unverified)

**Infrastructure:**
- Rate limiting (10 req/min/IP) + origin checking on all public API routes
- Shared Firestore CRUD helpers — admin pages use shared functions
- Scoring: 0-100 range, red flag penalties (-5 each, max -20), flagged plumber -20 penalty, reliability score 10% weight
- Vercel build passing (2250+ pages, typescript.ignoreBuildErrors for @types/react-dom bug)
- Security headers configured
- NEXT_PUBLIC_BUSINESS_PHONE env var for emergency CTA (hidden if unset)
- Firebase env vars configured on Vercel (all 6 NEXT_PUBLIC_FIREBASE_*)
- GitHub Actions: 9 secrets configured (3 API keys + 6 Firebase config)
- GitHub token has `workflow` scope — can push workflow file changes
- GitHub Actions workflow fixed: step-output pattern for secret checks, tsx for TS execution

### Resolved Issues
- [x] Lead tracking — Firestore write wired up, clicks persist to leads collection
- [x] Contact form — onSubmit handler, writes to contactSubmissions, success/error states
- [x] Phone number — env var NEXT_PUBLIC_BUSINESS_PHONE, hidden if unset
- [x] Blog renderer — HTML tags stripped before markdown parsing
- [x] Admin confirmation dialogs — all destructive actions require confirmation
- [x] Admin pagination — 25 per page on plumbers, cities, leads
- [x] City dropdown — dynamic CITY_LIST import (all available cities)
- [x] Firestore helpers — full CRUD, admin pages use shared functions
- [x] Rate limiting — 10 req/min/IP + origin checking on all public APIs
- [x] Vercel build — passing (typescript.ignoreBuildErrors for @types/react-dom@19.2.3 bug)

### Open Issues
- [x] City coordinates — priority IL cities + 30 additional IL cities added
- [ ] Mobile QA pass not done
- [ ] Favicon/icons not created yet (/icon-192.png, /icon-512.png)
- [ ] Firestore rules not deployed (`firebase deploy --only firestore:rules`)
- [x] GSC sitemap submitted — 2,321 pages discovered (April 3, 2026)
- [ ] GA4 not verified
- [x] GitHub Actions workflow — fixed (workflow scope token, secrets pattern, tsx, firebase-admin)
- [x] City pages showing 0 plumbers — fixed (static JSON fallback with 20-mile radius matching)
- [x] PlumberCard not tappable — fixed (links to /plumber/[slug], stopPropagation on action buttons)
- [x] Red flags missing from PlumberCard — fixed (red pills with AlertTriangle icon)
- [x] Pipeline Phases 2-3 failing — fixed (converted to firebase-admin SDK, PERMISSION_DENIED resolved)

---

## Phase 1: Complete the MVP

Priority: Fix what's broken, wire up the data pipeline with caching, build the review synthesis engine, and get SEO rolling.

### 1A — Fix Critical Issues ✅ DONE
- [x] Uncomment and wire up Firestore write in /api/track-lead
- [x] Fix contact form — add submit handler, send to Firestore or email
- [x] Replace hardcoded +18155555555 with real business number or remove
- [x] Add HTML escaping to blog markdown renderer
- [x] Add confirmation dialogs to admin approve/reject/toggle actions

### 1B — Google Places Data Pipeline + Caching Layer
We use the Google Places API directly — no middleman. Free monthly credits. Max them out, never exceed them. Cache everything for plumbers in our system.

**How caching works:**
- We do NOT proactively scrape every plumber in America. We cache data for plumbers as they enter our system — city by city, as we expand.
- When a plumber is first pulled from Google Places API → their full record + all available reviews get stored permanently in Firestore.
- Firestore is the source of truth. Google is the intake pipe.
- Before making any API call, check Firestore first — only fetch from Google if we don't have the data or it's stale.
- Reviews are immutable — once cached, cached forever. We never re-fetch a review we already have.

**Caching schema:** ✅ BUILT
- [x] `plumbers` collection — full plumber record cached permanently (uses placeId as doc ID)
- [x] `reviews` collection — individual review documents, deduplicated by googleReviewId hash
- [x] `ratingSnapshots` collection — timestamped rating/review count snapshots
- [x] `apiUsage` collection — monthly call counts, credits used, credits remaining

**Review refresh cycle:** ✅ BUILT (scripts/refresh-reviews.ts)
- [x] Every plumber checked on 30-day cadence
- [x] Only fetches reviews newer than most recent cached review (hash dedup)
- [x] Never re-fetches old reviews — immutable once cached
- [x] Re-runs synthesis engine when new reviews arrive
- [x] Tracks `lastReviewRefreshAt` on each plumber record
- [x] Review refreshes count against monthly API budget
- [x] Priority refresh: high-traffic plumbers (most leads) refreshed first

**Pipeline tasks:** ✅ BUILT (scripts/fetch-plumbers-v2.ts)
- [x] New fetch script uses Google Places API (New) v1 endpoints — works for any state
- [x] Budget guard stops at 90% of $200/mo free tier, tracks usage in Firestore
- [x] GitHub Actions runs fetch → refresh → synthesize daily with split budget
- [x] Automated pipeline: check Firestore cache → fetch only new/stale → cache → city pages
- [x] Deduplicates by placeId, appends to serviceCities for multi-city plumbers
- [x] Fill in city coordinates — priority IL cities + 30 additional IL cities added

### 1C — Google Review Synthesis (THE DIFFERENTIATOR)
This is what sets us apart. We pull real Google review data and present each plumber's strengths AND weaknesses honestly. The synthesis must be specific and punchy — never generic.

**Quality standard for all synthesis output:**
- ✅ "Answers calls fast but often books out 2–3 days — not ideal for true emergencies"
- ✅ "Multiple reviewers mention surprise fees after the initial quote"
- ✅ "Highly rated for water heater installs, but no reviews mention after-hours work"
- ✅ "3 of 12 reviews mention the tech arrived within an hour of calling"
- ❌ "Customers say they are reliable and professional"
- ❌ "Highly recommended by many satisfied customers"

**Build tasks:** ✅ BUILT (scripts/synthesize-reviews.ts + PlumberCard)
- [x] Pull Google review data via Places API (rating, review count, individual review text)
- [x] Cache ALL review text permanently in Firestore `reviews` collection
- [x] Build review synthesis engine — keyword analysis extracts:
  - Strengths with specifics (fast response, fair pricing, professionalism)
  - Weaknesses with specifics (pricing complaints, slow response, communication)
  - Emergency-specific signals: response time, after-hours, urgency mentions
  - Red flags: pricing, no-shows, quality issues
- [x] Display synthesized strengths/weaknesses on PlumberCard (green/amber text)
- [x] Show Google rating + review count prominently
- [x] Sort/rank plumbers by composite quality score (rating 40% + reviews 30% + emergency 20% + badges 10%)
- [x] Badge system: "Fast Responder", "Fair Pricing", "24/7 Verified by Reviews", "Clean & Professional", "Good Communicator"
- [x] Badges EARNED from review data via keyword matching, not self-reported
- [x] Re-synthesize automatically when new reviews come in via the refresh cycle

### 1D — First-Party Signal Collection ✅ DONE
Start building our own quality data that doesn't depend on Google. Every user interaction becomes a data point.

- [x] Track click-to-call events per plumber (persists to Firestore leads collection)
- [x] Track time-on-card per plumber (IntersectionObserver: 5s/15s/30s thresholds → plumberEngagement)
- [x] Track quick-bounce on plumber detail page (leaves within 10s → plumberEngagement via sendBeacon)
- [x] User report button on PlumberCard + plumber detail page — saves to plumberReports collection
- [x] Store all first-party signals in Firestore (leads + plumberReports + plumberEngagement)
- [x] Composite quality score blends Google rating + review count + emergency signals + badges (scoring.ts)

### 1E — SEO Plan & Execution

**Target Keywords:**
- Primary: "emergency plumber [city]"
- Secondary: "24 hour plumber [city]", "plumber near me [city]", "emergency plumbing [city] IL"
- Long-tail: "burst pipe plumber [city]", "water heater repair [city] emergency"

**Technical SEO:** (MOSTLY DONE)
- [x] XML sitemap auto-updates from cities-data (fixed broken plumber-data import)
- [x] Submit sitemap to Google Search Console — 2,321 pages discovered (April 3, 2026)
- [ ] Verify GA4 tracking is firing correctly (Tim to verify)
- [x] Internal linking — every city page links to nearby cities
- [x] Canonical URLs — metadataBase handles this for all pages
- [x] Breadcrumb schema on state and city pages (JSON-LD)
- [x] AggregateRating schema on city pages (aggregates all plumber ratings)

**Content Engine (Seinfeld Plan — 1 city page per day):**
- [ ] Priority queue — start with northern IL:
  1. Crystal Lake → McHenry → Algonquin → LITH → Huntley
  2. Woodstock → Cary → Marengo → Harvard → Carpentersville
  3. Elgin → South Elgin → St. Charles → Geneva → Batavia
  4. Aurora → Naperville → Wheaton → Schaumburg → Arlington Heights
  5. Expand outward
- [ ] Each city page: unique H1, 150-300 word city-specific intro, plumber listings with synthesized reviews, common emergencies section, FAQ with JSON-LD schema, nearby cities links
- [ ] Blog content strategy: long-tail keywords ("what to do when pipe bursts", "emergency plumber cost", "how to shut off water main")

**Local SEO:**
- [ ] Google Business Profile for the directory itself
- [ ] Backlinks from local IL sites, plumbing trade sites, home improvement blogs

### 1F — MVP Polish ✅ DONE (except mobile QA)
- [x] Firestore security rules — firestore.rules created with proper read/write permissions
- [x] Add firestore.ts write helpers (create/update/delete) — admin pages refactored
- [x] Rate limiting (10 req/min/IP) + origin checking on all API routes
- [x] Fix add-your-business city dropdown — dynamic CITY_LIST import
- [x] Admin pagination (25 per page) on plumbers, cities, and leads
- [ ] Mobile QA pass (TODO)
- [x] PWA manifest created (icon placeholders at /icon-192.png, /icon-512.png)

---

## Phase 2: Monetization

Start building after Phase 1 traffic is growing and review synthesis is live. BUT — test early on a small scale. Even 1 plumber paying $50/month = validation. Don't wait for perfect traffic to have the first revenue conversation.

### Listing Tiers
- **Free:** Basic listing — name, phone, Google rating, synthesized review highlights. Sorted by review quality signals
- **Premium ($49-99/month per city):** Highlighted card, above free results, larger CTA, website link, "Years in Business", full review synthesis visible
- **Featured ($149-199/month per city):** Top of page spotlight, banner, lead tracking dashboard, everything in Premium

### Pay-Per-Lead (Alternative/Add-on)
- Track click-to-call events per plumber per city
- Charge $5-15 per verified call click
- Plumber dashboard to see leads
- Monthly invoicing

### Plumber Self-Service Portal (Maybe)
- Plumber claims listing
- Update business info, hours, service area, photos
- View lead analytics
- Manage subscription tier

### Build Tasks
- [ ] Premium/Featured tier UI on city pages
- [ ] Stripe integration for plumber subscriptions
- [ ] Lead tracking dashboard for paying plumbers
- [ ] Billing system (monthly invoices)
- [ ] Plumber self-service portal (if validated — may start with manual onboarding)
- [ ] Email notifications: new leads, new submissions, subscription alerts

---

## Phase 3: Scale

Expand beyond Illinois once revenue model is validated.

### Geographic Expansion
- [ ] State by state — adjacent first: WI, IN, IA, MO
- [x] Remove all IL-only hardcoding from scripts and data maps — DONE (removed 5 `|| "IL"` fallbacks across 3 scripts)
- [ ] Automated pipeline: Google Places API → Firestore → city page generation at scale
- [ ] Scale daily API budget as revenue supports it

### Product Expansion
- [ ] Customer review submission (augment Google data with first-party reviews)
- [ ] Map view of plumbers on city pages
- [ ] SMS/email notifications when plumbers get leads
- [ ] Expand to other emergency trades (electricians, HVAC, locksmiths)
- [ ] National SEO strategy

---

## Phase 4: AI Verification Calls

The original moat idea. Same ElevenLabs + Twilio + Claude stack as AOK's phone system ("Sarah"), flipped inbound → outbound. Build after AOK system is battle-tested.

### Architecture
```
Cron Job (scheduled) → Twilio Outbound Call → Plumber's Phone
                              ↓
                     ElevenLabs Voice AI (Claude-powered)
                              ↓
                     Firestore: Log Result + Update Reliability Score
```

### Build Tasks
- [ ] Twilio outbound calling (dedicated number)
- [ ] ElevenLabs voice agent with verification script
- [ ] Call script: "Hi, I'm calling from Fast Plumber Near Me. We're verifying emergency availability. If a homeowner had a burst pipe right now, could you send someone today? How quickly?"
- [ ] Claude API for conversation handling + transcript logging
- [ ] Cron job — each plumber called 2-4x/month at random times (business hours, evenings, weekends, holidays)
- [ ] Scoring algorithm:
  - Answer rate (40%)
  - Response time (20%)
  - Availability confirmed (30%)
  - Estimated arrival time (10%)
  - Minimum 3 calls before score displays
  - Scores decay after 30 days
- [ ] "Verified Responsive" badge on frontend
- [ ] Reliability score bar on plumber cards
- [ ] Verification call logs in admin dashboard

---

## Blog Post Cluster Strategy

**Trigger:** GSC shows a city page crossing an impression threshold (e.g. 50+ impressions). Google is telling us this market has demand — invest in it.

**Action:** Generate a cluster of 8-10 supporting posts per qualifying city, all linking to/from the city page and individual plumber detail pages. All content generated from existing Firestore plumber data (scores, review synthesis, strengths, weaknesses, red flags, emergency signals).

### Post Types per City Cluster

**Comparison/Rankings**
- "Best Emergency Plumbers in [City] [State] ([Year] Rankings)" — scored ranking with strengths/weaknesses breakdown

**Situational/Problem-Specific** (filtered by review signal data)
- Burst pipe emergencies
- Sump pump repair
- Water heater emergencies
- Clogged drain / sewer backup

**Pricing/Decision-Making**
- "How Much Does an Emergency Plumber Cost in [City]?"
- "Should You Call an Emergency Plumber or Wait?"

**Seasonal**
- Frozen pipes (winter)
- Spring flooding / sump pump failures

**Trust/Transparency**
- "Red Flags to Watch For When Hiring a Plumber in [City]" — powered by red flag data

### Annual Awards Program
- "Best Emergency Plumber in [City] — [Year] Award" for each city with enough data
- Category awards: Fastest Response, Best Communication, Most Transparent Pricing
- Awards derived from quality scoring system — data-backed, not arbitrary
- Outreach to winners with badge graphic for their website (links back to award page)
- Annual refresh creates recurring backlink acquisition cycle

### Internal Linking
- Every post links back to its parent city page
- Every post links to relevant plumber detail pages
- City page updated with outbound links to its cluster posts
- Plumber detail pages get inbound links from relevant posts

### Content Refresh
- Posts regenerate when plumber scores change significantly (10+ point swing or ranking position change)
- dateModified updates signal freshness to Google
- Cadence: monthly or quarterly check, not on every review update

### Backlink Strategy
- City pages don't attract backlinks — posts do
- Pricing guides and comparison posts are linkable assets for journalists, bloggers, real estate sites
- Award pages generate backlinks from winning plumbers linking back with badge
- Flywheel: more cities → awards → plumber shares/links → domain authority → higher rankings → more traffic

---

## Key Design Decisions

- **Cache everything for plumbers in our system.** We don't scrape every plumber in America upfront. As plumbers enter our system city by city, their data and reviews get cached permanently in Firestore. The dataset grows with us.
- **Review refresh cycle.** Existing plumbers get checked for new reviews every 30 days. Only new reviews get fetched. Synthesis re-runs when new data arrives. Refresh priority goes to high-traffic plumbers first. Refreshes count against the monthly API budget.
- **Review synthesis must be specific and punchy.** "Reliable and professional" is banned. We show real strengths, real weaknesses, with specifics. That's why people trust us.
- **First-party signals compound over time.** Every click, every call, every user report makes our data better and less dependent on Google.
- **Data source is Google Places API** — no Outscraper, no middleman. Free monthly credits. Max them out, never exceed them.
- **This is NOT Angi or HomeAdvisor.** No account for users, no lead auction, no upsells. Clean, fast, one job: connect people with a plumber NOW.
- **Design:** Deep blue (#1a365d) primary, red (#e53e3e) for urgency, white background, green for verified/positive. Mobile-first.
- **Firebase graceful degradation** — site still renders without Firebase.

---

## Dependencies & Sequencing

1. **Phase 1** — now. Fix critical bugs first, then pipeline + caching + reviews + SEO in parallel
2. **Phase 2** — after Phase 1 traffic grows, but test early (even 1 paying plumber = validation)
3. **Phase 3** — after Phase 2 revenue validates. Revenue funds API scaling
4. **Phase 4** — after AOK AI phone system is battle-tested. Port the architecture

---

## What's Next

Phase 1 code is complete. Remaining work is operational — run the pipeline, verify output quality, let it bake.

### Current Focus: Dial In the 5-Review Pipeline

Before expanding aggressively or adding new review sources, we need to make sure our existing Google Places API pipeline is running smoothly and producing high-quality results with the 5 reviews we get per API call. This means:

1. Run the pipeline on our existing plumber set and verify:
   - AI synthesis produces specific, punchy summaries (not generic)
   - Badges are earned correctly from review data
   - Closure detection catches closed businesses
   - Scoring produces reasonable rankings
   - Budget tracking is accurate

2. Polish the city page experience:
   - Plumber cards display well with AI synthesis data
   - Emergency readiness indicators are clear and useful
   - Flagged/unverified plumbers display appropriately
   - Search from homepage reliably routes to correct city pages

3. Let the daily pipeline run for 2-4 weeks on existing coverage to:
   - Accumulate additional unique reviews via natural refresh cycle variance
   - Build confidence that the budget guard holds
   - Catch any edge cases in synthesis, scoring, or closure detection

4. Outscraper or SerpAPI for additional reviews = Phase 2 (after pipeline is proven and generating revenue)

### IN PROGRESS: GSC-Driven Expansion

Google Search Console shows we're already getting impressions on city pages — including out-of-state cities (Aiken SC, Yukon OK, Nashville TN, Acworth GA, Alameda CA). Google is testing our pages and we need to fill them with real plumber data before it moves on.

**Strategy:** Don't replace the daily IL expansion. Layer GSC intelligence on top of it:
- GSC pull: scrape impressions/clicks/position for all /emergency-plumbers/ pages
- Track every city in Firestore `cities` collection: status (empty/scraped/has_plumbers), plumber count, GSC signals
- Cities with impressions but no plumber data = highest scrape priority, jump the queue
- Daily scrape handles GSC-priority cities FIRST, then continues normal geographic expansion with remaining budget
- Admin dashboard shows city tracking table: impressions, clicks, position, plumber count, status

**Prerequisites:**
- [ ] GSC API enabled on GCP project (Tim manual — GCP console)
- [ ] Service account added as user in GSC for fastplumbernearme.com (Tim manual — GSC UI)
- [ ] Confirm GSC API works with existing service-account.json (run `node scripts/gsc-pull-test.js`)
- [ ] service-account.json on local dev machine (download from Firebase console)

**Scripts built:**
- [x] `scripts/gsc-pull-test.js` — test GSC API access, show 7 days of page data
- [x] `scripts/gsc-expansion.js` — pull GSC data, find cities with impressions but no plumber data, write expansion queue
- [x] `scripts/seed-cities-collection.js` — seed Firestore `cities` collection from plumbers-synthesized.json (run once)
- [x] `googleapis` npm package installed

**Firestore `cities` collection schema:**
```json
{
  "slug": "alameda-ca",
  "city": "Alameda",
  "state": "CA",
  "source": "gsc" | "cron" | "manual",
  "firstSeenGSC": "2026-04-05" | null,
  "impressionsAtDiscovery": 12 | null,
  "scraped": true,
  "scrapedAt": "2026-04-05T00:00:00Z",
  "scrapeSource": "google-places",
  "plumberCount": 12
}
```

**Remaining build tasks:**
- [x] Daily scrape prepends GSC-priority cities before normal queue — DONE (gsc-prepend-queue.js runs in GitHub Actions before daily-scrape.js)
- [ ] Admin dashboard city tracking table with color-coded status
- [x] GitHub Actions workflow for GSC pull — DONE (integrated into daily workflow, not separate — runs daily with continue-on-error)

### Operational TODO (Tim manual)
- [ ] Run `npx tsx scripts/seed-expansion-queue.ts` to seed expansion queue
- [x] Add Firebase secrets to GitHub Actions — DONE (9 secrets: 3 API keys + 6 Firebase config)
- [x] Verify ANTHROPIC_API_KEY is in GitHub Secrets — DONE
- [x] Submit sitemap to Google Search Console — DONE (2,321 pages discovered)
- [ ] Verify GA4 is firing
- [ ] Enable Places API (New) on Firebase GCP project (needed for refresh-reviews to call Google directly)
- [ ] Mobile QA pass
- [ ] Create favicon/icons
- [ ] Deploy Firestore rules (`firebase deploy --only firestore:rules`)
- [ ] Download service-account.json to local dev machine (Firebase Console > Project Settings > Service accounts)
- [ ] Enable Search Console API in GCP (https://console.cloud.google.com/apis/library/searchconsole.googleapis.com?project=fast-plumber-near-me)
- [ ] Add service account email as user in GSC with Restricted permission
- [ ] Run `node scripts/gsc-pull-test.js` to verify GSC API access
- [ ] Run `node scripts/seed-cities-collection.js` to seed Firestore cities collection

---

*Last updated: April 5, 2026*
*Owner: Tim Dodaro*
*Contact: fastplumbernearme@gmail.com*
