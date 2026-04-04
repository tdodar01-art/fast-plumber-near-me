/**
 * Shared budget guard for all pipeline scripts.
 * Enforces HARD monthly budget limit with per-phase allocation.
 *
 * Budget allocation:
 *   - Expansion (new cities): 60% of remaining
 *   - Review refresh: 30% of remaining
 *   - Reserve: 10% (never touched by automation)
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  type Firestore,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_MONTHLY_BUDGET = 200; // dollars
const HARD_STOP_THRESHOLD = 0.90; // stop at 90% of budget
const COST_PER_1000_TEXT_SEARCH = 32;
const COST_PER_1000_PLACE_DETAILS = 17;

export type BudgetPhase = "expansion" | "refresh" | "reserve";

const PHASE_ALLOCATION: Record<BudgetPhase, number> = {
  expansion: 0.60,
  refresh: 0.30,
  reserve: 0.10,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BudgetStatus {
  monthKey: string;
  totalBudget: number;
  estimatedCost: number;
  totalCalls: number;
  textSearchCalls: number;
  placeDetailsCalls: number;
  hardLimit: number;
  remaining: number;
  percentUsed: number;
  isExhausted: boolean;
  phaseAllocation: Record<BudgetPhase, number>;
  phaseUsed: Record<BudgetPhase, number>;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthlyBudget(): number {
  const envBudget = process.env.MONTHLY_API_BUDGET;
  return envBudget ? parseFloat(envBudget) : DEFAULT_MONTHLY_BUDGET;
}

export async function getBudgetStatus(db: Firestore): Promise<BudgetStatus> {
  const monthKey = getMonthKey();
  const totalBudget = getMonthlyBudget();
  const hardLimit = totalBudget * HARD_STOP_THRESHOLD;

  const docRef = doc(db, "apiUsage", monthKey);
  const snapshot = await getDoc(docRef);
  const data = snapshot.exists() ? snapshot.data() : {};

  const estimatedCost = data.estimatedCost || 0;
  const remaining = Math.max(0, hardLimit - estimatedCost);
  const percentUsed = totalBudget > 0 ? (estimatedCost / totalBudget) * 100 : 0;

  const phaseUsed: Record<BudgetPhase, number> = {
    expansion: data.expansionCost || 0,
    refresh: data.refreshCost || 0,
    reserve: 0,
  };

  const phaseAllocation: Record<BudgetPhase, number> = {
    expansion: remaining * PHASE_ALLOCATION.expansion,
    refresh: remaining * PHASE_ALLOCATION.refresh,
    reserve: remaining * PHASE_ALLOCATION.reserve,
  };

  return {
    monthKey,
    totalBudget,
    estimatedCost,
    totalCalls: data.totalCalls || 0,
    textSearchCalls: data.textSearchCalls || 0,
    placeDetailsCalls: data.placeDetailsCalls || 0,
    hardLimit,
    remaining,
    percentUsed,
    isExhausted: estimatedCost >= hardLimit,
    phaseAllocation,
    phaseUsed,
  };
}

/**
 * Check if a phase has budget remaining. Returns false if exhausted.
 * This is a HARD stop — no exceptions.
 */
export async function canSpend(db: Firestore, phase: BudgetPhase): Promise<boolean> {
  const status = await getBudgetStatus(db);

  // Global hard stop
  if (status.isExhausted) {
    console.log(`[BUDGET] HARD STOP: Monthly budget ${status.percentUsed.toFixed(1)}% used ($${status.estimatedCost.toFixed(2)}/$${status.totalBudget}). No API calls allowed.`);
    return false;
  }

  // Reserve is never available to automation
  if (phase === "reserve") {
    console.log(`[BUDGET] Reserve phase cannot be spent by automation.`);
    return false;
  }

  // Per-phase check
  const phaseLimit = status.remaining * PHASE_ALLOCATION[phase] + status.phaseUsed[phase];
  if (status.phaseUsed[phase] >= phaseLimit) {
    console.log(`[BUDGET] Phase "${phase}" exhausted: $${status.phaseUsed[phase].toFixed(2)} of $${phaseLimit.toFixed(2)} allocated.`);
    return false;
  }

  return true;
}

/**
 * Record API usage for a phase. Enforces hard stop.
 * Returns false if budget is exhausted (call should not have been made).
 */
export async function recordUsage(
  db: Firestore,
  type: "textSearch" | "placeDetails",
  count: number,
  phase: BudgetPhase
): Promise<boolean> {
  const monthKey = getMonthKey();
  const docRef = doc(db, "apiUsage", monthKey);
  const existing = await getDoc(docRef);

  const costPer1000 = type === "textSearch" ? COST_PER_1000_TEXT_SEARCH : COST_PER_1000_PLACE_DETAILS;
  const addedCost = (count / 1000) * costPer1000;

  if (existing.exists()) {
    const data = existing.data();
    const newTotal = (data.estimatedCost || 0) + addedCost;
    const hardLimit = getMonthlyBudget() * HARD_STOP_THRESHOLD;

    await updateDoc(docRef, {
      [`${type}Calls`]: (data[`${type}Calls`] || 0) + count,
      totalCalls: (data.totalCalls || 0) + count,
      estimatedCost: newTotal,
      [`${phase}Cost`]: (data[`${phase}Cost`] || 0) + addedCost,
      lastUpdatedAt: Timestamp.now(),
    });

    return newTotal < hardLimit;
  } else {
    await setDoc(docRef, {
      month: monthKey,
      year: new Date().getFullYear(),
      textSearchCalls: type === "textSearch" ? count : 0,
      placeDetailsCalls: type === "placeDetails" ? count : 0,
      totalCalls: count,
      estimatedCost: addedCost,
      [`${phase}Cost`]: addedCost,
      lastUpdatedAt: Timestamp.now(),
    });
    return true;
  }
}

/**
 * Log budget status to console. Call at start and end of each pipeline run.
 */
export function logBudgetStatus(status: BudgetStatus, label: string): void {
  console.log(`\n[BUDGET] ${label}`);
  console.log(`  Month: ${status.monthKey}`);
  console.log(`  Used: $${status.estimatedCost.toFixed(2)} / $${status.totalBudget} (${status.percentUsed.toFixed(1)}%)`);
  console.log(`  Hard limit: $${status.hardLimit.toFixed(2)} (90%)`);
  console.log(`  Remaining: $${status.remaining.toFixed(2)}`);
  console.log(`  Calls: ${status.totalCalls} (${status.textSearchCalls} text + ${status.placeDetailsCalls} details)`);
  console.log(`  Expansion allocation: $${status.phaseAllocation.expansion.toFixed(2)} (used: $${status.phaseUsed.expansion.toFixed(2)})`);
  console.log(`  Refresh allocation: $${status.phaseAllocation.refresh.toFixed(2)} (used: $${status.phaseUsed.refresh.toFixed(2)})`);
  console.log(`  Reserve: $${status.phaseAllocation.reserve.toFixed(2)} (untouchable)`);
  if (status.isExhausted) {
    console.log(`  ⛔ BUDGET EXHAUSTED — no API calls will be made`);
  }
  console.log();
}
