/**
 * 4-stat horizontal bar. Metric number in mono, delta in semantic color.
 * Property-agnostic — card labels come from data, not code.
 */

import type { SignalCard } from "@/lib/types";

function deltaColor(direction: SignalCard["direction"]): string {
  switch (direction) {
    case "up":
      return "var(--color-accent-strong)";
    case "down":
      return "var(--color-danger-ink)";
    case "flat":
    default:
      return "var(--color-ink-tertiary)";
  }
}

export default function SignalStrip({ cards }: { cards: SignalCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[8px] px-4 py-3"
          style={{
            backgroundColor: "var(--color-surface-muted)",
            border: "0.5px solid var(--color-border-tertiary)",
          }}
        >
          <div
            style={{
              fontSize: "var(--text-label)",
              color: "var(--color-ink-tertiary)",
              letterSpacing: "0.04em",
            }}
          >
            {card.label.toLowerCase()}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="font-mono font-medium"
              style={{
                fontSize: "var(--text-metric)",
                color: "var(--color-ink-primary)",
              }}
            >
              {card.value}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "var(--text-delta)",
                color: deltaColor(card.direction),
              }}
            >
              {card.delta}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
