# pros.fastplumbernearme.com — Monetization Subdomain Plan

*Task: fpnm-005 | Date: 2026-04-10 | Status: planning, not implementation*

> **Purpose:** Get the monetization engine on the radar. Single planning doc Tim can react to and prioritize against other work. No code, no domain registration, no overbuilding.

---

## TL;DR

- **What it is:** `pros.fastplumbernearme.com` is the plumber-facing portal — claim listing, manage profile, see leads, pay for placement, unlock the dofollow backlink. It is **not** a lead-auction marketplace.
- **Subdomain vs subdirectory:** **Subdomain.** The plumber side and the consumer side have nothing in common — different auth, different audience, different deploy cadence, different SEO surface.
- **Tech stack:** Next.js 16 + Firebase Auth, **same monorepo**, new `apps/pros-portal` workspace. Reuses the existing Firestore plumber records as the source of truth.
- **MVP:** Just enough to take Tim's first paying plumber's money. Three screens: claim, billing, lead inbox.
- **Phased rollout:** MVP (4 screens, no marketplace) → v1 (analytics + content tools) → v2 (the lifetime dofollow upsell) → v3 (full marketplace if and only if pay-per-lead becomes the dominant revenue mode).
- **Recommendation:** start with MVP, charge one plumber $49/mo manually before writing any portal code. Validate the wallet, then build.

---

## 1. What is `pros.fastplumbernearme.com`?

A plumber-facing web app where existing plumbers in our directory can:

| Action | MVP | v1 | v2 | v3 |
|---|---|---|---|---|
| Claim an existing listing (proves identity, links to a Firebase Auth account) | ✅ | | | |
| Edit profile fields (phone, hours, service area, photos, services offered) | ✅ | | | |
| See leads (click-to-call events tied to their listing) | ✅ | | | |
| Pay for monthly placement tier (Premium / Featured) via Stripe | ✅ | | | |
| Lifetime dofollow backlink unlock — one-time upsell | | | ✅ | |
| Lead-volume dashboard, conversion analytics, time-on-page per lead | | ✅ | | |
| Review-response tools (claim a review, post a public reply) | | ✅ | | |
| Service-area expansion requests (claim adjacent cities) | | ✅ | | |
| Pay-per-lead marketplace (bid for non-tier leads) | | | | ✅ |
| Verified-call badge enrollment (Phase 4 AI verification calls) | | | ✅ | |

**Explicit non-goals:**
- Not a lead auction. Plumbers don't bid for leads. Leads route by quality score, not by who paid the most.
- Not a CRM. We don't store customer data on behalf of the plumber. Their leads are click-through events from our directory, that's it.
- Not a quote-request relay. We are a directory. The customer calls the plumber directly. We don't sit in the middle of the transaction.

The mental model: **a plumber's "MyAccount" page for our directory.** Like the Yelp Business or GMB dashboards — but ours is honest about what we actually do (which is route searches to phones).

---

## 2. Subdomain vs subdirectory

### Option A — Subdomain: `pros.fastplumbernearme.com`

| Pro | Con |
|---|---|
| Clean separation: consumer site doesn't accidentally pull plumber-portal CSS, fonts, auth scripts | New DNS record, new Vercel project (or workspace) |
| Different SEO surface — `pros.` is `noindex`/private, the apex is fully indexable. Easier robots.txt and `meta name="robots"` discipline | Cookies don't share by default — if we ever want SSO between consumer + portal, slightly more work |
| Different deploy cadence — push portal changes without rebuilding the 2,300-page consumer site | Two analytics properties (or one with hostname filters) |
| Vercel preview deploys are scoped per project — pros and consumer don't fight | |

### Option B — Subdirectory: `fastplumbernearme.com/pros`

| Pro | Con |
|---|---|
| One DNS record, one deploy, one Vercel project | Every consumer-side build also rebuilds the portal — slow |
| Simpler SSO (same cookie domain) | Hard to keep portal pages out of consumer sitemap and crawl |
| Authority concentration on the apex domain | Authority concentration is a myth at our scale; the consumer site dwarfs the portal in pages and links |
| | If portal has a security incident, blast radius is the apex domain |
| | Plumber portal traffic patterns (logged-in, dynamic, low cache hit rate) hurt the consumer site's edge cache stats |

### Recommendation: **Option A — subdomain**

Pros and consumers do not share an audience, an SEO surface, or a deploy cadence. Forcing them into one project is premature optimization. The "shared cookie SSO" upside doesn't matter because consumers never log in.

The cost (one Vercel project, one DNS record) is trivial.

---

## 3. Monorepo placement

