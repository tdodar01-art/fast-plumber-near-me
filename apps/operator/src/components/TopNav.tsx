"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCronStepById } from "@/lib/dailyCronMock";

const items = [{ href: "/daily-workflow", label: "Daily Workflow" }] as const;

function resolveCrumbs(pathname: string): string[] {
  // "/" → no crumbs (we're on the dashboard)
  if (pathname === "/") return [];

  if (pathname === "/daily-workflow") return ["daily workflow"];

  const stepMatch = pathname.match(/^\/daily-workflow\/([^/]+)$/);
  if (stepMatch) {
    const step = getCronStepById(stepMatch[1]);
    return ["daily workflow", step ? step.name.toLowerCase() : stepMatch[1]];
  }

  return [];
}

export default function TopNav() {
  const pathname = usePathname();
  const crumbs = resolveCrumbs(pathname);

  return (
    <nav
      className="w-full border-b"
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <div className="mx-auto w-full max-w-[720px] px-6 md:px-8">
        <div className="flex items-center gap-6 py-3">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center rounded-full border px-3 py-1"
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
                {item.label}
              </Link>
            );
          })}
        </div>
        {crumbs.length > 0 && (
          <div
            className="pb-3 font-mono"
            style={{
              fontSize: "var(--text-ambient)",
              color: "var(--color-ink-tertiary)",
              letterSpacing: "0.02em",
            }}
          >
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && (
                  <span className="mx-2" aria-hidden>
                    ›
                  </span>
                )}
                <span
                  style={{
                    color:
                      i === crumbs.length - 1
                        ? "var(--color-ink-secondary)"
                        : "var(--color-ink-tertiary)",
                  }}
                >
                  {c}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
