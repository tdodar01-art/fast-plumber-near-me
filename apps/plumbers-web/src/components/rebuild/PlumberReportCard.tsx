import Link from "next/link";
import type { SynthesizedPlumber } from "@/lib/plumber-data";
import { businessProfilePath } from "@/config/plumbing-routes";
import {
  cardTier,
  cardEvidence,
  ratingMix,
  quotePair,
  reviewsReadCount,
  newestReviewLabel,
  distanceMiles,
  formatPhone,
  telHref,
  emergencyHonesty,
} from "@/lib/report-card";
import RatingMix from "./RatingMix";
import EvidenceList from "./EvidenceList";
import QuotePair from "./QuotePair";
import { StarIcon, PinIcon, ClockIcon, CheckIcon, TriangleIcon, OctagonIcon, PhoneIcon } from "./icons";

export interface CardCenter {
  lat: number;
  lng: number;
  /** e.g. "downtown Elgin" */
  label: string;
}

/**
 * PlumberReportCard — 02 §3.2 zones A–H. Every element maps to a field in the
 * committed JSON; no numeric 0–100 score renders here (C2 — tiers and rank
 * numerals only). Card is NOT click-anywhere: only the name and "Full report"
 * navigate; Call is the only filled button.
 */
export default function PlumberReportCard({
  plumber: p,
  rank,
  center,
  anchorId,
  sponsored = false,
  showEmergencyHonesty = false,
}: {
  plumber: SynthesizedPlumber;
  rank?: number | null;
  center: CardCenter;
  anchorId?: string;
  sponsored?: boolean;
  showEmergencyHonesty?: boolean;
}) {
  const tier = cardTier(p);
  const mix = ratingMix(p);
  const evidence = cardEvidence(p);
  const pair = quotePair(p);
  const read = reviewsReadCount(p);
  const newest = newestReviewLabel(p);
  const dist = distanceMiles(p, center.lat, center.lng);
  const honesty = showEmergencyHonesty ? emergencyHonesty(p) : null;
  const smallTrackRecord = p.googleReviewCount > 0 && p.googleReviewCount < 50;

  const tierClass = sponsored ? "" : ` t-${tier.tier === "top" ? "good" : tier.tier === "caveat" ? "warn" : "bad"}`;

  return (
    <article className={`card${tierClass} anchor-target`} id={anchorId}>
      {/* Zone A — identity row */}
      <div className="id-row">
        {!sponsored && typeof rank === "number" && (
          <div className="rank num" aria-label={`Ranked number ${rank}`}>
            {rank}
          </div>
        )}
        <div className="biz">
          <h3>
            <Link href={businessProfilePath(p.slug)}>{p.name}</Link>
          </h3>
          <div className="chips">
            {tier.tier === "top" && (
              <span className="chip good">
                <CheckIcon size={12} />
                {sponsored ? "Meets our top-pick bar" : "Top pick"}
              </span>
            )}
            {tier.tier === "caveat" && (
              <span className="chip warn">
                <TriangleIcon size={12} />
                Caveats apply
              </span>
            )}
            {tier.tier === "avoid" && (
              <span className="chip bad">
                <OctagonIcon size={12} />
                We&apos;d call someone else first
              </span>
            )}
            {p.is24Hour && (
              <span className="chip plain">
                <ClockIcon size={12} />
                24/7 per Google listing
              </span>
            )}
            {smallTrackRecord && <span className="chip warn">Small track record</span>}
          </div>
        </div>
      </div>

      {/* Zone B — fact row (ratings always attributed to their platform) */}
      <div className="fact-row num">
        {p.googleRating != null && (
          <span className="stars">
            <StarIcon size={14} className="star-glyph" /> {p.googleRating.toFixed(1)}{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-2)" }}>
              ({p.googleReviewCount.toLocaleString()} Google reviews)
            </span>
          </span>
        )}
        {(() => {
          const yelpRating = (p as unknown as { yelpRating?: number | null }).yelpRating;
          const yelpCount = (p as unknown as { yelpReviewCount?: number | null }).yelpReviewCount;
          return typeof yelpRating === "number" && yelpRating > 0 ? (
            <span>
              {yelpRating.toFixed(1)} on Yelp
              {typeof yelpCount === "number" && yelpCount > 0 ? ` (${yelpCount.toLocaleString()})` : ""}
            </span>
          ) : null;
        })()}
        {dist != null && (
          <span>
            <PinIcon size={13} /> {dist.toFixed(1)} mi from {center.label}
          </span>
        )}
        {!p.is24Hour && <span>Not a 24/7 shop</span>}
      </div>

      {honesty && (
        <p style={{ marginTop: 8, fontSize: "13px", color: "var(--ink-2)" }}>{honesty}</p>
      )}

      {/* Zone C — our take (serif = authored judgment) */}
      {p.synthesis?.summary && (
        <div className="take">
          <div className="cap">
            Our take <Link href="/methodology">— how we form it</Link>
          </div>
          <p>{p.synthesis.summary}</p>
        </div>
      )}

      {/* Zone D — rating mix, analyzed set only */}
      {mix && <RatingMix mix={mix} googleReviewCount={p.googleReviewCount} />}

      {/* Zone E — counted evidence, concern-forward when red flags exist */}
      <EvidenceList evidence={evidence} reviewsRead={read} />

      {/* Zone F — quote pair, verbatim + attributed */}
      <QuotePair pair={pair} />

      {/* Zone G — provenance line (honest recency cue) */}
      <p className="prov num">
        We read {read.toLocaleString()} of {p.googleReviewCount.toLocaleString()} reviews
        {newest ? ` · newest from ${newest}` : ""}
        {p.bbb?.accredited ? ` · BBB${p.bbb.rating ? ` ${p.bbb.rating}` : ""} accredited` : ""}
      </p>

      {/* Zone H — action row */}
      <div className="actions">
        {p.phone && (
          <a className="call-btn" href={telHref(p.phone)}>
            <PhoneIcon size={19} />
            <span className="num">{formatPhone(p.phone)}</span>
          </a>
        )}
        <div className="sec-links">
          <Link href={businessProfilePath(p.slug)}>Full report →</Link>
          {p.website && (
            <a
              className="ext"
              href={p.website}
              rel={sponsored ? "sponsored noopener nofollow" : "noopener nofollow"}
              target="_blank"
            >
              Website ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