**Add a new workspace: `apps/pros-portal`** alongside the existing `apps/plumbers-web`. Follow the same pattern.

```
fastplumbernearme.com/
├── apps/
│   ├── plumbers-web/        ← existing consumer site
│   └── pros-portal/         ← new plumber portal
├── packages/                ← currently empty; first real shared code goes here
│   ├── firestore-types/     ← shared TypeScript types for Plumber, Lead, etc.
│   └── ui/                  ← optional: shared button/input/modal components
└── pnpm-workspace.yaml
```

**Why monorepo and not a separate repo:**
- Both apps read from the same Firestore. Type drift between them = production bug. Shared `packages/firestore-types` solves it.
- One CI pipeline. One pnpm install. One Node version lockstep.
- If the portal calls a future internal API (lead webhook, payment success handler), it's a workspace import — not a network call.
- The `packages/` directory is currently empty; this is the right time to start using it.

**Why not collapse them into one Next.js app with a `(pros)` route group:**
- Different runtimes: consumer site is mostly SSG, portal is mostly authenticated SSR.
- Different middleware: portal needs auth gating on every page; consumer needs none.
- Different `next.config.ts`: portal will likely want a different image domain allowlist, different headers, different rewrites.

---

## 4. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | Same as `apps/plumbers-web`. No new framework to learn. |
| Auth | Firebase Auth (email + Google) | Already in the stack. Existing service-account pattern works for server-side checks. |
| Database | Firestore (existing `plumbers` collection + new `proAccounts` and `proLeads` collections) | Source of truth is unchanged. New collections are scoped to portal. |
| Payments | Stripe | Industry default for SaaS subscriptions. Stripe customer ID stored on `proAccounts` doc. |
| Email | Brevo (already used by AOK booking project per Tim's stack notes) | Reuse existing API key, no new vendor. |
| Hosting | Vercel | Same as `apps/plumbers-web`. New Vercel project in the same team. |
| State management | None — server components + Firestore listeners where needed | Avoid Redux/Zustand for an MVP this small. |

**No new dependencies that aren't already in the monorepo, except `stripe` and `@stripe/stripe-js`.**

---

## 5. Auth model

### Who can log in
Only plumbers whose business already exists in our `plumbers` Firestore collection. **No self-signup from outside the directory.**

### How a plumber claims a listing
1. Plumber visits `pros.fastplumbernearme.com/claim`
2. Searches for their business by name + city
3. Hits "Claim this listing"
4. Verification options (one of):
   - **Phone verification** (most likely path): we call the phone number on the listing with a 6-digit code via Twilio. They enter the code. (Reuses Twilio account already provisioned for AOK Sarah.)
   - **Email verification** (fallback): if their listing has an email field (rare — Google Places doesn't return one), we email a link.
   - **Manual verification** (last resort): they upload a utility bill or business license. Tim approves manually from the admin panel.
5. On success, a Firebase Auth account is created and linked to the plumber doc via `proAccounts/{uid}` → `{ plumberId, claimedAt, verificationMethod }`.

### Authorization
- A signed-in plumber can edit only their own listing.
- They can see only their own leads.
- Firestore security rules enforce both. (We already have `firestore.rules` — extend it.)
- Tim has admin access via the existing admin panel; nothing new there.

### Why not magic links from day one
Magic links are great UX but they make abuse trivial — a competitor can request a link to a plumber's email and the plumber may just click it without realizing what they're claiming. Phone verification is friction in the right place.

---

## 6. Phased rollout

### MVP — "Take Tim's first $49"
**Scope: 4 screens. ~2 weeks of work.**

1. **`/claim`** — search and claim flow with phone verification
2. **`/dashboard`** — single page showing: plumber name, claim status, current tier (free), lead count this month, "Upgrade to Premium" CTA
3. **`/dashboard/edit`** — edit phone, hours, service cities, photos, services offered. Writes back to the same `plumbers` doc the consumer site reads.
4. **`/dashboard/billing`** — Stripe checkout for Premium ($49/mo) and Featured ($149/mo). Webhook updates `plumbers/{id}.listingTier`.

What's deliberately missing from MVP:
- Lead detail view (just a count for now — Tim emails leads weekly until volume justifies a UI)
- Analytics charts
- Review responses
- Lifetime dofollow upsell
- Service area expansion requests

**Validation gate:** at least 1 plumber pays before any v1 work starts. If nobody pays at $49/mo, the problem isn't the dashboard — it's the offer or the audience.

### v1 — "Make it worth keeping the subscription"
**Adds:**
- Lead detail view: who called, when, from which city page, time-on-card before the call
- Time-series charts: leads per week, click-to-call rate, position in sort order
- Review-response tool (post a reply that shows on the plumber's profile page)
- Service-area expansion requests (plumber claims they serve adjacent cities, queues for Tim's review)

**Trigger:** ≥5 paying plumbers and at least one churn driven by "I can't see what I'm getting for the money."

### v2 — "Lifetime unlock + AI verification badge"
**Adds:**
- Lifetime dofollow backlink upsell — one-time payment ($499 or $999, Tim's call). Adds a `dofollowUntil: lifetime` field to the plumber doc; the consumer site renders a `rel=""` link (instead of `rel="nofollow"`) for these plumbers.
- Phase 4 verified-call badge enrollment — plumber opts in to AI verification calls, sees their answer-rate score on the dashboard, badge appears on consumer-side profile when score ≥ threshold.

**Trigger:** Phase 4 (AI verification calls) is built and stable on the AOK Sarah stack first — see ROADMAP.md.

### v3 — "Full marketplace" (only if pay-per-lead becomes dominant)
**Adds:**
- Pay-per-lead bidding for plumbers without a tier subscription
- Lead notification preferences (SMS, email, webhook)
- Auto-pause when monthly lead budget hits a cap

**Trigger:** subscription revenue alone can't sustain the business after 12 months of operation. **This is the "we got it wrong" branch.** If the subscription model works, v3 may never ship — and that's the desired outcome. Subscriptions are simpler to operate, predictable revenue, no plumber-vs-plumber friction. Don't build v3 just because it's on the roadmap. Build it because subscription revenue stalled.

---

## 7. Open questions for Tim

1. **Pricing.** $49 / $149 Premium / Featured is the placeholder from `ROADMAP.md` Phase 2. Is that the actual MVP pricing or do we want to test higher? Recommendation: $49 single tier for MVP, add Featured at v1 once one Premium tier converts.
2. **Stripe vs LemonSqueezy.** Stripe is the default but LemonSqueezy handles sales tax automatically (Stripe needs Stripe Tax). For 1–10 plumbers it's irrelevant. For 100+ plumbers, sales tax is a real headache. Worth flagging now.
3. **Brand:** is "pros.fastplumbernearme.com" the locked subdomain, or is something cleaner on the table (e.g., `dashboard.fastplumbernearme.com`, `partners.fastplumbernearme.com`)? Recommendation: stay with `pros.` — it's the most descriptive and the most common pattern in directory businesses.
4. **Lead delivery cadence.** Until v1 ships, how do we get leads in front of paying plumbers? Recommendation: weekly digest email to paying plumbers from `request-indexing.js`-style scheduled job, listing every `leads` Firestore doc tied to their plumber ID since the last digest.
5. **Manual onboarding for first 5 plumbers.** Recommendation: skip the `/claim` flow entirely for the first 5 — Tim claims their accounts manually via the admin panel and gives them temp passwords. The `/claim` flow is the second milestone, not the first.
6. **Phase 4 dependency.** v2 depends on AI verification calls being stable. That's a big upstream dependency. Should v2 just *not* include the verified badge and treat lifetime dofollow as a standalone v2? Recommendation: yes — split lifetime dofollow into v2a (ship soon after v1) and verified badge into v2b (ship after Phase 4).

---

## What this plan deliberately does NOT do

- Does not propose a new database, ORM, or auth system
- Does not propose a separate repo
- Does not include a marketing site for the portal — the consumer site's "List Your Business" page is the entry point
- Does not include a mobile app — the dashboard is responsive web
- Does not include lead-bidding mechanics (those live in v3, conditional)
- Does not assume payment processor lock-in — Stripe is the default but the schema doesn't bake Stripe customer IDs into anywhere they couldn't be migrated

---

## Recommendation summary

**Build the MVP only after one plumber pays $49 manually.** The riskiest assumption isn't "can we build a portal" — Tim's stack already does authenticated SaaS in the AOK projects. The riskiest assumption is "will plumbers in our directory pay us anything." Validate the wallet first, then write portal code.

When the build starts, the order is:
1. Create `apps/pros-portal` workspace and `packages/firestore-types`
2. Set up DNS and Vercel project for `pros.fastplumbernearme.com`
3. Build the 4 MVP screens
4. Wire Stripe webhook → Firestore tier update
5. Migrate the manual-billed plumber onto Stripe
6. Onboard plumbers 2–5 through the manual flow while iterating on `/claim`
7. Move to v1 work once ≥5 paying

Total MVP build estimate: ~2 weeks of focused work, gated on the validation step above.
