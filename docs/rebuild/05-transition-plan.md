# fastplumbernearme.com — URL Transition Plan (Legacy → Rebuild)

**Date:** 2026-07-11 · **Companion to:** `01-seo-architecture.md` (defines the target URL space)
**Scope:** 100% of the ~44,700-URL legacy space maps to exactly one of: 301 (single hop, permanent), 410 (gone), or "unchanged". Nothing 404s by accident; nothing redirects into a chain.

---

## 1. Legacy URL inventory (verified against the repo today)

Source of truth read: `apps/plumbers-web/src/app/**` route tree, `src/app/sitemap.ts`, `src/lib/services-config.ts`, `src/lib/states-data.ts`, `src/config/plumbing-routes.ts`, `next.config.ts`, `vercel.json`.

**Key facts found in code:**

- **No `middleware.ts` exists anywhere in the app.** No `redirects()` in `next.config.ts`. `vercel.json` is `{"framework":"nextjs"}` — zero redirect infrastructure today. Everything below is greenfield.
- **Legacy state segment is the FULL-NAME slug** (`states-data.ts`: `IL → slug: "illinois"`). The new architecture uses two-letter codes (`/plumbers/il/...`). Every geo redirect therefore requires a 51-entry state-name→abbr map.
- Apex→www is currently a **307** at the Vercel domain layer (noted in `plumbing-routes.ts` comments). Must become 308/301.
- Sitemap (`sitemap.ts`) stamps `new Date()` on nearly every URL and emits ~38,488 URLs; historical crawled space ~44,700 (cities grew via GSC expansion, and thin pages that fell below `MIN_PLUMBERS_FOR_PAGE=5` left the sitemap but remain crawlable URLs Google knows about).

### 1.1 Pattern-by-pattern inventory

| # | Legacy pattern | Route file | Scale | Notes |
|---|---|---|---|---|
| P1 | `/{service}/{state-name}/{city}` | `app/[service]/[state]/[city]/page.tsx` | 27 slugs × ~1,400 qualifying cities ≈ **~37,800** (sitemap); crawled space larger — any of ~2,268 `RAW_CITIES` × 27 resolves | The demoted doorway set. 27 slugs enumerated in §1.2 |
| P2 | `/emergency-plumbers/{state-name}/{city}` | `app/emergency-plumbers/[state]/[city]/page.tsx` | ~2,268 cities (grown daily via GSC expansion) | **The main indexed set — carries whatever equity exists** |
| P3 | `/emergency-plumbers/{state-name}` | `app/emergency-plumbers/[state]/page.tsx` | 51 | State pages |
| P4 | `/emergency-plumbers` | `app/emergency-plumbers/page.tsx` | 1 | Index |
| P5 | `/plumber/{business-slug}` | `app/plumber/[slug]/page.tsx` | ~6,211 | Healthiest template; franchise-collision slug fix already shipped |
| P6 | `/plumbers` | `app/plumbers/page.tsx` | 1 | Directory index w/ client filters (`?q=` possible) |
| P7 | `/blog`, `/blog/{slug}` | `app/blog/...` | 1 + 9 hand-written in `blog-data.ts` (AI city-cluster posts were generated to `data/blog-posts/` — verify none are routed; any that are get the P1 treatment) | Keep hand-written |
| P8 | `/how-we-verify` | `app/how-we-verify/page.tsx` | 1 | **FALSE verification claims — page dies, 301 → /methodology** |
| P9 | `/about`, `/contact`, `/add-your-business`, `/privacy-policy`, `/terms` | static | 5 | Paths unchanged (privacy-policy content purged of AI-call claims) |
| P10 | `/` | `app/page.tsx` | 1 | Unchanged |
| P11 | `/admin/*`, `/api/*` | app dirs | n/a | Never indexed; robots-disallowed; untouched |
| P12 | `/sitemap.xml` | `sitemap.ts` | 1 | Replaced by sitemap index (same path) |

### 1.2 The 27 service/intent/symptom slugs (from `services-config.ts`)

```
drain-cleaning, water-heater-repair, burst-pipe-repair, repiping,
bathroom-remodel-plumbing, sewer-repair, sewer-line-replacement, toilet-repair,
faucet-repair, garbage-disposal-repair, sump-pump-repair, gas-line-repair,
slab-leak-repair, water-line-repair, kitchen-remodel-plumbing, hydro-jetting,
24-hour-plumber, same-day-plumber, cheap-plumber, licensed-plumber, plumber-cost,
clogged-drain, no-hot-water, water-leak, low-water-pressure, frozen-pipes, sewage-backup
```

