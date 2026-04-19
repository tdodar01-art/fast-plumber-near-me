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

## Current Status (updated April 6, 2026)

### What's Built

**Site & Pages:**
- 2250+ city pages with plumber listings, SEO meta, JSON-LD (BreadcrumbList + ItemList with Plumber items + FAQPage + Review with positiveNotes/negativeNotes), OG images
- City pages use static JSON fallback with 20-mile Haversine radius matching — works at build time without Firestore
- 135+ plumber profile pages with full AI synthesis, cached reviews, KPI cards, red flags, badges, BBB data bar, JSON-LD (BreadcrumbList + Plumber with geo + Review with pros/cons)
- PlumberCard is tappable — links to plumber detail page at `/plumber/[slug]`
- Red flags displayed on PlumberCard (red pills with warning icon) — same on mobile and desktop
- 51 state pages
- Homepage with search + geolocation (fuzzy matching across all 2,300+ cities, handles "City, ST" format, St./Saint and Mt./Mount normalization)
- Blog (8 hand-written posts + AI-generated city blog clusters with custom markdown renderer + HTML sanitization)
- Blog post generator (`scripts/generate-blog-posts.js`) — 5 post types per qualifying city:
  - Rankings: "Best Emergency Plumbers in [City] ([Year])" — data-driven, all cities with 3+ plumbers
  - Local Guides: "Emergency Plumber in [City]: What to Know Before You Call" — Claude-generated, 800-1200 words, region-specific
  - Emergency Tips: "[City] Plumbing Emergency? How to Stop Water Damage While You Wait" — Claude-generated, 600-900 words
  - Service-specific: "Best [Service] Plumbers in [City]" — powered by servicesMentioned data
  - Red Flags: "Red Flags When Hiring a Plumber in [City]" — powered by red flag data
- Region detection for content: northern (frozen pipes), southern (slab leaks), desert (heat stress), california (earthquake shutoff), coastal-hurricane (storm prep)
- Plumber detail pages show top 15 reviews from Firestore (3 recent 5-star, 2 recent 1-2 star, fill with longest) with source badges (Google blue, Yelp red, Angi green)
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
- `scripts/outscraper-reviews.js` — multi-source deep review pull (Google + Yelp + Angi) via Outscraper API with async polling, Claude multi-source synthesis with cross-platform discrepancy detection
- `scripts/bbb-lookup.js` — Better Business Bureau data: searches BBB API + scrapes profile pages for accreditation, rating, complaints, years in business; fuzzy name matching with bigram Jaccard
- `scripts/export-firestore-to-json.js` — exports Firestore enrichment (synthesis, BBB, Yelp/Angi ratings) back to static JSON, commits + pushes to trigger Vercel rebuild
- `scripts/request-indexing.js` — submits sitemap + URL indexing requests via Google Indexing API, 200/day quota guard, logs to Firestore `indexingRequests` collection
- GitHub Actions daily pipeline fully operational — 5 phases: GSC expansion → scrape → Firestore upload → review refresh → AI synthesis → commit/push → re-index
- GitHub Actions deep review pull — daily at 7 AM Central: GSC tier filtering → BBB lookup → Outscraper multi-source reviews → Claude synthesis → export JSON → Vercel rebuild → re-index ALL serviceCities
- All scripts use firebase-admin SDK with service-account.json (bypasses Firestore security rules)
- 392 plumbers scraped across 37 cities (IL + Aberdeen MD, Worcester MA, Abilene TX, San Leandro CA, Stow OH, Edmond OK, Huntsville AL, Nashville TN, Acworth GA, Alameda CA, Bethesda MD, Yukon OK, Aiken SC, Ardmore OK)
- 11,000+ reviews cached in Firestore reviews collection (Google ~8,200 + Yelp ~2,600 + Angi ~125)
- 189 plumbers BBB-checked (126 matched, 71 accredited)
- Pipeline activity logged to `pipelineRuns` collection with per-plumber detail (viewable in admin Activity tab with expandable rows)
- Budget guard hardened: shared module `scripts/lib/budget-guard.ts`, hard stop at 90%, per-phase allocation (expansion 60%, refresh 30%, reserve 10%)
- Expansion queue: `scripts/seed-expansion-queue.ts` ready, Firestore-based, priority IL → adjacent states → population
- API usage tracking in Firestore `apiUsage` collection
- All IL-only hardcoding removed from pipeline scripts (daily-scrape, upload-to-firestore, seed-from-outscraper)
- City slug matching: all scripts handle both formats (`crystal-lake-il` and `crystal-lake`)

