/**
 * Collapsed form of the published state. Replaces the FocusCard on next
 * cycle — no history persistence in Phase 1, just the most recent receipt.
 */

import type { Receipt } from "@/lib/types";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export default function ReceiptChip({
  receipt,
  onDismiss,
}: {
  receipt: Receipt;
  onDismiss: () => void;
}) {
  return (
    <div
      className="rounded-[12px] px-6 py-4 transition-all duration-300"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "0.5px solid var(--color-border-secondary)",
      }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div
          className="flex items-center gap-3 flex-wrap"
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-ink-secondary)",
          }}
        >
          <span style={{ color: "var(--color-ink-primary)" }}>
            {receipt.focusHeadline}
          </span>
          <span style={{ color: "var(--color-ink-tertiary)" }}>·</span>
          <span className="font-mono tabular-nums">
            {receipt.recordsTouched} records
          </span>
          <span style={{ color: "var(--color-ink-tertiary)" }}>·</span>
          <span className="font-mono tabular-nums">
            {formatCost(receipt.cost)}
          </span>
          <span style={{ color: "var(--color-ink-tertiary)" }}>·</span>
          <span className="font-mono tabular-nums">
            {formatDuration(receipt.durationSeconds)}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="cursor-pointer"
          style={{
            fontSize: "var(--text-label)",
            color: "var(--color-ink-tertiary)",
            letterSpacing: "0.04em",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          next
        </button>
      </div>
    </div>
  );
}
