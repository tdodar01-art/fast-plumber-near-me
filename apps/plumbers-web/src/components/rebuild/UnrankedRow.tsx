import Link from "next/link";
import type { SynthesizedPlumber } from "@/lib/plumber-data";
import { businessProfilePath } from "@/config/plumbing-routes";
import { distanceMiles, telHref } from "@/lib/report-card";
import { StarIcon, PhoneIcon } from "./icons";
import type { CardCenter } from "./PlumberReportCard";

/**
 * Unranked one-liner (02 §3.6): name, platform-attributed rating, distance,
 * call link. No fake synthesis, no invented judgment.
 */
export default function UnrankedRow({
  plumber: p,
  center,
}: {
  plumber: SynthesizedPlumber;
  center: CardCenter;
}) {
  const dist = distanceMiles(p, center.lat, center.lng);
  return (
    <div className="u-row">
      <span className="u-name">
        <Link href={businessProfilePath(p.slug)}>{p.name}</Link>
      </span>
      <span className="u-meta num">
        {p.googleRating != null && (
          <>
            <StarIcon size={12} className="star-glyph" /> {p.googleRating.toFixed(1)} (
            {p.googleReviewCount.toLocaleString()} Google review
            {p.googleReviewCount === 1 ? "" : "s"})
          </>
        )}
        {p.city ? ` · ${p.city}` : ""}
        {dist != null ? ` · ${dist.toFixed(1)} mi` : ""}
      </span>
      {p.phone && (
        <a className="u-call num" href={telHref(p.phone)}>
          <PhoneIcon size={14} /> Call
        </a>
      )}
    </div>
  );
}