**GSC Expansion System (fully automated):**
- GSC API access verified and working (service account has siteFullUser permission)
- `scripts/gsc-pull-test.js` — test GSC API access, display 90-day page data
- `scripts/gsc-expansion.js` — pull GSC data, find cities with impressions but no plumber data, create stub docs in cities collection, write `data/gsc-expansion-queue.json`
- `scripts/gsc-prepend-queue.js` — geocode new cities (Google Maps Geocoding API), add coords to `city-coords.ts`, prepend to scrape queue
- `scripts/seed-cities-collection.js` — seed Firestore `cities` collection from synthesized data (run once — done, 27 cities seeded)
- `googleapis` npm package installed
- `daily-scrape.js` auto-updates Firestore `cities` collection after each successful scrape (non-blocking)
- Firestore `cities` collection: 2257 docs total, 37 scraped, single source of truth for city tracking
- First GSC-driven scrape completed: Ardmore, OK (found via impressions, scraped, live)
- **GitHub Actions automated:** daily workflow runs GSC expansion → prepend → scrape → upload → refresh → synthesize → commit (all GSC steps continue-on-error so normal scrape is never blocked)

**Review Synthesis:**
- Claude AI (Haiku) multi-source synthesis engine: processes Google + Yelp + Angi reviews together with BBB data
- Keyword fallback for plumbers with <3 reviews
- Fields: `summary`, `emergencyReadiness`, `emergencyNotes`, `aiSynthesizedAt`, `synthesisVersion`, `platformDiscrepancy`, `servicesMentioned`
- **servicesMentioned:** 16 service categories extracted from reviews (burst-pipe, sewer, water-heater, drain-cleaning, toilet, sump-pump, gas-leak, flooding, water-line, slab-leak, garbage-disposal, faucet-fixture, backflow, repiping, water-softener, bathroom-remodel) — each with count, avgRating, topQuote
- **Emergency readiness detection:** checks business name keywords (24/7, emergency, rescue), Google hours (Open 24 hours), and review signals (same-day, after-hours, weekend) — not just literal "emergency response" phrases
- PlumberCard shows AI summary, emergency readiness indicator, BBB data bar
- Badges earned from review data: Fast Responder, Fair Pricing, 24/7 Verified, Clean & Professional, Good Communicator
- **Badge consistency rule:** badges cannot contradict red flags (response time complaints → no Fast Responder, pricing disputes → no Fair Pricing, unprofessional behavior → no Clean & Professional)
- **Stricter red flag detection:** for plumbers with <25 reviews, even 1-2 negative reviews about the same issue = pattern flagged. For 25+ reviews, 3+ mentions required.
- Strengths/weaknesses displayed on PlumberCard (green/amber text)
- Red flags tracked: pricing complaints, slow response, communication issues, quality concerns, BBB complaints, cross-platform rating discrepancies
- Cross-platform discrepancy detection: flags when Google rating differs significantly from Yelp (e.g. 4.9 vs 3.9)

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
- GitHub Actions: 10 secrets configured (3 API keys + 6 Firebase config + OUTSCRAPER_API_KEY)
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

**Technical SEO:** ✅ DONE (April 6, 2026 schema overhaul)
- [x] XML sitemap auto-updates from cities-data (fixed broken plumber-data import)
- [x] Submit sitemap to Google Search Console — 2,321 pages discovered (April 3, 2026)
- [ ] Verify GA4 tracking is firing correctly (Tim to verify)
- [x] Internal linking — every city page links to nearby cities
- [x] Canonical URLs — metadataBase handles this for all pages
- [x] Breadcrumb schema on ALL pages: homepage, state, city, plumber detail, blog index, blog posts, plumber directory, emergency plumbers index
- [x] City pages: BreadcrumbList + ItemList (Plumber items with geo, streetAddress, postalCode, AggregateRating) + FAQPage + Review per plumber with positiveNotes/negativeNotes (pros/cons schema)
- [x] Plumber detail pages: BreadcrumbList + Plumber (with geo coords) + Review with positiveNotes/negativeNotes
- [x] Homepage: WebSite with SearchAction (sitelinks search box) + Organization
- [x] Blog posts: Article with mainEntityOfPage + BreadcrumbList
- [x] Removed bogus LocalBusiness AggregateRating that aggregated ratings from unrelated businesses (Google guidelines violation)
- [x] Request indexing script: submits sitemap + URL indexing via Google Indexing API after every data update

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

**Trigger:** City has 3+ plumbers in the system (rankings), or 5+ plumbers (guides/tips). Service-specific posts trigger when 2+ plumbers in a city have the same service mentioned in reviews.

