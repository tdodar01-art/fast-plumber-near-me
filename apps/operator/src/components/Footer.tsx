/**
 * Quiet footer — serif italic status line + doctrine link stub + build info.
 * No interaction beyond the doctrine link stub (href="#" for Phase 1).
 */

export default function Footer() {
  return (
    <footer
      className="w-full border-t mt-auto"
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-4 px-6 py-6 md:px-8">
        <p
          className="italic"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-footer)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          one operator · one column · one action at a time
        </p>
        <div
          className="flex items-center gap-4"
          style={{
            fontSize: "var(--text-footer)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          <a
            href="#"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            doctrine
          </a>
          <span className="font-mono">phase 1 · mock</span>
        </div>
      </div>
    </footer>
  );
}
