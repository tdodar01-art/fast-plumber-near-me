import Link from "next/link";
import type { MarketRankContext, NearbyMarketLink } from "@/lib/profile-dossier";
import { verdictInfo } from "@/lib/profile-dossier";
import { businessProfilePath } from "@/config/plumbing-routes";

/**
 * Compare & continue (03 §3.10): adjacent ranked profiles in the same market
 * (honest directional links — "ranked #2", never better/worse prose), the
 * city-page link (the money page), and nearby covered markets.
 */
export default function CompareStrip({
  rankCtx,
  nearby,
  currentName,
}: {
  rankCtx: MarketRankContext | null;
  nearby: NearbyMarketLink[];
  currentName: string;
}) {
  if (!rankCtx && nearby.length === 0) return null;
  const m = rankCtx?.market;

  return (
    <section aria-labelledby="compare-h" className="pf-section">
      <h2 id="compare-h">
        {m ? `More plumbers in ${m.name}, ${m.st.toUpperCase()}` : "Find plumbers near you"}
      </h2>

      {rankCtx &&
        rankCtx.neighbors.map(({ plumber: n, rank }) => {
          const v = verdictInfo(n);
          return (
            <Link key={n.placeId} className="altcard" href={businessProfilePath(n.slug)}>
              <span className="nm">
                {n.name}
                {v && <span className={`vchip vc-${v.tone}`}>{v.short}</span>}
              </span>
              <span className="sub num">
                Ranked #{rank} of {rankCtx.total} in {rankCtx.market.name}
                {n.synthesis?.summary ? ` · ${n.synthesis.summary.slice(0, 90)}${n.synthesis.summary.length > 90 ? "…" : ""}` : ""}
              </span>
            </Link>
          );
        })}

      {m && (
        <p style={{ marginTop: 10 }}>
          <Link href={`/plumbers/${m.st}/${m.slug}`}>
            <b>
              See all {rankCtx.total} plumbers we&apos;ve reviewed in {m.name},{" "}
              {m.st.toUpperCase()} →
            </b>
          </Link>
        </p>
      )}
      {!m && nearby.length > 0 && (
        <p className="pf-footnote">
          {currentName} isn&apos;t in one of our ranked city guides yet — the nearest covered
          markets are below.
        </p>
      )}

      {nearby.length > 0 && (
        <p className="pf-nearby num">
          Nearby:{" "}
          {nearby.map((n, i) => (
            <span key={`${n.st}/${n.slug}`}>
              {i > 0 && " · "}
              <Link href={`/plumbers/${n.st}/${n.slug}`}>{n.name}</Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