**Generator:** `scripts/generate-blog-posts.js` — run manually or after re-synthesis. Outputs to `data/blog-posts/` as JSON files.

**Current output:** 109 posts across 31 cities (dry-run April 6, 2026). Service-specific posts pending `servicesMentioned` data from re-synthesis.

### Post Types per City Cluster — ✅ BUILT

| Type | Trigger | Generator | Status |
|------|---------|-----------|--------|
| **Rankings** | 3+ plumbers | Data-driven (static) | ✅ 31 posts |
| **Local Guide** | 5+ plumbers | Claude Haiku (800-1200 words) | ✅ 28 posts |
| **Emergency Tips** | 5+ plumbers | Claude Haiku (600-900 words) | ✅ 28 posts |
| **Service-specific** | 2+ plumbers with same service | Data-driven (servicesMentioned) | Pending re-synthesis |
| **Red Flags** | 2+ plumbers with red flags | Data-driven (static) | ✅ 22 posts |

### Post Types per City Cluster — FUTURE (not yet built)

**Pricing/Decision-Making**
- "How Much Does an Emergency Plumber Cost in [City]?"
- "Should You Call an Emergency Plumber or Wait?"

**Seasonal**
- Frozen pipes (winter)
- Spring flooding / sump pump failures

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
- **Primary data source is Google Places API** — free monthly credits, max them out, never exceed them. **Outscraper** supplements with deep Google reviews (100 per plumber vs 5 from Places API) + Yelp + Angi reviews for high-traction cities. **BBB** data adds accreditation, complaint history, and years in business.
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

## Automated Pipeline Architecture

Two GitHub Actions workflows run daily with zero manual intervention:

### Daily Scrape (6:00 AM Central — `daily-scrape.yml`)
```
GSC API → gsc-expansion.js → find cities with impressions, set gscTier
    ↓
gsc-prepend-queue.js → resolve coords (CSV → OSM → Google), update
                       city-coords-cache.json, re-invoke generate-cities-data.mjs
                       to rebuild cities-generated.ts + city-coords.ts from cache
                       (exits non-zero if any city still missing coords — fail loud)
    ↓
daily-scrape.js → Google Places textSearch → if city < THIN_THRESHOLD (5),
                  retry with "24 hour plumber" + "plumbing services" query
                  variants (dedup within city) → Claude Sonnet synthesis
    ↓
upload-to-firestore.js → upsert plumber docs
    ↓
refresh-reviews.ts → fetch new Google reviews for existing plumbers (30-day cadence)
    ↓
synthesize-reviews.ts → Claude Haiku synthesis on plumbers with new reviews
    ↓
export-firestore-to-json.js → merge enrichment into static JSON (JSON invariant
                              in CLAUDE.md: this is the ONLY writer)
    ↓
git commit + push → Vercel rebuild
    ↓
request-indexing.js → sitemap + URL indexing for scraped cities
```

**Race window:** A city typically takes 1–3 days from GSC discovery → rendered plumbers on the live site. In the meantime, the page still renders via the 20-mile radius fallback in `resolvePlumbersForCity()` (Firestore) or `getPlumbersNearCity()` (static JSON), both keyed off `city-coords.ts`. Coord-missing cities are the urgent class — `gsc-prepend-queue.js` exits non-zero and logs to `errors.jsonl` if any new city can't be resolved.

**Coord contract:** Every entry in `RAW_CITIES` in `cities-generated.ts` MUST have a matching coord in `city-coords.ts`. Both files are regenerated from `scripts/city-coords-cache.json` by `generate-cities-data.mjs`. Never hand-edit `city-coords.ts`. The cache is populated by the 3-phase resolver: (1) kelvins US-Cities CSV at `scripts/data/us-cities.csv` (offline, 30k cities), (2) Nominatim/OSM (free, 1.1s rate limit), (3) Google Geocoding (requires Geocoding API enablement separate from Places).

**Unified Firestore plumber fetch:** Both `/emergency-plumbers/[state]/[city]` and `/[service]/[state]/[city]` call `resolvePlumbersForCity(state, citySlug, cityCoord)` from `lib/firestore.ts`, which checks direct `serviceCities` matches first, then sweeps a 20-mile haversine radius. Falls back to static JSON if Firestore is unconfigured or throws.

**Thin-cities retry:** `daily-scrape.js` compares `cityNew + cityDeduped` against `THIN_THRESHOLD = 5`. Below threshold, it re-runs the textSearch with broader query templates (`"24 hour plumber"`, `"plumbing services"`) before giving up. Cities still below threshold after retries log a `severity: warn` entry to `errors.jsonl` — useful signal for underserved markets vs coverage bugs.

