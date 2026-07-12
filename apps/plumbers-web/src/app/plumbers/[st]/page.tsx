import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStateByAbbr } from "@/lib/states-data";
import { getStateMarkets } from "@/lib/markets";
import { isIndexableMarket } from "@/lib/indexable";
import { absoluteUrl } from "@/config/plumbing-routes";
import { breadcrumbLd, homeCrumbs, collectionPageLd, jsonLdString } from "@/lib/schema";
import { fitDescription, ogImagePath } from "@/lib/meta";
import MARKET_STATES from "@/lib/generated/market-states.json";

interface Props {
  params: Promise<{ st: string }>;
}

// Only states with >=1 market get a hub. Anything else 404s.
export const dynamicParams = false;

export function generateStaticParams(): { st: string }[] {
  return (MARKET_STATES as string[]).map((st) => ({ st }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { st } = await params;
  const state = getStateByAbbr(st);
  const markets = getStateMarkets(st);
  if (!state || markets.length === 0) return {};

  // C8: state title formula (measured — longest state name still fits 60).
  const title = `Plumbers in ${state.name} — ${markets.length} Local Markets Ranked`;
  const description = fitDescription(
    `City-by-city plumber rankings across ${state.name}, built from real customer reviews — ${markets.reduce((n, m) => n + m.counts.plumbers, 0).toLocaleString()} plumbers in ${markets.length} markets. Complaints included.`,
  );
  const canonical = absoluteUrl(`/plumbers/${st}`);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [
        {
          url: ogImagePath({ type: "city", title: `Plumbers in ${state.name}` }),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default async function StateHubPage({ params }: Props) {
  const { st } = await params;
  const state = getStateByAbbr(st);
  const markets = getStateMarkets(st);
  if (!state || markets.length === 0) notFound();

  const indexableMarkets = markets.filter(isIndexableMarket);
  const totalPlumbers = markets.reduce((n, m) => n + m.counts.plumbers, 0);
  const totalQuoted = markets.reduce((n, m) => n + m.counts.rankableQuoted, 0);

  // CollectionPage + ItemList of market-page URLs only — no nested
  // LocalBusiness entities here (01 §2.1: a list of pages, not businesses).
  const jsonLd = [
    breadcrumbLd([...homeCrumbs(), { name: state.name, path: `/plumbers/${st}` }]),
    collectionPageLd({
      name: `Plumbers in ${state.name}`,
      path: `/plumbers/${st}`,
      itemUrls: indexableMarkets.map((m) => absoluteUrl(`/plumbers/${m.st}/${m.slug}`)),
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
          <Link href="/">Home</Link> › <Link href="/plumbers">Plumbers</Link> › {state.name}
        </nav>
        <h1 className="report-h1">Plumbers in {state.name}</h1>
        <p className="dek num">
          {markets.length} city {markets.length === 1 ? "guide" : "guides"} covering{" "}
          {totalPlumbers.toLocaleString()} plumbers — {totalQuoted.toLocaleString()} of them with
          quote-backed assessments. Each guide ranks local plumbers from what their customers
          actually wrote in reviews.
        </p>

        <ul className="hub-list">
          {markets.map((m) => (
            <li key={m.slug}>
              <div className="hub-row">
                <span className="hub-name">
                  <Link href={`/plumbers/${m.st}/${m.slug}`}>
                    {m.name}, {m.st.toUpperCase()}
                  </Link>
                </span>
                <span className="hub-meta num">
                  {m.counts.plumbers} plumbers · {m.counts.rankableQuoted} quote-backed
                  {m.hasEmergencyPage && (
                    <>
                      {" · "}
                      <Link href={`/plumbers/${m.st}/${m.slug}/emergency`}>24/7 guide</Link>
                    </>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
