#!/usr/bin/env node

/**
 * Writeback validated batch results to Firestore. Mirrors score-plumbers.ts
 * Pass 1's exact Firestore field shape so:
 *   - reviewSynthesis.* is consumed by export-firestore-to-json.js
 *   - scores.* is consumed by score-plumbers.ts --pass 2 (rank) + --pass 3 (verdict)
 *
 * Only jobs in status "validated" are written. After write, status → "written".
 *
 * Usage:
 *   node scripts/synth/writeback.js <runDir>             # writes all validated jobs
 *   node scripts/synth/writeback.js <runDir> --dry-run   # logs what would be written
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { COLLECTIONS } = require("../config/plumbing-directory.cjs");
// NOTE: decision-engine.ts cannot be required from plain Node here — it's a TS
// source file and we removed tsx from the local synth pipeline. We re-derive
// the parts we need (badges, emergencyReadiness, pricingTier, bestFor) in
// pure JS in ./lib/derive-fields.js. Cross-platform adjustment is deferred
// to a later pipeline iteration; score-plumbers Pass 2 still ranks correctly
// from the un-adjusted scores we write.
const {
  deriveBadges,
  deriveEmergencyReadiness,
  derivePricingTier,
  approximateVariance,
  computeBestFor,
} = require("./lib/derive-fields");
const { readQueue, markJob } = require("./queue-state");
const { DIMENSION_KEYS, SPECIALTY_KEYS } = require("./lib/synthesis-schema");

const APP_ROOT = path.resolve(__dirname, "..", "..");
const SA_PATH = path.join(APP_ROOT, "service-account.json");

const SYNTHESIS_VERSION = "claude-code-local-v3-cited";

function initDb() {
  if (!fs.existsSync(SA_PATH)) {
    console.error("ERROR: service-account.json not found.");
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

/**
 * Normalize dimension scores: null → 50 (neutral) so downstream math works.
 * Pass 1 does the same (treats missing dims as 50).
 */
function normalizeDimensions(dimensionScores) {
  const out = {};
  for (const k of DIMENSION_KEYS) {
    const v = dimensionScores?.[k];
    out[k] = typeof v === "number" ? v : 50;
  }
  return out;
}

function normalizeSpecialty(specialtyStrength) {
  const out = {};
  for (const k of SPECIALTY_KEYS) {
    const v = specialtyStrength?.[k];
    out[k] = typeof v === "number" ? v : 0;
  }
  return out;
}

/**
 * Build the rawScores object that decision-engine.applyAdjustment expects.
 */
function buildRawScores(result, batchPlumber) {
  const dims = normalizeDimensions(result.dimensionScores);
  const specialty = normalizeSpecialty(result.specialtyStrength);
  const consistency = batchPlumber?.signals?.reviewConsistency;
  return {
    ...dims,
    specialty_strength: specialty,
    variance: approximateVariance(consistency),
  };
}

/**
 * Coerce a claim array to plain string[] regardless of whether the agent
 * emitted the new structured form [{text, supporting_review_ids[]}] or the
 * legacy string[] form. Used to keep `reviewSynthesis.strengths` (and the
 * sibling fields) as the flat shape that the render layer expects.
 */
function flattenClaims(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && typeof item.text === "string") return item.text;
      return null;
    })
    .filter((s) => typeof s === "string" && s.length > 0);
}

/**
 * Produce the structured evidenced form. Prefers the validator-supplied
 * *Evidence array when present (already normalized + id-validated); falls
 * back to deriving from the raw claims array.
 */