### Deep Review Pull (7:00 AM Central — `deep-review-pull.yml`)
```
Firestore cities → query gscTier "medium"/"high" (10+ impressions)
    ↓ filter: skip if all plumbers have <30 day Outscraper data
    ↓ cap: 3 cities per run
bbb-lookup.js → BBB search API + profile scrape (accreditation, complaints, years)
    ↓
outscraper-reviews.js → Google (100 reviews via REST API + async polling)
                       → Yelp (constructed URL → Google search fallback)
                       → Angi (Google search for site:angi.com)
    ↓
Claude Haiku synthesis → all reviews + BBB data, cross-platform discrepancy detection
    ↓
export-firestore-to-json.js → merge enrichment into static JSON → git push → Vercel rebuild
    ↓
request-indexing.js → sitemap + URL indexing for ALL serviceCities of updated plumbers
```

### GSC Tier Thresholds
| Tier | Impressions | Action |
|------|-------------|--------|
| **high** | 50+ | Highest priority for scrape + deep review pull |
| **medium** | 10–49 | Eligible for deep review pull |
| **low** | 1–9 | Scraped via daily pipeline, not yet deep-reviewed |
| **none** | 0 | No action |

---

## What's Next

### Current Focus: Let the Pipeline Bake

Both automated workflows are live and running daily. Focus now:
1. Monitor admin Activity dashboard for 2-4 weeks to confirm pipeline stability
2. Watch for synthesis quality — are red flags being caught? Are badges consistent?
3. Track Outscraper costs — currently ~$0.10-0.20 per city (3 cities/day = ~$10-20/month)
4. Verify Vercel rebuilds are triggering after export-firestore-to-json pushes

### Known Gaps (Pending)

**Yelp Coverage Gap:**
Outscraper `yelpReviews` returns 0 for smaller businesses (<20 Yelp reviews). Google search fallback correctly finds Yelp URLs, but Outscraper can't scrape the reviews. Need alternative approach — possibly direct Yelp page scraping or Yelp Fusion API.

**Blog Post Cluster Generation:**
Generator built (`scripts/generate-blog-posts.js`) with 5 post types. 109 posts generated in dry-run. Remaining work: wire blog posts into Next.js dynamic routes, add to sitemap, run service-specific generation after `servicesMentioned` data populates. Annual awards program not yet built.

**UI Pending:**
- [ ] City page sort/filter: allow homeowners to sort by price, response time, trust score (data exists, UI not built)
- [ ] Cross-platform rating display on plumber detail pages: show Google/Yelp/Angi ratings side by side (data in Firestore, UI partially built — BBB bar done, Yelp/Angi not)
- [ ] Admin dashboard city tracking table with color-coded GSC tier status
- [ ] Mobile QA pass

**Email Collection for Award Outreach:**
Google Places API doesn't return email. Collection paths: plumber self-service portal, business submission form, website scraping, or award outreach itself.

### GSC-Driven Expansion — FULLY AUTOMATED

Google Search Console integration is live and running:
- [x] GSC API enabled and working (service account has siteOwner permission)
- [x] `gsc-expansion.js` pulls impressions, sets `gscTier` on city docs, creates stubs
- [x] `gsc-prepend-queue.js` geocodes new cities, prepends to scrape queue
- [x] Deep review pull workflow targets medium/high tier cities automatically
- [x] BBB lookup runs before Outscraper so synthesis has full context

### Operational TODO (Tim manual)
- [ ] Verify GA4 is firing
- [ ] Enable Places API (New) on Firebase GCP project (needed for refresh-reviews to call Google directly)
- [ ] Mobile QA pass
- [ ] Create favicon/icons
- [ ] Deploy Firestore rules (`firebase deploy --only firestore:rules`)

### Manual-Only Scripts (intentional)
| Script | Purpose |
|--------|---------|
| `generate-blog-posts.js` | Blog post generation — run after re-synthesis or data changes |
| `resynthesize-emergency.js` | Bulk re-synthesis for emergency readiness + servicesMentioned (one-time scheduled Apr 7) |
| `seed-expansion-queue.ts` | One-time seed — not recurring |
| `seed-cities-collection.js` | One-time seed — already run |
| `seed-plumbers.ts` | Test data only |
| `gsc-pull-test.js` | Diagnostic tool |
| `fetch-plumbers-v2.ts` | Superseded by daily-scrape.js |

---

*Last updated: April 6, 2026*
*Owner: Tim Dodaro*
*Contact: info@fastplumbernearme.com*
