import Link from "next/link";
import type { NearbyMarket } from "@/lib/markets";

/**
 * Nearby covered markets with REAL haversine distances and real ranked
 * counts (01 §4: kept markets only — guaranteed by construction, since
 * markets.json contains nothing else).
 */
export default function NearbyMarkets({ nearby }: { nearby: NearbyMarket[] }) {
  if (nearby.length === 0) return null;
  return (
    <section className="nearby">
      <h2>Nearby city guides</h2>
      <div className="near-grid">
        {nearby.map(({ market: m, distanceMiles }) => (
          <Link key={`${m.st}/${m.slug}`} href={`/plumbers/${m.st}/${m.slug}`}>
            {m.name}, {m.st.toUpperCase()}{" "}
            <span className="num">
              · {m.counts.plumbers} plumbers · {Math.round(distanceMiles)} mi
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
