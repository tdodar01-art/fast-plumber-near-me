#!/usr/bin/env node
/**
 * Read-only synth queue report. Loads all plumber docs once and reports:
 *  - The local-synth selection (generate-batches `plumberNeedsResynth`), with
 *    reason breakdown and city grouping (what a run NOW would actually pick up).
 *  - The canonical daily-report queue levels: C/L1 synth, D/rank, E/L2 decision.
 * No writes. No review fetches. Mirrors the logic in generate-batches.js and
 * daily-report.js so the numbers match the morning email.
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { COLLECTIONS } = require("../config/plumbing-directory.cjs");

const APP_ROOT = path.resolve(__dirname, "..", "..");
const SA_PATH = path.join(APP_ROOT, "service-account.json");
const MAX_AGE_DAYS = 30;
const CANONICAL_METHODS = new Set([
  "claude-code-local-v3-cited",
  "unified-sonnet-v4-cited",
]);

function tsToMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v === "string") { const t = Date.parse(v); return Number.isNaN(t) ? 0 : t; }
  if (typeof v === "object" && typeof v._seconds === "number") return v._seconds * 1000;
  return 0;
}
function primaryCity(data) {
  if (Array.isArray(data.serviceCities) && data.serviceCities.length > 0)
    return String(data.serviceCities[0]).toLowerCase();
  const city = data.city || data.address?.city;
  if (city)
    return String(city).toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return null;
}

const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  const now = Date.now();
  const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  const snap = await db.collection(COLLECTIONS.businesses).get();

  let totalActive = 0;
  // local-synth (generate-batches) selection + reasons
  let localSynth = 0, rPending = 0, rOutscrape = 0, rNoSynth = 0, rStale = 0, noReviews = 0;
  const byCity = new Map();
  // canonical daily-report levels
  let l1 = 0, dpEligible = 0, rankStale = 0, decisionStale = 0;
  // method distribution (context)
  const methodCounts = new Map();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.isActive === false) continue;
    totalActive++;

    const scores = data.scores || {};
    const rs = data.reviewSynthesis || {};
    const method = scores.method || "(none)";
    methodCounts.set(method, (methodCounts.get(method) || 0) + 1);

    const grc = data.googleReviewCount || 0;
    const lastPull = tsToMillis(data.lastOutscraperPull);
    const lastSynth = tsToMillis(rs.synthesizedAt ?? rs.aiSynthesizedAt);
    const hasSummary = typeof rs.summary === "string" && rs.summary.trim().length > 0;

    // ---- local-synth selection (generate-batches.js plumberNeedsResynth) ----
    // pendingRescoreSince bypasses the zero-review guard (the run stamps
    // review-less pending plumbers no_reviews and they exit the queue).
    const hasPending = !!data.pendingRescoreSince;
    if (grc === 0 && !hasPending) {
      noReviews++;
    } else {
      let needs = false, reason = null;
      if (hasPending) { needs = true; reason = "pending-rescore"; }
      else if (lastPull > 0 && lastPull > lastSynth) { needs = true; reason = "outscraped-after-synth"; }
      else if (!hasSummary) { needs = true; reason = "no-synth"; }
      else if (lastSynth > 0 && now - lastSynth > maxAgeMs) { needs = true; reason = "stale>30d"; }
      if (needs) {
        localSynth++;
        if (reason === "pending-rescore") rPending++;
        else if (reason === "outscraped-after-synth") rOutscrape++;
        else if (reason === "no-synth") rNoSynth++;
        else if (reason === "stale>30d") rStale++;
        const city = primaryCity(data) || "(no-city)";
        byCity.set(city, (byCity.get(city) || 0) + 1);
      }
    }

    // ---- canonical daily-report levels ----
    const scoredAt = scores.last_scored_at ? Date.parse(scores.last_scored_at) : 0;
    if (grc >= 20 && (!lastPull || now - lastPull > SIXTY_DAYS_MS)) dpEligible++;
    const methodOk = CANONICAL_METHODS.has(scores.method);
    const structurallyPinned = scores.method === "no_reviews" || scores.method === "keyword_fallback";
    if (!structurallyPinned && (hasPending || !methodOk || !hasSummary)) l1++;

    const rankable = scores.method !== "no_reviews" && scores.method !== "keyword_fallback" &&
                     typeof scores.reliability === "number";
    const cityRank = data.city_rank || {};
    const hasAnyRank = cityRank && Object.keys(cityRank).length > 0;
    if (rankable && scoredAt > 0 && !hasAnyRank) rankStale++;
    const decidedAt = data.decision?.decided_at ? Date.parse(data.decision.decided_at) : 0;
    if (rankable && scoredAt > 0 && (!decidedAt || scoredAt > decidedAt)) decisionStale++;
  }

  const pct = (n) => ((n / totalActive) * 100).toFixed(1) + "%";
  console.log("=".repeat(64));
  console.log(`ACTIVE PLUMBERS: ${totalActive}   (skipped isActive:false)`);
  console.log("=".repeat(64));
  console.log("\nLOCAL-SYNTH QUEUE — what `generate-batches.js` would pick up NOW");
  console.log(`  TOTAL needing re-synth:        ${localSynth}  (${pct(localSynth)})`);
  console.log(`    · pending-rescore:           ${rPending}   (explicit flag — new reviews or approved submission)`);
  console.log(`    · outscraped-after-synth:    ${rOutscrape}   (rich Outscraper data arrived since last synth)`);
  console.log(`    · no-synth (has reviews):     ${rNoSynth}   (reviews present, no summary yet)`);
  console.log(`    · stale >${MAX_AGE_DAYS}d:               ${rStale}`);
  console.log(`  (excluded) zero-review plumbers: ${noReviews}  (nothing to synthesize)`);

  console.log("\nCANONICAL QUEUE LEVELS (daily-report definitions)");
  console.log(`  C. L1 synthesis:   ${l1}   (off-canonical method OR pending rescore OR no summary)`);
  console.log(`  D. City rank (P2): ${rankStale}   (scored but no city_rank entries)`);
  console.log(`  E. L2 decision (P3): ${decisionStale}   (scores newer than decision.decided_at)`);
  console.log(`  B. Deep-review:    ${dpEligible}   (≥20 Google reviews & no/stale Outscraper pull)`);

  console.log("\nLOCAL-SYNTH QUEUE BY CITY (top 25)");
  const cities = [...byCity.entries()].sort((a, b) => b[1] - a[1]);
  for (const [c, n] of cities.slice(0, 25)) console.log(`  ${String(n).padStart(4)}  ${c}`);
  console.log(`  ...${cities.length} cities total in the local-synth queue`);

  console.log("\nSCORING METHOD DISTRIBUTION (all active)");
  for (const [m, n] of [...methodCounts.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(4)}  ${m}`);

  // batch math
  const batches = Math.ceil(localSynth / 10);
  console.log(`\nBATCH ESTIMATE: ~${batches} batches @ size 10 (concurrency 8 → ~${Math.ceil(batches / 8)} waves)`);
  process.exit(0);
})().catch((e) => { console.error("FATAL:", e?.stack || e); process.exit(1); });
