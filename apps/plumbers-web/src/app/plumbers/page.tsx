import type { Metadata } from "next";
import Link from "next/link";
import { getStateByAbbr } from "@/lib/states-data";
import { getMarkets, getMarketsByState } from "@/lib/markets";
import { absoluteUrl } from "@/config/plumbing-routes";
import { breadcrumbLd, homeCrumbs, collectionPageLd, jsonLdString } from "@/lib/schema";
import MarketSearch, { type SearchMarket } from "@/components/rebuild/MarketSearch";

/**
 * /plumbers — national index (browse states with market counts). Same path as
 * the legacy client-side directory, new content (05 §4.4: no redirect).
 * Rebuild design: hairline list, data-rich links.
 *
 * Also the WebSite SearchAction target (/plumbers?q=...): the client-side
 * MarketSearch prefills from ?q= on mount. The page itself is static and
 * self-canonical — query strings never produce indexable states (01 §3.4).
 */

export const metadata: Metadata = {
  title: "Find Ranked Plumbers by State & City",
  description:
    "City-by-city plumber rankings built from real customer reviews — strengths, complaints, and red flags included. Browse every ranked market by state.",
  alternates: { canonical: absoluteUrl("/plumbers") },
};

export default function PlumbersIndexPage() {
  const byState = getMarketsByState();

  // Sort states by market count desc, then name.
  const states = [...byState.entries()]
    .map(([st, markets]) => ({
      st,
      name: getStateByAbbr(st)?.name ?? st.toUpperCase(),
      marketCount: markets.length,
      plumberCount: markets.reduce((n, m) => n + m.counts.plumbers, 0),
      quotedCount: markets.reduce((n, m) => n + m.counts.rankableQuoted, 0),
      topMarkets: markets.slice(0, 5),
    }))
    .sort((a, b) => b.marketCount - a.marketCount || a.name.localeCompare(b.name));

  const totalMarkets = states.reduce((n, s) => n + s.marketCount, 0);
  const totalPlumbers = states.reduce((n, s) => n + s.plumberCount, 0);

  const searchMarkets: SearchMarket[] = getMarkets().map((m) => ({
    name: m.name,
    st: m.st,
    slug: m.slug,
    lat: m.lat,
    lng: m.lng,
    plumbers: m.counts.plumbers,
    emergency: m.counts.emergency,
  }));

  const jsonLd = [
    breadcrumbLd(homeCrumbs()),
    collectionPageLd({
      name: "Find Ranked Plumbers by State & City",
      path: "/plumbers",
      itemUrls: states.map((s) => absoluteUrl(`/plumbers/${s.st}`)),
    }),
  ];

  return (
    <div className="fpn">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <main className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › Plumbers
        </nav>
        <h1 className="report-h1">Plumber rankings by city</h1>
        <p className="dek num">
          {totalMarkets.toLocaleString()} city guides across {states.length} states, covering{" "}
          {totalPlumbers.toLocaleString()} plumbers. Every ranking is built from what customers
          actually wrote in reviews — rankings are never for sale.
        </p>

        <MarketSearch markets={searchMarkets} initFromUrlQuery />

        <ul className="hub-list">
          {states.map((s) => (
            <li key={s.st}>
              <div className="hub-row">
                <span className="hub-name">
                  <Link href={`/plumbers/${s.st}`}>{s.name}</Link>
                </span>
                <span className="hub-meta num">
                  {s.marketCount} {s.marketCount === 1 ? "guide" : "guides"} ·{" "}
                  {s.plumberCount.toLocaleString()} plumbers · {s.quotedCount.toLocaleString()}{" "}
                  quote-backed
                </span>
              </div>
              <p className="hub-sub">
                {s.topMarkets.map((m, i) => (
                  <span key={m.slug}>
                    {i > 0 && ", "}
                    <Link href={`/plumbers/${m.st}/${m.slug}`}>{m.name}</Link>
                  </span>
                ))}
                {s.marketCount > 5 && (
                  <>
                    {" "}
                    <Link href={`/plumbers/${s.st}`}>+{s.marketCount - 5} more</Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>

        <p style={{ marginTop: 32, fontSize: 13, color: "var(--ink-3)" }}>
          How these rankings work: <Link href="/methodology">our methodology</Link>.
        </p>
      </main>
    </div>
  );
}
