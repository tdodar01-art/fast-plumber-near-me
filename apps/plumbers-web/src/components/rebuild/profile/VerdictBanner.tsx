import Link from "next/link";
import type { SynthesizedPlumber } from "@/lib/plumber-data";
import type { VerdictInfo, DimensionBar, MarketRankContext } from "@/lib/profile-dossier";

/**
 * THE VERDICT (03 §3.2) — the page's reason to exist and its LCP block.
 * Server-only, pure text. Contents in order: verdict label, synthesis.summary
 * in serif, 0–100 score + dimension bars WITH the mandatory disclosure (C2),
 * city-rank line ("plumbers we've reviewed" phrasing — never a market-wide
 * factual claim), provenance line.
 */
export default function VerdictBanner({
  plumber: p,
  verdict,
  dims,
  rankCtx,
  reviewsRead,
  updatedLabel,
  anchorId,
}: {
  plumber: SynthesizedPlumber;
  verdict: VerdictInfo;
  dims: DimensionBar[] | null;
  rankCtx: MarketRankContext | null;
  reviewsRead: number;
  updatedLabel: string | null;
  anchorId?: string;
}) {
  const score = p.synthesis?.score;
  return (
    <section aria-labelledby="verdict-h" id={anchorId} className="anchor-target">
      <h2 id="verdict-h" className="sr-only-h">
        Our verdict
      </h2>
      <div className={`verdict v-${verdict.tone}`}>
        <span className="verdict-tag">{verdict.label}</span>
        {p.synthesis?.summary && <p className="verdict-summary">{p.synthesis.summary}</p>}

        {typeof score === "number" && (
          <>
            <div className="scorehead">
              <span className="scorenum num">
                {Math.round(score)}
                <span className="scoreden">/100</span>
              </span>
              <span className="scorelbl">
                FPN Review Score · <Link href="/methodology#score">how we score</Link>
              </span>
            </div>
            {dims && (
              <div
                className="dims"
                role="img"
                aria-label={`Dimension scores: ${dims.map((d) => `${d.label} ${d.value}${d.weakest ? " (weakest area)" : ""}`).join(", ")}`}
              >
                {dims.map((d) => (
                  <div key={d.key} className={`dim${d.weakest ? " weak" : ""}`}>
                    <span className="lbl">{d.label}</span>
                    <span className="track">
                      <i className="fill" style={{ width: `${Math.max(2, Math.min(100, d.value))}%` }} />
                    </span>
                    <span className="val num">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="score-note">
              Scores are our editorial reading of published customer reviews — not a
              verification, license check, or guarantee.
            </p>
          </>
        )}

        {rankCtx && (
          <p className="rankline num">
            Ranked{" "}
            <b>
              #{rankCtx.rank} of {rankCtx.total}
            </b>{" "}
            plumbers we&apos;ve reviewed in {rankCtx.market.name},{" "}
            {rankCtx.market.st.toUpperCase()} ·{" "}
            <Link href={`/plumbers/${rankCtx.market.st}/${rankCtx.market.slug}`}>
              compare all →
            </Link>
          </p>
        )}

        <p className="provenance">
          <b>Our opinion</b>, based on the {reviewsRead.toLocaleString()} reviews we analyzed
          from Google, Yelp and BBB
          {updatedLabel ? ` · Analysis updated ${updatedLabel}` : ""} ·{" "}
          <Link href="/methodology">How we decide ↗</Link>
        </p>
      </div>
    </section>
  );
}
