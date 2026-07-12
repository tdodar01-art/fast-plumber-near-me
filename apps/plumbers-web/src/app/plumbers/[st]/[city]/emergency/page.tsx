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
import { isIndexableEmergencyMarket } from "@/lib/indexable";
import type { SynthesizedPlumber } from "@/lib/plumber-data";
import { absoluteUrl } from "@/config/plumbing-routes";
import { breadcrumbLd, homeCrumbs, plumberItemListLd, jsonLdString } from "@/lib/schema";
import { fitTitle, fitDescription, ogImagePath } from "@/lib/meta";
import {
  reviewsReadCount,
  telHref,
  tierGroups,
  MAX_RANKED,
} from "@/lib/report-card";
import ReportHeader from "@/components/rebuild/ReportHeader";
import RankTier from "@/components/rebuild/RankTier";
import PlumberReportCard from "@/components/rebuild/PlumberReportCard";
import MethodologyBlock from "@/components/rebuild/MethodologyBlock";
import NearbyMarkets from "@/components/rebuild/NearbyMarkets";
import StickyCallBar from "@/components/rebuild/StickyCallBar";
import { ClockIcon } from "@/components/rebuild/icons";

interface Props {
  params: Promise<{ st: string; city: string }>;
}

// Only hasEmergencyPage markets get this route; everything else 404s
// (legacy emergency URLs are 301'd by middleware before reaching here).
export const dynamicParams = false;

export function generateStaticParams(): { st: string; city: string }[] {
  return getMarkets()
    .filter((m) => m.hasEmergencyPage)
    .map((m) => ({ st: m.st, city: m.slug }));
}

/**
 * 24/7-listed plumbers, editorial order preserved: synthesis + >=1 quote to
 * rank, is24Hour per their Google listing to qualify. is24Hour is a LISTING
 * claim (their published Google hours), not our test — framed that way on
 * every card via the 24-hour honesty pair (04 §5).
 */
