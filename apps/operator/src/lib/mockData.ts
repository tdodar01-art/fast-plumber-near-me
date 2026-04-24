/**
 * Mock data for Phase 1. No external APIs, no Firestore — just statically
 * wrapped docs that match the real `mb_` envelope shape.
 *
 * When Phase 2 wires real readers, these fixtures can be replaced with live
 * data sources without changing component code.
 */

import type {
  FocusItem,
  FocusQueueData,
  MbEnvelope,
  PulledReview,
  QuietMovement,
  Receipt,
  SignalSnapshotData,
  SourceCounts,
} from "./types";

const INGESTED_AT = "2026-04-23T06:00:00.000Z";

function envelope<T>(
  source: string,
  property: string,
  data: T,
): MbEnvelope<T> {
  return {
    mb_version: 1,
    mb_source: source,
    mb_company: property,
    mb_ingested_at: INGESTED_AT,
    data,
  };
}

// ---------- Signal snapshot ----------

export const signalSnapshot: MbEnvelope<SignalSnapshotData> = envelope(
  "gsc_daily_snapshot",
  "plumber",
  {
    snapshotDate: "2026-04-23",
    cards: [
      { label: "Impressions", value: "1,247", delta: "+12%", direction: "up" },
      { label: "Clicks", value: "14", delta: "+3", direction: "up" },
      { label: "Leads", value: "2", delta: "flat", direction: "flat" },
      { label: "Cities moved", value: "6", delta: "7d", direction: "flat" },
    ],
  },
);

// ---------- Focus queue ----------

const crystalLake: FocusItem = {
  id: "focus_crystal_lake_2026_04_23",
  property: "plumber",
  label: "Today's focus",
  headline: "Crystal Lake moved.",
  body:
    'For "emergency plumber crystal lake" you climbed from position 22 to 14 this week — 40 impressions, 2 clicks. Reviews last pulled 52 days ago.',
  recommendation: {
    title: "Recommended",
    body:
      "Refresh reviews via Outscraper, then re-synthesize with local Claude Code.",
    costPreview: "~$1.80 · 3 min · previewed before publish",
  },
  lastActivityDaysAgo: 52,
};

const huntley: FocusItem = {
  id: "focus_huntley_2026_04_23",
  property: "plumber",
  label: "Today's focus",
  headline: "Huntley held position 19.",
  body:
    'Steady on "emergency plumber huntley" with 28 impressions this week. Reviews last pulled 40 days ago. Worth a light refresh to keep data current.',
  recommendation: {
    title: "Recommended",
    body:
      "Refresh reviews via Outscraper, then re-synthesize with local Claude Code.",
    costPreview: "~$1.60 · 3 min · previewed before publish",
  },
  lastActivityDaysAgo: 40,
};

export const focusQueue: MbEnvelope<FocusQueueData> = envelope(
  "mb_focus_queue",
  "plumber",
  {
    items: [crystalLake, huntley],
  },
);

// ---------- Quiet list ----------

export const quietMovements: QuietMovement[] = [
  { city: "Huntley", query: "emergency plumber", position: 19, delta: "held" },
  { city: "Cary", query: "plumber near me", position: 24, delta: -3 },
  {
    city: "Algonquin",
    query: "water heater repair",
    position: 8,
    delta: 2,
  },
  {
    city: "Lake in the Hills",
    query: "drain cleaning",
    position: 31,
    delta: "new",
  },
  { city: "Woodstock", query: "sump pump", position: 16, delta: 4 },
  {
    city: "McHenry",
    query: "emergency plumber",
    position: 12,
    delta: "held",
  },
];

// ---------- Pull progression ----------

export const pullTargets: SourceCounts = { google: 47, yelp: 12, angi: 3 };

export function pullTotal(counts: SourceCounts): number {
  return counts.google + counts.yelp + counts.angi;
}

export const pulledReviewsMock: PulledReview[] = [
  {
    id: "rev_g_1",
    source: "google",
    rating: 5,
    text:
      "Came out at 11pm for a burst pipe. Upfront about the after-hours rate, fixed it clean. Would call again.",
    date: "2026-04-18",
    isNew: true,
  },
  {
    id: "rev_g_2",
    source: "google",
    rating: 2,
    text:
      "Quoted $250 over the phone, billed $480 after. Wouldn't itemize. Won't use again.",
    date: "2026-04-12",
    isNew: true,
  },
  {
    id: "rev_y_1",
    source: "yelp",
    rating: 4,
    text:
      "Fast callback on a Sunday. Not the cheapest but fair for the hour.",
    date: "2026-04-09",
    isNew: true,
  },
  {
    id: "rev_g_3",
    source: "google",
    rating: 5,
    text:
      "Water heater failure on a holiday weekend. They had one in the truck. Impressive.",
    date: "2026-04-07",
    isNew: false,
  },
];

// ---------- Synthesis preview ----------

export const mockSynthesisPrompt =
  "# Synthesis prompt\n\n" +
  "You are refreshing the review synthesis for a business in Crystal Lake, IL.\n" +
  "Read the embedded reviews and produce strengths, weaknesses, red flags,\n" +
  "and two representative quotes. Follow the specificity standard — no generic\n" +
  'phrases like "reliable and professional."\n\n' +
  "<reviews>\n" +
  "[47 Google · 12 Yelp · 3 Angi — embedded here in the real prompt]\n" +
  "</reviews>\n";

export const mockSynthesisPreview =
  "Answers after-hours calls consistently — three reviewers mention 11pm+ dispatches. " +
  "Pricing transparency is the pattern to watch: 2 of 12 reviews describe the final bill " +
  "coming in materially over the phone quote, with no itemization provided on request. " +
  "Strong on water heater swaps (one reviewer notes a holiday-weekend install from the truck).";

// ---------- Receipt ----------

export function buildReceipt(focus: FocusItem): Receipt {
  return {
    id: `receipt_${focus.id}`,
    property: focus.property,
    focusHeadline: `${focus.headline.replace(/\.$/, "")} · refreshed`,
    recordsTouched: 3,
    cost: 1.78,
    durationSeconds: 252,
    completedAt: new Date().toISOString(),
  };
}
