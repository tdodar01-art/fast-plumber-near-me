"use client";

/**
 * Operator console — main page.
 *
 * Reads mock data at render time, owns the reducer, and wires simulated
 * transitions (setTimeout chains) for each action. Phase 2 replaces these
 * setTimeout calls with real API route invocations.
 *
 * Dev-only `?state=<kind>` query param forces any state on mount.
 *   TODO(phase-deploy): remove the ?state= dev override before the first
 *   real deploy — it's a convenience for local development only.
 */

import { useEffect, useReducer, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import FlowIndicator from "@/components/FlowIndicator";
import SignalStrip from "@/components/SignalStrip";
import FocusCard from "@/components/FocusCard";
import Divider from "@/components/Divider";
import QuietList from "@/components/QuietList";
import ReceiptChip from "@/components/ReceiptChip";

import {
  type Action,
  type State,
  type StateKind,
  initialState,
  reducer,
} from "@/lib/reducer";
import {
  buildReceipt,
  focusQueue,
  mockSynthesisPreview,
  mockSynthesisPrompt,
  pulledReviewsMock,
  quietMovements,
  signalSnapshot,
} from "@/lib/mockData";

// AmbientHeader + Footer are rendered by the RootLayout — not re-rendered
// here. This page is the inner column only.

function buildForcedState(
  kind: StateKind,
  base: Extract<State, { kind: "idle" }>,
): State | null {
  const focus = base.focus;
  const rest = base.queue;

  switch (kind) {
    case "idle":
      return { kind: "idle", focus, queue: rest };
    case "pulling":
      return {
        kind: "pulling",
        focus,
        queue: rest,
        sources: { google: 32, yelp: 8, angi: 2 },
        totalTarget: 62,
      };
    case "reviewing":
      return {
        kind: "reviewing",
        focus,
        queue: rest,
        reviews: pulledReviewsMock,
        sources: { google: 47, yelp: 12, angi: 3 },
      };
    case "synthesizing":
      return {
        kind: "synthesizing",
        focus,
        queue: rest,
        reviews: pulledReviewsMock,
        prompt: mockSynthesisPrompt,
        pastedOutput: null,
      };
    case "publishing":
      return {
        kind: "publishing",
        focus,
        queue: rest,
        synthesisPreview: mockSynthesisPreview,
        estimatedCost: 1.78,
      };
    case "published":
      return {
        kind: "published",
        receipt: buildReceipt(focus),
        queue: rest,
      };
    default:
      return null;
  }
}

function OperatorConsole() {
  const searchParams = useSearchParams();

  const [state, dispatch] = useReducer(
    reducer,
    focusQueue.data.items,
    initialState,
  );

  // Dev-only ?state= override. Fires once on mount.
  // TODO(phase-deploy): remove before the first real deploy.
  const didForce = useRef(false);
  useEffect(() => {
    if (didForce.current) return;
    didForce.current = true;
    const forced = searchParams.get("state") as StateKind | null;
    if (!forced) return;
    const base = initialState(focusQueue.data.items);
    const next = buildForcedState(forced, base);
    if (next) {
      dispatch({ type: "DEV_FORCE", state: next });
    }
  }, [searchParams]);

  // Simulated transitions. When `state.kind` changes, kick off timers.
  useEffect(() => {
    if (state.kind === "pulling") {
      // Two progress ticks, then completion.
      const t1 = setTimeout(() => {
        dispatch({
          type: "PULL_PROGRESS",
          sources: { google: 22, yelp: 5, angi: 1 },
        });
      }, 600);
      const t2 = setTimeout(() => {
        dispatch({
          type: "PULL_PROGRESS",
          sources: { google: 41, yelp: 10, angi: 2 },
        });
      }, 1200);
      const t3 = setTimeout(() => {
        dispatch({ type: "PULL_COMPLETE", reviews: pulledReviewsMock });
      }, 1800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }

    if (state.kind === "publishing") {
      // Nothing fires automatically — waits for APPROVE_PUBLISH click.
      return;
    }
  }, [state.kind]);

  // APPROVE_PUBLISH is a "no-op" in the reducer — the page owns the simulated
  // publish delay and fires PUBLISH_COMPLETE after ~1.5s. To make that flow
  // work without racing, we catch the click by wrapping dispatch locally.
  const wrappedDispatch = (action: Action) => {
    if (action.type === "APPROVE_PUBLISH" && state.kind === "publishing") {
      // Dispatch a harmless state-preserving action to keep the reducer
      // contract honest, then schedule completion.
      dispatch(action);
      const focus = state.focus;
      setTimeout(() => {
        dispatch({ type: "PUBLISH_COMPLETE", receipt: buildReceipt(focus) });
      }, 1500);
      return;
    }
    dispatch(action);
  };

  return (
    <div className="flex flex-col gap-10">
      <FlowIndicator current={state.kind} />
      <SignalStrip cards={signalSnapshot.data.cards} />

      {state.kind === "published" ? (
        <ReceiptChip
          receipt={state.receipt}
          onDismiss={() => dispatch({ type: "DISMISS" })}
        />
      ) : (
        <FocusCard state={state} dispatch={wrappedDispatch} />
      )}

      <Divider />

      <QuietList
        label="Six other movements this week"
        items={quietMovements}
      />

      <p
        className="italic mt-4"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-footer)",
          color: "var(--color-ink-tertiary)",
        }}
      >
        nothing else needs attention today.
      </p>
    </div>
  );
}

export default function OperatorConsoleView() {
  return (
    <Suspense fallback={null}>
      <OperatorConsole />
    </Suspense>
  );
}
