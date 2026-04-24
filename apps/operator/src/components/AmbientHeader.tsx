/**
 * Ambient top strip: domain · operator initial · date.
 *
 * The "operator · control-center" mark links back to the dashboard.
 */

import Link from "next/link";

export default function AmbientHeader() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header
      className="w-full border-b"
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <div className="mx-auto flex w-full max-w-[720px] items-center justify-between px-6 py-4 md:px-8">
        <Link
          href="/"
          className="font-mono hover:opacity-80"
          style={{
            fontSize: "var(--text-ambient)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          operator · control-center
        </Link>
        <div
          className="flex items-center gap-4"
          style={{
            fontSize: "var(--text-ambient)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          <span>{today}</span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full"
            style={{
              backgroundColor: "var(--color-surface-muted)",
              color: "var(--color-ink-secondary)",
              fontSize: "var(--text-label)",
            }}
            aria-label="Operator"
          >
            T
          </span>
        </div>
      </div>
    </header>
  );
}
