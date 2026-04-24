/**
 * Full 6-state state machine for the FocusCard.
 *
 * idle → pulling → reviewing → synthesizing → publishing → published
 *
 * DISMISS and RESET can fire from most states and return to idle with the
 * next focus item. DEV_FORCE is used by the `?state=<kind>` dev query param.
 */

import type {
  FocusItem,
  PulledReview,
  Receipt,
  SourceCounts,
} from "./types";

export type StateKind =
  | "idle"
  | "pulling"
  | "reviewing"
  | "synthesizing"
  | "publishing"
  | "published";

export type State =
  | { kind: "idle"; focus: FocusItem; queue: FocusItem[] }
  | {
      kind: "pulling";
      focus: FocusItem;
      queue: FocusItem[];
      sources: SourceCounts;
      totalTarget: number;
    }
  | {
      kind: "reviewing";
      focus: FocusItem;
      queue: FocusItem[];
      reviews: PulledReview[];
      sources: SourceCounts;
    }
  | {
      kind: "synthesizing";
      focus: FocusItem;
      queue: FocusItem[];
      reviews: PulledReview[];
      prompt: string;
      pastedOutput: string | null;
    }
  | {
      kind: "publishing";
      focus: FocusItem;
      queue: FocusItem[];
      synthesisPreview: string;
      estimatedCost: number;
    }
  | { kind: "published"; receipt: Receipt; queue: FocusItem[] };

export type Action =
  | { type: "START_PULL" }
  | { type: "PULL_PROGRESS"; sources: SourceCounts }
  | { type: "PULL_COMPLETE"; reviews: PulledReview[] }
  | { type: "APPROVE_REVIEWS"; prompt: string }
  | { type: "PASTE_SYNTHESIS"; output: string }
  | { type: "SUBMIT_SYNTHESIS"; preview: string; estimatedCost: number }
  | { type: "APPROVE_PUBLISH" }
  | { type: "PUBLISH_COMPLETE"; receipt: Receipt }
  | { type: "DISMISS" }
  | { type: "RESET" }
  | { type: "DEV_FORCE"; state: State };

export function initialState(
  queue: FocusItem[],
): Extract<State, { kind: "idle" }> {
  if (queue.length === 0) {
    // Degenerate case — real code will render the "nothing needs attention"
    // footer. For Phase 1 mock data the queue always has items, but guard
    // the type anyway.
    throw new Error("initialState requires a non-empty focus queue");
  }
  const [focus, ...rest] = queue;
  return { kind: "idle", focus, queue: rest };
}

// Pop the next focus from the queue. If the queue is empty, stay in the
// current state (the page footer carries the "nothing else needs attention"
// message).
function advanceQueue(state: State): State {
  const queue = state.queue;
  if (queue.length === 0) {
    if (state.kind === "published") {
      // Preserve the receipt so the operator can still see their last action.
      return state;
    }
    return { kind: "idle", focus: state.focus, queue: [] };
  }
  const [nextFocus, ...rest] = queue;
  return { kind: "idle", focus: nextFocus, queue: rest };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_PULL": {
      if (state.kind !== "idle") return state;
      return {
        kind: "pulling",
        focus: state.focus,
        queue: state.queue,
        sources: { google: 0, yelp: 0, angi: 0 },
        totalTarget: 62,
      };
    }

    case "PULL_PROGRESS": {
      if (state.kind !== "pulling") return state;
      return { ...state, sources: action.sources };
    }

    case "PULL_COMPLETE": {
      if (state.kind !== "pulling") return state;
      return {
        kind: "reviewing",
        focus: state.focus,
        queue: state.queue,
        reviews: action.reviews,
        sources: state.sources,
      };
    }

    case "APPROVE_REVIEWS": {
      if (state.kind !== "reviewing") return state;
      return {
        kind: "synthesizing",
        focus: state.focus,
        queue: state.queue,
        reviews: state.reviews,
        prompt: action.prompt,
        pastedOutput: null,
      };
    }

    case "PASTE_SYNTHESIS": {
      if (state.kind !== "synthesizing") return state;
      return { ...state, pastedOutput: action.output };
    }

    case "SUBMIT_SYNTHESIS": {
      if (state.kind !== "synthesizing") return state;
      return {
        kind: "publishing",
        focus: state.focus,
        queue: state.queue,
        synthesisPreview: action.preview,
        estimatedCost: action.estimatedCost,
      };
    }

    case "APPROVE_PUBLISH": {
      // No-op in the reducer — the page component fires the simulated
      // PUBLISH_COMPLETE after a short delay.
      return state;
    }

    case "PUBLISH_COMPLETE": {
      if (state.kind !== "publishing") return state;
      return {
        kind: "published",
        receipt: action.receipt,
        queue: state.queue,
      };
    }

    case "DISMISS": {
      if (state.kind === "published") {
        // From published: move to the next focus item.
        return advanceQueue(state);
      }
      if (state.kind === "idle") {
        return advanceQueue(state);
      }
      // Any mid-flow state: bail to idle with the same focus (user changed
      // their mind). Real UI would confirm; Phase 1 keeps it simple.
      return { kind: "idle", focus: state.focus, queue: state.queue };
    }

    case "RESET": {
      return advanceQueue(state);
    }

    case "DEV_FORCE": {
      return action.state;
    }

    default: {
      // exhaustive check
      const _never: never = action;
      return _never;
    }
  }
}
