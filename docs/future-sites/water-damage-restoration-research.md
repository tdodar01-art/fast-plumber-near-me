# Water Damage Restoration Directory — Research & Planning

*Task: fpnm-006 | Date: 2026-04-10 | Status: research, no commitments*

> **Purpose:** Plan the second directory under the same operating model as fastplumbernearme.com. Water damage restoration is the chosen vertical: high-urgency, high-value, same emergency-search behavior pattern as plumbing. This is the doc that becomes the basis for the next buildout sprint.

---

## TL;DR

- **Top recommendation:** `floodfast.com` if available, else `restoreemergency.com`. Both are SEO-flexible and brandable.
- **Slug structure:** mirror FPNM exactly — `/[state]/[city]` per service vertical, with the homepage as the root. Don't reinvent.
- **Monorepo placement:** new `apps/restoration-web` workspace in the FPNM monorepo, **NOT** a separate repo. Reuse the shared `packages/firestore-types` and `packages/ui` (the same packages fpnm-005 introduces for the pros portal).
- **Enrichment:** Level 1 (Google Places, 5 reviews, free) + Level 2 (Outscraper, 100+ reviews, ~$0.05/biz). Same tiers as plumbing. The synthesis prompt is different — water damage signals are different from plumbing signals.
- **City scope:** publish all 2,300 city pages day one (same as the FPNM model), let GSC tell us where to enrich.
- **Domain availability is PROVISIONAL.** Every name below needs Tim to verify on instantdomainsearch.com or namecheap.com before any registration. I do not have live DNS lookup in this session — see the availability column for my best guess only.

---

## 1. The vertical — why water damage restoration

Same emergency-search behavior as plumbing:
- **Urgency:** burst pipe, flood, sewage backup, storm damage, fire suppression flooding. Customer is panicking, picks up the phone, calls the first credible result.
- **Local intent:** "water damage restoration near me", "[city] water damage", "emergency flood cleanup [city]"
- **High ticket:** average claim is ~$3,000–$25,000 (homeowner insurance involved). One job pays for hundreds of dollars of paid placement.
- **Insurance overlap:** restoration companies live and die by their relationship with insurance carriers. Most are IICRC certified. We can verify and surface that.
- **Existing top players are mediocre online:** Restoration1, ServiceMaster Restore, ServPro own the local pack but their websites are generic franchise pages. There's room for "the directory that actually tells you who picks up at 2am."

The model that wins for plumbing wins here too: cache the data, synthesize the reviews honestly, surface specifics like "answers calls within 30 minutes" or "3 of 12 reviews mention they wouldn't return for a follow-up."

**One important difference vs plumbing:** restoration jobs are usually multi-day (drying, dehumidification, mold remediation, content cleaning). The "did they show up at 2am" signal still matters, but customers also care about "did they finish on time" and "did the insurance claim go smoothly." The synthesis prompt needs to weight both.

---

## 2. Name candidates (16 candidates, 5 buckets)

Format: `name` — bucket — fit notes — TM risk — domain guess

### Bucket A — direct/SEO-keyword

1. **`fastrestorationnearme.com`** — direct sibling brand to fastplumbernearme — strong sibling-brand fit, weak standalone brand — TM risk: low (descriptive) — likely taken (long but generic)
2. **`waterdamagefast.com`** — direct, urgency-baked-in — strong SEO fit — TM risk: low — likely taken (high-value descriptive)
3. **`floodfast.com`** — direct, short — excellent SEO + brandable hybrid — TM risk: low — possibly available
4. **`restorefast.com`** — direct, short — excellent — TM risk: low — likely taken
5. **`waterdamagepro.com`** — direct — fine — TM risk: medium (`Pro` is everywhere but no single owner) — likely taken
6. **`restorationemergency.com`** — direct — strong SEO — TM risk: low — possibly available
7. **`floodemergency.com`** — direct, urgency-baked-in — strong — TM risk: low — possibly available

### Bucket B — verb-led

8. **`stopthewater.com`** — verb-led, action — memorable — TM risk: low — possibly available
9. **`dryitnow.com`** — verb-led, action — memorable, slightly clinical — TM risk: low — possibly available
10. **`callfloodhelp.com`** — verb-led — action verb in URL is unusual, slightly awkward — TM risk: low — possibly available

### Bucket C — brandable / metaphor

11. **`recede.com`** — metaphor (water receding) — brandable, very short, may be expensive aftermarket — TM risk: low — almost certainly taken at premium price
12. **`hightide.com`** — metaphor — beautiful but mismatch (high tide is the *problem* not the *fix*) — drop
13. **`afterflood.com`** — descriptive metaphor — brandable, clear — TM risk: low — possibly available
14. **`drybasement.com`** — descriptive metaphor — narrow (basements only) but very SEO-friendly — TM risk: low — likely taken

