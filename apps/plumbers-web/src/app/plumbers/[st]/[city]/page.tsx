import CuratedShortlist from "@/components/curated/CuratedShortlist";
import { shortlistData } from "@/lib/shortlist-data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStateByAbbr } from "@/lib/states-data";
import {
  getMarket,
  getMarkets,
  getMarketsMeta,
  getMarketPlumbers,
  nearbyMarkets,
  type Market,
} from "@/lib/markets";
import { isIndexableMarket } from "@/lib/indexable";
import type { SynthesizedPlumber } from "@/lib/plumber-data";
import { absoluteUrl } from "@/config/plumbing-routes";
import {
  breadcrumbLd,
  homeCrumbs,
  plumberItemListLd,
  jsonLdString,
} from "@/lib/schema";
import { fitTitle, fitDescription, ogImagePath } from "@/lib/meta";
import {
  cardEvidence,
  reviewsReadCount,
  splitRanked,
  tierGroups,
} from "@/lib/report-card";
import SponsoredSlot from "@/components/rebuild/SponsoredSlot";
import RankTier from "@/components/rebuild/RankTier";
import PlumberReportCard from "@/components/rebuild/PlumberReportCard";
import UnrankedRow from "@/components/rebuild/UnrankedRow";
import MethodologyBlock from "@/components/rebuild/MethodologyBlock";
import AreasServed from "@/components/rebuild/AreasServed";
import NearbyMarkets from "@/components/rebuild/NearbyMarkets";
import { TriangleIcon, OctagonIcon } from "@/components/rebuild/icons";

interface Props {
  params: Promise<{ st: string; city: string }>;
}

// Non-market cities have NO page at this route (middleware 301s or 410s the
// legacy URL space). Unknown params 404.
export const dynamicParams = false;

