import type { RatingMixData } from "@/lib/report-card";

/**
 * Rating-mix bars — computed ONLY over the analyzed review set (C10).
 * The caption states the analyzed count on every card; we never render (or
 * imply) Google's full histogram, which we don't have.
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
          Rating mix — of the {mix.analyzed} review{mix.analyzed === 1 ? "" : "s"} we analyzed
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
      {mix.disagreesWithAverage ? (
        <p className="mix-note bad">
          Our sample skews heavily toward critical reviews — it disagrees with the Google average
          shown above.
        </p>
      ) : mix.smallSample ? (
        <p className="mix-note">
          Small sample — we&apos;ve analyzed only {mix.analyzed} of{" "}
          {googleReviewCount.toLocaleString()} reviews so far. Treat this as a first read.
        </p>
      ) : null}
    </div>
  );
}