function evidencedClaims(evidenceArr, rawArr) {
  if (Array.isArray(evidenceArr) && evidenceArr.length > 0) return evidenceArr;
  if (!Array.isArray(rawArr)) return [];
  return rawArr
    .map((item) => {
      if (typeof item === "string") return { text: item, supporting_review_ids: [] };
      if (item && typeof item === "object" && typeof item.text === "string") {
        return {
          text: item.text,
          supporting_review_ids: Array.isArray(item.supporting_review_ids)
            ? item.supporting_review_ids.filter((x) => typeof x === "string")
            : [],
        };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Match an agent-output quote back to the source batch quote it was drawn from
 * so we can stamp source/publishedAt/author_name onto the EvidenceQuote at
 * write time. The validator already enforces substring overlap between agent
 * output and one of the input quotes — so for any quote that passes
 * validation, exactly one source quote should match. Falls back to returning
 * null when nothing matches; the EvidenceQuote will be written without
 * attribution and surface in the audit pipeline as a legacy un-attributed
 * citation.
 */
function findSourceQuote(agentQuote, batchPlumber) {
  if (!batchPlumber || !Array.isArray(batchPlumber.evidenceQuotes)) return null;
  const agentText = (agentQuote.quote || "").toLowerCase().trim();
  if (!agentText) return null;
  // First try: substring either direction, whichever side is longer
  for (const src of batchPlumber.evidenceQuotes) {
    const srcText = (src.text || "").toLowerCase().trim();
    if (!srcText) continue;
    if (srcText.includes(agentText) || agentText.includes(srcText)) {
      return src;
    }
  }
  // Fallback: first 30 chars overlap
  const head = agentText.slice(0, 30);
  if (head.length < 10) return null;
  for (const src of batchPlumber.evidenceQuotes) {
    const srcText = (src.text || "").toLowerCase().trim();
    if (srcText.includes(head)) return src;
  }
  return null;
}

/**
 * Apply Pass-1-equivalent adjustments + derivations and return the Firestore
 * update payload for one plumber.
 */
function buildUpdatePayload(result, batchPlumber, nowTs) {
  const rawScores = buildRawScores(result, batchPlumber);

  // v1: cross-platform adjustment deferred — write agent's raw scores directly.
  // Pass 2 (rank) reads from `scores.*` exactly the same way regardless.
  const adjusted = rawScores;

  // Derive display fields from adjusted scores.
  const badges = deriveBadges(adjusted, result.redFlags || []);
  const { readiness: emergencyReadiness, signals: emergencySignals } =
    deriveEmergencyReadiness(adjusted, result.emergencyNotes || "");
  const pricingTier = derivePricingTier(adjusted);
  const bestFor = computeBestFor(adjusted);

  // servicesMentioned shape used by service pages
  const servicesMentioned = result.servicesMentioned || {};

  const update = {
    scores: {
      ...adjusted,
      review_text_only: rawScores,
      method: "claude-code-local-v3-cited",
      last_scored_at: new Date().toISOString(),
      review_count_used: batchPlumber.signals?.totalReviewsAnalyzed ?? 0,
    },
    evidence_quotes: (result.evidenceQuotes || []).map((q) => {
      const src = findSourceQuote(q, batchPlumber);
      const out = {
        dimension: q.dimension,
        quote: q.quote,
      };
      // Attribution carried through from the batch input (which carries it
      // through from the Firestore review docs). Source-of-truth attribution
      // — never trust the agent to echo these back. Optional fields: if a
      // match isn't found, omit them rather than fabricating.
      if (src?.source) out.source = src.source;
      if (src?.publishedAt) out.published_at = src.publishedAt;
      if (src?.author_name) out.author_name = src.author_name;
      if (typeof src?.rating === "number") out.rating = src.rating;
      // review_id: preprocessor doesn't currently carry it on evidenceQuotes,
      // but we keep the field stable so downstream consumers can rely on the
      // shape and so an upstream preprocessor change wires through cleanly.
      if (src?.review_id) out.review_id = src.review_id;
      return out;
    }),
    "reviewSynthesis.summary": result.summary,
    // CRITICAL: agents emit strengths/weaknesses/redFlags in the new structured
    // form [{text, supporting_review_ids[]}] OR the legacy string[] form. The
    // validator normalizes in-memory but doesn't persist back to disk, so we
    // re-flatten here before write. Without this the render layer sees object
    // arrays where it expects strings and crashes with "a.toLowerCase is not
    // a function" during Next.js static generation. Found 2026-05-22 after
    // the narsso-construction-and-plumbing Vercel build failure.
    "reviewSynthesis.strengths": flattenClaims(result.strengths),
    "reviewSynthesis.weaknesses": flattenClaims(result.weaknesses),
    "reviewSynthesis.redFlags": flattenClaims(result.redFlags),
    // Structured evidenced forms — derived from result.strengths/weaknesses/redFlags
    // when the agent returned the structured shape, else from result.*Evidence
    // when the validator populated them.
    "reviewSynthesis.strengthsEvidence": evidencedClaims(result.strengthsEvidence, result.strengths),
    "reviewSynthesis.weaknessesEvidence": evidencedClaims(result.weaknessesEvidence, result.weaknesses),
    "reviewSynthesis.redFlagsEvidence": evidencedClaims(result.redFlagsEvidence, result.redFlags),
    "reviewSynthesis.badges": badges,
    "reviewSynthesis.emergencyReadiness": emergencyReadiness,
    "reviewSynthesis.emergencyNotes": result.emergencyNotes,
    "reviewSynthesis.emergencySignals": emergencySignals,
    "reviewSynthesis.pricingTier": pricingTier,
    "reviewSynthesis.bestFor": bestFor,
    "reviewSynthesis.platformDiscrepancy": result.platformDiscrepancy ?? null,
    "reviewSynthesis.reviewCount": batchPlumber.signals?.totalReviewsAnalyzed ?? 0,
    "reviewSynthesis.aiSynthesizedAt": nowTs,
    // synthesizedAt is the freshness field the re-synth selector keys off
    // (generate-batches.js plumberNeedsResynth reads `synthesizedAt ?? aiSynthesizedAt`,
    // preferring synthesizedAt). Writing aiSynthesizedAt alone left the stale
    // pre-cited-form `synthesizedAt` in place, so every run re-selected the same
    // plumbers forever. Write both — export-firestore keys off aiSynthesizedAt.
    "reviewSynthesis.synthesizedAt": nowTs,
    "reviewSynthesis.synthesisVersion": SYNTHESIS_VERSION,
    pendingRescoreSince: admin.firestore.FieldValue.delete(),
    pendingRescoreReason: admin.firestore.FieldValue.delete(),
    updatedAt: nowTs,
  };
  if (Object.keys(servicesMentioned).length > 0) {
    update["reviewSynthesis.servicesMentioned"] = servicesMentioned;
  }
  return update;
}

async function writebackJob(db, runDir, job, opts) {
  const batch = loadJSON(job.batchPath);
  const results = loadJSON(job.resultPath).results;
  const byPlaceId = new Map(batch.plumbers.map((p) => [p.placeId, p]));
  const nowTs = admin.firestore.Timestamp.now();

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    const batchPlumber = byPlaceId.get(r.placeId);
    if (!batchPlumber) {
      console.error(`  ! ${job.jobId}/${r.placeId}: no matching batch plumber, skipping`);
      failed++;
      continue;
    }
    try {
      const payload = buildUpdatePayload(r, batchPlumber, nowTs);
      if (opts.dryRun) {
        console.log(`  [dry-run] ${r.placeId}: ${Object.keys(payload).length} fields, badges=[${(payload["reviewSynthesis.badges"] || []).join(",")}]`);
      } else {
        await db.collection(COLLECTIONS.businesses).doc(r.placeId).update(payload);
      }
      ok++;
    } catch (e) {
      console.error(`  ! ${job.jobId}/${r.placeId}: ${e.message}`);
      failed++;
    }
  }
  if (!opts.dryRun && failed === 0) {
    markJob(runDir, job.jobId, "written", { written: true });
  }
  return { ok, failed };
}

async function main() {
  const argv = process.argv.slice(2);
  const runDir = argv[0];
  const dryRun = argv.includes("--dry-run");
  if (!runDir) {
    console.error("usage: node writeback.js <runDir> [--dry-run] [--no-publish]");
    process.exit(1);
  }

  const db = dryRun ? null : initDb();
  const q = readQueue(runDir);
  const jobs = q.jobs.filter((j) => j.status === "validated");
  if (jobs.length === 0) {
    console.log("No validated jobs to write.");
    return;
  }

  const startedAt = new Date();
  let totalOk = 0;
  let totalFailed = 0;
  const perJob = [];
  for (const job of jobs) {
    console.log(`\nWriting ${job.jobId} (${job.plumberCount} plumbers)${dryRun ? " [dry-run]" : ""}`);
    const r = await writebackJob(db, runDir, job, { dryRun });
    totalOk += r.ok;
    totalFailed += r.failed;
    perJob.push({ jobId: job.jobId, ok: r.ok, failed: r.failed });
  }
  console.log(`\nWriteback: ${totalOk} ok, ${totalFailed} failed across ${jobs.length} jobs`);

  // Log pipelineRun so the daily report surfaces local-synth writeback activity.
  // Without this, manual local-synth runs are invisible to the daily report
  // pipeline (which reads activity from the pipelineRuns collection). Phase
  // "score" matches the daily-report classifier's L1-synth bucket.
  if (!dryRun && db) {
    try {
      await db.collection("pipelineRuns").add({
        script: "synth-writeback",
        phase: "score",
        startedAt: admin.firestore.Timestamp.fromDate(startedAt),
        completedAt: admin.firestore.Timestamp.now(),
        durationSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
        status: totalFailed === 0 ? "success" : totalOk === 0 ? "error" : "partial",
        summary: {
          runDir: runDir.replace(/^.*\/synth-runs\//, "synth-runs/"),
          jobCount: jobs.length,
          plumbersUpdated: totalOk,
          plumbersFailed: totalFailed,
          synthesisVersion: SYNTHESIS_VERSION,
          perJob,
        },
        triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
      });
    } catch (e) {
      console.error("Failed to log pipelineRun for synth-writeback:", e?.message || e);
    }
  }
}

if (require.main === module) {
  main()
    .then(async () => {
      // Post-writeback publish hook: export Firestore → JSON and ping GSC
      // indexing for affected city pages. Mirrors the outscraper-reviews.js
      // pattern so manual local-synth runs don't leave the site updated
      // without telling Google. Without this, the 1,485-plumber backfill
      // on 2026-05-22 published changes to git but never submitted the
      // affected city URLs for re-crawl — Google would have only picked up
      // the changes via sitemap re-discovery (slower).
      //
      // --no-publish: skip this hook so multiple per-wave writebacks in one
      // burn session don't burn the 200/day indexing quota on intermediate
      // states. Operator should run one final publish at the end of the burn
      // (either a writeback without --no-publish, or directly invoke
      // export-firestore-to-json.js + request-indexing.js).
      const dryRun = process.argv.includes("--dry-run");
      const noPublish = process.argv.includes("--no-publish");
      if (noPublish) {
        console.log("[writeback] --no-publish set — skipping post-publish hook");
        process.exit(0);
      }
      try {
        const { publishAfterWriteback } = require("../lib/post-writeback-publish");
        await publishAfterWriteback({ dryRun, label: "synth-writeback" });
      } catch (e) {
        console.error("[writeback] post-publish hook failed:", e?.stack || e);
      }
      process.exit(0);
    })
    .catch((e) => {
      console.error("[writeback] FATAL:", e?.stack || e);
      process.exit(1);
    });
}
