/**
 * Daily Workflow — step 2: this morning's maintenance.
 *
 * Two cron steps that don't bring NEW data, they keep what we already
 * have fresh:
 *   - Refresh Reviews: re-pulls Google Places reviews on existing
 *     plumbers (30-day rotation, capped at 20 per run)
 *   - Request Indexing: pings Google Indexing API for the city pages
 *     we just touched (200/day quota, free)
 *
 * Both run inside the same `daily-scrape.yml` workflow as step 1; this
 * page just filters the run to the maintenance subset for review.
 */

import Link from "next/link";
import { todayCronRun as mockRun } from "@/lib/dailyCronMock";
import { loadTodayCronRun } from "@/lib/dailyCronReader";
import { MAINTENANCE_STEPS } from "@/lib/cronSteps";
import type { CronStep, CronStepStatus } from "@/lib/types";

export const revalidate = 300;

function statusInk(status: CronStepStatus): string {
  switch (status) {
    case "success":
      return "var(--color-accent-strong)";
    case "warn":
      return "var(--color-ink-secondary)";
    case "skip":
      return "var(--color-ink-tertiary)";
    case "error":
      return "var(--color-danger-ink)";
  }
}

function statusLabel(status: CronStepStatus): string {
  switch (status) {
    case "success":
      return "ran";
    case "warn":
      return "warn";
    case "skip":
      return "skip";
    case "error":
      return "fail";
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function DailyWorkflowStep2Page() {
  const live = await loadTodayCronRun();
  const run = live ?? mockRun;
  const isMock = !live;
  const maintenanceIds = new Set(MAINTENANCE_STEPS.map((s) => s.id));
  const maintenanceSteps = run.steps.filter((s) => maintenanceIds.has(s.id));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/daily-workflow"
          className="hover:opacity-80"
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          ← step 1: this morning&rsquo;s intake
        </Link>
        <p
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          step 2 · this morning&rsquo;s maintenance
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-editorial)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          What got refreshed today.
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-ink-secondary)",
          }}
        >
          {formatDate(run.date)} · two automated jobs that keep existing data
          fresh and ping Google to recrawl. Both are zero-cost and need no
          operator attention — this page is just visibility.
        </p>
      </header>

      <ol className="flex flex-col">
        {maintenanceSteps.map((step, idx) => (
          <StepRow key={step.id} step={step} index={idx + 1} />
        ))}
      </ol>

      {isMock && (
        <footer
          className="border-t pt-4"
          style={{ borderColor: "var(--color-border-tertiary)" }}
        >
          <p
            className="font-mono"
            style={{
              fontSize: "var(--text-ambient)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            mock data · no real 6 AM run captured yet for this date
          </p>
        </footer>
      )}
    </div>
  );
}

function StepRow({ step, index }: { step: CronStep; index: number }) {
  return (
    <li
      className="border-b last:border-b-0"
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <Link
        href={`/daily-workflow/${step.id}`}
        className="flex gap-5 py-4 hover:opacity-80"
      >
        <span
          className="font-mono tabular-nums pt-0.5"
          style={{
            fontSize: "var(--text-label)",
            color: "var(--color-ink-tertiary)",
            minWidth: "1.5rem",
          }}
        >
          {String(index).padStart(2, "0")}
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
              {step.name}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "var(--text-label)",
                letterSpacing: "0.04em",
                color: statusInk(step.status),
              }}
            >
              {statusLabel(step.status)}
            </span>
          </div>
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-ink-secondary)",
            }}
          >
            {step.summary}
          </p>
          {step.detail && (
            <p
              style={{
                fontSize: "var(--text-ambient)",
                color: "var(--color-ink-tertiary)",
              }}
            >
              {step.detail}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
