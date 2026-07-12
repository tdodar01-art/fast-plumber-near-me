import type { RatingMixData } from "@/lib/report-card";
import type { PlatformPicture } from "@/lib/profile-dossier";
import RatingMix from "../RatingMix";

/**
 * The rating picture (03 §3.5): analyzed-set distribution (C10 framing via
 * the shared RatingMix component) + cross-platform comparison panel with
 * synthesis.platformDiscrepancy prose as the caption. Anchor target of the
 * header's "platforms disagree" chip.
 */
export default function RatingPicture({
  mix,
  googleReviewCount,
  platforms,
  newestLabel,
}: {
  mix: RatingMixData | null;
  googleReviewCount: number;
  platforms: PlatformPicture | null;
  newestLabel: string | null;
}) {
  if (!mix && !platforms) return null;
  return (
    <section aria-labelledby="rating-picture-h" id="rating-picture" className="anchor-target pf-section">
      <h2 id="rating-picture-h">The rating picture</h2>
      <div className="rp-grid">
        {mix && (
          <div className="panel">
            <RatingMix mix={mix} googleReviewCount={googleReviewCount} />
            {newestLabel && (
              <p className="caption num">Newest review in our sample: {newestLabel}.</p>
            )}
          </div>
        )}
        {platforms && (
          <div className="panel">
            <h3 className="cap">Across platforms</h3>
            <div className="plat-rows">
              {platforms.rows.map((row) => (
                <div key={row.label} className="plat num">
                  <span className="plat-name">{row.label}</span>
                  <span className="track">
                    <i
                      className={`fill plat-${row.tone}`}
                      style={{
                        width: row.rating != null ? `${Math.round((row.rating / 5) * 100)}%` : "96%",
                      }}
                    />
                  </span>
                  <span className="plat-detail">{row.detail}</span>
                </div>
              ))}
            </div>
            {platforms.discrepancy && <p className="caption">{platforms.discrepancy}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
