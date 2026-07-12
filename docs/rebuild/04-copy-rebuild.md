# Copy Rebuild — fastplumbernearme.com

Ground-up copy system for the honest-broker rebuild. Written 2026-07-11 against live data:
6,211 active plumbers, 6,154 with review synthesis, 5,755 with verbatim attributed quotes.
Every false verification claim on the current site is inventoried and replaced here.

---

## 0. Inventory of false claims that must die

Every one of these is live today and describes a product that never existed. None survive the rebuild.

| Location | False claim (verbatim) |
|---|---|
| Homepage hero (`src/app/page.tsx:59`) | "We don't just list plumbers — we verify they actually pick up the phone and show up." |
| Homepage step 2 (`page.tsx:122`) | "Every plumber is AI-verified. We call them to confirm they're actually available for emergency service." |
| Homepage step 3 (`page.tsx:132`) | "Tap to call a verified plumber who will actually pick up and come help." |
| Homepage trust badge (`page.tsx:145`) | "AI-Verified Plumbers" |
| Homepage trust badge (`page.tsx:153`) | "Licensed & Insured" — we do not check licensure or insurance; also false |
| Homepage why-us (`page.tsx:201-206`) | "We Actually Call Them … we use AI to periodically call every listed plumber at random times" |
| Homepage why-us (`page.tsx:209-213`) | "Real Reliability Scores … based on how often they answer, how fast they respond" |
| `/how-we-verify` (entire page) | "Our AI calls each plumber 2-4 times per month" + 40/30/20/10 answer-rate scoring model + "minimum of 3 verification calls … scores decay after 30 days" — all fabricated |
| `/about` meta + body (`about/page.tsx:9,41-45,53`) | "We call every listed plumber to verify they actually pick up and show up" / "AI verification system" |
| Privacy policy §1, §2, §3 (`privacy-policy/page.tsx`) | "data from our verification calls", "AI calling system", entire "AI Verification Calls" consent clause |
| Homepage meta description (`page.tsx:41`) | "verified, responsive plumbers" |
| Featured cities blurb (`page.tsx:166`) | "verified emergency plumbers ready to help right now" |

Rule going forward: the word **"verify" / "verified" never appears on the site** except in the
methodology page sentence that explicitly says we do NOT verify by phone. It is unsalvageable
vocabulary — retire it.

---

## 1. Voice & tone definition

**Who we are on the page:** the friend who actually read all 200 reviews before you hired anyone —
including the three angry ones the plumber wishes would disappear. Plain-spoken. Specific.
Comfortable telling you something negative, because that's the whole point.

**The one-sentence voice test:** *Could a competitor directory paste this sentence onto their site
unchanged?* If yes, delete it. Our copy is only ours when it carries our data, our judgment, or our
willingness to say the uncomfortable thing.

### Rule 1 — Claim only what we did. Name the mechanism.
Never imply an action we didn't take. Every trust claim states its actual mechanism: we read and
synthesize public reviews.

> **Before** (homepage hero, page.tsx:59): "We don't just list plumbers — we verify they actually pick up the phone and show up. Real reviews, real ratings, real response times."
>
> **After:** "We read the reviews so you don't have to — all of them, including the bad ones. Then we tell you what they add up to."

### Rule 2 — Numbers over adjectives. Specific over superlative.
"Reliable," "trusted," "top-rated," "most trustworthy" are banned as freestanding claims. If a
sentence needs a trust word, replace it with the datum that would earn it.

> **Before** (about page, about/page.tsx:19): "We're building the most trustworthy emergency plumber directory in the country."
>
> **After:** "We publish the strengths and the complaints for 6,000+ plumbers, quoted word-for-word from real customers. Judge us by whether that's useful."

### Rule 3 — Say the negative thing plainly. It's the product.
Concerns are not softened, euphemized, or buried below the fold. A concern section that reads like
a compliment is a defect. Site-authored text never asserts a fact about a plumber; it points at
quoted customers who do.

