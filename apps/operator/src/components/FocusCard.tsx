"use client";

/**
 * THE focus surface. Transforms in place across idle → pulling → reviewing →
 * synthesizing → publishing. Never renders in the `published` state — the
 * parent branch-renders ReceiptChip instead.
 *
 * Each state renders a different body below the stable headline; the button
 * row is state-specific.
 */

import type { Dispatch } from "react";
import type { Action, State } from "@/lib/reducer";
import type { PulledReview } from "@/lib/types";

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}

function Button({
  label,
  onClick,
  disabled,
  variant = "primary",
}: ButtonProps) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-[8px] px-4 py-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        fontSize: "var(--text-body)",
        backgroundColor: isPrimary
          ? "var(--color-ink-primary)"
          : "transparent",
        color: isPrimary
          ? "var(--color-base)"
          : "var(--color-ink-secondary)",
        border: isPrimary
          ? "0.5px solid var(--color-ink-primary)"
          : "0.5px solid var(--color-border-secondary)",
      }}
    >
      {label}
    </button>
  );
}

function RecommendationPanel({
  title,
  body,
  costPreview,
}: {
  title: string;
  body: string;
  costPreview: string;
}) {
  return (
    <div
      className="rounded-[8px] px-4 py-3"
      style={{
        backgroundColor: "var(--color-accent-bg)",
        color: "var(--color-accent-ink)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-label)",
          letterSpacing: "0.04em",
        }}
      >
        {title.toLowerCase()}
      </div>
      <p
        className="mt-1"
        style={{
          fontSize: "var(--text-body)",
          color: "var(--color-accent-ink)",
        }}
      >
        {body}
      </p>
      <p
        className="mt-2 font-mono"
        style={{
          fontSize: "var(--text-delta)",
          color: "var(--color-accent-ink)",
          opacity: 0.85,
        }}
      >
        {costPreview}
      </p>
    </div>
  );
}

function StatusLine({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="italic"
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: "var(--text-body)",
        color: "var(--color-ink-secondary)",
      }}
    >
      {children}
    </p>
  );
}

function ReviewRow({ review }: { review: PulledReview }) {
  return (
    <div
      className="flex flex-col gap-1 py-3"
      style={{
        borderTop: "0.5px solid var(--color-border-tertiary)",
      }}
    >
      <div
        className="flex items-center gap-2 flex-wrap"
        style={{
          fontSize: "var(--text-label)",
          color: "var(--color-ink-tertiary)",
          letterSpacing: "0.04em",
        }}
      >
        <span>{review.source}</span>
        <span>·</span>
        <span className="font-mono">{review.rating.toFixed(1)}</span>
        <span>·</span>
        <span className="font-mono">{review.date}</span>
        {review.isNew && (
          <>
            <span>·</span>
            <span style={{ color: "var(--color-accent-strong)" }}>new</span>
          </>
        )}
      </div>
      <p
        style={{
          fontSize: "var(--text-body)",
          color: "var(--color-ink-secondary)",
        }}
      >
        {review.text}
      </p>
    </div>
  );
}

