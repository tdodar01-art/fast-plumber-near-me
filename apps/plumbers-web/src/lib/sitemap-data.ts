/**
 * Shared builders for the segmented sitemap (01 §3.5):
 *
 *   /sitemap.xml            -> sitemap INDEX (route handler)
 *   /sitemaps/static.xml    -> ~50 static URLs
 *   /sitemaps/markets.xml   -> indexable market pages
 *   /sitemaps/emergency.xml -> indexable emergency market pages
 *   /sitemaps/plumbers-N.xml-> indexable profiles, chunked <=2500
 *
 * Rules enforced here:
 * - ONLY isIndexable*-true URLs appear (same predicates as page metadata).
 * - REAL lastmod: markets.json `lastmod`, plumber `scrapedAt`, blog
 *   `updatedAt`. Never `new Date()`. URLs without a real date omit lastmod.
 * - No changefreq/priority (ignored; noise).
 */

import { getMarkets, getMarketsByState, type Market } from "./markets";
import { getAllPlumbers } from "./plumber-data";
import {
  isIndexableMarket,
  isIndexableEmergencyMarket,
  isIndexablePlumber,
} from "./indexable";
import { BLOG_POSTS } from "./blog-data";
import { absoluteUrl, businessProfilePath } from "@/config/plumbing-routes";

export const PLUMBER_CHUNK_SIZE = 2500;

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

function toDateOnly(iso: string | undefined | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function maxLastmod(markets: Market[]): string | undefined {
  let max: string | undefined;
  for (const m of markets) {
    if (m.lastmod && (!max || m.lastmod > max)) max = m.lastmod;
  }
  return toDateOnly(max);
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export function staticUrls(): SitemapUrl[] {
  const urls: SitemapUrl[] = [
    { loc: absoluteUrl(), lastmod: maxLastmod(getMarkets()) },
    { loc: absoluteUrl("/plumbers"), lastmod: maxLastmod(getMarkets()) },
  ];

  // State hubs: lastmod = newest market in the state.
  for (const [st, markets] of getMarketsByState()) {
    urls.push({ loc: absoluteUrl(`/plumbers/${st}`), lastmod: maxLastmod(markets) });
  }

  // Trust + statics (no real edit dates tracked -> omit lastmod).
  for (const p of ["/methodology", "/about", "/add-your-business", "/contact", "/privacy-policy", "/terms", "/blog"]) {
    urls.push({ loc: absoluteUrl(p) });
  }

  // Hand-written blog posts (real updatedAt).
  for (const post of BLOG_POSTS) {
    urls.push({ loc: absoluteUrl(`/blog/${post.slug}`), lastmod: toDateOnly(post.updatedAt) });
  }

  return urls;
}

export function marketUrls(): SitemapUrl[] {
  return getMarkets()
    .filter(isIndexableMarket)
    .map((m) => ({
      loc: absoluteUrl(`/plumbers/${m.st}/${m.slug}`),
      lastmod: toDateOnly(m.lastmod),
    }));
}

export function emergencyUrls(): SitemapUrl[] {
  return getMarkets()
    .filter(isIndexableEmergencyMarket)
    .map((m) => ({
      loc: absoluteUrl(`/plumbers/${m.st}/${m.slug}/emergency`),
      lastmod: toDateOnly(m.lastmod),
    }));
}

let plumberChunksCache: SitemapUrl[][] | null = null;

export function plumberUrlChunks(): SitemapUrl[][] {
  if (!plumberChunksCache) {
    const urls = getAllPlumbers()
      .filter(isIndexablePlumber)
      .map((p) => ({
        loc: absoluteUrl(businessProfilePath(p.slug)),
        lastmod: toDateOnly(p.scrapedAt),
      }));
    const chunks: SitemapUrl[][] = [];
    for (let i = 0; i < urls.length; i += PLUMBER_CHUNK_SIZE) {
      chunks.push(urls.slice(i, i + PLUMBER_CHUNK_SIZE));
    }
    plumberChunksCache = chunks;
  }
  return plumberChunksCache;
}

/** Every segment filename served under /sitemaps/. */
export function segmentNames(): string[] {
  return [
    "static.xml",
    "markets.xml",
    "emergency.xml",
    ...plumberUrlChunks().map((_, i) => `plumbers-${i + 1}.xml`),
  ];
}

export function urlsForSegment(name: string): SitemapUrl[] | null {
  if (name === "static.xml") return staticUrls();
  if (name === "markets.xml") return marketUrls();
  if (name === "emergency.xml") return emergencyUrls();
  const m = name.match(/^plumbers-(\d+)\.xml$/);
  if (m) return plumberUrlChunks()[Number(m[1]) - 1] ?? null;
  return null;
}

// ---------------------------------------------------------------------------
// XML rendering
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderUrlset(urls: SitemapUrl[]): string {
  const body = urls
    .map(
      (u) =>
        `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function renderSitemapIndex(): string {
  const body = segmentNames()
    .map((name) => `<sitemap><loc>${esc(absoluteUrl(`/sitemaps/${name}`))}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}
