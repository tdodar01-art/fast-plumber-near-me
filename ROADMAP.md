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

### Critical Issues (Fix First)
- [ ] **EXPOSED API KEYS** — .env.local has Google Places + Anthropic keys in plaintext. Revoke and regenerate immediately
- [ ] **Lead tracking is dead** — /api/track-lead has Firestore write commented out. Every click-to-call is lost
- [ ] **Contact form broken** — Renders form with no onSubmit handler. Users fill it out and nothing happens
- [ ] **Hardcoded placeholder phone** — +18155555555 in Header (2x), error.tsx, not-found.tsx. Replace with real number or remove
- [ ] **No input sanitization on blog renderer** — Custom markdown parser doesn't escape HTML

### Medium Issues
- [ ] Admin has no confirmation dialogs — approve/reject/toggle fire immediately
- [ ] No pagination on admin pages — will break at scale
- [ ] add-your-business has hardcoded city dropdown instead of using CITY_LIST
- [ ] firestore.ts is read-only — admin writes directly to Firestore, not through shared helpers
- [ ] API routes have no rate limiting or CSRF protection
- [ ] Seed script is IL-only — county/nearby maps hardcoded for Illinois
- [ ] city-coords.ts only has ~400 cities, 1600+ have no coordinates

---

## Phase 1: Complete the MVP

Priority: Fix what's broken, wire up the data pipeline with caching, build the review synthesis engine, and get SEO rolling.

### 1A — Fix Critical Issues (DO FIRST)
- [ ] Revoke and regenerate exposed API keys
- [ ] Uncomment and wire up Firestore write in /api/track-lead
- [ ] Fix contact form — add submit handler, send to Firestore or email
- [ ] Replace hardcoded +18155555555 with real business number or remove
- [ ] Add HTML escaping to blog markdown renderer
- [ ] Add confirmation dialogs to admin approve/reject/toggle actions

### 1B — Google Places Data Pipeline + Caching Layer
We use the Google Places API directly — no middleman. Free monthly credits. Max them out, never exceed them. Cache everything for plumbers in our system.

**How caching works:**
- We do NOT proactively scrape every plumber in America. We cache data for plumbers as they enter our system — city by city, as we expand.
- When a plumber is first pulled from Google Places API → their full record + all available reviews get stored permanently in Firestore.
- Firestore is the source of truth. Google is the intake pipe.
- Before making any API call, check Firestore first — only fetch from Google if we don't have the data or it's stale.
- Reviews are immutable — once cached, cached forever. We never re-fetch a review we already have.

**Caching schema:**
- [ ] `plumbers` collection — full plumber record cached permanently
- [ ] `reviews` collection — individual review documents, linked to plumber by plumberId, each with a unique Google review ID so we never duplicate
- [ ] `ratingSnapshots` collection — timestamped rating/review count snapshots so we can track changes over time
- [ ] `apiUsage` collection — monthly call counts, credits used, credits remaining

**Review refresh cycle (keeps data fresh without wasting API credits):**
- [ ] Every plumber in the system gets checked for new reviews on a 30-day cadence
- [ ] When refreshing, only fetch reviews newer than the most recent cached review for that plumber (compare by timestamp or review ID)
- [ ] Never re-fetch old reviews — they're immutable and already cached
- [ ] When new reviews come in, re-run the synthesis engine for that plumber and update their displayed strengths/weaknesses
- [ ] Track `lastReviewRefreshAt` on each plumber record
- [ ] Review refreshes count against the monthly Google Places API budget — factor into the budget tracker
- [ ] Priority refresh: plumbers with the most click-to-call activity get refreshed first (they matter most to users)

**Pipeline tasks:**
- [ ] Polish fetch-plumbers.ts — remove IL-only hardcoding, make it work for any state
- [ ] Add rate limiting / budget tracking so we never exceed free monthly credits
- [ ] Polish GitHub Actions daily scrape (daily-scrape.yml) — stay within budget, split budget between new plumber fetches and review refreshes
- [ ] Automated pipeline: Google Places API → check cache → fetch only new data → Firestore → city pages
- [ ] Deduplicate plumbers across cities (same plumber serves multiple areas)
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

**Build tasks:**
- [ ] Pull Google review data via Places API (rating, review count, individual review text)
- [ ] Cache ALL review text permanently in Firestore `reviews` collection
- [ ] Build review synthesis engine — analyze review text to extract:
  - Strengths with specifics (what exactly are they good at?)
  - Weaknesses with specifics (what do people complain about?)
  - Common themes across reviews (with counts — "4 of 15 reviewers mention...")
  - Emergency-specific signals: response time mentions, after-hours mentions, urgency handling
  - Red flags: pricing complaints, no-show mentions, communication issues
- [ ] Display synthesized strengths/weaknesses on PlumberCard and plumber detail views
- [ ] Show Google rating + review count prominently
- [ ] Sort/rank plumbers by quality signals from reviews, not just star rating
- [ ] Badge system based on review analysis: "Fast Responder", "Fair Pricing", "24/7 Verified by Reviews", etc.
- [ ] Badges must be EARNED from review data, not self-reported
- [ ] Re-synthesize automatically when new reviews come in via the refresh cycle

### 1D — First-Party Signal Collection
Start building our own quality data that doesn't depend on Google. Every user interaction becomes a data point.

- [ ] Track click-to-call events per plumber (already partially built — needs to actually persist)
- [ ] Track time-on-page per plumber card (which cards do people spend time on?)
- [ ] Track "back to results" behavior (user clicked a plumber then immediately came back = negative signal)
- [ ] User report button: "Is this plumber still in business?" / "Did they answer when you called?"
- [ ] Store all first-party signals in Firestore — these become our own ranking inputs over time
- [ ] Eventually blend first-party signals with Google review data for a composite quality score

### 1E — SEO Plan & Execution

**Target Keywords:**
- Primary: "emergency plumber [city]"
- Secondary: "24 hour plumber [city]", "plumber near me [city]", "emergency plumbing [city] IL"
- Long-tail: "burst pipe plumber [city]", "water heater repair [city] emergency"

**Technical SEO:**
- [ ] Verify XML sitemap auto-updates when new cities publish
- [ ] Submit sitemap to Google Search Console
- [ ] Verify GA4 tracking is firing correctly
- [ ] Internal linking audit — every city page links to nearby cities
- [ ] Canonical URLs verified across all pages
- [ ] Breadcrumb schema on state and city pages
- [ ] Review schema (AggregateRating) on city pages

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

### 1F — MVP Polish
- [ ] Firestore security rules — lock down collections, admin-only writes
- [ ] Add firestore.ts write helpers (create/update/delete) — stop admin pages writing directly
- [ ] Rate limiting + CSRF on API routes
- [ ] Fix add-your-business city dropdown to use CITY_LIST
- [ ] Admin pagination for plumber/city/lead lists
- [ ] Mobile QA pass
- [ ] Favicon and PWA manifest

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

*Last updated: April 2, 2026*
*Owner: Tim Dodaro*
*Contact: fastplumbernearme@gmail.com*