These are safe to match as a closed set in middleware — `[service]` is a top-level dynamic segment, so the set doubles as the disambiguator between "legacy service URL" and any future top-level path.

---

## 2. Position: strategic 410, not 301-everything

**Decision: 410 the no-equity doorway tail; 301 only where a genuinely equivalent page exists.**

Rationale (take it or leave the whole plan):

1. **There is almost no equity to preserve.** Lifetime CTR 0.04% — at the pre-cliff peak (~6,600 impressions/day) the entire 44k-page estate earned ~2–3 clicks/day. Post-cliff it earns ~0. External backlinks to deep programmatic URLs are effectively nil (nobody links to `/cheap-plumber/alabama/abernant`). The thing being "consolidated" by a 301-everything strategy is not equity — it is a spam classifier's memory of a doorway set.
2. **Mass 301s to non-equivalent pages are treated as soft-404s anyway.** Google collapses redirect-to-irrelevant-target into "crawled, not selected." You gain nothing and you keep Googlebot revisiting 44k dead URLs through your redirect handler for months.
3. **410 is the loudest possible "the doorway set is gone" signal.** Recovery from a SpamBrain demotion requires the classifier to see a categorically different site. 410s drain from the index measurably faster than 404s and much faster than redirect-limbo. The architecture doc (§5.3) calls for one decisive deletion event — 410 is how you say it.
4. **301 where content-equivalence is real.** A suburb within 12 miles of a kept market genuinely appears on that market page (Areas Served + its plumbers are in the list). That redirect helps users holding old URLs and consolidates the little equity the P2 set has. Same for `/how-we-verify → /methodology` (topical successor) and state pages.

