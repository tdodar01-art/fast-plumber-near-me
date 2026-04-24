/**
 * Shared types for the operator console.
 *
 * Property-agnostic by design. "plumber" never appears here — it only shows
 * up as a string literal in mock data. Types use "property", "business", and
 * "vertical" instead.
 */

// The envelope wrapping every doc the console reads. Real ingestion writes
// these fields with a firebase-admin Timestamp for `mb_ingested_at`; mock
// data uses an ISO string. Keep the type loose enough to accept both.
export interface MbEnvelope<T> {
  mb_version: 1;
  mb_source: string;
  mb_company: string;
  mb_ingested_at: string;
  data: T;
}

// ---------- Signal snapshot (top-of-page metric strip) ----------

export type DeltaDirection = "up" | "down" | "flat";

export interface SignalCard {
  label: string;
  value: string;
  delta: string;
  direction: DeltaDirection;
}

export interface SignalSnapshotData {
  snapshotDate: string; // ISO date
  cards: SignalCard[];
}

// ---------- Focus queue ----------

export interface RecommendationBlock {
  title: string;
  body: string;
  costPreview: string;
}

export interface FocusItem {
  id: string;
  property: string; // e.g. "plumbers", "handyman", "easy-exit"
  label: string; // "Today's focus"
  headline: string; // serif headline, e.g. "Crystal Lake moved."
  body: string; // prose paragraph — plain text, may include markdown-ish em
  recommendation: RecommendationBlock;
  lastActivityDaysAgo: number;
}

export interface FocusQueueData {
  items: FocusItem[];
}

// ---------- Pull state ----------

export interface SourceCounts {
  google: number;
  yelp: number;
  angi: number;
}

export interface PulledReview {
  id: string;
  source: "google" | "yelp" | "angi";
  rating: number;
  text: string;
  date: string;
  isNew: boolean;
}

// ---------- Receipt (post-publish) ----------

export interface Receipt {
  id: string;
  property: string;
  focusHeadline: string; // e.g. "Crystal Lake · refreshed"
  recordsTouched: number;
  cost: number;
  durationSeconds: number;
  completedAt: string; // ISO timestamp
}

// ---------- Quiet list ----------

export type QuietDelta = number | "held" | "flat" | "new";

export interface QuietMovement {
  city: string;
  query: string;
  position: number;
  delta: QuietDelta;
}

// ---------- Daily cron run (6 AM intake) ----------

export type CronStepStatus = "success" | "warn" | "skip" | "error";

// Structured detail blocks for a cron step detail page. Kept intentionally
// narrow — the live reader in Phase 2 will map daily-result log fields +
// gh-run metadata onto these shapes.
export type StepDetailBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "facts"; rows: Array<{ label: string; value: string }> }
  | { kind: "list"; label?: string; items: string[] }
  | {
      kind: "table";
      columns: string[];
      rows: string[][];
    }
  | { kind: "code"; language?: string; text: string };

export interface CronStep {
  id: string;
  name: string;
  status: CronStepStatus;
  summary: string;
  detail?: string;
  startedAt?: string; // ISO
  durationSeconds?: number;
  blocks?: StepDetailBlock[];
}

export interface DailyCronRun {
  date: string; // YYYY-MM-DD
  startedAt: string; // ISO
  durationSeconds: number;
  commitSha?: string;
  commitMessage?: string;
  steps: CronStep[];
}
