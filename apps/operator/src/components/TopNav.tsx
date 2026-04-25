"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top nav for the operator console.
 *
 * The Daily Workflow is the operator's morning pass through the system,
 * broken into numbered steps. Each step gets a pill at the top — click
 * to jump anywhere. Active step is highlighted.
 *
 * Steps grow over time as we move automated jobs into the manual flow.
 * Add a new entry to STEPS to surface it.
 */

interface StepDef {
  href: string;
  label: string;
  hint: string;
}

const STEPS: readonly StepDef[] = [
  {
    href: "/daily-workflow",
    label: "Step 1",
    hint: "this morning's intake",
  },
  {
    href: "/daily-workflow/step-2",
    label: "Step 2",
    hint: "synthesize new plumbers",
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/daily-workflow") {
    // Step 1 is active for /daily-workflow exactly OR any per-step detail
    // page that isn't step-2.
    if (pathname === "/daily-workflow") return true;
    if (pathname.startsWith("/daily-workflow/step-2")) return false;
    return pathname.startsWith("/daily-workflow/");
  }
  return pathname.startsWith(href);
}

export default function TopNav() {
  const pathname = usePathname();
  const inDailyWorkflow = pathname.startsWith("/daily-workflow");

  if (!inDailyWorkflow) return null;

  return (
    <nav
      className="w-full border-b"
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <div className="mx-auto w-full max-w-[720px] px-6 md:px-8">
        <div className="flex items-baseline gap-3 py-3 flex-wrap">
          <span
            className="font-mono"
            style={{
              fontSize: "var(--text-label)",
              letterSpacing: "0.04em",
              color: "var(--color-ink-tertiary)",
              marginRight: "0.25rem",
            }}
          >
            daily workflow
          </span>
          {STEPS.map((step) => {
            const active = isActive(pathname, step.href);
            return (
              <Link
                key={step.href}
                href={step.href}
                className="inline-flex items-baseline gap-2 rounded-full border px-3 py-1 hover:opacity-90"
                style={{
                  fontSize: "var(--text-label)",
                  letterSpacing: "0.04em",
                  color: active
                    ? "var(--color-ink-primary)"
                    : "var(--color-ink-tertiary)",
                  borderColor: active
                    ? "var(--color-border-secondary)"
                    : "var(--color-border-tertiary)",
                  backgroundColor: active
                    ? "var(--color-surface-muted)"
                    : "transparent",
                }}
              >
                <span style={{ fontWeight: active ? 500 : 400 }}>
                  {step.label}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-ambient)",
                    color: active
                      ? "var(--color-ink-secondary)"
                      : "var(--color-ink-tertiary)",
                  }}
                >
                  {step.hint}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
