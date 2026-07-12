import { ClockIcon } from "./icons";

/**
 * Emergency triage strip (02 §3.1 item 3) — one quiet row, no urgency
 * theatre. Anchors to the first 24/7-listed ranked card.
 */
export default function TriageStrip({
  anchorId,
  count24h,
}: {
  /** id of the first 24/7 ranked card; strip renders nothing without one. */
  anchorId: string | null;
  count24h: number;
}) {
  if (!anchorId || count24h === 0) return null;
  return (
    <div className="triage">
      <ClockIcon size={18} style={{ color: "var(--action)", marginTop: 2 }} />
      <div>
        <b>Water everywhere right now?</b> Shut off your main valve first, then{" "}
        <a href={`#${anchorId}`}>jump to the 24/7 picks ↓</a>. Every plumber below is one tap to
        call.
      </div>
    </div>
  );
}
