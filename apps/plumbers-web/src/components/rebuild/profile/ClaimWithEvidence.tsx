import type { ClaimBlock } from "@/lib/profile-dossier";
import QuoteCard from "./QuoteCard";
import { ChevronIcon } from "../icons";

/**
 * One synthesized claim + its receipts (03 §3.3–3.4).
 *
 * Strengths: claim always visible, quotes behind a <details> chip.
 * Concerns/red flags: the strongest supporting quote renders ALREADY EXPANDED
 * inline — the reader must never click to see the first negative receipt.
 * Remaining quotes stay behind the chip.
 */
export default function ClaimWithEvidence({
  claim,
  reviewsRead,
}: {
  claim: ClaimBlock;
  reviewsRead: number;
}) {
  const isConcern = claim.severity !== "strength";
  const isFlag = claim.severity === "redflag";
  const inline = isConcern ? claim.quotes.slice(0, 1) : [];
  const behindChip = isConcern ? claim.quotes.slice(1) : claim.quotes;

  return (
    <div className={`claim${isConcern ? " concern" : ""}${isFlag ? " flag" : ""}`}>
      {isFlag && <p className="flaghead">Red flag</p>}
      <p className="claimtext">{claim.text}</p>

      {inline.length > 0 && (
        <div className="evbody" style={{ marginTop: 10 }}>
          {inline.map((q, i) => (
            <QuoteCard key={i} quote={q} />
          ))}
        </div>
      )}

      {behindChip.length > 0 ? (
        <details className="ev">
          <summary>
            {behindChip.length} {isConcern && inline.length > 0 ? "more " : ""}cited review
            {behindChip.length === 1 ? "" : "s"} <ChevronIcon size={13} className="chev" />
          </summary>
          <div className="evbody">
            {behindChip.map((q, i) => (
              <QuoteCard key={i} quote={q} />
            ))}
            {claim.supportCount > claim.quotes.length && (
              <p className="ev-note num">
                Cited in {claim.supportCount} of the {reviewsRead} reviews we analyzed —{" "}
                {claim.supportCount - claim.quotes.length} cited review
                {claim.supportCount - claim.quotes.length === 1 ? "" : "s"} not excerpted here.
              </p>
            )}
          </div>
        </details>
      ) : claim.supportCount > claim.quotes.length ? (
        <p className="ev-note num">
          Cited in {claim.supportCount} of the {reviewsRead} reviews we analyzed.
        </p>
      ) : null}
    </div>
  );
}