function emergencyRanked(market: Market): SynthesizedPlumber[] {
  return getMarketPlumbers(market)
    .filter((p) => p.is24Hour && p.synthesis && (p.evidence_quotes?.length ?? 0) >= 1)
    .slice(0, MAX_RANKED);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { st, city } = await params;
  const market = getMarket(st, city);
  if (!market || !market.hasEmergencyPage) return {};
  const ranked = emergencyRanked(market);
  const indexable = isIndexableEmergencyMarket(market);
  const ST = st.toUpperCase();

  // C8: emergency title formula, measured <=60 with real shorter fallbacks.
  const title = fitTitle(
    `Emergency Plumbers in ${market.name}, ${ST} — ${ranked.length} Open 24/7 (Reviewed)`,
    `Emergency Plumbers in ${market.name}, ${ST} — ${ranked.length} Open 24/7`,
    `24/7 Plumbers in ${market.name}, ${ST} — Reviewed`,
  );
  const description = fitDescription(
    `${ranked.length} plumbers serving ${market.name}, ${ST} list 24/7 hours. We ranked them by what reviewers say about after-hours calls, response speed, and pricing.`,
  );
  const canonical = absoluteUrl(`/plumbers/${market.st}/${market.slug}/emergency`);

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
          url: ogImagePath({
            type: "city",
            city: market.name,
            state: ST,
            title: `24/7 Plumbers in ${market.name}, ${ST}`,
          }),
          width: 1200,
          height: 630,
        },
      ],
    },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function EmergencyMarketPage({ params }: Props) {
  const { st, city } = await params;
  const market = getMarket(st, city);
  if (!market || !market.hasEmergencyPage) notFound();

  const state = getStateByAbbr(st);
  const stateName = state?.name ?? st.toUpperCase();
  const ranked = emergencyRanked(market);
  const groups = tierGroups(ranked);
  const displayOrder = groups.flatMap((g) => g.plumbers);
  const ranks = new Map(displayOrder.map((p, i) => [p.placeId, i + 1]));
  const radiusMiles = getMarketsMeta().radiusMiles;
  const center = { lat: market.lat, lng: market.lng, label: `downtown ${market.name}` };
  const reviewsReadTotal = ranked.reduce((s, p) => s + reviewsReadCount(p), 0);
  const nearby = nearbyMarkets(market, 6).filter((n) => n.market.hasEmergencyPage);
  const top = displayOrder[0];

  const lastmodDate = new Date(market.lastmod);
  const updatedLabel = Number.isNaN(lastmodDate.getTime())
    ? null
    : lastmodDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // 24-hour honesty framing (04 §5): the count is of LISTINGS, our read tells
  // you which listings the reviews corroborate.
  const dek = [
    `These ${ranked.length} plumbers list 24/7 hours on their Google profiles — a claim they publish, not something we tested.`,
    `We read ${reviewsReadTotal.toLocaleString()} of their reviews for what actually happens after hours: where reviewers describe a real 2 a.m. call, that evidence is quoted below; where no review mentions after-hours response either way, the card says that too.`,
    "Rankings are not for sale.",
  ];

  // Same shape as the market page (01 §2.1): BreadcrumbList adds -> 24/7,
  // ItemList filtered to is24Hour listings, full Plumber summary entities.
  const jsonLd = [
    breadcrumbLd([
      ...homeCrumbs(),
      { name: stateName, path: `/plumbers/${market.st}` },
      { name: market.name, path: `/plumbers/${market.st}/${market.slug}` },
      { name: "24/7", path: `/plumbers/${market.st}/${market.slug}/emergency` },
    ]),
    plumberItemListLd({
      name: `24-hour plumbers serving ${market.name}, ${market.st.toUpperCase()}`,
      path: `/plumbers/${market.st}/${market.slug}/emergency`,
      plumbers: displayOrder,
    }),
  ];

  return (
    <div className="fpn">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <main className="wrap">
        <ReportHeader
          crumbs={[
            { label: "Plumbers", href: "/plumbers" },
            { label: stateName, href: `/plumbers/${market.st}` },
            { label: market.name, href: `/plumbers/${market.st}/${market.slug}` },
            { label: "24/7" },
          ]}
          h1={`The ${ranked.length} 24/7 plumbers serving ${market.name}`}
          dekHtmlSentences={dek}
          updatedLabel={updatedLabel}
          radiusLabel={`${radiusMiles}-mile radius of downtown ${market.name}`}
          reviewsReadTotal={reviewsReadTotal}
          businessesRead={ranked.length}
        />

        <div className="triage">
          <ClockIcon size={18} style={{ color: "var(--action)", marginTop: 2 }} />
          <div>
            <b>Before you call anyone:</b> shut off your main water valve. Then start at the top —
            every card is one tap to call.{" "}
            <Link href={`/plumbers/${market.st}/${market.slug}`}>
              Not urgent? See all ranked plumbers in {market.name} →
            </Link>
          </div>
        </div>

        {groups.map((g) => (
          <RankTier key={g.tier} tier={g.tier}>
            {g.plumbers.map((p) => (
              <PlumberReportCard
                key={p.placeId}
                plumber={p}
                rank={ranks.get(p.placeId)}
                center={center}
                anchorId={`pick-${ranks.get(p.placeId)}`}
                showEmergencyHonesty
              />
            ))}
          </RankTier>
        ))}

        <MethodologyBlock
          cityName={market.name}
          reviewsReadTotal={reviewsReadTotal}
          businessesRead={ranked.length}
        />

        <NearbyMarkets nearby={nearby} />
      </main>

      {top?.phone && (
        <StickyCallBar
          name={top.name}
          telHref={telHref(top.phone)}
          targetId={`pick-${ranks.get(top.placeId)}`}
          is24Hour={top.is24Hour}
        />
      )}
    </div>
  );
}