> **Before** (current PlumberCard pattern — weaknesses rendered as muted amber footnote text under a wall of praise):"Customers say they are professional. Minor notes on scheduling."
>
> **After:** "Strong on water heater installs — 14 reviewers name it. But three reviewers since March describe quotes that grew after work started. Read those quotes below before you agree on price."

### Rule 4 — No urgency theater. The user's emergency is real; our copy stays calm.
Someone with a flooded basement doesn't need exclamation points, "RIGHT NOW," or countdown energy.
They need the shortest path to a good decision. Short sentences. Verbs. No hype about speed we
can't measure.

> **Before** (homepage hero, page.tsx:55-56): "Find a Reliable Emergency Plumber — Right Now"
>
> **After:** "A burst pipe doesn't leave time to read 200 reviews. We already did."

### Rule 5 — Every indexable sentence must be locally true, or it doesn't exist.
No sentence generated for 44,000 pages at once. City copy is composed from that city's own data
and says nothing that isn't true of that specific place. If we have nothing specific to say, we
say less — a short honest page beats a long templated one.

> **Before** (token-swap boilerplate, src/lib/cities-generated.ts — the Fairbanks "hero"): "With long, severe winters in Fairbanks North Star County, Fairbanks homeowners face frequent plumbing emergencies. Frozen and burst pipes top the list, followed by water heater failures and sewer line backups caused by deep ground frost." *(Identical sentence skeleton deployed to thousands of cities with nouns swapped. This is the doorway pattern that got the site demoted.)*
>
> **After** (composed from the city's real data — see §4): "We track 51 plumbing companies within 20 miles of Nashville and have read their 34,000+ Google reviews. 41 of the 51 advertise 24-hour service — but the reviews tell you which ones actually answer at 2 a.m."

**Tone dials:** homeowner pages = calm, direct, second person. Plumber-facing pages (add-your-business) = businesslike, respectful, zero flattery. Legal/methodology = precise, first person plural, no marketing rhythm.

---

## 2. Brand promise + homepage copy

### Brand promise (internal north star, one line)
**We show you what the other directories bury.**

Long form (usable as the meta description / og description):
> Fast Plumber Near Me reads the public reviews of every plumber we list — Google, Yelp, BBB — and publishes an honest summary of the strengths *and* the complaints, with the actual customer quotes to back it up. No plumber can pay us to hide a bad review.

### Homepage

**H1:**
> A burst pipe doesn't leave time to read 200 reviews. We already did.

**Subhead:**
> We summarize the public reviews of 6,000+ plumbers — Google, Yelp, and BBB — and show you the strengths *and* the complaints, quoted word-for-word. The negative reviews other directories bury are the first thing we look for.

**Search card:**
- Card heading: "Find plumbers near you"
- Helper text: "Enter your city or zip. We'll show every plumber within 20 miles, ranked by our read of their reviews."
- Location button: "Use my location"

**Stats strip (under search — real numbers, wired to build-time data):**
> 6,211 plumbers tracked · 9,708 cities covered · Reviews read from Google, Yelp & BBB

**How it works (3 steps):**

1. **We collect the reviews.**
   For every plumber we list, we pull their public reviews from Google, Yelp, and the Better Business Bureau — hundreds per company, not the five happiest.

2. **We read them and take a side.**
   Our editors, with AI assistance, distill each plumber's reviews into plain-English strengths and concerns. If three customers mention surprise fees, you'll see it — with their exact words, names, and dates.

3. **You call with your eyes open.**
   No account, no forms, no lead auction. Pick a plumber knowing what past customers loved and what they complained about, and tap to call them directly.

**Why trust us (section heading: "Why we're different"):**

- **We publish the complaints.**
  Every directory shows you star ratings. We quote the one-star reviews — verbatim and attributed — because a single written complaint usually speaks for several customers who never wrote one. If a plumber has a pattern of no-shows or growing invoices, it's on their card, not hidden in page four of their Google reviews.

- **Plumbers can't pay to change what we write.**
  We sell advertising placement, and we label it. What we never sell is the assessment. A sponsored plumber's concerns section reads exactly as it would if they'd never paid us — and plumbers below our quality bar can't buy placement at all. [How our ranking works →](/methodology)

- **Our opinion, their words.**
  Everything we say about a plumber is grounded in quoted customer reviews you can read yourself. We show the full rating picture, link every claim to its source quotes, and correct mistakes fast when a plumber disputes something. [Our correction policy →](/methodology#corrections)

- **One job: help you pick.**
  We don't sell your info to four plumbers who'll all call you back (that's the other guys' business model). You browse free and anonymous, and you call the plumber yourself.

**Footer tagline:** "The reviews, read honestly."

---

## 3. Methodology page — replaces /how-we-verify

**New slug: `/methodology`** — with a 301 from `/how-we-verify`. ("How we rank" undersells the
synthesis; "methodology" is the E-E-A-T convention users and Google's raters recognize from review
sites like Wirecutter/NerdWallet.)

**Title tag:** How We Rate Plumbers — Our Methodology | Fast Plumber Near Me
**Meta description:** How Fast Plumber Near Me works: we aggregate public reviews from Google, Yelp, and the BBB, synthesize them under editorial standards, and publish each plumber's strengths and concerns with verbatim quotes. What we do, what we don't, and how to dispute a listing.

---

### FULL PAGE COPY

# How we rate plumbers

Fast Plumber Near Me is a review-synthesis directory. We read the public reviews of the plumbers we list, form an editorial opinion, and publish it — including the negative patterns other directories don't surface. This page explains exactly how that works, what we do not do, and how to reach us if we got something wrong.

*Last updated: [date]. This page changes when our process does.*

## What we do

**1. We aggregate public reviews.**
For each plumber, we collect published customer reviews from Google, Yelp, and the Better Business Bureau — for most companies, far more than the handful shown on a typical search result. As of [month year] we track 6,000+ plumbing companies and have collected their public reviews on an ongoing basis. Reviews are stored as written; we never edit, paraphrase-as-quote, or fabricate them.

**2. We synthesize them, with AI assistance under editorial standards.**
Reading 400 reviews per company doesn't scale by hand, so we use AI tools to help find patterns — and we constrain them hard. Our standards for every published synthesis:

- Every strength and every concern must be supported by specific, identifiable reviews. Our system rejects any summary line that can't cite the reviews it came from.
- Quotes are verbatim excerpts of real published reviews, shown with the reviewer's name, review date, and source platform.
- Generic filler is banned. "Reliable and professional" tells you nothing; "three reviewers since March describe invoices that grew after work started" tells you what to ask before you sign.
- We look hardest for the signals that matter in an emergency: does anyone say they came at night? Do reviewers mention response time, or only workmanship?

**3. We take a side.**
Each plumber gets a quality score and a ranking on their city's page. The score is our opinion — a weighted read of their rating, review volume and recency, and the strength of the patterns (good and bad) in the review text. Two plumbers with identical star ratings can rank very differently if one has a pattern of pricing complaints and the other doesn't. We think that's the entire point of a directory.

**4. We publish the negatives.**
A written complaint usually represents more than one unhappy customer — most people never write the review. So when reviews show a repeated concern (no-shows, surprise fees, unreturned calls, failed inspections), it appears on the plumber's card, above the fold, with the quotes behind it. We also show each plumber's full rating distribution, not a cherry-picked average.

## What we do NOT do

Honesty about our method includes its limits:

- **We do not call, visit, or inspect plumbers.** No phone verification, no test calls, no in-person checks. If a page on this site ever said otherwise, it was wrong and has been removed.
- **We do not check licenses or insurance.** Verify licensure with your state or municipality before hiring — we link to the checker where your state offers one.
- **We do not accept payment to alter an assessment.** Not to remove a concern, soften a summary, hide a quote, or bump a score. There is no price for that. See "Sponsored placement" below for what money *does* buy.
- **We do not launder reviews.** We don't solicit, host, or gate reviews ourselves, and we don't let plumbers submit testimonials into our synthesis. Only reviews published on independent platforms count.
- **We do not guarantee outcomes.** Our synthesis is an opinion based on what past customers wrote publicly. It is a decision aid, not an endorsement, warranty, or prediction of your experience.

## What our score means

Every listed plumber gets a score from 0–100. It blends:

- **Customer rating and review volume** — a 4.8 across 900 reviews outweighs a 5.0 across 6.
- **Recency** — what customers say lately counts more than what they said in 2019.
- **Pattern strength in review text** — repeated, specific praise (fast arrival, clean diagnosis, honest pricing) raises it; repeated, specific complaints lower it, more than the star average alone would suggest.

The score is an editorial judgment, not a measurement. Where our data is thin — a plumber with only a few reviews — we say so on their card instead of pretending confidence.

## Sponsored placement — what money buys here, exactly

We sell one thing to plumbers: **position**. A plumber can pay to appear in the marked "Sponsored" slot at the top of their city's page.

The rules, in full:

- Sponsored placement is **always labeled** — visibly on the card, and as paid placement in the page code (`rel="sponsored"`).
- Sponsorship **never changes the written assessment**. The sponsored card shows the same score, the same strengths, the same concerns, and the same quotes as it would unsponsored. If a sponsor has a pattern of pricing complaints, the sponsored card says so.
- **Not every plumber can sponsor.** Plumbers scoring below our quality threshold cannot buy placement at any price. You can pay to be seen; you cannot pay to be trusted.
- Organic rankings below the sponsored slot are never affected by who pays us.

## Corrections and disputes — for plumbers

If we've listed your business and something is wrong, we want to fix it. Email **corrections@fastplumbernearme.com** from your business domain (or call attribution will be requested) with the listing URL and the issue:

- **Factual data** (phone, address, hours, closed business): we correct verified errors within 3 business days.
- **A quote you believe is fake or was removed by the platform**: send us the link; if the source platform has taken the review down, we remove the quote and re-run the synthesis.
- **You disagree with our assessment**: our synthesis is our opinion based on quoted public reviews, and we don't remove accurate quotes because they're unflattering. What we will do: re-run your synthesis against your current reviews on request (once per quarter), so improvement shows up here. The fastest way to change your concerns section is to resolve the pattern your customers are writing about.
- **Claim your listing**: any plumber can claim their listing free to update business details and respond to our summary. A response, if you provide one, appears labeled as "Owner response."

We log every correction. Materially wrong published assessments are corrected with a dated note, not silently.

## Who runs this

Fast Plumber Near Me is operated by Tim Dodaro from Crystal Lake, Illinois. It's an independent site: no plumbing company, franchise network, or lead-gen broker owns any part of it. Revenue comes from clearly labeled sponsored placement — nothing else.

Questions about this methodology: info@fastplumbernearme.com.

---
*(end methodology page copy)*

**Implementation notes:** anchor ids `#what-we-do-not-do`, `#score`, `#sponsored`, `#corrections`. Link to this page from: footer (site-wide), every plumber card score tooltip, every sponsored label, every concerns section header.

---

## 4. City-page copy framework

### The anti-example (what got us demoted)

From `src/lib/cities-generated.ts` (live today):

> "With long, severe winters in Fairbanks North Star County, Fairbanks homeowners face frequent plumbing emergencies. Frozen and burst pipes top the list, followed by water heater failures and sewer line backups caused by deep ground frost."

Swap "Fairbanks"→"Juneau" and "frozen pipes"→"failed water heaters" and you have the next city's
hero — one sentence skeleton, thousands of URLs, zero information a user couldn't guess. Google's
scaled-content classifier eats this pattern for breakfast, and it deserves to.

**The structural difference in the new system:** the old copy was *about the city* (weather
trivia any LLM can generate). The new copy is *about our data for that city* — facts that exist
nowhere else because the underlying synthesis exists nowhere else. It cannot be written for a city
we haven't analyzed, which is precisely the property that makes it index-worthy.

### Data slots (computed per city at build time, 20-mile radius)

| # | Slot | Definition | Example (Nashville, TN) |
|---|---|---|---|
| S1 | `plumberCount` | Active plumbers within 20 mi | 51 |
| S2 | `reviewsRead` | Sum of googleReviewCount across them | 34,054 |
| S3 | `pct24Hour` | % with is24Hour | 41 of 51 (80%) |
| S4 | `medianRating` | Median googleRating | 4.9 |
| S5 | `lowRatedCount` | Count with rating < 4.0 | 1 |
| S6 | `concernCount` | Count whose synthesis has ≥1 concern/red flag | per synthesis data |
| S7 | `deepReviewCount` | Count with ≥100 reviews (high-confidence assessments) | 36 |
| S8 | `thinDataCount` | Count with <10 reviews (low-confidence, flagged) | per data |
| S9 | `dominantSpecialties` | Top 2–3 services named across reviews (servicesMentioned) | e.g. water heaters, drain clearing |
| S10 | `standoutFact` | One machine-selected, human-templated superlative: largest review base, oldest concern pattern, only sub-4.0, biggest Google/Yelp gap, etc. | Busy Bee: 1,469 reviews |

### Composition rules

1. **Every intro must use ≥4 slots; no two density tiers share a sentence skeleton.** Three tiers: **dense** (≥25 plumbers), **standard** (5–24), **thin** (1–4). Each tier has its own paragraph shapes, so intros differ structurally across the site, not just numerically.
2. **Lead with the most decision-relevant fact for THAT city**, chosen by rule: if `pct24Hour` < 50% → lead with scarcity of after-hours options; if `lowRatedCount`/`concernCount` is notable → lead with the caution; if market is uniformly strong → lead with how we differentiate near-identical ratings; if thin → lead with honest scope.
3. **At least one sentence must be a caution or limitation.** Every city. This is the brand.
4. **S10 (standoutFact) makes the intro unfakeable** — it names a real business and a real number, different in every city.
5. **Numbers render from data, never hardcoded** — the intro recomputes on every rebuild, so copy stays true as data changes; wording variants rotate on a per-city stable seed so recrawls don't see churn.
6. **No weather, no county trivia, no "homeowners face" filler.** If a sentence could be written without our dataset, it's out.
7. **Thin tier (<5) gets the honest-scope treatment** — see §6 thin-market state. Below 1 plumber, the page doesn't exist (noindex/410), full stop.

### Example intro — DENSE: Nashville, TN (51 plumbers, 34,054 reviews read, 41/51 24-hr, median 4.9, 36 with 100+ reviews, 1 below 4.0)

> **Emergency plumbers in Nashville, TN — what 34,000 reviews actually say**
>
> We track 51 plumbing companies within 20 miles of Nashville and have read their reviews — 34,054 of them across Google, Yelp, and the BBB. Nashville's problem isn't finding a plumber; it's telling them apart: the median rating here is 4.9, and 41 of the 51 advertise 24-hour service. When everyone has five stars, the stars stop helping.
>
> That's where the review text earns its keep. Thirty-six of these companies have 100+ reviews — enough history for real patterns to show — and the patterns differ more than the ratings do: some are praised specifically for middle-of-the-night response, others rack up five stars entirely on daytime installs, and a handful of concerns (quotes that grew mid-job, unreturned callbacks) recur often enough that we flag them on the cards below. Only one company in this radius sits below 4.0, but a high average with a repeated complaint pattern deserves a harder look than the stars suggest — you'll see those concerns quoted, with names and dates, before you call.

### Example intro — STANDARD: Aiken, SC (10 plumbers, 5,820 reviews read, 3/10 24-hr, median 4.7, 4 with 100+ reviews)

> **The 10 plumbers serving Aiken, SC — strengths and concerns from 5,800 reviews**
>
> Ten plumbing companies serve the Aiken area within 20 miles, and we've read all 5,820 of their public reviews. The number that matters most here: only 3 of the 10 operate 24 hours. If it's the middle of the night, start with those three — but read their concern sections first, because "open 24 hours" on a Google profile and "answered at 2 a.m." in a customer review are not the same claim, and we quote the reviews that tell you which is which.
>
> Ratings run high in Aiken (median 4.7, nobody below 4.0), but the depth behind them varies a lot: four companies carry 100+ reviews — including one with over 3,500 — while others have a few dozen, which we treat as thinner evidence and say so on their cards. Where reviewers repeat a specific complaint, it's flagged below with their exact words.

### Example intro — THIN: Woodstock, VA (4 plumbers, 1,544 reviews read, 4/4 24-hr, median 4.9, one at 4.4)

> **The 4 plumbers we've assessed near Woodstock, VA**
>
> Our coverage near Woodstock is small: 4 plumbing companies within 20 miles, with 1,544 public reviews between them. We'd rather show you four companies we've actually read up on than pad this page with businesses from an hour away — so this is the honest list, and here's what it shows.
>
> All four advertise 24-hour service, and three hold ratings of 4.9 or better across substantial review counts. The fourth sits at 4.4 over 192 reviews — the widest spread of praise and complaints in this radius, and worth reading in full below, where the recurring concerns are quoted with names and dates. In a market this small you may end up calling more than one; the strengths sections below tell you who to try first for your specific problem.

*(Note the three intros share no sentence skeleton, lead with different facts by rule 2, and each contains a caution by rule 3.)*

---

## 5. Plumber card & profile microcopy

**Section labels (card + profile):**
- Strengths section: **"What reviewers praise"** — not "Pros" (too listicle) or "Highlights" (too marketing).
- Concerns section: **"What reviewers complain about"** — plain, factual, sourced-to-reviewers by its own grammar. If no pattern found: **"No repeated complaints found in the reviews we've read."** (Never "No concerns" — absence of evidence isn't a clean bill.)
- Thin-data flag: **"Only [N] reviews — treat this assessment as a first impression, not a track record."**

**"Our take" framing line (precedes synthesis on profile; establishes opinion-grounded-in-quotes for §230/FTC posture):**
> **Our take** — our editors' read of [N] public reviews from Google, Yelp, and the BBB. It's an opinion; the quotes below are what it's based on. [How we rate plumbers →](/methodology)

**Quote attribution format (every quote, no exceptions):**
> "The quote text exactly as published, trimmed only with ellipses."
> — First name L., Google review, March 2026 · [rating given: ★☆☆☆☆]

Rules: verbatim or ellipsized only; reviewer name as published on the platform; source platform + month/year always shown; the star rating that reviewer gave shown with the quote; quote links to the source review where the platform provides a stable URL.

**Rating distribution caption:** "All [N] ratings, not just the average." (bar chart of 1–5 stars)

**Score tooltip (on the 0–100 score):**
> Our 0–100 score — an editorial judgment blending this plumber's rating, review volume and recency, and the patterns in what reviewers actually wrote. It can't be bought. [See the full methodology →](/methodology#score)

**Sponsored-slot disclosure (on-card, FTC-clean, always visible — not hover-only):**
> **Sponsored** — [Business] paid for this top position. Payment buys placement only: the score, strengths, and complaints shown here are our independent assessment and are unaffected by sponsorship. [How sponsorship works →](/methodology#sponsored)

(Anchor + link markup uses `rel="sponsored"`. Label text "Sponsored" in the card corner even when collapsed.)

**Dispute / claim CTA (profile footer):**
> **Is this your business?** Claim this listing free to correct business details or post an owner response. Think we've quoted a fake or deleted review? [Tell us — we check every dispute.](/methodology#corrections) We don't remove accurate quotes, but we'll re-run your assessment as your reviews change.

**Call button microcopy:** "Call [Business]" + subtext "You call them directly — we don't sell your info or route the call."

**24-hour label honesty pair:**
- If profile hours say 24h AND reviews corroborate night response: "Open 24 hours — and reviewers confirm night calls."
- If profile hours say 24h with no review corroboration: "Advertises 24-hour service — no reviews mention after-hours response either way."

---

## 6. Ancillary pages

### /about — full copy

# About Fast Plumber Near Me

**We're the directory that shows you the bad reviews.**

Every plumber directory promises "trusted pros." Here's the problem: the directories get paid by the pros. The result is an industry where the bury-the-negative business model is standard — star averages up front, complaints unfindable, and rankings quietly sold.

We built the opposite. Fast Plumber Near Me reads the public reviews of every plumber we list — 6,000+ companies, from Google, Yelp, and the Better Business Bureau — and publishes an honest synthesis of each one: what customers praise, what they complain about, quoted word-for-word with names and dates. When three reviewers say the invoice grew after the quote, that goes at the top of the card, because the next customer deserves to know before they call, not after.

**What we are:** an opinionated reading service for plumber reviews. Our rankings are our editorial judgment, grounded in quotes you can check yourself.

**What we're not:** a lead-gen operation. We don't take your contact info and auction it to four plumbers. We don't charge plumbers for leads. We sell exactly one thing — clearly labeled sponsored placement — and it never changes a word of what we write about anyone. The full rules are in [our methodology](/methodology).

**Who's behind it:** Fast Plumber Near Me is run by Tim Dodaro from Crystal Lake, Illinois. It started with a simple observation: when your basement is flooding, you don't have time to read 200 reviews — but somebody should have. Now somebody has.

Found a mistake? [We correct fast.](/methodology#corrections) Want your business listed or want to sponsor a city? [Start here.](/add-your-business)

### /add-your-business — full copy (plumber-facing pitch)

# Get listed. Get read. Get chosen.

**For plumbing companies**

Fast Plumber Near Me is a review-synthesis directory: we read your public reviews from Google, Yelp, and the BBB, and publish an honest assessment — strengths and complaints — for homeowners comparing plumbers in your area. 6,000+ companies are already listed. Yours may be too.

## The free part

Every qualifying plumber is listed free. No charge, ever, for:

- Your listing with phone, hours, service area, and website
- Our synthesis of your reviews — the same honest treatment everyone gets
- Claiming your listing to correct business details and post an owner response
- A quarterly re-read of your reviews on request, so recent improvement shows up here

**Straight talk before you submit:** we publish complaint patterns too. If your reviews show one, it will appear on your card, and payment can't remove it. Plenty of directories will hide your negatives for a fee; we're not one of them, and that's exactly why homeowners believe the positives we print about you.

[Submit your business — free]

## Sponsored placement: own the top of your city

One plumber per city page can hold the labeled **Sponsored** slot — the first card homeowners see for that city.

What you get:
- Top position on the city page(s) you choose, above the organic rankings
- The "Sponsored" label, plus your full assessment — the same one you'd have anyway
- Placement in front of people actively comparing plumbers in your area — not cold leads you're bidding on against four competitors

What you should know:
- **Sponsorship never changes your assessment.** Your score, strengths, and complaint patterns read identically, paid or not. Homeowners trust the slot because it can't lie — which is what makes it worth buying.
- **There's a quality bar.** Companies below our quality threshold can't purchase placement. If that's you today, it may not be after your next quarter of reviews — ask us for a re-read.
- Pricing is per city, month to month, no contract. [Contact us for your city's rate.](/contact)

*You can pay to be seen here. You can't pay to be trusted here. That's the deal — for you and for every competitor on your page.*

### 404 page

# This page has left for another job.

The page you're looking for doesn't exist — it may have been removed when we rebuilt the site to cut thin pages and keep only listings we can stand behind.

- [Search for plumbers near you](/) — 6,000+ companies, reviews read and summarized
- [Browse by state](/plumbers)
- [How we rate plumbers](/methodology)

If a link on our own site brought you here, [tell us](/contact) — we fix broken pipes of all kinds.

### Thin-market state (city page with plumbers below threshold, e.g. 2–4 within 20 mi)

Used when a page renders with too few plumbers for a ranked list to be meaningful (see §4 thin-tier intro for 4; below is the floor case). **Cities with 0 plumbers get no page at all.**

> **We've only assessed [N] plumber[s] within 20 miles of [City].**
>
> That's the honest count — we list only companies whose reviews we've actually read and summarized, and we won't pad this page to look bigger than our coverage. Here's what we know about the [N] below, including any complaint patterns in their reviews.
>
> [cards]
>
> **If none of these works out:** [Nearest covered city, X mi away] has [M] assessed plumbers — many companies in this region travel between the two. [See plumbers near [Nearest city] →]
>
> *Run a plumbing company around [City]? [Get listed free](/add-your-business) — we'll read your reviews and give homeowners a reason to find you here.*

---

## 7. Privacy-policy red-lines

File: `src/app/privacy-policy/page.tsx`. Exact clauses referencing the nonexistent call program, and replacements. (Bump "Last updated" on publish; keep everything else legal-reviewed but these are the factual falsehoods.)

| # | Location | Current text (verbatim) | Action / replacement |
|---|---|---|---|
| R1 | §1 "Information We Collect — For Plumbers" (lines 26-29) | "We also collect data from our verification calls including whether calls were answered and response times." | **Delete sentence.** Replace with: "We also collect publicly available information about your business, including customer reviews published on third-party platforms such as Google, Yelp, and the Better Business Bureau." |
| R2 | §2 bullet (line 36) | "To verify plumber availability through our AI calling system" | **Delete bullet.** Replace with: "To aggregate and synthesize publicly available customer reviews into the assessments displayed on our site" |
| R3 | §2 bullet (line 37) | "To calculate and display reliability scores" | **Rewrite:** "To calculate and display editorial quality scores based on public review data" — "reliability score" is the vocabulary of the fake call program; retire the term site-wide. |
| R4 | §3 entire section (lines 44-53) | "AI Verification Calls — As part of our verification process, we make periodic phone calls to listed plumbers using AI voice technology. These calls may be recorded… you consent to receiving these verification calls. Plumbers may opt out… 'unverified' status…" | **Delete the entire section.** Replace with a new §3 "Public Review Data": "Our plumber assessments are based on customer reviews published on third-party platforms (Google, Yelp, BBB). We quote these reviews verbatim with the attribution (reviewer name, date, platform) under which they were published. Reviewers whose public reviews are quoted, or plumbers who believe a quoted review has been removed at its source, may contact us at corrections@fastplumbernearme.com; see our Methodology page for the dispute process." |
| R5 | Consequential check | "unverified status" concept (§3) | No listing status may reference verification. Statuses are "assessed / not yet assessed" (assessed = synthesis exists). Grep for "verificationStatus" usage in rendered UI. |

**Beyond privacy policy — same red-line sweep required in:** homepage (`page.tsx` metadata + hero + step 2 + badges + why-us), `/about` (metadata + "Our Solution" + "AI-Verified" tile), `/how-we-verify` (delete page, 301 → `/methodology`), any JSON-LD or OG description emitting "verified," and `/terms` (grep for "verification"). Site-wide grep before launch: `verif`, `reliability score`, `AI call`, `answer rate`, `we call`, `licensed & insured`.

---

## Appendix: banned/required vocabulary quick card

**Banned site-wide:** verified, verify, AI-verified, verification, reliability score, "we call," answer rate, licensed & insured (unless actually checked), trusted/trustworthy (as self-description), top-rated, reliable (site-authored, about a plumber), "pre-screened," any weather-based city filler.

**Required framings:** "our take/our read/our assessment" (opinion), "reviewers say/complain/praise" (attribution), "based on [N] reviews from Google, Yelp, and the BBB" (grounding), "Sponsored — payment buys placement only" (disclosure), "we have not read enough reviews to say" (uncertainty).
