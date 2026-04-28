#!/usr/bin/env node
/**
 * Apply manually-produced synthesis JSON (from parallel Claude subagents)
 * to the Firestore plumbers collection.
 *
 * Reads:  data/raw/synth-batch-*.json    (one per subagent)
 * Writes: plumbers/{placeId} merge:
 *   - scores.{reliability,pricing_fairness,workmanship,responsiveness,
 *             communication,variance,review_count_used,last_scored_at,method}
 *   - evidence_quotes[]
 *   - reviewSynthesis.{summary,strengths,weaknesses,redFlags,emergencyNotes,
 *                      emergencyReadiness,emergencySignals,pricingTier,bestFor,
 *                      platformDiscrepancy,badges,reviewCount,
 *                      aiSynthesizedAt,synthesisVersion,servicesMentioned}
 *
 * synthesisVersion = "manual-claude-v1" (so we can tell these apart from
 * unified-sonnet-v2 in audits).
 *
 * Idempotent: re-running with the same input is safe (writes are merged).
 */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const glob = require("fs").readdirSync;

const SA_PATH = path.join(__dirname, "..", "service-account.json");
const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const BATCH_DIR = path.join(__dirname, "..", "data", "raw");

// ---- Validation ---------------------------------------------------------

const DIM_KEYS = ["reliability", "pricing_fairness", "workmanship", "responsiveness", "communication"];
// Match score-plumbers.ts enum values exactly so frontend rendering is consistent
const READINESS = new Set(["high", "medium", "low", "unknown"]);
const PRICING_TIER = new Set(["budget", "mid-range", "premium", "unknown"]);

function validatePlumber(p, idx, srcFile) {
  const errs = [];
  if (!p.placeId || typeof p.placeId !== "string") errs.push("missing placeId");
  if (!p.scores || typeof p.scores !== "object") errs.push("missing scores");
  else {
    for (const k of DIM_KEYS) {
      const v = p.scores[k];
      if (typeof v !== "number" || v < 0 || v > 100) errs.push(`scores.${k} out of [0,100]`);
    }
    if (typeof p.scores.variance !== "number") errs.push("scores.variance not number");
  }
  if (!p.reviewSynthesis || typeof p.reviewSynthesis !== "object") errs.push("missing reviewSynthesis");
  else {
    const s = p.reviewSynthesis;
    if (typeof s.summary !== "string" || s.summary.length < 30) errs.push("reviewSynthesis.summary too short");
    if (!Array.isArray(s.strengths)) errs.push("strengths not array");
    if (!Array.isArray(s.weaknesses)) errs.push("weaknesses not array");
    if (!Array.isArray(s.redFlags)) errs.push("redFlags not array");
    if (s.emergencyReadiness && !READINESS.has(s.emergencyReadiness)) errs.push(`bad emergencyReadiness=${s.emergencyReadiness}`);
    if (s.pricingTier && !PRICING_TIER.has(s.pricingTier)) errs.push(`bad pricingTier=${s.pricingTier}`);
  }
  if (errs.length) {
    return { ok: false, msg: `[${srcFile} #${idx} ${p.placeId || "?"}] ${errs.join("; ")}` };
  }
  return { ok: true };
}

// ---- Apply --------------------------------------------------------------

