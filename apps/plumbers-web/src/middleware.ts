/**
 * Legacy-URL transition middleware (rebuild spec Epic 2, detail in
 * docs/rebuild/05-transition-plan.md §4).
 *
 * Handles, in ONE hop (single-hop guarantee — casing + trailing-slash +
 * junk-param cleanup are folded into the same 301 as the legacy resolution):
 *
 *   /how-we-verify                        -> 301 /methodology
 *   /emergency-plumbers                   -> 301 /plumbers
 *   /emergency-plumbers/{state}           -> 301 /plumbers/{st} (or /plumbers)
 *   /emergency-plumbers/{state}/{city}    -> 301 market /emergency page when it
 *                                            exists, else market page; 410 gone
 *   /{service}/{state}/{city} (27 slugs)  -> 301 market page; 410 gone
 *   /plumbers/{full-state-name}/...       -> 301 two-letter form
 *   /blog/{unknown-slug}                  -> 410 (allowlist = BLOG_POSTS)
 *
 * Unknown covered-city keys and {g:1} map entries return 410 (deliberately
 * gone — never 301 doorway equity at nothing-equivalent destinations).
 *
 * Bundle note: redirect-map.json (~534 KB raw, ~60 KB gzipped) is statically
 * imported. Together with the service-slug registry and blog allowlist the
 * middleware bundle stays well inside the Edge 1–2 MB budget, so the lookup
 * lives here rather than in a route handler.
 *
 * NOT touched (05 §4.4): /plumber/{slug} (route handles its own aliases),
 * /plumbers new tree, /blog index + real posts, statics, /admin, /api.
 */

import { NextResponse, type NextRequest } from "next/server";
import REDIRECT_MAP from "@/lib/generated/redirect-map.json";
import MARKET_STATES from "@/lib/generated/market-states.json";
import { STATES_DATA } from "@/lib/states-data";
import { getAllServiceSlugs } from "@/lib/services-config";
import { BLOG_POSTS } from "@/lib/blog-data";

type RedirectEntry = { t?: string; e?: string; g?: 1 };
const MAP = REDIRECT_MAP as Record<string, RedirectEntry>;
const STATE_CODES = MARKET_STATES as string[];

// Full-name legacy state slug -> two-letter lowercase code, derived from the
// existing single source of truth rather than a hand-copied table.
const STATE_SLUG_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.values(STATES_DATA).map((s) => [s.slug, s.abbreviation.toLowerCase()]),
);

// Closed set: the 27 legacy service/intent/symptom slugs.
const LEGACY_SERVICE_SLUGS = new Set(getAllServiceSlugs());

// Allowlist: the hand-written blog posts. Anything else under /blog/ is a
// generated doorway slug -> 410.
const BLOG_SLUGS = new Set(BLOG_POSTS.map((p) => p.slug));

// Tracking params we strip (utm_* and gclid deliberately pass through).
const JUNK_PARAMS = ["fbclid", "msclkid", "twclid", "mc_cid", "mc_eid", "_hs"];

const GONE = () =>
  new NextResponse(null, {
    status: 410,
    headers: { "x-robots-tag": "noindex" },
  });

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  let path = url.pathname;

  // --- 1. Normalize casing + trailing slash BEFORE resolving, so legacy
  // uppercase/slashed URLs land on their final target in one 301.
  const lowered = path.toLowerCase();
  const needsCaseFix = lowered !== path;
  path = lowered;
  const hadTrailingSlash = path.length > 1 && path.endsWith("/");
  if (hadTrailingSlash) path = path.replace(/\/+$/, "");

  // --- 2. Junk query params.
  const params = new URLSearchParams(url.search);
  let paramsChanged = false;
  for (const key of [...params.keys()]) {
    if (JUNK_PARAMS.some((j) => key === j || key.startsWith(j))) {
      params.delete(key);
      paramsChanged = true;
    }
  }

  // Build the destination from scratch — cloning req.nextUrl re-applies the
  // original trailing slash to the rewritten pathname (verified), which would
  // emit `/target/` and even self-redirect loops on slash-only fixes.
  const redirect = (to: string) => {
    const dest = new URL(to, url.origin);
    const qs = params.toString();
    if (qs) dest.search = qs;
    return NextResponse.redirect(dest, 301);
  };

  const seg = path.split("/").filter(Boolean); // e.g. ["emergency-plumbers","illinois","palatine"]

  // --- 3. /how-we-verify -> /methodology (also in next.config redirects();
  // this branch catches case/slash variants the static rule misses).
  if (path === "/how-we-verify") return redirect("/methodology");

  // --- 4. /emergency-plumbers tree.
  if (seg[0] === "emergency-plumbers") {
    if (seg.length === 1) return redirect("/plumbers");
    const st = STATE_SLUG_TO_ABBR[seg[1]];
    if (!st) return GONE(); // never a page
    if (seg.length === 2) {
      return redirect(STATE_CODES.includes(st) ? `/plumbers/${st}` : "/plumbers");
    }
    if (seg.length === 3) {
      const v = MAP[`${seg[1]}/${seg[2]}`];
      if (!v || v.g) return GONE();
      // Emergency intent prefers the market's /emergency target when it exists.
      return redirect(v.e ?? v.t!);
    }
    return GONE(); // deeper paths never existed
  }

  // --- 5. /{service}/{state}/{city} — the 27-config doorway set.
  if (seg.length > 0 && LEGACY_SERVICE_SLUGS.has(seg[0])) {
    if (seg.length !== 3) return GONE(); // /{service} and /{service}/{state} never rendered
    if (!STATE_SLUG_TO_ABBR[seg[1]]) return GONE();
    const v = MAP[`${seg[1]}/${seg[2]}`];
    if (!v || v.g) return GONE();
    // Service intent always lands on the market page (never /emergency).
    return redirect(v.t!);
  }

  // --- 6. New-tree guard: /plumbers/{full-state-name}/... typed by mistake.
  // Resolve through the redirect map (05 §7 R19 + "nothing 404s by accident"):
  // a bare abbreviation swap would 301 suburb/gone cities into 404s.
  if (seg[0] === "plumbers" && seg[1] && STATE_SLUG_TO_ABBR[seg[1]]) {
    const st = STATE_SLUG_TO_ABBR[seg[1]];
    if (seg.length === 2) {
      return redirect(STATE_CODES.includes(st) ? `/plumbers/${st}` : "/plumbers");
    }
    const v = MAP[`${seg[1]}/${seg[2]}`];
    if (v) {
      if (v.g) return GONE();
      if (seg.length === 3) return redirect(v.t!);
      // /plumbers/{state-name}/{city}/emergency and deeper
      if (seg.length === 4 && seg[3] === "emergency") return redirect(v.e ?? v.t!);
      return GONE();
    }
    // Unknown city: fall back to the literal abbreviation swap (R19).
    seg[1] = st;
    return redirect(`/${seg.join("/")}`);
  }

  // --- 7. /blog allowlist: unknown slugs are generated doorways -> 410.
  if (seg[0] === "blog" && seg.length >= 2) {
    if (seg.length > 2 || !BLOG_SLUGS.has(seg[1])) return GONE();
  }

  // --- 8. Fall through: casing / trailing-slash / param-only fixes.
  if (needsCaseFix || hadTrailingSlash || paramsChanged) return redirect(path);

  return NextResponse.next();
}

export const config = {
  // Skip static assets, API, admin, image optimizer, files with extensions
  // (covers /sitemap.xml, /sitemaps/*.xml, favicon, images).
  matcher: ["/((?!_next/|api/|admin/|.*\\..*).*)"],
};
