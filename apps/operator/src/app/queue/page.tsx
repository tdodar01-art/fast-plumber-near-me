/**
 * Scrape queue detail page — everything pending scrape, sorted by GSC
 * impressions desc. Cities with no GSC join sink to the bottom.
 */

import Link from "next/link";
import { loadQueueSnapshot, type QueueEntry } from "@/lib/queueReader";

export const revalidate = 300;

function sortByImpressionsDesc(a: QueueEntry, b: QueueEntry): number {
  const ai = a.impressions ?? -1;
  const bi = b.impressions ?? -1;
  if (ai !== bi) return bi - ai;
  return a.city.localeCompare(b.city);
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
  const sorted = [...pending].sort(sortByImpressionsDesc);
  const withImpr = sorted.filter(
    (e) => typeof e.impressions === "number" && e.impressions > 0,
  );
  const noImpr = sorted.filter(
    (e) => !(typeof e.impressions === "number" && e.impressions > 0),
  );
  const totalImpr = withImpr.reduce((s, e) => s + (e.impressions ?? 0), 0);

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
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-ink-secondary)",
          }}
        >
          {withImpr.length} with GSC impression data (
          {totalImpr.toLocaleString()} total impressions across the queue).
          {noImpr.length > 0 && (
            <> {noImpr.length} without recent GSC data.</>
          )}
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

      <section>
        <h2
          className="mb-3"
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          sorted by impressions, desc
        </h2>
        <ol className="flex flex-col">
          {sorted.map((e, idx) => (
            <QueueRow key={`${e.city}|${e.state}`} entry={e} index={idx + 1} />
          ))}
        </ol>
      </section>
    </div>
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
