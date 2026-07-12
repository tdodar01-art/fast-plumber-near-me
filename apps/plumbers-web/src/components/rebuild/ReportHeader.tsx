import Link from "next/link";
import { ClockIcon, PinIcon, BookIcon, ChevronIcon } from "./icons";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Report header (02 §3.1 items 1–2): breadcrumb, H1 with the real rendered
 * count, the serif methods dek (composed per-city by src/lib/city-intro.ts —
 * every number computed), and the meta row. Includes the "How we rank —
 * 60-second version" disclosure (02 §3.4).
 */
export default function ReportHeader({
  crumbs,
  h1,
  dekHtmlSentences,
  introMore,
  updatedLabel,
  radiusLabel,
  methodAnchor = "#how-we-rank",
  reviewsReadTotal,
  businessesRead,
}: {
  crumbs: Crumb[];
  h1: string;
  /** Composed serif dek sentences (already plain text; bold handled by <strong> markers is not used — plain). */
  dekHtmlSentences: string[];
  /** Optional second composed paragraph (standard/dense tiers). */
  introMore?: string | null;
  updatedLabel: string | null;
  radiusLabel: string;
  methodAnchor?: string;
  /** Sum of reviews read across the businesses on this page (for the 60-second version). */
  reviewsReadTotal: number;
  businessesRead: number;
}) {
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && " › "}
            {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
          </span>
        ))}
      </nav>
      <h1 className="report-h1">{h1}</h1>
      <p className="dek">{dekHtmlSentences.join(" ")}</p>
      {introMore && <p className="intro-more">{introMore}</p>}
      <div className="report-meta">
        {updatedLabel && (
          <span className="num">
            <ClockIcon size={14} />
            Updated {updatedLabel}
          </span>
        )}
        <span className="num">
          <PinIcon size={14} />
          {radiusLabel}
        </span>
        <span>
          <BookIcon size={14} />
          <a href={methodAnchor}>How we rank</a>
        </span>
      </div>

      <details className="method">
        <summary>
          How we rank — the 60-second version <ChevronIcon size={16} className="chev" />
        </summary>
        <div className="method-body">
          <p>
            <b>What we read:</b> for each plumber, up to 100 recent reviews from Google, Yelp and
            BBB — the full text, not just the stars. For this page:{" "}
            {reviewsReadTotal.toLocaleString()} reviews across {businessesRead} businesses.
          </p>
          <p>
            <b>What moves a plumber up:</b> repeated, independent evidence of showing up when
            promised, fair and upfront pricing, and work that holds. One glowing review counts for
            little; twenty that agree count for a lot.
          </p>
          <p>
            <b>What moves a plumber down:</b> repeated complaint patterns — surprise fees, missed
            appointments, pressure sales — especially when they show up on more than one platform.
          </p>
          <p>
            <b>What never moves the ranking:</b> money. One clearly labeled sponsored slot may
            appear above this list; it never changes the order below it.
          </p>
          <p>
            Our take on each plumber is our opinion, grounded in the reviews we quote on this page.{" "}
            <a href={methodAnchor}>Full methodology ↓</a>
          </p>
        </div>
      </details>
    </>
  );
}
