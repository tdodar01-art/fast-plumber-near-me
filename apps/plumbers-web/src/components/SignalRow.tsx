"use client";

import { resolveSignals, pickTop, countByKind, type PlumberLike } from "@/lib/plumber-signals";
import SignalChip from "./SignalChip";

/**
 * SignalRow — compact horizontal row of signal chips for a plumber card.
 *
 * By default shows the top 3 signals. If `showAll` is true (detail page),
 * shows every qualifying signal in one row (wraps).
 *
 * Honesty principle (enforced by pickTop): if any flag exists, the most
 * severe flag is always in slot 1. Users cannot miss a concern on a card.
 *
 * Renders nothing if the plumber has no qualifying signals.
 */

export default function SignalRow({
  plumber,
  showAll = false,
  limit = 3,
}: {
  plumber: PlumberLike;
  showAll?: boolean;
  limit?: number;
}) {
  const signals = resolveSignals(plumber);
  if (signals.length === 0) return null;
  const display = showAll ? signals : pickTop(signals, limit);
  const counts = countByKind(signals);
  const overflow = Math.max(0, signals.length - display.length);

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {display.map((signal) => (
        <SignalChip key={signal.id} signal={signal} compact />
      ))}
      {!showAll && overflow > 0 && (
        <span
          className="text-[11px] text-gray-500 font-medium px-1.5 py-0.5 rounded-full"
          title={`${counts.flag} concern${counts.flag === 1 ? "" : "s"}, ${counts.excel} strength${counts.excel === 1 ? "" : "s"}${counts.info > 0 ? `, ${counts.info} info` : ""}`}
        >
          +{overflow} more
        </span>
      )}
    </div>
  );
}