**Rule of thumb applied throughout: a legacy URL 301s only if the target page would satisfy the same user; otherwise 410.** Never 301 geo pages to `/guides/*` (intent ≠ market), never 301 anything to `/` (that's a soft-404 in a trenchcoat).

---

## 3. Full disposition matrix

City classification comes from the build-time map (§4.1): every US city in the coverage dump is classified `market` (one of the 1,643 kept markets), `suburb` (within 12mi of a kept market → assigned to it; 5,493 cities), or `gone` (2,572 cities). Cities absent from the dump entirely (GSC-discovered oddballs, typo'd slugs) = `gone`.

| Legacy URL | Condition | Action | Target |
|---|---|---|---|
| `/emergency-plumbers/{state}/{city}` | city = kept market, market has emergency page (905) | **301** | `/plumbers/{st}/{city}/emergency` |
| `/emergency-plumbers/{state}/{city}` | city = kept market, no emergency page | **301** | `/plumbers/{st}/{city}` |
| `/emergency-plumbers/{state}/{city}` | city = suburb of market M; M has emergency page | **301** | `/plumbers/{st}/{M}/emergency` (intent-preserving, single hop) |
| `/emergency-plumbers/{state}/{city}` | city = suburb of market M; no emergency page | **301** | `/plumbers/{st}/{M}` |
| `/emergency-plumbers/{state}/{city}` | city = gone / unknown | **410** | — |
| `/{service}/{state}/{city}` (all 27) | city = market or suburb | **301** | market page `/plumbers/{st}/{market}` (service intent is a section/filter there; do NOT deep-link fragments in Location headers) |
| `/{service}/{state}/{city}` | city = gone / unknown | **410** | — |
| `/{service}/{state}` or `/{service}` (crawl artifacts; no page ever existed) | any | pass through → natural **404** | — |
| `/emergency-plumbers/{state-name}` | state has ≥1 market (32 states) | **301** | `/plumbers/{st}` |
| `/emergency-plumbers/{state-name}` | state has 0 markets (19) | **301** | `/plumbers` (national index genuinely lists all states) |
| `/emergency-plumbers` | — | **301** | `/plumbers` |
| `/plumber/{slug}` | canonical slug | **unchanged** (no churn on healthiest template) |
| `/plumber/{slug}` | retired alternate/collision slug | **301** to canonical slug (existing alias table, keep) |
| `/plumber/{slug}` | plumber closed >90 days | **410** (per architecture §3.2 — handled in-route, not middleware) |
| `/plumbers` | — | **unchanged path**, new content |
| `/how-we-verify` | — | **301** | `/methodology` |
| `/blog/{slug}` | one of the 9 hand-written posts | **unchanged** |
| `/blog/{slug}` | generated city-cluster post slug (if any routed) / unknown slug | **410** (these are doorway-adjacent AI content) |
| `/about /contact /add-your-business /privacy-policy /terms /` | — | **unchanged** |
| Any path with uppercase chars | — | **301** to lowercased path (then rules re-apply — implemented as one hop, see code) |
| Any path with trailing slash | — | **308** strip (Next default `trailingSlash:false` — verify, do not disable) |
| Any URL with junk query params (`fbclid`, `msclkid`, `ref`, `mc_*`) | — | **301** to same path with junk params stripped; `utm_*` + `gclid` pass through untouched (analytics), canonical tag handles them |
| `apex → www` | — | Vercel domain redirect, upgrade **307 → 308** (dashboard: Domains → fastplumbernearme.com → Redirect to www, permanent) |

Counting it: P2 ≈ 2,268 crawled cities → ~1,100 land on market/emergency 301s, rest 410. P1 = 27 × same classification. Total 301 rules ≈ 27+1 patterns backed by one ~9,700-key city map; total distinct 410 URLs ≈ tens of thousands — all served by the same map, zero per-URL config.

### 3.1 Priority table — which legacy URLs actually carry equity (verify these post-launch)

| Priority | Set | Why | Verification |
|---|---|---|---|
| **1** | Top ~200 `/emergency-plumbers/{state}/{city}` by lifetime GSC clicks (export from GSC before launch — this list is the launch artifact) | The only set that was ever meaningfully indexed and clicked | curl each pre/post deploy; URL-inspect 20 in GSC week 1; watch target market pages get indexed |
| **2** | `/emergency-plumbers/{state}` all 51 | Internal-link hubs; some ranked for "emergency plumber {state}" | curl loop; check `/plumbers/{st}` indexed by day 30 |
| **3** | `/plumber/{slug}` top 100 by clicks | Business-name queries — real user intent | Unchanged, so just confirm 200 + still indexed |
| **4** | `/how-we-verify`, `/`, `/plumbers`, `/blog/*` (9) | Site-level trust pages, possible external links | curl; Ahrefs/GSC link report re-check |
| **5** | Everything else (the ~40k tail) | 0.04% CTR — no equity; 410/301 per matrix | Spot-sample 50 random URLs per pattern with the test script (§6.3); then just watch GSC "Not found (410)" climb and flatten |

---

## 4. Implementation

Design: **one build-time generated data file + one middleware + a small static `redirects()` block.** No per-URL Vercel config (44k entries would blow the config limit and is unmaintainable). Everything data-dependent lives in middleware; everything truly static lives in `next.config.ts`.

### 4.1 Build-time generator → `src/lib/generated/redirect-map.json`

New script `apps/plumbers-web/scripts/generate-redirects.js`, run inside the export step (after `markets.json` is produced by `export-firestore-to-json.js` — single-writer invariant respected: this writes a NEW derived file, reads others).

```js
// scripts/generate-redirects.js
// Inputs:  data/synthesized/markets.json  (1,643 kept markets: slug, st, lat, lng, hasEmergency)
//          data/city-coverage-20mi.json   (9,708 coverage cities: state, city, lat, lng)
// Output:  src/lib/generated/redirect-map.json  (compact: "st:city-slug" -> "m:{marketSlug}[:e]" | "g")
const fs = require("fs");
const markets = require("../data/synthesized/markets.json");
const coverage = require("../data/city-coverage-20mi.json");

const R_MI = 3958.8;
const hav = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(s));
};
const slugify = (s) =>
  s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const map = {};
// 1) Every kept market maps to itself.
for (const m of markets) {
  map[`${m.st}:${m.slug}`] = m.hasEmergency ? `m:${m.slug}:e` : `m:${m.slug}`;
}
// 2) Every other coverage city: nearest kept market in same-or-any state within 12mi, else gone.
for (const c of coverage) {
  const key = `${c.state.toLowerCase()}:${slugify(c.city)}`;
  if (map[key]) continue;
  let best = null, bestD = Infinity;
  for (const m of markets) {
    const d = hav(c, m);
    if (d < bestD) { bestD = d; best = m; }
  }
  map[key] =
    best && bestD <= 12
      ? (best.hasEmergency ? `m:${best.st}:${best.slug}:e` : `m:${best.st}:${best.slug}`)
      : "g";
}
// NOTE: same-state markets within the market's own key omit the st for size;
// cross-state suburb assignments (border metros: e.g. NW Indiana → Chicago) carry it.
fs.mkdirSync("src/lib/generated", { recursive: true });
fs.writeFileSync("src/lib/generated/redirect-map.json", JSON.stringify(map));
console.log(`redirect-map: ${Object.keys(map).length} keys, gone=${Object.values(map).filter(v=>v==="g").length}`);
```

Expected output: ~9,708 keys (≈1,643 `m:` self, ≈5,493 `m:` suburb, ≈2,572 `g`), ~350 KB raw / ~60 KB gzipped — comfortably inside the Edge middleware bundle budget (1–2 MB). **Committed to git** like the other derived JSON (same pattern as `plumbers-synthesized.json`), regenerated on every export. **Never delete keys** — the map only grows; 301s are forever (architecture §1.4).

Also emit `src/lib/generated/market-states.json`: the 32 two-letter codes that have ≥1 market (drives the P3 state-redirect branch).

### 4.2 `src/middleware.ts` (new file — none exists today)

```ts
import { NextRequest, NextResponse } from "next/server";
import REDIRECT_MAP from "@/lib/generated/redirect-map.json";
import MARKET_STATES from "@/lib/generated/market-states.json";

// 51-entry legacy full-name slug -> two-letter code (from states-data.ts slugs)
const STATE_SLUG_TO_ABBR: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
  colorado: "co", connecticut: "ct", delaware: "de", "district-of-columbia": "dc",
  florida: "fl", georgia: "ga", hawaii: "hi", idaho: "id", illinois: "il",
  indiana: "in", iowa: "ia", kansas: "ks", kentucky: "ky", louisiana: "la",
  maine: "me", maryland: "md", massachusetts: "ma", michigan: "mi", minnesota: "mn",
  mississippi: "ms", missouri: "mo", montana: "mt", nebraska: "ne", nevada: "nv",
  "new-hampshire": "nh", "new-jersey": "nj", "new-mexico": "nm", "new-york": "ny",
  "north-carolina": "nc", "north-dakota": "nd", ohio: "oh", oklahoma: "ok",
  oregon: "or", pennsylvania: "pa", "rhode-island": "ri", "south-carolina": "sc",
  "south-dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt",
  virginia: "va", washington: "wa", "west-virginia": "wv", wisconsin: "wi", wyoming: "wy",
};

// Closed set: the 27 legacy service/intent/symptom slugs (services-config.ts)
const LEGACY_SERVICE_SLUGS = new Set([
  "drain-cleaning","water-heater-repair","burst-pipe-repair","repiping",
  "bathroom-remodel-plumbing","sewer-repair","sewer-line-replacement","toilet-repair",
  "faucet-repair","garbage-disposal-repair","sump-pump-repair","gas-line-repair",
  "slab-leak-repair","water-line-repair","kitchen-remodel-plumbing","hydro-jetting",
  "24-hour-plumber","same-day-plumber","cheap-plumber","licensed-plumber","plumber-cost",
  "clogged-drain","no-hot-water","water-leak","low-water-pressure","frozen-pipes","sewage-backup",
]);

const JUNK_PARAMS = ["fbclid", "msclkid", "twclid", "mc_cid", "mc_eid", "ref", "_hs"];

const GONE = () =>
  new NextResponse(null, { status: 410, headers: { "x-robots-tag": "noindex" } });

function resolveCity(st: string, citySlug: string): string | null {
  // Map values: "m:{slug}" | "m:{slug}:e" | "m:{st}:{slug}" | "m:{st}:{slug}:e" | "g"
  const v = (REDIRECT_MAP as Record<string, string>)[`${st}:${citySlug}`];
  return v ?? null;
}

function marketPath(st: string, v: string, wantEmergency: boolean): string {
  const parts = v.split(":"); // ["m", (st?), slug, ("e"?)]
  const hasE = parts[parts.length - 1] === "e";
  const core = hasE ? parts.slice(1, -1) : parts.slice(1);
  const [mSt, mSlug] = core.length === 2 ? core : [st, core[0]];
  const base = `/plumbers/${mSt}/${mSlug}`;
  return wantEmergency && hasE ? `${base}/emergency` : base;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  let path = url.pathname;

  // --- 1. Casing: lowercase the path in the SAME response we compute below
  // (no separate hop — we normalize first, then resolve, so legacy uppercase
  // URLs land on their final target in one 301).
  const lowered = path.toLowerCase();
  const needsCaseFix = lowered !== path;
  path = lowered;

  // --- 2. Junk query params (utm_* and gclid pass through)
  let paramsChanged = false;
  const params = new URLSearchParams(url.search);
  for (const p of [...params.keys()]) {
    if (JUNK_PARAMS.some((j) => p === j || p.startsWith(j))) {
      params.delete(p);
      paramsChanged = true;
    }
  }

  const redirect = (to: string) => {
    const dest = url.clone();
    dest.pathname = to;
    dest.search = params.toString() ? `?${params.toString()}` : "";
    return NextResponse.redirect(dest, 301);
  };

  const seg = path.split("/").filter(Boolean); // ["emergency-plumbers","illinois","palatine"]

  // --- 3. /how-we-verify -> /methodology (also covered in next.config; belt & suspenders)
  if (path === "/how-we-verify") return redirect("/methodology");

  // --- 4. /emergency-plumbers tree
  if (seg[0] === "emergency-plumbers") {
    if (seg.length === 1) return redirect("/plumbers");
    const st = STATE_SLUG_TO_ABBR[seg[1]];
    if (!st) return GONE(); // e.g. /emergency-plumbers/garbage — was never a page
    if (seg.length === 2)
      return redirect(
        (MARKET_STATES as string[]).includes(st) ? `/plumbers/${st}` : "/plumbers",
      );
    if (seg.length === 3) {
      const v = resolveCity(st, seg[2]);
      if (!v || v === "g") return GONE();
      return redirect(marketPath(st, v, /*wantEmergency*/ true));
    }
    return GONE(); // deeper paths never existed
  }

  // --- 5. /{service}/{state}/{city} — the 27-config doorway set
  if (LEGACY_SERVICE_SLUGS.has(seg[0] ?? "")) {
    if (seg.length !== 3) return GONE(); // /{service} and /{service}/{state} never rendered
    const st = STATE_SLUG_TO_ABBR[seg[1]];
    if (!st) return GONE();
    const v = resolveCity(st, seg[2]);
    if (!v || v === "g") return GONE();
    return redirect(marketPath(st, v, /*wantEmergency*/ false)); // service intent = section on market page
  }

  // --- 6. New-structure guard: /plumbers/{full-state-name}/... typed/linked by mistake
  if (seg[0] === "plumbers" && seg[1] && STATE_SLUG_TO_ABBR[seg[1]]) {
    seg[1] = STATE_SLUG_TO_ABBR[seg[1]];
    return redirect(`/${seg.join("/")}`);
  }

  // --- 7. Fall through: casing/param-only fixes
  if (needsCaseFix || paramsChanged) return redirect(path);

  return NextResponse.next();
}

export const config = {
  // Skip static assets, API, admin, image optimizer, files with extensions
  matcher: ["/((?!_next/|api/|admin/|.*\\..*).*)"],
};
```

Notes on the code:

- **Single-hop guarantee is structural:** casing + param cleanup + legacy resolution are computed together and emitted as ONE 301 to the final URL. The only unavoidable second hop is apex→www (platform level, before middleware) — Google tolerates a 2-hop cross-host chain fine; keep it at 2, never 3 (that's why trailing-slash handling stays on Next's built-in 308 and legacy paths are generated slash-free).
- **410 body:** Next serves the response as-is. Optionally render a tiny static HTML body ("This page was removed — find plumbers near you at /plumbers") by rewriting to a `/gone` route instead of `new NextResponse(null)`; keep the 410 status either way. Cosmetic, not required.
- **`resolveCity` misses = 410, not 404.** Any `{state}/{city}` Google ever crawled that isn't in the 9,708-city coverage universe was a thin radius-fallback shell — deliberately gone.
- **`/plumber/{slug}` intentionally absent** — no middleware touch; closed-plumber 410s are rendered by the route itself (it has the data), alternate-slug 301s live in the route's existing alias handling.

### 4.3 `next.config.ts` additions (static, pattern-safe rules only)

```ts
async redirects() {
  return [
    // Methodology successor (also in middleware; this wins first, zero function cost)
    { source: "/how-we-verify", destination: "/methodology", permanent: true },
    // Old index page
    { source: "/emergency-plumbers", destination: "/plumbers", permanent: true },
  ];
},
```

Everything else needs the data lookup and stays in middleware. Do NOT attempt the 51 state redirects here with `:state` patterns — `redirects()` can't map `illinois → il` without 51 literal entries, and the city branch needs middleware anyway; keeping geo logic in ONE place prevents drift.

### 4.4 Things that must NOT redirect

- `/plumbers` (index) — same path, new content.
- `/plumber/{slug}` — untouched (healthiest template; zero churn).
- `/about`, `/contact`, `/add-your-business`, `/privacy-policy`, `/terms`, `/` — same paths.
- `/blog` + the 9 hand-written post slugs — same paths. Unknown `/blog/{slug}` → 410 (add a slug allowlist check in the blog route's `generateStaticParams` + `notFound()` override returning 410 via route handler, or add a `blog` branch to middleware with the 9-slug set — recommended: middleware branch, it's a static set).
- `/sitemap.xml` — same path, now a sitemap **index** pointing at `/sitemaps/*.xml` (GSC keeps the property's existing sitemap registration working during the swap).

---

## 5. Deploy sequencing (redirects live BEFORE old pages die — atomically)

Vercel deploys are atomic: the new deployment (new routes + middleware + deleted old routes) swaps in one step, so there is no window where old URLs 404. The sequencing risk is **preview-verification and rollback**, not partial states.

**T-7 to T-1 (staging):**
1. Freeze the daily pipeline's sitemap-affecting steps for launch week (daily-scrape can run; `request-indexing.js` step **disabled** — do not ping legacy URLs ever again).
2. Export GSC top-500 legacy URLs by clicks (90-day + 16-month) → `data/launch/legacy-equity-urls.csv`. This is the priority-1 verification set.
3. Build on a preview deployment. Run the curl verification suite (§6.3) against the preview URL — all patterns, plus the full equity CSV.
4. Unit tests: 20 sample URLs per legacy pattern → expected target/410 (architecture checklist §6.2). Test the map edge cases: cross-state suburb (NW Indiana→Chicago market), kept market w/o emergency page, unknown city, uppercase path, junk params, `/emergency-plumbers/illinois/`.

**T-0 (launch day, one deploy):**
5. Merge to `main` → production deploy contains: new routes, middleware + redirect-map.json, next.config redirects, new segmented sitemaps at `/sitemaps/*.xml`, `/sitemap.xml` as index, deleted legacy route dirs (`[service]/`, `emergency-plumbers/`, `how-we-verify/`).
6. Vercel dashboard: flip apex redirect 307 → 308 (permanent).
7. Smoke-verify production with the curl suite (§6.3) — takes <5 min.
8. GSC: annotate the date. Submit `/sitemap.xml` (re-submit even though registered — forces re-read). Do NOT delete the old sitemap registration; it's the same path. URL-inspect 20 exemplars per new template + 10 per legacy pattern (confirm Google sees 301/410).

**T+1 to T+7:**
9. Watch Vercel logs / middleware invocations for unexpected 410 spikes on URLs that should 301 (log a sample of GONE hits with the requested path for triage — a `console.log` in the GONE branch, reviewed daily for week 1, then removed).
10. GSC Crawl Stats: redirect share should spike, then decay; 4xx (Google buckets 410 under "Not found") climbs then flattens over weeks. 5xx must stay ~0.

**Rollback plan:**
- Vercel "Instant Rollback" to the prior deployment restores the entire legacy site (routes + no middleware) in one click, <1 min. Because all changes ship in one deployment, rollback is equally atomic.
- Rollback triggers: 5xx rate >1% sustained 30 min; middleware error rate spike; any priority-1 equity URL returning 404 (should be impossible — matrix covers 100%); redirect loops detected by the curl suite.
- The one thing rollback does NOT undo: GSC has seen some 410s. Harmless — Google re-crawls; a 410 seen for a day does not deindex a URL that then returns 200 (it re-indexes on recrawl). Do not panic-rollback for SEO reasons; rollback is for availability only.
- Keep the pre-launch branch (`legacy-freeze`) and the last legacy deployment pinned for 90 days.

---

## 6. Transition checklist

### 6.1 Pre-launch gates
- [ ] `redirect-map.json` generated; key count ≈9,708; `g` count ≈2,572; spot-check 10 known suburbs map to expected markets (Elk Grove Village→ its cluster winner, etc.)
- [ ] Truthfulness purge grep gate passes (no "verification call / we call every / answer rate" in rendered copy) — includes `/privacy-policy` rewrite
- [ ] Unit tests: pattern suite green (20/pattern)
- [ ] Preview curl suite green (§6.3)
- [ ] GSC legacy-equity CSV exported and archived
- [ ] `request-indexing.js` disabled in `daily-scrape.yml` (never ping legacy URLs again; per architecture, Indexing API deprioritized entirely)
- [ ] New sitemaps validate (XML, <50k URLs/file, only `index`-eligible URLs, real lastmod — no `new Date()`)

### 6.2 GSC steps
- [ ] Day 0: annotate deploy; submit `/sitemap.xml`; URL-inspect 20/template
- [ ] Day 0: Removals tool — do NOT use for the 410 set (it's temporary hiding, wrong tool; 410s do the real work)
- [ ] Weekly: Coverage by sitemap segment (`/sitemaps/markets.xml` etc.) — indexed-vs-submitted ≥90% by day 45
- [ ] Weekly: Performance regex filters per template: `^https://www\.fastplumbernearme\.com/plumbers/[a-z]{2}/[^/]+$` (markets), `/emergency$`, `^.../plumber/` (profiles) — clicks, CTR (target ≥1.5% markets)
- [ ] Weekly: Crawl stats — "Not found" trend (410 pool draining: rises, peaks ~week 3–6, flattens), redirect share decaying
- [ ] Monitor priority-1 CSV: by day 30, every 301'd equity URL should show its TARGET in "Google-selected canonical" on inspection
- [ ] Track the next spam/core update (Search Status Dashboard) — recovery verdict only readable after one rolls through

### 6.3 curl verification suite (staging + production)

```bash
#!/usr/bin/env bash
# verify-redirects.sh BASE_URL  (e.g. https://preview-xyz.vercel.app or https://www.fastplumbernearme.com)
B=$1; fail=0
chk () { # chk <path> <expected-status> [expected-location]
  read -r code loc < <(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$B$1")
  if [ "$code" != "$2" ] || { [ -n "$3" ] && [[ "$loc" != *"$3" ]]; }; then
    echo "FAIL $1 -> $code $loc (want $2 $3)"; fail=1
  else echo "ok   $1 -> $code ${loc#"$B"}"; fi
}
# P2 equity set — kept market with emergency page
chk /emergency-plumbers/illinois/palatine        301 /plumbers/il/palatine/emergency
# P2 — suburb -> market emergency
chk /emergency-plumbers/illinois/prospect-heights 301 /emergency
# P2 — gone city
chk /emergency-plumbers/montana/ekalaka          410
# P1 — service page, kept market
chk /drain-cleaning/illinois/palatine            301 /plumbers/il/palatine
# P1 — service page, gone city
chk /cheap-plumber/alabama/abernant              410   # (if abernant classifies gone; use a known-gone city)
# P1 — service segment without city
chk /drain-cleaning/illinois                     410
# P3 — state pages
chk /emergency-plumbers/illinois                 301 /plumbers/il
chk /emergency-plumbers/wyoming                  301 /plumbers   # no-market state
chk /emergency-plumbers                          301 /plumbers
# Statics
chk /how-we-verify                               301 /methodology
chk /plumber/some-known-slug                     200
chk /plumbers                                    200
# Hygiene
chk /Emergency-Plumbers/Illinois/Palatine        301 /plumbers/il/palatine/emergency  # single hop, case-fixed
chk "/emergency-plumbers/illinois/palatine?fbclid=x&utm_source=y" 301 "utm_source=y"  # junk stripped, utm kept
chk /plumbers/illinois/palatine                  301 /plumbers/il/palatine            # guard branch
# No chains: follow every 301 once, assert the hop lands 200 (not another 3xx)
for p in /emergency-plumbers/illinois/palatine /drain-cleaning/illinois/palatine /how-we-verify; do
  final=$(curl -s -o /dev/null -w '%{http_code}' -L --max-redirs 2 "$B$p") || fail=1
  [ "$final" = "200" ] && echo "ok   $p chain<=1 -> 200" || { echo "FAIL $p chain -> $final"; fail=1; }
done
exit $fail
```

Plus: `while read url; do ...; done < data/launch/legacy-equity-urls.csv` asserting every priority-1 URL returns 301→200 or (documented) 410.

### 6.4 Timeline & expectations (fix-and-wait reality)

| Window | What happens | What you do |
|---|---|---|
| Day 0 | Atomic deploy; 44.7k-URL footprint becomes ~8.3k + redirects/410s | Verify, submit, annotate |
| Weeks 1–3 | Googlebot hammers the redirect/410 space; crawl stats look "worse" (4xx share up) — **this is the desired shape** | Triage middleware GONE-log; fix any misclassified 301s (map edits ship like code) |
| Weeks 3–8 | 410 pool drains from index; new templates index; "Crawled — currently not indexed" is the metric to watch per segment | If a segment stalls <50% indexed by day 45: raise that segment's threshold (markets ≥15), don't add pages |
| Months 2–4+ | Demotion re-evaluation happens at the **next spam/core update** — not before. No update = no verdict | Ship guides, earn links, keep data fresh; success metric is clicks/day (target 50/day at 90 days post-reindex) and CTR ≥1.5%, NOT the 6,600 impressions vanity baseline |
| Forever | `redirect-map.json` and middleware branches are permanent. Never expire 301s; never re-use legacy patterns for new content | Quarterly: re-run coverage export → map grows only |

---

## 7. Machine-readable rule summary

```json
{
  "version": "2026-07-11",
  "infrastructure": {
    "middleware": "src/middleware.ts (new — none exists today)",
    "data": "src/lib/generated/redirect-map.json (~9708 keys, build-time, committed, append-only)",
    "generator": "scripts/generate-redirects.js (runs after export-firestore-to-json.js)",
    "nextConfigRedirects": 2,
    "vercelDomain": "apex->www upgrade 307->308"
  },
  "rules": [
    { "id": "R1", "pattern": "/emergency-plumbers/{stateName}/{city}", "match": "city classifies market|suburb AND target market hasEmergency", "action": 301, "target": "/plumbers/{st}/{marketSlug}/emergency", "count": "~subset of 1100" },
    { "id": "R2", "pattern": "/emergency-plumbers/{stateName}/{city}", "match": "city classifies market|suburb AND no emergency page", "action": 301, "target": "/plumbers/{st}/{marketSlug}" },
    { "id": "R3", "pattern": "/emergency-plumbers/{stateName}/{city}", "match": "city classifies gone OR unknown", "action": 410, "count": "~2572 coverage cities + unknown tail" },
    { "id": "R4", "pattern": "/{service}/{stateName}/{city}", "match": "service in 27-slug set AND city classifies market|suburb", "action": 301, "target": "/plumbers/{st}/{marketSlug}", "note": "never to /guides/*, never to emergency" },
    { "id": "R5", "pattern": "/{service}/{stateName}/{city}", "match": "service in 27-slug set AND city gone/unknown", "action": 410 },
    { "id": "R6", "pattern": "/{service} | /{service}/{stateName}", "match": "service in 27-slug set", "action": 410, "note": "never rendered; crawl artifacts" },
    { "id": "R7", "pattern": "/emergency-plumbers/{stateName}", "match": "state has >=1 market (32)", "action": 301, "target": "/plumbers/{st}" },
    { "id": "R8", "pattern": "/emergency-plumbers/{stateName}", "match": "state has 0 markets (19)", "action": 301, "target": "/plumbers" },
    { "id": "R9", "pattern": "/emergency-plumbers", "action": 301, "target": "/plumbers" },
    { "id": "R10", "pattern": "/how-we-verify", "action": 301, "target": "/methodology" },
    { "id": "R11", "pattern": "/plumber/{slug}", "action": "unchanged", "note": "closed>90d -> 410 in-route; alternate slugs 301 in-route" },
    { "id": "R12", "pattern": "/plumbers", "action": "unchanged-path-new-content" },
    { "id": "R13", "pattern": "/blog/{slug}", "match": "slug in 9 hand-written set", "action": "unchanged" },
    { "id": "R14", "pattern": "/blog/{slug}", "match": "unknown/generated slug", "action": 410 },
    { "id": "R15", "pattern": "/ /about /contact /add-your-business /privacy-policy /terms", "action": "unchanged" },
    { "id": "R16", "pattern": "path with uppercase", "action": 301, "target": "lowercased-then-resolved (single hop)" },
    { "id": "R17", "pattern": "trailing slash", "action": 308, "target": "no-slash (Next default)" },
    { "id": "R18", "pattern": "?fbclid|msclkid|twclid|mc_*|ref|_hs", "action": 301, "target": "param-stripped same path; utm_*+gclid pass through" },
    { "id": "R19", "pattern": "/plumbers/{stateName}/...", "match": "full state name used in new structure", "action": 301, "target": "/plumbers/{st}/..." },
    { "id": "R20", "pattern": "apex host", "action": 308, "target": "www (Vercel domain layer)" }
  ],
  "policy": {
    "strategy": "strategic-410",
    "justification": "0.04% lifetime CTR = no equity in the tail; 301 only where content-equivalent target exists (suburb<=12mi genuinely listed on target market page); 410 is the decisive doorway-removal signal SpamBrain needs",
    "neverExpire301s": true,
    "maxRedirectHops": 1,
    "hopException": "apex->www platform hop (total 2 cross-host, acceptable)"
  },
  "verification": {
    "priority1": "top ~200 /emergency-plumbers/{state}/{city} by lifetime GSC clicks (export pre-launch)",
    "suite": "verify-redirects.sh — per-pattern status+location asserts + chain check (--max-redirs 2 must land 200)",
    "gscTargets": { "indexedVsSubmitted": ">=0.90 by day 45", "marketCTR": ">=1.5%", "clicksPerDay90d": 50 }
  }
}
```
