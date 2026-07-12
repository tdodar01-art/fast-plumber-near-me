import { CheckIcon, TriangleIcon, OctagonIcon } from "./icons";
import type { CardEvidence } from "@/lib/report-card";

/**
 * Counted strengths / concerns columns (02 §3.2 zone E).
 * Concern-forward rule: when red flags exist, the concerns column renders
 * FIRST in both mobile and desktop layouts — that ordering is the honesty
 * signal, handled here via source order.
 */
export default function EvidenceList({
  evidence,
  reviewsRead,
}: {
  evidence: CardEvidence;
  reviewsRead: number;
}) {
  const { strengths, concerns, concernForward } = evidence;
  if (strengths.length === 0 && concerns.length === 0) return null;

  const hasRedFlag = concerns.some((c) => c.severity === "redflag");

  const strengthsCol = strengths.length > 0 && (
    <div className="ev str" key="str">
      <h4>{concernForward ? "To be fair" : "What reviewers keep saying"}</h4>
      <ul>
        {strengths.map((item, i) => (
          <li key={i}>
            <CheckIcon size={15} style={{ color: "var(--good)" }} />
            <span>
              {item.text}
              {item.supportCount > 0 && (
                <>
                  {" "}
                  <span className="ct num">
                    (cited in {item.supportCount} of {reviewsRead} reviews)
                  </span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const concernsCol = (
    <div className={`ev con${hasRedFlag ? " flag" : ""}`} key="con">
      <h4>{concernForward ? "Why we're cautious" : "What reviewers complain about"}</h4>
      <ul>
        {concerns.length === 0 ? (
          <li>
            <TriangleIcon size={15} style={{ color: "var(--warn)" }} />
            <span>No repeated complaints found in the reviews we&apos;ve read.</span>
          </li>
        ) : (
          concerns.map((item, i) => (
            <li key={i} className={item.severity === "redflag" ? "severe" : undefined}>
              {item.severity === "redflag" ? (
                <OctagonIcon size={15} style={{ color: "var(--bad)" }} />
              ) : (
                <TriangleIcon size={15} style={{ color: "var(--warn)" }} />
              )}
              <span>
                {item.text}
                {item.supportCount > 0 && (
                  <>
                    {" "}
                    <span className="ct num">
                      ({item.supportCount} of {reviewsRead} reviews)
                    </span>
                  </>
                )}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  return (
    <div className="evidence two">
      {concernForward ? (
        <>
          {concernsCol}
          {strengthsCol}
        </>
      ) : (
        <>
          {strengthsCol}
          {concernsCol}
        </>
      )}
    </div>
  );
}