export default function FocusCard({
  state,
  dispatch,
}: {
  state: Exclude<State, { kind: "published" }>;
  dispatch: Dispatch<Action>;
}) {
  const { focus } = state;

  return (
    <article
      className="rounded-[12px] px-7 py-7 transition-all duration-300"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "0.5px solid var(--color-border-secondary)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-label)",
          color: "var(--color-accent-strong)",
          letterSpacing: "0.04em",
        }}
      >
        {focus.label.toLowerCase()}
      </div>
      <h1
        className="mt-2"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-editorial)",
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          color: "var(--color-ink-primary)",
        }}
      >
        {focus.headline}
      </h1>
      <p
        className="mt-4"
        style={{
          fontSize: "var(--text-body)",
          color: "var(--color-ink-secondary)",
          lineHeight: 1.65,
        }}
      >
        {focus.body}
      </p>

      {/* idle: recommendation + start/dismiss */}
      {state.kind === "idle" && (
        <>
          <div className="mt-5">
            <RecommendationPanel
              title={focus.recommendation.title}
              body={focus.recommendation.body}
              costPreview={focus.recommendation.costPreview}
            />
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button
              label="Start — pull reviews"
              onClick={() => dispatch({ type: "START_PULL" })}
            />
            <Button
              label="Not today"
              variant="secondary"
              onClick={() => dispatch({ type: "DISMISS" })}
            />
          </div>
        </>
      )}

      {/* pulling: live status line + disabled primary */}
      {state.kind === "pulling" && (
        <>
          <div className="mt-5">
            <StatusLine>
              Pulling reviews from Outscraper… Google {state.sources.google} ·
              Yelp {state.sources.yelp} · Angi {state.sources.angi}
            </StatusLine>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button label="Pulling…" onClick={() => {}} disabled />
            <Button
              label="Cancel"
              variant="secondary"
              onClick={() => dispatch({ type: "DISMISS" })}
            />
          </div>
        </>
      )}

      {/* reviewing: list + approve */}
      {state.kind === "reviewing" && (
        <>
          <div className="mt-5">
            <StatusLine>
              Pulled {state.reviews.length} reviews. Scan and approve to
              continue.
            </StatusLine>
          </div>
          <div className="mt-4 flex flex-col">
            {state.reviews.map((r) => (
              <ReviewRow key={r.id} review={r} />
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button
              label="Approve — move to synthesis"
              onClick={() =>
                dispatch({
                  type: "APPROVE_REVIEWS",
                  prompt: "[prompt generated — see mock]",
                })
              }
            />
            <Button
              label="Discard"
              variant="secondary"
              onClick={() => dispatch({ type: "DISMISS" })}
            />
          </div>
        </>
      )}

      {/* synthesizing: prompt block + paste area + render */}
      {state.kind === "synthesizing" && (
        <>
          <div className="mt-5">
            <StatusLine>
              Ready to synthesize locally. Copy the prompt into Claude Code,
              then paste the output below.
            </StatusLine>
          </div>
          <pre
            className="mt-4 overflow-x-auto rounded-[8px] px-4 py-3 font-mono"
            style={{
              fontSize: "var(--text-delta)",
              backgroundColor: "var(--color-surface-muted)",
              color: "var(--color-ink-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
            }}
          >
            {state.prompt}
          </pre>
          <textarea
            value={state.pastedOutput ?? ""}
            onChange={(e) =>
              dispatch({ type: "PASTE_SYNTHESIS", output: e.target.value })
            }
            placeholder="Paste Claude Code output here when done."
            className="mt-4 w-full rounded-[8px] px-4 py-3 font-mono"
            rows={6}
            style={{
              fontSize: "var(--text-delta)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-ink-primary)",
              border: "0.5px solid var(--color-border-secondary)",
              resize: "vertical",
            }}
          />
          <div className="mt-6 flex items-center gap-3">
            <Button
              label="Render preview"
              disabled={!state.pastedOutput?.trim()}
              onClick={() =>
                dispatch({
                  type: "SUBMIT_SYNTHESIS",
                  preview: state.pastedOutput ?? "",
                  estimatedCost: 1.78,
                })
              }
            />
            <Button
              label="Back"
              variant="secondary"
              onClick={() => dispatch({ type: "DISMISS" })}
            />
          </div>
        </>
      )}

      {/* publishing: preview + approve */}
      {state.kind === "publishing" && (
        <>
          <div className="mt-5">
            <StatusLine>
              Ready to publish. This will update 3 records and ping the
              Indexing API for 2 pages.
            </StatusLine>
          </div>
          <div
            className="mt-4 rounded-[8px] px-4 py-3"
            style={{
              backgroundColor: "var(--color-surface-muted)",
              border: "0.5px solid var(--color-border-tertiary)",
              fontSize: "var(--text-body)",
              color: "var(--color-ink-secondary)",
              lineHeight: 1.65,
            }}
          >
            {state.synthesisPreview}
          </div>
          <p
            className="mt-3 font-mono"
            style={{
              fontSize: "var(--text-delta)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            estimated cost · ${state.estimatedCost.toFixed(2)}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button
              label="Publish"
              onClick={() => dispatch({ type: "APPROVE_PUBLISH" })}
            />
            <Button
              label="Back"
              variant="secondary"
              onClick={() => dispatch({ type: "DISMISS" })}
            />
          </div>
        </>
      )}
    </article>
  );
}
