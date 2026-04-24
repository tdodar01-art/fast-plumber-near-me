import Link from "next/link";
import { loadQueueSnapshot } from "@/lib/queueReader";

export default async function QueueKpi() {
  const snap = await loadQueueSnapshot();
  const count = snap?.pending ?? null;
  const topImpr = snap
    ? snap.entries
        .filter((e) => typeof e.impressions === "number")
        .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
        .slice(0, 3)
    : [];

  return (
    <Link
      href="/queue"
      className="block border rounded-lg p-5 hover:opacity-90 transition-opacity"
      style={{
        borderColor: "var(--color-border-tertiary)",
        backgroundColor: "var(--color-surface-muted)",
      }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p
            style={{
              fontSize: "var(--text-label)",
              letterSpacing: "0.04em",
              color: "var(--color-ink-tertiary)",
            }}
          >
            scrape queue
          </p>
          <p
            className="font-mono tabular-nums mt-1"
            style={{
              fontSize: "var(--text-editorial)",
              color: "var(--color-ink-primary)",
              lineHeight: 1.1,
            }}
          >
            {count ?? "—"}
          </p>
          <p
            className="mt-1"
            style={{
              fontSize: "var(--text-ambient)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            cit{count === 1 ? "y" : "ies"} pending scrape
          </p>
        </div>
        <span
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          view →
        </span>
      </div>
      {topImpr.length > 0 && (
        <div
          className="mt-4 pt-3 border-t flex flex-col gap-1 font-mono"
          style={{
            borderColor: "var(--color-border-tertiary)",
            fontSize: "var(--text-ambient)",
            color: "var(--color-ink-secondary)",
          }}
        >
          <span
            className="mb-1"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            top by impressions
          </span>
          {topImpr.map((e) => (
            <span key={`${e.city}|${e.state}`}>
              {e.city}, {e.state} · {e.impressions?.toLocaleString()} impr
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
