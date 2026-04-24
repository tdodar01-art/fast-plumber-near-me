/**
 * Scrape queue detail page.
 *
 * Grouped by GSC tier (high / medium / low / none) — same thresholds as
 * scripts/gsc-expansion.js. Within each tier, sorted by impressions desc.
 */

import Link from "next/link";
import {
  loadQueueSnapshot,
  TIER_LABEL,
  TIER_RANGE,
  type GscTier,
  type QueueEntry,
} from "@/lib/queueReader";

export const revalidate = 300;

const TIER_ORDER: GscTier[] = ["high", "medium", "low", "none"];

function tierInk(tier: GscTier): string {
  switch (tier) {
    case "high":
      return "var(--color-accent-strong)";
    case "medium":
      return "var(--color-ink-primary)";
    case "low":
      return "var(--color-ink-secondary)";
    case "none":
      return "var(--color-ink-tertiary)";
  }
}

export default async function QueuePage() {
  const snap = await loadQueueSnapshot();

  if (!snap) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/"
          className="hover:opacity-80"
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          ← back
        </Link>
        <p style={{ color: "var(--color-ink-secondary)" }}>
          Queue unavailable (GitHub API fetch failed — set{" "}
          <code>GITHUB_TOKEN</code> in{" "}
          <code>apps/operator/.env.local</code>).
        </p>
      </div>
    );
  }

  const pending = snap.entries.filter((e) => e.status === "pending");
  const byTier: Record<GscTier, QueueEntry[]> = {
    high: [],
    medium: [],
    low: [],
    none: [],
  };
  for (const e of pending) byTier[e.tier].push(e);
  for (const tier of TIER_ORDER) {
    byTier[tier].sort((a, b) => {
      const ai = a.impressions ?? -1;
      const bi = b.impressions ?? -1;
      if (ai !== bi) return bi - ai;
      return a.city.localeCompare(b.city);
    });
  }

  const totalImpr = pending.reduce((s, e) => s + (e.impressions ?? 0), 0);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="hover:opacity-80"
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          ← back to dashboard
        </Link>
        <p
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          scrape queue
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-editorial)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          {pending.length} cit{pending.length === 1 ? "y" : "ies"} pending
          scrape.
        </h1>
        <p
          className="font-mono"
          style={{
            fontSize: "var(--text-ambient)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          {TIER_ORDER.filter((t) => byTier[t].length > 0)
            .map((t) => `${byTier[t].length} ${t}`)
            .join(" · ")}{" "}
          · {totalImpr.toLocaleString()} total impressions
        </p>
        <p
          className="font-mono"
          style={{
            fontSize: "var(--text-ambient)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          Places API budget: {snap.usedThisMonth} / {snap.monthlyBudget} calls
          used this month ({snap.currentMonth})
        </p>
      </header>

      {TIER_ORDER.map((tier) => {
        const rows = byTier[tier];
        if (rows.length === 0) return null;
        return <TierSection key={tier} tier={tier} rows={rows} />;
      })}
    </div>
  );
}

function TierSection({
  tier,
  rows,
}: {
  tier: GscTier;
  rows: QueueEntry[];
}) {
  const tierImpr = rows.reduce((s, e) => s + (e.impressions ?? 0), 0);
  return (
    <section className="flex flex-col gap-3">
      <header
        className="flex items-baseline justify-between gap-4 border-b pb-2"
        style={{ borderColor: "var(--color-border-secondary)" }}
      >
        <div className="flex items-baseline gap-3">
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-heading)",
              color: tierInk(tier),
              lineHeight: 1.2,
            }}
          >
            {TIER_LABEL[tier]}
          </h2>
          <span
            className="font-mono"
            style={{
              fontSize: "var(--text-label)",
              letterSpacing: "0.04em",
              color: "var(--color-ink-tertiary)",
            }}
          >
            {TIER_RANGE[tier]}
          </span>
        </div>
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          {rows.length} cit{rows.length === 1 ? "y" : "ies"}
          {tier !== "none" && ` · ${tierImpr.toLocaleString()} impr`}
        </span>
      </header>
      <ol className="flex flex-col">
        {rows.map((e, idx) => (
          <QueueRow key={`${e.city}|${e.state}`} entry={e} index={idx + 1} />
        ))}
      </ol>
    </section>
  );
}

function QueueRow({
  entry,
  index,
}: {
  entry: QueueEntry;
  index: number;
}) {
  return (
    <li
      className="border-b last:border-b-0 py-3 flex items-baseline gap-5"
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <span
        className="font-mono tabular-nums pt-0.5"
        style={{
          fontSize: "var(--text-label)",
          color: "var(--color-ink-tertiary)",
          minWidth: "2.5rem",
        }}
      >
        {String(index).padStart(3, "0")}
      </span>
      <div className="flex-1 flex flex-col gap-0.5">
        {entry.pageUrl ? (
          <a
            href={entry.pageUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:underline"
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-ink-primary)",
              fontWeight: 500,
            }}
          >
            {entry.city}, {entry.state}
          </a>
        ) : (
          <span
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-ink-primary)",
              fontWeight: 500,
            }}
          >
            {entry.city}, {entry.state}
          </span>
        )}
        {entry.pageTypes && entry.pageTypes.length > 0 && (
          <span
            className="font-mono"
            style={{
              fontSize: "var(--text-ambient)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            {entry.pageTypes.slice(0, 4).join(" · ")}
            {entry.pageTypes.length > 4 && " · …"}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end font-mono tabular-nums">
        {typeof entry.impressions === "number" ? (
          <>
            <span
              style={{
                fontSize: "var(--text-body)",
                color:
                  entry.impressions > 0
                    ? "var(--color-ink-primary)"
                    : "var(--color-ink-tertiary)",
              }}
            >
              {entry.impressions.toLocaleString()} impr
            </span>
            {typeof entry.avgPosition === "number" && (
              <span
                style={{
                  fontSize: "var(--text-ambient)",
                  color: "var(--color-ink-tertiary)",
                }}
              >
                avg pos {entry.avgPosition.toFixed(1)}
              </span>
            )}
          </>
        ) : (
          <span
            style={{
              fontSize: "var(--text-ambient)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            no gsc data
          </span>
        )}
      </div>
    </li>
  );
}
