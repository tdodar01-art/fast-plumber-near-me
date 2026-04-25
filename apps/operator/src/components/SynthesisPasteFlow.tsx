"use client";

import { useState } from "react";
import { parsePastedSynthesis, type ParsedSynthesis } from "@/lib/synthesisPrompt";

interface Props {
  prompt: string;
  plumberName: string;
}

export default function SynthesisPasteFlow({ prompt, plumberName }: Props) {
  const [pastedRaw, setPastedRaw] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [resultCopyState, setResultCopyState] = useState<"idle" | "copied">("idle");

  const parsed = pastedRaw.trim() ? parsePastedSynthesis(pastedRaw) : null;
  const isError = parsed && "error" in parsed;
  const valid: ParsedSynthesis | null = parsed && !isError ? (parsed as ParsedSynthesis) : null;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      // ignore — user can manually select the textarea
    }
  }

  async function copyParsed() {
    if (!valid) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(valid, null, 2));
      setResultCopyState("copied");
      setTimeout(() => setResultCopyState("idle"), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-heading)",
              color: "var(--color-ink-primary)",
              lineHeight: 1.2,
            }}
          >
            1. Prompt for {plumberName}
          </h2>
          <button
            type="button"
            onClick={copyPrompt}
            className="rounded-full border px-3 py-1 hover:opacity-90"
            style={{
              fontSize: "var(--text-label)",
              letterSpacing: "0.04em",
              borderColor: "var(--color-border-secondary)",
              backgroundColor:
                copyState === "copied"
                  ? "var(--color-accent-bg)"
                  : "var(--color-surface-muted)",
              color:
                copyState === "copied"
                  ? "var(--color-accent-ink)"
                  : "var(--color-ink-primary)",
            }}
          >
            {copyState === "copied" ? "copied ✓" : "copy prompt"}
          </button>
        </div>
        <textarea
          readOnly
          value={prompt}
          rows={12}
          className="font-mono w-full p-3 rounded border resize-y"
          style={{
            fontSize: "var(--text-ambient)",
            backgroundColor: "var(--color-surface-muted)",
            borderColor: "var(--color-border-tertiary)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.5,
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-heading)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          2. Paste Claude&rsquo;s JSON response
        </h2>
        <textarea
          value={pastedRaw}
          onChange={(e) => setPastedRaw(e.target.value)}
          placeholder={`{
  "summary": "...",
  "strengths": [...],
  ...
}`}
          rows={10}
          className="font-mono w-full p-3 rounded border resize-y"
          style={{
            fontSize: "var(--text-ambient)",
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border-tertiary)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.5,
          }}
        />
      </section>

      {isError && (
        <section
          className="rounded border p-4"
          style={{
            borderColor: "var(--color-danger-ink)",
            backgroundColor: "var(--color-surface-muted)",
          }}
        >
          <p
            className="font-mono"
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-danger-ink)",
            }}
          >
            {(parsed as { error: string }).error}
          </p>
          <p
            className="mt-1"
            style={{
              fontSize: "var(--text-ambient)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            Make sure you pasted only the JSON block — strip any markdown
            fences or surrounding prose Claude added.
          </p>
        </section>
      )}

      {valid && (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "var(--text-heading)",
                color: "var(--color-ink-primary)",
                lineHeight: 1.2,
              }}
            >
              3. Parsed synthesis ✓
            </h2>
            <button
              type="button"
              onClick={copyParsed}
              className="rounded-full border px-3 py-1 hover:opacity-90"
              style={{
                fontSize: "var(--text-label)",
                letterSpacing: "0.04em",
                borderColor: "var(--color-border-secondary)",
                backgroundColor:
                  resultCopyState === "copied"
                    ? "var(--color-accent-bg)"
                    : "var(--color-surface-muted)",
                color:
                  resultCopyState === "copied"
                    ? "var(--color-accent-ink)"
                    : "var(--color-ink-primary)",
              }}
            >
              {resultCopyState === "copied" ? "copied ✓" : "copy clean JSON"}
            </button>
          </div>

          <ParsedView parsed={valid} />
        </section>
      )}
    </div>
  );
}

function ParsedView({ parsed }: { parsed: ParsedSynthesis }) {
  const Section = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex flex-col gap-1">
      <span
        style={{
          fontSize: "var(--text-label)",
          letterSpacing: "0.04em",
          color: "var(--color-ink-tertiary)",
        }}
      >
        {label.toLowerCase()}
      </span>
      <div
        style={{
          fontSize: "var(--text-body)",
          color: "var(--color-ink-primary)",
        }}
      >
        {children}
      </div>
    </div>
  );

  const List = ({ items }: { items: string[] }) =>
    items.length === 0 ? (
      <span
        className="italic"
        style={{ color: "var(--color-ink-tertiary)" }}
      >
        (none)
      </span>
    ) : (
      <ul className="list-disc pl-5 flex flex-col gap-1">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    );

  return (
    <div
      className="flex flex-col gap-5 border rounded p-4"
      style={{
        borderColor: "var(--color-border-tertiary)",
        backgroundColor: "var(--color-surface-muted)",
      }}
    >
      <Section label="Summary">
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-heading)",
            color: "var(--color-ink-primary)",
          }}
        >
          {parsed.summary || "(empty)"}
        </p>
      </Section>
      <Section label="Strengths">
        <List items={parsed.strengths} />
      </Section>
      <Section label="Weaknesses">
        <List items={parsed.weaknesses} />
      </Section>
      <Section label="Red flags">
        <List items={parsed.redFlags} />
      </Section>
      <Section label="Emergency notes">
        <p>{parsed.emergencyNotes || "(empty)"}</p>
        {parsed.emergencyReadiness && (
          <p
            className="font-mono mt-1"
            style={{
              fontSize: "var(--text-ambient)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            readiness: {parsed.emergencyReadiness}
          </p>
        )}
      </Section>
      <Section label="Best for">
        <List items={parsed.bestFor} />
      </Section>
      {(parsed.topQuote || parsed.worstQuote) && (
        <Section label="Quotes">
          {parsed.topQuote && (
            <p
              className="italic"
              style={{
                fontFamily: "var(--font-serif)",
                color: "var(--color-ink-secondary)",
              }}
            >
              top: &ldquo;{parsed.topQuote}&rdquo;
            </p>
          )}
          {parsed.worstQuote && (
            <p
              className="italic mt-2"
              style={{
                fontFamily: "var(--font-serif)",
                color: "var(--color-ink-secondary)",
              }}
            >
              worst: &ldquo;{parsed.worstQuote}&rdquo;
            </p>
          )}
        </Section>
      )}
      {(parsed.trustLevel || parsed.priceSignal) && (
        <Section label="Signals">
          <p
            className="font-mono"
            style={{
              fontSize: "var(--text-ambient)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            {parsed.trustLevel ? `trust: ${parsed.trustLevel}` : ""}
            {parsed.trustLevel && parsed.priceSignal ? " · " : ""}
            {parsed.priceSignal ? `price: ${parsed.priceSignal}` : ""}
          </p>
        </Section>
      )}
    </div>
  );
}