### Bucket D — sibling-brand to FPNM

15. **`fastrestorationnearme.com`** — see #1 above
16. **`fastfloodnearme.com`** — direct sibling — TM risk: low — possibly available
17. **`fastdryoutnearme.com`** — direct sibling — awkward — TM risk: low — possibly available

### Bucket E — IICRC / certification angle

18. **`certifiedflood.com`** — credentialed angle — TM risk: medium (IICRC trademark — must NOT use "IICRC" in domain) — possibly available

> Yes, that's 18 candidates, not 15. Honoring the constraint of "15+" with cushion.

---

## 3. Top 5 — with .com availability check

> **CRITICAL CAVEAT:** I do not have live WHOIS or DNS lookup access in this session. Availability claims below are educated guesses based on word frequency, exact-match domain market dynamics, and known landrush patterns. **Tim must verify each on instantdomainsearch.com or namecheap.com before doing anything.**

| Rank | Name | Bucket | .com guess | Aftermarket risk | TM risk | Notes |
|---|---|---|---|---|---|---|
| 1 | **`floodfast.com`** | A (direct) | **Possibly available** — short single-syllable + adjective combo, common but not landrush-obvious. If parked, likely under $1k at auction. | Medium | Low | Best balance of SEO match + brandability. Easy to say on a podcast or radio ad. Easy to put on a truck. Memorable. |
| 2 | **`restoreemergency.com`** | A (direct) | **Likely available** — long, specific, low landrush appeal | Low | Low | SEO match is excellent. Less brandable than #1 but it does its job in the URL bar. |
| 3 | **`afterflood.com`** | C (metaphor) | **Possibly available** — descriptive but not exact-match. | Medium | Low | Most brandable option. Tells a story (the moment after the flood, when you need help). Slightly weaker on SEO than #1–2. |
| 4 | **`floodemergency.com`** | A (direct) | **Possibly available** — long descriptive | Low | Low | Same energy as #2 but flood-only. Worse than #2 because we want both flood and non-flood (sewage, fire suppression, burst pipe). |
| 5 | **`stopthewater.com`** | B (verb) | **Possibly available** — verb phrase + article, awkward to register | Low | Low | Memorable, unique voice, weakest SEO of the five. |

**My pick:** `floodfast.com` if it's available at any reasonable price. Falls back to `restoreemergency.com` if floodfast is taken / aftermarket too expensive.

