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

## Current Status (from April 2026 Audit)

### What's Built
- 42 city pages with plumber listings, SEO meta, JSON-LD, OG images
- ~2000 city entries generated (only 42 published)
- Homepage with search + geolocation
- Blog (8 posts with custom markdown renderer)
- Directory index + state pages
- Admin dashboard (Firebase Auth, plumber/city/lead/submission management)
- 122 plumber records loaded
- Business submission form (Add Your Business)
- OG image generation (edge runtime)
- Google Places API fetch script (scripts/fetch-plumbers.ts)
- GitHub Actions daily scrape (daily-scrape.yml, runs 6am CT)
- Seed scripts for CSV import
- PageSpeed: 99/96/100/100
- Security headers configured

### Critical Issues — RESOLVED (April 2, 2026)
- [x] **Lead tracking fixed** — Firestore write uncommented, clicks persist to leads collection
- [x] **Contact form fixed** — Added onSubmit handler, writes to contactSubmissions, shows success/error
- [x] **Phone number fixed** — Replaced +18155555555 with NEXT_PUBLIC_BUSINESS_PHONE env var, hidden if unset
- [x] **Blog renderer sanitized** — HTML tags stripped before markdown parsing (defense-in-depth)
- [x] **Admin confirmation dialogs** — All destructive actions now require "Are you sure?" confirmation
- [ ] **EXPOSED API KEYS** — Tim to revoke and regenerate manually

### Medium Issues — MOSTLY RESOLVED (April 2, 2026)
- [x] Admin has confirmation dialogs on all destructive actions
- [x] Pagination on admin plumbers, cities, and leads pages (25 per page)
- [x] add-your-business uses dynamic CITY_LIST (scrollable checkbox grid)
- [x] firestore.ts has full CRUD helpers — admin pages use shared functions
- [x] API routes have rate limiting (10 req/min/IP) and origin checking
- [ ] city-coords.ts only has ~400 cities, 1600+ have no coordinates (TODO)

---

## Phase 1: Complete the MVP

Priority: Fix what's broken, wire up the data pipeline with caching, build the review synthesis engine, and get SEO rolling.

### 1A — Fix Critical Issues ✅ DONE
- [ ] Revoke and regenerate exposed API keys (Tim doing manually)
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
- [ ] Fill in missing city coordinates (1600+ cities missing lat/lng)

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
- [ ] Sort/rank plumbers by quality signals from reviews (partially done — still tier-based)
- [x] Badge system: "Fast Responder", "Fair Pricing", "24/7 Verified by Reviews", "Clean & Professional", "Good Communicator"
- [x] Badges EARNED from review data via keyword matching, not self-reported
- [x] Re-synthesize automatically when new reviews come in via the refresh cycle

### 1D — First-Party Signal Collection (PARTIALLY DONE)
Start building our own quality data that doesn't depend on Google. Every user interaction becomes a data point.

- [x] Track click-to-call events per plumber (persists to Firestore leads collection)
- [ ] Track time-on-page per plumber card (TODO — needs client-side analytics)
- [ ] Track "back to results" behavior (TODO — needs client-side analytics)
- [x] User report button: "answered fast", "didn't answer", "bad number", "seems closed" — saves to plumberReports collection
- [x] Store all first-party signals in Firestore (leads + plumberReports)
- [ ] Eventually blend first-party signals with Google review data for a composite quality score

### 1E — SEO Plan & Execution

**Target Keywords:**
- Primary: "emergency plumber [city]"
- Secondary: "24 hour plumber [city]", "plumber near me [city]", "emergency plumbing [city] IL"
- Long-tail: "burst pipe plumber [city]", "water heater repair [city] emergency"

**Technical SEO:** (MOSTLY DONE)
- [x] XML sitemap auto-updates from cities-data (fixed broken plumber-data import)
- [ ] Submit sitemap to Google Search Console (Tim to do manually)
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
- [ ] Remove all IL-only hardcoding from scripts and data maps
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

Phase 1 is ~85% complete. Remaining items before moving to Phase 2:
1. **Rotate exposed API keys** (manual — Tim)
2. **Run the pipeline** — `npx ts-node scripts/fetch-plumbers-v2.ts --state IL --cities "Crystal Lake,McHenry,Algonquin"` to populate Firestore with real data
3. **Submit sitemap to GSC** and verify GA4 is firing
4. **Fill missing city coordinates** (scripts/fill-city-coords.ts)
5. **Mobile QA pass**
6. **Create favicon/icons** at /icon-192.png and /icon-512.png
7. **Deploy Firestore rules** — `firebase deploy --only firestore:rules`

---

*Last updated: April 2, 2026*
*Owner: Tim Dodaro*
*Contact: fastplumbernearme@gmail.com*
