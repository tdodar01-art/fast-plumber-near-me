import type { RatingMixData } from "@/lib/report-card";

/**
 * Bars describe the selected exported excerpts. The exporter deliberately
 * selects by rating, recency and length; this is not a representative sample.
 */
export default function RatingMix({
  mix,
  googleReviewCount,
  compact = false,
}: {
  mix: RatingMixData;
  googleReviewCount: number;
  compact?: boolean;
}) {
  const maxCount = Math.max(...mix.counts, 1);
  const rows = [5, 4, 3, 2, 1] as const;
  return (
    <div className="mix">
      <div className="mix-title">
        <span className="cap">
          Rating mix — {mix.analyzed} selected review{mix.analyzed === 1 ? "" : "s"}
        </span>
        {!compact && googleReviewCount > mix.analyzed && (
          <span className="num" style={{ fontSize: "12.5px", color: "var(--ink-3)" }}>
            {googleReviewCount.toLocaleString()} total on Google
          </span>
        )}
      </div>
      <div className="mix-rows num">
        {rows.map((stars) => {
          const count = mix.counts[stars - 1];
          const width = Math.round((count / maxCount) * 100);
          return (
            <div key={stars} className={`mix-row${stars === 5 ? " r5" : stars === 1 ? " r1" : ""}`}>
              <span>{stars}★</span>
              <span className="mix-bar">
                <span className="mix-fill" style={{ width: `${width}%` }} />
              </span>
              <span>{count}</span>
            </div>
          );
        })}
      </div>
      <p className="mix-note">
        These excerpts were selected for recency, detail, and a range of ratings.
        This chart does not represent all reviews or the full analysis sample.
      </p>
      {mix.disagreesWithAverage ? (
        <p className="mix-note bad">
          This selected set contains a higher share of critical reviews than the Google average
          suggests. Selection affects this comparison.
        </p>
      ) : mix.smallSample ? (
        <p className="mix-note">
          Only {mix.analyzed} selected excerpts are shown in this chart. Check the analysis
          count separately before judging the depth of our assessment.
        </p>
      ) : null}
    </div>
  );
}
