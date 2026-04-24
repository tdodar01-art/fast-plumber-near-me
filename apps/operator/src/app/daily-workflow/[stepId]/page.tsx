/**
 * Daily Workflow step detail — shows exactly what a single cron step did.
 *
 * Intentionally minimal UI per user direction: only the step name, timing,
 * status, and the structured detail blocks. No sidebars, no cross-step nav
 * beyond the submenu breadcrumb rendered by TopNav.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCronStepById, IS_MOCK, todayCronRun } from "@/lib/dailyCronMock";
import type {
  CronStep,
  CronStepStatus,
  StepDetailBlock,
} from "@/lib/types";

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
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function StepDetailPage({
  params,
}: {
  params: Promise<{ stepId: string }>;
}) {
  const { stepId } = await params;
  const step = getCronStepById(stepId);
  if (!step) notFound();

  const idx = todayCronRun.steps.findIndex((s) => s.id === step.id) + 1;

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
          ← back to daily workflow
        </Link>
        <p
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          step {String(idx).padStart(2, "0")}
        </p>
        <div className="flex items-baseline justify-between gap-4">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-editorial)",
              color: "var(--color-ink-primary)",
              lineHeight: 1.2,
            }}
          >
            {step.name}.
          </h1>
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
        {(step.startedAt || step.durationSeconds !== undefined) && (
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-ink-secondary)",
            }}
          >
            {step.startedAt && <>started {formatTime(step.startedAt)}</>}
            {step.startedAt && step.durationSeconds !== undefined && " · "}
            {step.durationSeconds !== undefined && (
              <>ran for {formatDuration(step.durationSeconds)}</>
            )}
          </p>
        )}
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-ink-primary)",
          }}
        >
          {step.summary}
        </p>
      </header>

      {step.blocks && step.blocks.length > 0 && (
        <div className="flex flex-col gap-8">
          {step.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      )}

      {IS_MOCK && (
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

function BlockRenderer({ block }: { block: StepDetailBlock }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-ink-secondary)",
          }}
        >
          {block.text}
        </p>
      );
    case "facts":
      return (
        <dl className="flex flex-col gap-2">
          {block.rows.map((row, i) => (
            <div
              key={i}
              className="flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0"
              style={{ borderColor: "var(--color-border-tertiary)" }}
            >
              <dt
                style={{
                  fontSize: "var(--text-label)",
                  letterSpacing: "0.04em",
                  color: "var(--color-ink-tertiary)",
                }}
              >
                {row.label.toLowerCase()}
              </dt>
              <dd
                className="font-mono text-right"
                style={{
                  fontSize: "var(--text-body)",
                  color: "var(--color-ink-primary)",
                }}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      );
    case "list":
      return (
        <section>
          {block.label && (
            <h2
              className="mb-3"
              style={{
                fontSize: "var(--text-label)",
                letterSpacing: "0.04em",
                color: "var(--color-ink-tertiary)",
              }}
            >
              {block.label.toLowerCase()}
            </h2>
          )}
          <ul className="flex flex-col gap-1 font-mono">
            {block.items.map((item, i) => (
              <li
                key={i}
                style={{
                  fontSize: "var(--text-ambient)",
                  color: "var(--color-ink-secondary)",
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: "var(--color-border-secondary)" }}
              >
                {block.columns.map((col, i) => (
                  <th
                    key={i}
                    className="text-left py-2 pr-4 font-normal"
                    style={{
                      fontSize: "var(--text-label)",
                      letterSpacing: "0.04em",
                      color: "var(--color-ink-tertiary)",
                    }}
                  >
                    {col.toLowerCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "var(--color-border-tertiary)" }}
                >
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="py-2 pr-4 font-mono tabular-nums"
                      style={{
                        fontSize: "var(--text-body)",
                        color:
                          j === 0
                            ? "var(--color-ink-primary)"
                            : "var(--color-ink-secondary)",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return (
        <pre
          className="font-mono overflow-x-auto p-4 rounded"
          style={{
            fontSize: "var(--text-ambient)",
            backgroundColor: "var(--color-surface-muted)",
            color: "var(--color-ink-primary)",
          }}
        >
          {block.text}
        </pre>
      );
  }
}

export function generateStaticParams() {
  return todayCronRun.steps.map((s) => ({ stepId: s.id }));
}

// Guard against dynamic `params` types in strict mode if any static
// params get appended later.
export const dynamicParams = false;
