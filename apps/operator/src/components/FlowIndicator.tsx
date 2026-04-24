/**
 * Breadcrumb-style step trail: idle → pulling → reviewing → synthesizing →
 * publishing → published. One dot filled (current), rest empty. No buttons,
 * no interaction.
 */

import type { StateKind } from "@/lib/reducer";

const STEPS: { kind: StateKind; label: string }[] = [
  { kind: "idle", label: "Signal" },
  { kind: "pulling", label: "Pull" },
  { kind: "reviewing", label: "Review" },
  { kind: "synthesizing", label: "Synthesize" },
  { kind: "publishing", label: "Approve" },
  { kind: "published", label: "Publish" },
];

export default function FlowIndicator({ current }: { current: StateKind }) {
  const currentIndex = STEPS.findIndex((s) => s.kind === current);

  return (
    <nav
      aria-label="Flow progress"
      className="flex items-center gap-2 flex-wrap"
      style={{
        fontSize: "var(--text-label)",
        color: "var(--color-ink-tertiary)",
      }}
    >
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <span key={step.kind} className="flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: isActive
                  ? "var(--color-accent-strong)"
                  : isPast
                    ? "var(--color-ink-tertiary)"
                    : "var(--color-border-secondary)",
              }}
            />
            <span
              style={{
                color: isActive
                  ? "var(--color-ink-primary)"
                  : "var(--color-ink-tertiary)",
                letterSpacing: "0.04em",
              }}
            >
              {step.label.toLowerCase()}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                style={{ color: "var(--color-border-secondary)" }}
              >
                ·
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