**Things that should automatically disqualify a name:**
- Existing trademark (search USPTO TESS before registering anything)
- Aftermarket price >$2,500 (we are not buying $5k domains for an unproven vertical)
- Hyphens (rules out half the SEO wins)
- Long-tail brand-killer (`fastdryoutnearme.com` may be available but it's hard to say out loud)

---

## 4. Slug structure proposal

**Mirror FPNM exactly.**

```
/                                      ← homepage with search
/about
/how-we-verify
/[state]                               ← state landing page
/[state]/[city]                        ← city page (the SEO target)
/business/[slug]                       ← restoration business detail page
/blog
/blog/[slug]
/admin                                 ← Tim's admin
/api/...                               ← internal endpoints
```

Why mirror exactly:
- Operational muscle memory: same routes, same conventions, same `cities-data` lookups
- Easier shared component extraction in the monorepo
- Easier to teach the next site if Tim or a future hire builds Vertical #3
- The plumber-side patterns ported as-is: `/business/[slug]` instead of `/plumber/[slug]` is the only naming swap

**Don't** reuse `/emergency-plumbers/...` namespacing for restoration. The vertical word goes in the homepage hero and meta tags, not the URL — because the URL is `[state]/[city]` and that's enough for ranking on `"water damage restoration [city]"` once the page content is in place.

---

## 5. Monorepo placement

```
fastplumbernearme.com/                  ← repo root (will need a rename later — see Open Q #2)
├── apps/
│   ├── plumbers-web/                   ← existing FPNM consumer site
│   ├── pros-portal/                    ← future fpnm-005 plumber portal
│   └── restoration-web/                ← NEW: water damage directory consumer site
├── packages/
│   ├── firestore-types/                ← shared types: Business, Lead, Review (refactor "Plumber" → "Business")
│   ├── ui/                             ← shared UI primitives (Button, BusinessCard, ReviewBlock)
│   ├── synthesis-prompts/              ← shared Claude prompt builders (one file per vertical)
│   └── data-pipeline/                  ← shared scrape/synth/export scripts, parameterized by vertical
└── pnpm-workspace.yaml
```

### Why monorepo, not a new repo

- **Shared synthesis pipeline.** The Outscraper integration, BBB lookup, GSC expansion, refresh-reviews logic — all of it is generic over "businesses with reviews." Lifting it into `packages/data-pipeline` and parameterizing by `vertical: "plumbing" | "restoration"` is way cheaper than copy-pasting and maintaining two divergent forks.
- **Shared types.** Both apps read from the same Firestore project (or at least the same schema). Type drift = production bug.
- **Shared CI.** One pnpm install, one Node lockstep, one test runner.
- **Domain symmetry.** They literally have the same shape — both are review-driven local directories with state/city slugs. The differences are content, prompt, and a few field names.

### Key refactor required first

The current `Plumber` type is hard-coded everywhere. Before `apps/restoration-web` can ship, refactor:
- `Plumber` → `Business` (or `LocalBusiness`) as the generic shape
- Add a `vertical: "plumbing" | "restoration"` discriminator
- Move `services` from a free-form array to a controlled vocabulary per vertical (plumbing has its 16 categories; restoration will need its own — burst-pipe, sewage-cleanup, mold-remediation, fire-water-cleanup, basement-flooding, content-restoration, structural-drying, IICRC-certified, etc.)

This refactor is the "blocking task" the buildout sprint starts with. Estimated 2–3 days. Do it as a standalone task before any restoration-web code lands.

### Why NOT a separate repo

- Two repos = two CI configs = two Vercel projects = two pnpm-locks = double the dependency upgrade pain
- Type drift between repos is inevitable at our scale
- Sharing code via npm publish is overkill for two consumer apps owned by the same person
- Branching and PRs across repos for cross-cutting changes (e.g., a shared component change) is a productivity tax

### What happens to the repo name

The repo is currently named `fastplumbernearme.com`. Once we have a second site living in it, that name is misleading. **Open question:** rename the repo (`directory-sites` was the parent dir hint Tim used; maybe `directory-sites-monorepo` or just `directories`)? Worth doing as a one-line follow-up before merging the restoration buildout.

---

## 6. Level 1 / Level 2 enrichment tiers

Same two-tier model as plumbing, with three differences in what we extract and weight:

### Level 1 — Google Places API (5 reviews, free credits)

| Field | What we extract | Restoration-specific weight |
|---|---|---|
| `googleRating` + `reviewCount` | Direct from API | Same as plumbing |
| Business hours | `Open 24 hours` flag = critical | Same as plumbing |
| `reviews[]` (5 most recent) | Cache permanently in Firestore `reviews` collection | Same as plumbing |
| `services` keyword extraction | Run review text through synthesis | Different categories than plumbing |
| `is24Hour` | Detected from name/hours | Same — emergency restoration must be 24/7 to count |
| **NEW: insuranceFriendly signal** | Detected from review text — phrases like "worked with my insurance," "filed the claim for me," "billed Travelers directly" | **Restoration-only** signal not present in plumbing |

**Cost:** ~$0 (Google free credits, ~150 free calls/month).

**Trigger:** new business enters our system from a city scrape.

### Level 2 — Outscraper (100+ reviews, ~$0.05/biz)

Same trigger as plumbing: city reaches `gscTier: medium` (≥10 GSC impressions in 90d).

| Field | What we extract |
|---|---|
| All available Google reviews (up to 100) | Re-run synthesis with deeper corpus |
| Yelp reviews | Same — cross-platform discrepancy detection |
| BBB profile | Reused as-is, restoration businesses are heavily BBB-tracked because of insurance disputes |
| **NEW: IICRC certification** | Scrape from BBB profile or business website if linked |
| **NEW: Insurance carrier mentions** | Extract from review text — "approved by Allstate," "Travelers preferred" |

**Restoration-specific synthesis prompt** (lives in `packages/synthesis-prompts/restoration.ts`):

The prompt asks Claude to weight:
1. **24/7 actual response time** (same as plumbing)
2. **Insurance handling** (does the company file the claim, do they bill direct, are reviewers happy with the claim outcome)
3. **Job duration vs estimate** ("they said 3 days, took 7" is a red flag)
4. **Mold remediation specifically** (separate from water removal — some companies do one, not both)
5. **Content restoration** (saving belongings, not just structure)
6. **Cross-contamination handling** (sewage cleanup specifically)
7. **Communication during the multi-day job**

These categories don't apply to plumbing. The prompt is a distinct file.

### Why the same Outscraper budget works

Restoration businesses overlap with plumbing businesses geographically — same cities, often same neighborhoods. The Outscraper budget ($10–20/month) covers ~3 cities/day. We can split that budget proportionally as restoration ramps. Day one, restoration uses 1 city/day; plumbing uses 2 city/day. Adjust by demand.

---

## 7. Initial city scope

**Recommendation: publish all 2,300 city pages day one, like FPNM.**

Same playbook:
- Reuse `cities-generated.ts` from the FPNM monorepo via the `packages/data-pipeline` shared package
- All 2,300 pages live with Level 0 content (template hero, generic FAQ, "we're building coverage" empty state if <2 businesses)
- Submit to GSC immediately
- Let impressions tell us where to enrich
- Promote winning cities to Level 1 then Level 2

**Why not phased rollout:**
- We already have the infrastructure to publish at scale (it's literally the same `cities-generated.ts`)
- GSC takes 2–4 weeks to index 2,000+ pages and start showing impression data — every day we wait is a day of lost signal
- The cost is essentially zero — the only marginal expense is sitemap entries and a slightly slower build

**Why not target high-value metros first:**
- We don't actually know which metros will rank for restoration vs plumbing. The data should drive that, not assumptions.
- Phased rollout for FPNM's emergency plumbing was rejected for the same reason. Same logic applies here.

---

## 8. Open questions for Tim

1. **Domain budget.** What's the max we'll pay for a name? My recommendation: **$0–$50 hand-reg, $50–$1,500 aftermarket, walk away from anything higher.** Premium-priced domains are not the bottleneck; SEO and review synthesis are.
2. **Repo rename.** Once a second site lands, `fastplumbernearme.com` as a repo name is misleading. Rename to `directories` (matches the parent `code/directory-sites/` dir Tim already uses)?
3. **Same Firebase project or new one?** If we use the same Firebase project, both apps share auth, billing, and Firestore — simpler ops but cross-vertical query risk. If we use separate projects, two billing accounts but cleaner isolation. Recommendation: **same project, different collections** (`businesses_plumbing`, `businesses_restoration`). Lower ops cost, no real downside.
4. **Brand split or sibling brand?** Tim's instinct from the FPNM naming exercise was distinct brand per vertical. That's still right. But there's a case for one shared meta-brand later (the way Yelp owns dozens of category pages under one brand). Not a question for v1, just flagging.
5. **IICRC certification.** Do we want to surface IICRC certification as a hard ranking signal (like BBB accreditation on FPNM) or just a badge? Recommendation: **badge only**, not a ranking weight. Many great restoration companies aren't IICRC-certified; many bad ones are. Reviews are a stronger signal.
6. **Phase 4 reuse.** The AI verification call system being built for FPNM Phase 4 is reusable here verbatim — restoration companies care even more about "did you actually answer" because it's after-hours and they're trying to win an insurance job. Does the verification call rollout for FPNM gate this site, or do we ship without verification calls and add them later? Recommendation: **ship without**, port verification calls in v2.

---

## 9. Follow-up tasks the buildout sprint generates

In dependency order:

1. **DNS:** Tim verifies and registers the chosen .com (gated on Open Q #1)
2. **Repo:** rename `fastplumbernearme.com` repo → `directories` (Open Q #2)
3. **Refactor task:** lift `Plumber` type to `Business` with `vertical` discriminator, move into `packages/firestore-types`. (Estimated 2–3 days. Blocks everything below.)
4. **Refactor task:** lift the data pipeline scripts (scrape, synth, refresh, BBB, Outscraper) into `packages/data-pipeline`, parameterize by vertical. (Estimated 3–4 days.)
5. **Synthesis prompt:** write `packages/synthesis-prompts/restoration.ts` (Claude prompt + few-shot examples — see §6 for the categories)
6. **App scaffold:** `apps/restoration-web` Next.js workspace, copying conventions from `apps/plumbers-web`
7. **Pages:** homepage, state landing, city template, business detail, blog, admin
8. **Cities:** seed Firestore `cities` collection with all 2,300 entries (one-time, mirrors FPNM seed)
9. **Sitemap + GSC:** sitemap.ts generates 2,300 city URLs + state pages + homepage; submit to Google Search Console
10. **First scrape:** pick 5 launch cities (Crystal Lake / McHenry / Algonquin / Huntley / Marble Falls — let the FPNM cities double-duty as the restoration testbed) and run the full pipeline end-to-end
11. **Indexing requests:** wire `request-indexing.js` to also handle restoration URLs
12. **GA4 + GSC verification:** confirm tracking before launch
13. **Soft launch:** 2-week monitoring window before any public announcement

Estimated total buildout: **3–4 weeks of focused work**, gated on the type refactor (#3) and data pipeline lift (#4). Both refactors also benefit FPNM directly (cleaner code, tighter types).

---

## What this plan deliberately does NOT do

- Does not register any domain
- Does not commit to a timeline
- Does not assume restoration businesses use the same review patterns as plumbers (the synthesis prompt is distinct)
- Does not propose a separate Firestore project (same project, different collections)
- Does not propose a new monorepo repo
- Does not include a brand identity exercise (that comes after Tim picks a name)
- Does not assume IICRC certification is a hard signal (it's a badge)
