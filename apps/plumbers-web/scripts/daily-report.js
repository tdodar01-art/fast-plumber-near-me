#!/usr/bin/env node
/**
 * Daily activity report for Fast Plumber Near Me.
 *
 * Runs every morning (GitHub Actions cron, see .github/workflows/daily-report.yml)
 * AFTER daily-scrape + deep-review-pull + any human-triggered synthesis have
 * had time to finish. Reads the pipelineRuns log + Firestore queue depths,
 * composes an HTML email, sends via Brevo.
 *
 * Five activity classes the email surfaces (matching how Tim thinks about
 * the pipeline):
 *   1. SCRAPE              — daily-scrape.js, outscraper-reviews.js,
 *                            refresh-reviews.ts (everything that brings new
 *                            review data into the system)
 *   2. LEVEL 1 SYNTHESIS   — score-plumbers Pass 1 + synth/writeback (Claude
 *                            generates per-plumber summary + dimension scores
 *                            + cited evidence)
 *   3. LEVEL 2 SYNTHESIS   — score-plumbers Pass 3 (decision-engine produces
 *                            verdict, best_for, hire_if, etc.)
 *   4. CITY PAGE REORG     — score-plumbers Pass 2 (per-city ranking refresh
 *                            changes the order plumbers appear on city pages)
 *   5. PUBLISH             — export-firestore-to-json + request-indexing
 *                            (what actually went live)
 *
 * Five queues the email reports current depth on:
 *   A. SCRAPE              — cities discovered (GSC stub or seed) but not yet
 *                            scraped (no plumbers cached)
 *   B. DEEP-REVIEW          — plumbers eligible for an Outscraper pull
 *                            (gscTier medium/high, lastOutscraperPull stale or
 *                            missing)
 *   C. L1 SYNTHESIS        — plumbers needing canonical re-synthesis
 *                            (pendingRescoreSince OR scores.method not in the
 *                            canonical "cited" set OR missing summary)
 *   D. CITY PAGE REORG     — plumbers whose scores are newer than their
 *                            city_rank (Pass 2 hasn't caught up)
 *   E. L2 DECISION         — plumbers whose scores are newer than their
 *                            decision.decided_at (Pass 3 hasn't caught up)
 *
 * Usage:
 *   node scripts/daily-report.js [--window-hours 24] [--dry-run] [--to email]
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { sendBrevoEmail, escapeHtml } = require("./lib/brevo");
const { COLLECTIONS } = require("./config/plumbing-directory.cjs");

// Canonical scoring methods — anything else needs L1 re-synth.
const CANONICAL_METHODS = new Set([
  "claude-code-local-v3-cited",
  "unified-sonnet-v4-cited",
]);

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs() {
  const a = process.argv.slice(2);
  const getVal = (flag) => {
    const i = a.indexOf(flag);
    return i >= 0 && i + 1 < a.length ? a[i + 1] : null;
  };
  return {
    windowHours: Number(getVal("--window-hours")) || 24,
    dryRun: a.includes("--dry-run"),
    to: getVal("--to") || process.env.REPORT_TO_EMAIL,
  };
}

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

function initFirebase() {
  if (admin.apps.length) return admin.firestore();

  const saPath = path.join(__dirname, "..", "service-account.json");
  if (fs.existsSync(saPath)) {
    const sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // GitHub Actions path — secret holds the JSON inline.
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    console.error("ERROR: no Firebase credentials (service-account.json, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_SERVICE_ACCOUNT_JSON)");
    process.exit(1);
  }
  return admin.firestore();
}

// ---------------------------------------------------------------------------
// Activity classification
// ---------------------------------------------------------------------------

function classifyActivity(run) {
  const script = String(run.script || "").toLowerCase();
  const phase = String(run.phase || "").toLowerCase();

  if (script === "daily-scrape" || script === "outscraper-reviews" || script === "refresh-reviews" || script === "bbb-lookup") {
    return "scrape";
  }
  if (script === "synth-writeback" || (script === "score-plumbers" && (phase === "score" || phase === "" || phase === "pass1"))) {
    return "l1_synth";
  }
  if (script === "score-plumbers" && (phase === "decide" || phase === "pass3")) {
    return "l2_synth";
  }
  if (script === "score-plumbers" && (phase === "rank" || phase === "pass2")) {
    return "city_reorg";
  }
  if (script === "export-json" || script === "request-indexing") {
    return "publish";
  }
  return "other";
}

function activityLabel(kind) {
  return {
    scrape: "Scrape",
    l1_synth: "Level 1 synthesis",
    l2_synth: "Level 2 synthesis (decision)",
    city_reorg: "City page reorg (rank)",
    publish: "Publish",
    other: "Other",
  }[kind] || kind;
}

function shortSummary(run) {
  const s = run.summary || {};
  const parts = [];
  // Pull whichever fields are present — different scripts use different keys.
  if (typeof s.plumbersAdded === "number") parts.push(`+${s.plumbersAdded} plumbers`);
  if (typeof s.plumbersUpdated === "number" && s.plumbersUpdated > 0) parts.push(`${s.plumbersUpdated} updated`);
  if (typeof s.citiesScraped === "number") parts.push(`${s.citiesScraped} cities`);
  if (typeof s.newReviewsCached === "number") parts.push(`+${s.newReviewsCached} reviews`);
  if (typeof s.newReviews === "number") parts.push(`+${s.newReviews} reviews`);
  if (typeof s.plumbersRefreshed === "number") parts.push(`${s.plumbersRefreshed} refreshed`);
  if (typeof s.plumbersProcessed === "number") parts.push(`${s.plumbersProcessed} processed`);
  if (typeof s.urlsRequested === "number") parts.push(`${s.urlsRequested} URLs requested`);
  if (typeof s.indexingSubmitted === "number") parts.push(`${s.indexingSubmitted} indexed`);
  if (typeof s.scored === "number") parts.push(`${s.scored} scored`);
  if (typeof s.ranked === "number") parts.push(`${s.ranked} ranked`);
  if (typeof s.decided === "number") parts.push(`${s.decided} decided`);
  if (typeof s.citiesAffected === "number") parts.push(`${s.citiesAffected} cities affected`);
  if (Array.isArray(s.citySlugs) && s.citySlugs.length > 0) parts.push(`cities: ${s.citySlugs.slice(0, 4).join(", ")}${s.citySlugs.length > 4 ? "…" : ""}`);
  if (s.pass) parts.push(`pass=${s.pass}`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Pipeline runs (last N hours)
// ---------------------------------------------------------------------------

async function loadRecentRuns(db, windowHours) {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const snap = await db.collection("pipelineRuns")
    .where("startedAt", ">=", admin.firestore.Timestamp.fromDate(since))
    .orderBy("startedAt", "desc")
    .limit(500)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      script: data.script,
      phase: data.phase,
      status: data.status,
      startedAt: data.startedAt?.toDate?.() || null,
      completedAt: data.completedAt?.toDate?.() || null,
      durationSeconds: data.durationSeconds,
      summary: data.summary || {},
      error: data.error || null,
      triggeredBy: data.triggeredBy,
      kind: classifyActivity(data),
    };
  });
}

// ---------------------------------------------------------------------------
// Queue depths
// ---------------------------------------------------------------------------

async function measureQueues(db) {
  const queues = {
    scrape: { label: "A. Scrape queue", count: 0, note: "" },
    deep_review: { label: "B. Deep-review queue", count: 0, note: "" },
    l1_synth: { label: "C. Level 1 synthesis queue", count: 0, note: "" },
    city_reorg: { label: "D. City page reorg queue", count: 0, note: "" },
    l2_decision: { label: "E. Level 2 decision queue", count: 0, note: "" },
  };

  // Read plumbers + cities collections in parallel.
  const [bizSnap, cityFromGsc, cityScraped] = await Promise.all([
    db.collection(COLLECTIONS.businesses).get(),
    db.collection(COLLECTIONS.cities).where("gscTier", "in", ["medium", "high", "low"]).get(),
    db.collection(COLLECTIONS.cities).where("scraped", "==", true).get(),
  ]);

  // A. Scrape queue = cities with gscTier set OR seeded BUT not yet scraped.
  const scrapedCitySlugs = new Set(cityScraped.docs.map((d) => d.id));
  let scrapeQueueCount = 0;
  for (const d of cityFromGsc.docs) {
    if (!scrapedCitySlugs.has(d.id)) scrapeQueueCount++;
  }
  queues.scrape.count = scrapeQueueCount;
  queues.scrape.note = `${cityFromGsc.size} GSC-tagged cities; ${scrapedCitySlugs.size} already scraped`;

  // For business-keyed queues, walk once.
  let dpEligible = 0;
  let l1Needed = 0;
  let cityRankStale = 0;
  let decisionStale = 0;
  let totalBiz = 0;

  const now = Date.now();
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

  for (const doc of bizSnap.docs) {
    const data = doc.data();
    if (data.isActive === false) continue;
    totalBiz++;

    const scores = data.scores || {};
    const scoredAt = scores.last_scored_at ? Date.parse(scores.last_scored_at) : 0;
    const rs = data.reviewSynthesis || {};

    // B. Deep-review eligible: gscTier signal (need to peek city collection) or
    // simpler proxy: lastOutscraperPull missing or > 60 days, and the plumber
    // has Google reviews suggesting more data could be pulled.
    const lastOutscraperMs = data.lastOutscraperPull?.toMillis?.() || 0;
    if ((data.googleReviewCount || 0) >= 20 &&
        (!lastOutscraperMs || now - lastOutscraperMs > SIXTY_DAYS_MS)) {
      dpEligible++;
    }

    // C. L1 synth queue: pendingRescoreSince OR scores.method not canonical OR no summary.
    const hasPending = !!data.pendingRescoreSince;
    const methodOk = CANONICAL_METHODS.has(scores.method);
    const hasSummary = typeof rs.summary === "string" && rs.summary.trim().length > 0;
    if (hasPending || !methodOk || !hasSummary) l1Needed++;

    // D. City page reorg queue: scores newer than city_rank's freshness.
    // city_rank doesn't store a timestamp per entry; use updatedAt vs scores.
    const cityRank = data.city_rank || {};
    const hasAnyRank = cityRank && Object.keys(cityRank).length > 0;
    if (scoredAt > 0 && !hasAnyRank) cityRankStale++;

    // E. L2 decision queue: scores newer than decision.decided_at.
    const decidedAt = data.decision?.decided_at ? Date.parse(data.decision.decided_at) : 0;
    if (scoredAt > 0 && (!decidedAt || scoredAt > decidedAt)) decisionStale++;
  }

  queues.deep_review.count = dpEligible;
  queues.deep_review.note = `≥20 Google reviews & no/stale Outscraper pull`;
  queues.l1_synth.count = l1Needed;
  queues.l1_synth.note = `not on ${[...CANONICAL_METHODS].join("/")} OR pending rescore`;
  queues.city_reorg.count = cityRankStale;
  queues.city_reorg.note = `scored but no city_rank entries`;
  queues.l2_decision.count = decisionStale;
  queues.l2_decision.note = `scores newer than decision.decided_at`;

  // Total city count = union of GSC-tagged and scraped sets.
  const cityIds = new Set([
    ...cityFromGsc.docs.map((d) => d.id),
    ...cityScraped.docs.map((d) => d.id),
  ]);
  return { queues, totalActiveBusinesses: totalBiz, totalCities: cityIds.size };
}

// ---------------------------------------------------------------------------
// Build email
// ---------------------------------------------------------------------------

function buildEmail({ runs, queues, totals, windowHours }) {
  // Group runs by kind.
  const byKind = { scrape: [], l1_synth: [], l2_synth: [], city_reorg: [], publish: [], other: [] };
  for (const r of runs) byKind[r.kind].push(r);
  const errors = runs.filter((r) => r.status === "error");

  // Headline counts
  const headline = {
    scrape: byKind.scrape.length,
    l1_synth: byKind.l1_synth.length,
    l2_synth: byKind.l2_synth.length,
    city_reorg: byKind.city_reorg.length,
    publish: byKind.publish.length,
    errors: errors.length,
  };

  const subject = `Fast Plumber daily — ${new Date().toISOString().slice(0, 10)} | ${headline.scrape} scrape · ${headline.l1_synth} L1 · ${headline.l2_synth} L2 · ${headline.city_reorg} reorg · queue: L1=${queues.queues.l1_synth.count}`;

  // HTML body — keep visual style minimal and inbox-safe.
  let html = `<div style="font-family: -apple-system, system-ui, sans-serif; color: #1a202c; max-width: 720px;">`;
  html += `<h2 style="margin-bottom: 4px;">Fast Plumber Near Me — daily activity</h2>`;
  html += `<p style="color:#718096; margin-top:0;">Window: last ${windowHours}h · ${runs.length} pipeline runs total · ${totals.totalActiveBusinesses} active plumbers · ${totals.totalCities} cities tracked</p>`;

  // Headline table
  html += `<h3>Today at a glance</h3>`;
  html += `<table cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">`;
  html += `<tr style="background:#f7fafc;"><th align="left">Activity</th><th align="right">Runs</th></tr>`;
  for (const [k, label] of [
    ["scrape", "Scrape"],
    ["l1_synth", "Level 1 synthesis"],
    ["l2_synth", "Level 2 synthesis (decision)"],
    ["city_reorg", "City page reorg (rank)"],
    ["publish", "Publish (export + indexing)"],
    ["other", "Other"],
  ]) {
    const n = byKind[k]?.length || 0;
    html += `<tr><td>${label}</td><td align="right" style="font-variant-numeric: tabular-nums;">${n}</td></tr>`;
  }
  html += `<tr style="background:#fff5f5; color:#742a2a;"><td><strong>Errors</strong></td><td align="right" style="font-variant-numeric: tabular-nums;"><strong>${errors.length}</strong></td></tr>`;
  html += `</table>`;

  // Queue depths
  html += `<h3>Current queue depths</h3>`;
  html += `<table cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 14px; width: 100%;">`;
  html += `<tr style="background:#f7fafc;"><th align="left">Queue</th><th align="right">Plumbers</th><th align="left">Notes</th></tr>`;
  for (const q of Object.values(queues.queues)) {
    html += `<tr><td>${escapeHtml(q.label)}</td><td align="right" style="font-variant-numeric: tabular-nums;">${q.count.toLocaleString()}</td><td style="color:#718096;">${escapeHtml(q.note)}</td></tr>`;
  }
  html += `</table>`;

  // Errors section (if any)
  if (errors.length > 0) {
    html += `<h3 style="color:#742a2a;">Errors (${errors.length})</h3>`;
    html += `<ul style="font-size: 14px;">`;
    for (const e of errors) {
      html += `<li><strong>${escapeHtml(e.script)}</strong> ${e.phase ? `[${escapeHtml(e.phase)}] ` : ""}— ${escapeHtml(e.error || "(no detail)")}<br><span style="color:#718096; font-size: 12px;">${e.startedAt?.toISOString?.() || ""}</span></li>`;
    }
    html += `</ul>`;
  }

  // Activity log
  html += `<h3>Activity log</h3>`;
  const sectionOrder = ["scrape", "l1_synth", "city_reorg", "l2_synth", "publish", "other"];
  for (const k of sectionOrder) {
    const list = byKind[k];
    if (!list || list.length === 0) continue;
    html += `<h4 style="margin-bottom:4px;">${escapeHtml(activityLabel(k))} <span style="color:#718096; font-weight:normal;">(${list.length})</span></h4>`;
    html += `<table cellpadding="4" cellspacing="0" style="border-collapse: collapse; font-size: 13px; width: 100%; margin-bottom: 12px;">`;
    html += `<tr style="background:#f7fafc;"><th align="left">When</th><th align="left">Script</th><th align="left">Status</th><th align="left">Summary</th></tr>`;
    for (const r of list) {
      const when = r.startedAt ? r.startedAt.toISOString().replace("T", " ").slice(0, 19) + "Z" : "";
      const statusColor = r.status === "error" ? "#c53030" : r.status === "partial" ? "#dd6b20" : "#2f855a";
      html += `<tr>`;
      html += `<td style="color:#4a5568; white-space:nowrap;">${escapeHtml(when)}</td>`;
      html += `<td>${escapeHtml(r.script)}${r.phase ? ` <span style="color:#718096;">[${escapeHtml(r.phase)}]</span>` : ""}</td>`;
      html += `<td style="color:${statusColor};">${escapeHtml(r.status || "?")}</td>`;
      html += `<td style="color:#4a5568;">${escapeHtml(shortSummary(r))}</td>`;
      html += `</tr>`;
    }
    html += `</table>`;
  }

  if (runs.length === 0) {
    html += `<p style="color:#a0aec0; font-style: italic;">No pipeline runs in the last ${windowHours}h — everything is quiet (or no automation ran today).</p>`;
  }

  html += `<hr style="margin: 24px 0; border:none; border-top: 1px solid #e2e8f0;">`;
  html += `<p style="color:#a0aec0; font-size: 12px;">Sent by scripts/daily-report.js · Source: pipelineRuns Firestore collection · See ROADMAP.md and CLAUDE.md for the pipeline map.</p>`;
  html += `</div>`;

  // Plain-text version
  const text = [
    `Fast Plumber Near Me — daily activity (last ${windowHours}h)`,
    `${runs.length} pipeline runs · ${totals.totalActiveBusinesses} active plumbers · ${totals.totalCities} cities tracked`,
    ``,
    `Today at a glance:`,
    `  Scrape: ${headline.scrape}`,
    `  Level 1 synthesis: ${headline.l1_synth}`,
    `  Level 2 synthesis (decision): ${headline.l2_synth}`,
    `  City page reorg (rank): ${headline.city_reorg}`,
    `  Publish: ${headline.publish}`,
    `  Errors: ${headline.errors}`,
    ``,
    `Queue depths:`,
    ...Object.values(queues.queues).map((q) => `  ${q.label}: ${q.count.toLocaleString()} (${q.note})`),
    ``,
    errors.length > 0 ? `Errors:` : "",
    ...errors.map((e) => `  ${e.script}${e.phase ? ` [${e.phase}]` : ""}: ${e.error || "(no detail)"}`),
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load .env.local in dev so manual runs work like the daily-scrape locals.
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }

  const args = parseArgs();
  const db = initFirebase();
  const startedAt = new Date();

  console.log(`[daily-report] window=${args.windowHours}h dryRun=${args.dryRun} to=${args.to || "(none)"}`);

  const [runs, queues] = await Promise.all([
    loadRecentRuns(db, args.windowHours),
    measureQueues(db),
  ]);

  const { subject, html, text } = buildEmail({
    runs,
    queues,
    totals: { totalActiveBusinesses: queues.totalActiveBusinesses, totalCities: queues.totalCities },
    windowHours: args.windowHours,
  });

  console.log(`[daily-report] subject: ${subject}`);
  console.log(`[daily-report] activities=${runs.length} queues=${Object.values(queues.queues).reduce((s, q) => s + q.count, 0)}`);

  if (args.dryRun) {
    console.log("\n=== DRY RUN — email body (text) ===\n");
    console.log(text);
    console.log("\n=== END DRY RUN ===\n");
    await admin.app().delete();
    return;
  }

  if (!args.to) {
    console.error("ERROR: no recipient — pass --to or set REPORT_TO_EMAIL");
    process.exit(1);
  }

  const result = await sendBrevoEmail({
    to: [{ email: args.to, name: "Tim" }],
    subject,
    htmlContent: html,
    textContent: text,
  });

  if (!result.ok) {
    console.error(`[daily-report] Brevo send failed: ${result.error}`);
    // Log a pipelineRun error so the next day's report surfaces this failure.
    try {
      await db.collection("pipelineRuns").add({
        script: "daily-report",
        startedAt: admin.firestore.Timestamp.fromDate(startedAt),
        completedAt: admin.firestore.Timestamp.now(),
        durationSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
        status: "error",
        error: result.error,
        summary: { recipient: args.to },
        triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
      });
    } catch { /* swallow */ }
    process.exit(1);
  }

  console.log(`[daily-report] sent — messageId=${result.messageId || "(none)"}`);
  await db.collection("pipelineRuns").add({
    script: "daily-report",
    startedAt: admin.firestore.Timestamp.fromDate(startedAt),
    completedAt: admin.firestore.Timestamp.now(),
    durationSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    status: "success",
    summary: {
      recipient: args.to,
      windowHours: args.windowHours,
      runCount: runs.length,
      queueDepths: Object.fromEntries(Object.entries(queues.queues).map(([k, v]) => [k, v.count])),
      messageId: result.messageId || null,
    },
    triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
  });

  await admin.app().delete();
}

main().catch(async (err) => {
  console.error("[daily-report] FATAL:", err?.stack || err);
  process.exit(1);
});
