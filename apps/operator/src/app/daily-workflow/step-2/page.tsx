/**
 * Daily Workflow — step 2: synthesize plumbers via paste-flow.
 *
 * Lists plumbers in Firestore that have no Sonnet `synthesis.summary`
 * yet. Operator clicks into each one to see a copy-able prompt + a
 * paste-back area for Claude.ai's response (no Anthropic API spend).
 *
 * This replaces the disabled `score-plumbers.ts` cron step. The page
 * shows the work pile; the per-plumber detail page is where the actual
 * paste-flow happens.
 */

import Link from "next/link";
import { loadSynthesisQueue } from "@/lib/synthesisReader";

export const revalidate = 300;

export default async function Step2Page() {
  const snap = await loadSynthesisQueue();

  if (!snap) {
    return (
      <div className="flex flex-col gap-4">
        <p style={{ color: "var(--color-ink-secondary)" }}>
          Could not load plumbers JSON from main. Check{" "}
          <code>GITHUB_TOKEN</code> in <code>apps/operator/.env.local</code>.
        </p>
      </div>
    );
  }

  const candidates = snap.candidates;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          step 2 · synthesize new plumbers
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-editorial)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          {candidates.length} plumber{candidates.length === 1 ? "" : "s"} need
          synthesis.
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-ink-secondary)",
          }}
        >
          Sorted by review count desc — most reviews = synthesis with the most
          signal. Click in to see the prompt and paste Claude&rsquo;s response
          back. No Anthropic API spend; you run it in your own Claude.ai tab.
        </p>
        <p
          className="font-mono"
          style={{
            fontSize: "var(--text-ambient)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          {snap.hasSynthesis} / {snap.totalPlumbers} plumbers already have a
          synthesis on file.
        </p>
      </header>

      {candidates.length === 0 ? (
        <p
          className="italic"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-body)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          Every plumber in Firestore has a synthesis. Nothing to do here.
        </p>
      ) : (
        <ol className="flex flex-col">
          {candidates.map((c, idx) => (
            <li
              key={c.placeId || c.slug}
              className="border-b last:border-b-0"
              style={{ borderColor: "var(--color-border-tertiary)" }}
            >
              <Link
                href={`/daily-workflow/step-2/${c.placeId || c.slug}`}
                className="flex gap-5 py-4 hover:opacity-80"
              >
                <span
                  className="font-mono tabular-nums pt-0.5"
                  style={{
                    fontSize: "var(--text-label)",
                    color: "var(--color-ink-tertiary)",
                    minWidth: "2.5rem",
                  }}
                >
                  {String(idx + 1).padStart(3, "0")}
                </span>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span
                      style={{
                        fontSize: "var(--text-body)",
                        color: "var(--color-ink-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {c.name}
                    </span>
                    <span
                      className="font-mono tabular-nums"
                      style={{
                        fontSize: "var(--text-label)",
                        letterSpacing: "0.04em",
                        color: "var(--color-ink-tertiary)",
                      }}
                    >
                      {c.reviewsCachedCount} cached
                      {c.googleReviewCount !== undefined &&
                        c.googleReviewCount !== c.reviewsCachedCount &&
                        ` · ${c.googleReviewCount} on google`}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "var(--text-body)",
                      color: "var(--color-ink-secondary)",
                    }}
                  >
                    {c.city}
                    {c.state ? `, ${c.state}` : ""}
                    {typeof c.googleRating === "number" && (
                      <>
                        {" · "}
                        {c.googleRating.toFixed(1)}★
                      </>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
