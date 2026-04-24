/**
 * Daily Workflow — step 1: review what the 6 AM cron did overnight.
 *
 * Mirrors the seven surviving steps of `daily-scrape.yml` (see CLAUDE.md
 * "Automation pause" section). This page is intentionally the only thing
 * visible — no signal strip, no focus card, no quiet list. The operator's
 * daily pass starts here.
 */

import Link from "next/link";
import { todayCronRun as mockRun } from "@/lib/dailyCronMock";
import { loadTodayCronRun } from "@/lib/dailyCronReader";
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default async function DailyWorkflowPage() {
  const live = await loadTodayCronRun();
  const run = live ?? mockRun;
  const isMock = !live;

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
          step 1 · this morning&rsquo;s intake
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-editorial)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          What ran at 6&nbsp;AM today.
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-ink-secondary)",
          }}
        >
          {formatDate(run.date)} · started {formatTime(run.startedAt)} ·
          finished in {formatDuration(run.durationSeconds)}
        </p>
      </header>

      <ol className="flex flex-col">
        {run.steps.map((step, idx) => (
          <StepRow key={step.id} step={step} index={idx + 1} />
        ))}
      </ol>

      {run.commitSha && (
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
            commit {run.commitSha}
          </p>
          {run.commitMessage && (
            <p
              className="mt-1"
              style={{
                fontSize: "var(--text-body)",
                color: "var(--color-ink-secondary)",
              }}
            >
              {run.commitMessage}
            </p>
          )}
          {isMock && (
            <p
              className="font-mono mt-3"
              style={{
                fontSize: "var(--text-ambient)",
                color: "var(--color-ink-tertiary)",
              }}
            >
              mock data · no real 6 AM run captured yet for this date
            </p>
          )}
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
