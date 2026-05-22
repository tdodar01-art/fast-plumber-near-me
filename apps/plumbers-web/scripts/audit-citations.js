#!/usr/bin/env node
/**
 * One-shot audit script for citation health post-2026-05-22 attribution fix.
 *
 * Reports five reorder/refresh classes:
 *   1. verdict-evidence mismatch — verdict driven by a weak dim that isn't cited
 *   2. mis-ordered citations    — weak dim cited but not surfaced first
 *   3. stale citations          — newest review > 60d after last_scored_at
 *   4. platform-gap without cross-platform cite — discrepancy detected but
 *      every cite is from a single (unattributed) source
 *   5. attribution backfill backlog — cites missing source/date entirely
 *
 * Usage: node scripts/audit-citations.js [--top 20]
 */

const fs = require("fs");
const path = require("path");

const JSON_PATH = path.join(
  __dirname,
  "..",
  "data",
  "synthesized",
  "plumbers-synthesized.json",
);

const top = (() => {
  const i = process.argv.indexOf("--top");
  if (i === -1) return 10;
  const n = parseInt(process.argv[i + 1], 10);
  return Number.isFinite(n) ? n : 10;
})();

const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
const plumbers = data.plumbers || data;

const DIMS = [
  "reliability",
  "pricing_fairness",
  "workmanship",
  "responsiveness",
  "communication",
];

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

function worstDim(scores) {
  let dim = DIMS[0];
  let val = scores[dim] ?? 100;
  for (const d of DIMS) {
    const v = scores[d] ?? 100;
    if (v < val) {
      val = v;
      dim = d;
    }
  }
  return { dim, val };
}

const verdictEvidenceMismatch = [];
const misOrdered = [];
const stale = [];
const platformGapCites = [];
const noAttribution = [];

for (const p of plumbers) {
  const cites = Array.isArray(p.evidence_quotes) ? p.evidence_quotes : [];

  // F1 + F2 require scored dimensions + a verdict
  if (p.scores && p.decision && cites.length > 0) {
    const { dim, val } = worstDim(p.scores);
    const isNegative =
      p.decision.verdict === "caution" || p.decision.verdict === "avoid";
    if (isNegative && val < 65) {
      const hasWorstQuote = cites.some((eq) => eq.dimension === dim);
      if (!hasWorstQuote) {
        verdictEvidenceMismatch.push({
          name: p.name,
          city: p.city,
          state: p.state,
          verdict: p.decision.verdict,
          worstDim: dim,
          worstScore: val,
          dimsQuoted: cites.map((eq) => eq.dimension).join(","),
        });
      } else if (cites[0].dimension !== dim && cites.length >= 2) {
        misOrdered.push({
          name: p.name,
          city: p.city,
          state: p.state,
          verdict: p.decision.verdict,
          worstDim: dim,
          firstDim: cites[0].dimension,
        });
      }
    }
  }

  // F3 staleness
  if (p.scores?.last_scored_at && cites.length > 0) {
    const lastScored = Date.parse(p.scores.last_scored_at);
    if (!Number.isNaN(lastScored)) {
      const reviews = p.reviews || [];
      let newest = 0;
      for (const r of reviews) {
        const t = Date.parse(r.publishedAt || "");
        if (!Number.isNaN(t) && t > newest) newest = t;
      }
      if (reviews.length >= 5 && newest && newest - lastScored > SIXTY_DAYS_MS) {
        stale.push({
          name: p.name,
          city: p.city,
          state: p.state,
          lastScored: p.scores.last_scored_at.slice(0, 10),
          newestReview: new Date(newest).toISOString().slice(0, 10),
          reviewCount: reviews.length,
        });
      }
    }
  }

  // F4 platform gap with single-source / unattributed cites
  if (p.synthesis?.platformDiscrepancy && cites.length > 0) {
    const sources = new Set(cites.map((eq) => eq.source).filter(Boolean));
    if (sources.size <= 1) {
      platformGapCites.push({
        name: p.name,
        city: p.city,
        state: p.state,
        gap: String(p.synthesis.platformDiscrepancy).slice(0, 80),
        googleRating: p.googleRating,
        yelpRating: p.yelpRating,
      });
    }
  }

  // F5 attribution backfill
  if (cites.length > 0) {
    const anyAttributed = cites.some(
      (eq) => eq.source || eq.published_at || eq.review_id,
    );
    if (!anyAttributed) {
      noAttribution.push({
        name: p.name,
        city: p.city,
        state: p.state,
        method: p.scores?.method || "(none)",
        citeCount: cites.length,
      });
    }
  }
}

function print(label, items, fmt) {
  console.log(`\n${label}: ${items.length}`);
  for (const r of items.slice(0, top)) console.log(`  - ${fmt(r)}`);
  if (items.length > top) console.log(`  ... and ${items.length - top} more`);
}

console.log("=== CITATION REORDER / REFRESH AUDIT ===");

print(
  "F1 verdict-evidence mismatch (weak dim drives verdict but isn't cited)",
  verdictEvidenceMismatch,
  (r) =>
    `${r.name} (${r.city}, ${r.state}) — verdict=${r.verdict}, worst=${r.worstDim}(${r.worstScore}), cites=[${r.dimsQuoted}]`,
);
print(
  "F2 mis-ordered (weak dim cited but not first for caution/avoid)",
  misOrdered,
  (r) =>
    `${r.name} (${r.city}, ${r.state}) — verdict=${r.verdict}, worst=${r.worstDim}, first=${r.firstDim}`,
);
print(
  "F3 stale (newest review > 60d after last_scored_at, 5+ reviews)",
  stale,
  (r) =>
    `${r.name} (${r.city}, ${r.state}) — scored ${r.lastScored}, newest review ${r.newestReview} (${r.reviewCount} reviews)`,
);
print(
  "F4 platform-discrepancy plumbers with no cross-platform cite",
  platformGapCites,
  (r) =>
    `${r.name} (${r.city}, ${r.state}) — G:${r.googleRating}/5 Y:${r.yelpRating}/5 — "${r.gap}..."`,
);
print(
  "F5 cites with no attribution at all (need pipeline rerun for backfill)",
  noAttribution,
  (r) =>
    `${r.name} (${r.city}, ${r.state}) — ${r.citeCount} cites, method=${r.method}`,
);

console.log("\n=== SUMMARY ===");
const totalWithCites = plumbers.filter(
  (p) => Array.isArray(p.evidence_quotes) && p.evidence_quotes.length > 0,
).length;
console.log(`Plumbers with any citations:                       ${totalWithCites}`);
console.log(`  F1 verdict-evidence mismatch:                    ${verdictEvidenceMismatch.length}`);
console.log(`  F2 mis-ordered for negative verdict:             ${misOrdered.length}`);
console.log(`  F3 stale (re-score pending):                     ${stale.length}`);
console.log(`  F4 platform gap, no cross-platform cite:         ${platformGapCites.length}`);
console.log(`  F5 attribution backfill needed:                  ${noAttribution.length}`);