async function applyOne(p) {
  const now = admin.firestore.Timestamp.now();
  const update = {
    scores: {
      ...p.scores,
      // Pass 3 (computeBestFor) walks scores.specialty_strength[key]; without
      // this, it crashes on undefined access. Subagents don't produce it, so
      // we set an empty object as a safe default. Future enhancement: have
      // subagents emit per-specialty scores and merge here.
      specialty_strength: p.scores.specialty_strength ?? {},
      last_scored_at: new Date().toISOString(),
      method: "manual-claude",
    },
    "reviewSynthesis.summary": p.reviewSynthesis.summary,
    "reviewSynthesis.strengths": p.reviewSynthesis.strengths || [],
    "reviewSynthesis.weaknesses": p.reviewSynthesis.weaknesses || [],
    "reviewSynthesis.redFlags": p.reviewSynthesis.redFlags || [],
    "reviewSynthesis.badges": p.reviewSynthesis.badges || [],
    "reviewSynthesis.emergencyReadiness": p.reviewSynthesis.emergencyReadiness || "unknown",
    "reviewSynthesis.emergencyNotes": p.reviewSynthesis.emergencyNotes || "",
    "reviewSynthesis.emergencySignals": p.reviewSynthesis.emergencySignals || [],
    "reviewSynthesis.pricingTier": p.reviewSynthesis.pricingTier || "unknown",
    "reviewSynthesis.bestFor": p.reviewSynthesis.bestFor || [],
    "reviewSynthesis.platformDiscrepancy": p.reviewSynthesis.platformDiscrepancy || null,
    "reviewSynthesis.reviewCount": p.reviewSynthesis.reviewCount || 0,
    "reviewSynthesis.aiSynthesizedAt": now,
    "reviewSynthesis.synthesisVersion": "manual-claude-v1",
    updatedAt: now,
  };
  if (p.evidence_quotes) update.evidence_quotes = p.evidence_quotes;
  if (p.reviewSynthesis.servicesMentioned && Object.keys(p.reviewSynthesis.servicesMentioned).length > 0) {
    update["reviewSynthesis.servicesMentioned"] = p.reviewSynthesis.servicesMentioned;
  }

  // Mirror to legacy `synthesis.summary` so the operator console queue picks
  // up the change without waiting for the next plumbers-synthesized.json export.
  update["synthesis.summary"] = p.reviewSynthesis.summary;

  await db.collection("plumbers").doc(p.placeId).update(update);
}

async function main() {
  const files = glob(BATCH_DIR)
    .filter((f) => /^synth-batch-.*\.json$/.test(f))
    .map((f) => path.join(BATCH_DIR, f));
  if (files.length === 0) {
    console.error(`No synth-batch-*.json found in ${BATCH_DIR}`);
    process.exit(1);
  }
  console.log(`Found ${files.length} batch files:`);
  files.forEach((f) => console.log(`  ${path.basename(f)}`));

  const all = [];
  const errors = [];
  for (const f of files) {
    let arr;
    try {
      arr = JSON.parse(fs.readFileSync(f, "utf-8"));
    } catch (e) {
      errors.push(`[${path.basename(f)}] parse error: ${e.message}`);
      continue;
    }
    if (!Array.isArray(arr)) {
      errors.push(`[${path.basename(f)}] not an array`);
      continue;
    }
    arr.forEach((p, i) => {
      const v = validatePlumber(p, i, path.basename(f));
      if (!v.ok) errors.push(v.msg);
      else all.push(p);
    });
  }

  if (errors.length) {
    console.error(`\nValidation errors (${errors.length}):`);
    errors.forEach((e) => console.error("  ✗ " + e));
    if (all.length === 0) {
      console.error("\nNo valid plumbers to apply. Aborting.");
      process.exit(1);
    }
    console.error(`\nApplying ${all.length} valid plumbers anyway. Failed entries can be re-run.`);
  }

  // Deduplicate by placeId (last write wins if two batches have the same)
  const byId = new Map();
  for (const p of all) byId.set(p.placeId, p);
  const unique = [...byId.values()];

  console.log(`\nApplying ${unique.length} unique plumbers to Firestore…`);
  let ok = 0, fail = 0;
  for (const p of unique) {
    try {
      await applyOne(p);
      ok++;
      if (ok % 10 === 0) console.log(`  applied ${ok}/${unique.length}`);
    } catch (e) {
      fail++;
      console.error(`  ✗ ${p.placeId}: ${e.message}`);
    }
  }
  console.log(`\nDone. ${ok} applied, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
