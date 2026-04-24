/**
 * The below-the-fold quiet list. Pure information — no buttons, no CTAs.
 */

import type { QuietMovement } from "@/lib/types";

function renderDelta(delta: QuietMovement["delta"]): string {
  if (delta === "held") return "held";
  if (delta === "flat") return "flat";
  if (delta === "new") return "new";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function deltaColor(delta: QuietMovement["delta"]): string {
  if (typeof delta === "number") {
    if (delta > 0) return "var(--color-accent-strong)";
    if (delta < 0) return "var(--color-danger-ink)";
  }
  return "var(--color-ink-tertiary)";
}

export default function QuietList({
  label,
  items,
}: {
  label: string;
  items: QuietMovement[];
}) {
  return (
    <section>
      <h2
        className="mb-4"
        style={{
          fontSize: "var(--text-label)",
          color: "var(--color-ink-tertiary)",
          letterSpacing: "0.04em",
        }}
      >
        {label.toLowerCase()}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((m) => (
          <li
            key={`${m.city}-${m.query}`}
            className="flex items-baseline justify-between gap-4"
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-ink-secondary)",
            }}
          >
            <span>
              <span style={{ color: "var(--color-ink-primary)" }}>
                {m.city}
              </span>{" "}
              <span style={{ color: "var(--color-ink-tertiary)" }}>
                · {m.query}
              </span>
            </span>
            <span className="flex items-center gap-3 font-mono tabular-nums">
              <span
                style={{
                  fontSize: "var(--text-delta)",
                  color: "var(--color-ink-tertiary)",
                }}
              >
                #{m.position}
              </span>
              <span
                style={{
                  fontSize: "var(--text-delta)",
                  color: deltaColor(m.delta),
                }}
              >
                {renderDelta(m.delta)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