export function generateStaticParams(): { st: string; city: string }[] {
  return getMarkets().map((m) => ({ st: m.st, city: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { st, city } = await params;
  const market = getMarket(st, city);
  if (!market) return {};
  const state = getStateByAbbr(st);
  const stateName = state?.name ?? st.toUpperCase();
  const ST = st.toUpperCase();
  const { ranked } = splitRanked(getMarketPlumbers(market));
  const reviewsRead = ranked.reduce((s, p) => s + reviewsReadCount(p), 0);
  const indexable = isIndexableMarket(market);

  // C8: 01's title formula, measured <=60 with real shorter fallbacks.
  const title = fitTitle(
    `Plumbers in ${market.name}, ${ST} — Who Should You Call?`,
    `Plumbers in ${market.name}, ${ST} — Compare Your Options`,
    `Plumbers in ${market.name}, ${ST}`,
  );
  const description = fitDescription(
    `Compare plumbers near ${market.name}, ${stateName} by job evidence, pricing concerns, and reliability. ${reviewsRead.toLocaleString()} reviews analyzed across ${ranked.length} detailed directory assessments.`,
  );
  const canonical = absoluteUrl(`/plumbers/${market.st}/${market.slug}`);

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
          url: ogImagePath({ type: "city", city: market.name, state: ST }),
          width: 1200,
          height: 630,
        },
      ],
    },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

/**
 * BreadcrumbList + ItemList of Plumber SUMMARY entities (01 §2.1 field map:
 * @id -> profile URL, telephone, PostalAddress, GeoCoordinates, openingHours,
 * areaServed GeoCircle, sameAs). No FAQPage, no Review/AggregateRating (C1).
 */
function marketJsonLd(
  market: Market,
  ranked: SynthesizedPlumber[],
  stateName: string,
) {
  return [
    breadcrumbLd([
      ...homeCrumbs(),
      { name: stateName, path: `/plumbers/${market.st}` },
      { name: market.name, path: `/plumbers/${market.st}/${market.slug}` },
    ]),
    plumberItemListLd({
      name: `Plumbers serving ${market.name}, ${market.st.toUpperCase()}`,
      path: `/plumbers/${market.st}/${market.slug}`,
      plumbers: ranked,
    }),
  ];
}

/** Aggregate negative evidence across ranked cards ("what reviewers complain about"). */
function complaintItems(
  ranked: SynthesizedPlumber[],
  ranks: Map<string, number>,
): { name: string; anchor: string; text: string; severe: boolean }[] {
  const items: {
    name: string;
    anchor: string;
    text: string;
    severe: boolean;
  }[] = [];
  for (const p of ranked) {
    const ev = cardEvidence(p);
    for (const c of ev.concerns) {
      items.push({
        name: p.name,
        anchor: `pick-${ranks.get(p.placeId)}`,
        text: c.text,
        severe: c.severity === "redflag",
      });
    }
  }
  // Red flags first, then cap — the page shouldn't repeat every card in full.
  items.sort((a, b) => Number(b.severe) - Number(a.severe));
  return items.slice(0, 8);
}

export default async function MarketPage({ params }: Props) {
  const { st, city } = await params;
  const market = getMarket(st, city);
  if (!market) notFound();

  const state = getStateByAbbr(st);
  const stateName = state?.name ?? st.toUpperCase();
  const allPlumbers = getMarketPlumbers(market);
  const { ranked, unranked } = splitRanked(allPlumbers);
  const groups = tierGroups(ranked);

  // Rank numerals follow display order (tier groups, editorial order within).
  const displayOrder = groups.flatMap((g) => g.plumbers);
  const ranks = new Map(displayOrder.map((p, i) => [p.placeId, i + 1]));

  const nearby = nearbyMarkets(market, 6);
  const radiusMiles = getMarketsMeta().radiusMiles;
  const center = {
    lat: market.lat,
    lng: market.lng,
    label: `downtown ${market.name}`,
  };

  const reviewsReadTotal = ranked.reduce((s, p) => s + reviewsReadCount(p), 0);
  const lastmodDate = new Date(market.lastmod);
  const updatedLabel = Number.isNaN(lastmodDate.getTime())
    ? null
    : lastmodDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  const complaints = complaintItems(displayOrder, ranks);

  return (
    <div className="fpn">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(marketJsonLd(market, displayOrder, stateName)),
        }}
      />
      <div className="wrap">
        <header className="curated-market-intro">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/plumbers">Find a plumber</Link> /{" "}
            <Link href={`/plumbers/${market.st}`}>{stateName}</Link> /{" "}
            <span>{market.name}</span>
          </nav>
          <span className="eyebrow">LOCAL OPTIONS. A HIGHER STANDARD.</span>
          <h1>
            A good plumber in {market.name}.<br />
            <em>For the right reasons.</em>
          </h1>
          <p>
            Start with fair-dealing evidence and job fit. Compare a short list,
            read the reservations, and call directly.
          </p>
          <div className="market-scope">
            {allPlumbers.length} directory records considered · Within{" "}
            {radiusMiles} miles of downtown {market.name} · Coverage must be
            confirmed
            {updatedLabel ? ` · Directory updated ${updatedLabel}` : ""}
          </div>
        </header>

        <CuratedShortlist
          candidates={allPlumbers.map(shortlistData)}
          city={market.name}
          state={market.st.toUpperCase()}
        />

<p className="shortlist-afterhours"><a href="#job=any&urgency=after-hours">Need an after-hours option? Filter the shortlist →</a></p>

        {market.hasEmergencyPage && (
          <p style={{ marginTop: 10, fontSize: 14 }}>
            Only need the after-hours list?{" "}
            <Link href={`/plumbers/${market.st}/${market.slug}/emergency`}>
              Browse the full after-hours directory (business-stated hours) →
            </Link>
          </p>
        )}

        <details className="full-directory" id="full-directory">
          <summary>
            Explore the full directory{" "}
            <span>
              {allPlumbers.length} records · {ranked.length} detailed
              assessments
            </span>
          </summary>
          <p className="directory-disclosure">
            These are existing directory assessments, with different evidence
            depth. Inclusion here does not mean a business meets the shortlist’s
            fair-dealing standard.
          </p>
          {/* Sponsored slot — renders nothing while unsold (no placeholder on the money page). */}
          <SponsoredSlot sponsor={null} center={center} />

          {groups.map((g) => (
            <RankTier key={g.tier} tier={g.tier}>
              {g.plumbers.map((p) => (
                <PlumberReportCard
                  key={p.placeId}
                  plumber={p}
                  rank={ranks.get(p.placeId)}
                  center={center}
                  anchorId={`pick-${ranks.get(p.placeId)}`}
                />
              ))}
            </RankTier>
          ))}

          {unranked.length > 0 && (
            <section className="unranked">
              <div className="tier-head">
                <h2>Also serving {market.name} — not enough reviews to rank</h2>
              </div>
              <p className="unranked-note">
                We don&apos;t rank a plumber until we&apos;ve read enough
                reviews to have an opinion. Ratings below are Google&apos;s, not
                ours.
              </p>
              {unranked.map((p) => (
                <UnrankedRow key={p.placeId} plumber={p} center={center} />
              ))}
            </section>
          )}

          {complaints.length > 0 && (
            <section className="complaints">
              <h2>What reviewers complain about in {market.name}</h2>
              <p style={{ marginTop: 6, fontSize: 14, color: "var(--ink-2)" }}>
                The repeated complaint patterns our read surfaced, business by
                business — each links to the card where the supporting quotes
                live. <Link href="/methodology">How we find these →</Link>
              </p>
              <ul>
                {complaints.map((c, i) => (
                  <li key={i}>
                    {c.severe ? (
                      <OctagonIcon
                        size={15}
                        style={{ color: "var(--bad)", flex: "none" }}
                      />
                    ) : (
                      <TriangleIcon
                        size={15}
                        style={{ color: "var(--warn)", flex: "none" }}
                      />
                    )}
                    <span>
                      <a className="who" href={`#${c.anchor}`}>
                        {c.name}
                      </a>
                      {" — "}
                      {c.text}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </details>

        <MethodologyBlock
          cityName={market.name}
          reviewsReadTotal={reviewsReadTotal}
          businessesRead={ranked.length}
        />

        <AreasServed
          cityName={market.name}
          clusterCities={market.clusterCities}
        />

        <NearbyMarkets nearby={nearby} />
      </div>
    </div>
  );
}
