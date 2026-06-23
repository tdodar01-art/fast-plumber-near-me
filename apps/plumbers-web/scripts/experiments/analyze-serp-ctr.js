#!/usr/bin/env node
/**
 * exp-003 — analyze the SERP title/description CTR test and email the report.
 *
 * Reads per-page daily GSC metrics from experiment_metrics/plumbers/{slug}/{date}
 * (written by publishMetrics.ts), joins each page to its arm from the committed
 * snapshot, and answers: which title+description STRUCTURE wins on CTR, controlling
 * for ranking position?
 *
 * Method: each slug-day's clicks/impressions are attributed to the position bin
 * the page ranked in THAT day, so CTR is compared within position bands (1-3,
 * 4-6, 7-10, 11-20, 21+) — isolating copy effect from position. Treatment arms
 * are compared to control with a two-proportion z-test.
 *
 * Usage:
 *   node scripts/experiments/analyze-serp-ctr.js                 # email tim@aokchemdry.net
 *   node scripts/experiments/analyze-serp-ctr.js --to a@b.com    # override recipient
 *   node scripts/experiments/analyze-serp-ctr.js --dry-run       # print, don't send
 *   node scripts/experiments/analyze-serp-ctr.js --start 2026-06-04 --end 2026-10-04
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { sendBrevoEmail, escapeHtml } = require("../lib/brevo");
const { SITE_ORIGIN_WITH_WWW } = require("../config/plumbing-directory.cjs");

const APP_ROOT = path.join(__dirname, "..", "..");
const SA_PATH = path.join(APP_ROOT, "service-account.json");
const SNAPSHOT_PATH = path.join(APP_ROOT, "data", "experiments", "exp-003-eligible-slugs.json");
const ENV_PATH = path.join(APP_ROOT, ".env.local");
const DEFAULT_TO = "tim@aokchemdry.net";

const ARM_LABELS = {
  control: "Control (Rated & Reviewed)",
  urgency: "Urgency (24/7, Fast & Local)",
  social_proof: "Social proof (Top-Rated, Reviewed)",
};
const POSITION_BINS = [
  { key: "1-3", lo: 0.5, hi: 3.5 },
  { key: "4-6", lo: 3.5, hi: 6.5 },
  { key: "7-10", lo: 6.5, hi: 10.5 },
  { key: "11-20", lo: 10.5, hi: 20.5 },
  { key: "21+", lo: 20.5, hi: Infinity },
];

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}

function binFor(position) {
  for (const b of POSITION_BINS) if (position > b.lo && position <= b.hi) return b.key;
  return "21+";
}

// Two-proportion z-test: treatment CTR vs control CTR. Returns {z, p, sig}.
function zTest(cT, iT, cC, iC) {
  if (iT < 1 || iC < 1) return { z: 0, p: 1, sig: false };
  const pT = cT / iT, pC = cC / iC;
  const pPool = (cT + cC) / (iT + iC);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / iT + 1 / iC));
  if (se === 0) return { z: 0, p: 1, sig: false };
  const z = (pT - pC) / se;
  // two-sided p via normal CDF approximation (Abramowitz & Stegun 7.1.26)
  const az = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * az);
  const d = 0.3989423 * Math.exp(-az * az / 2);
  const p2 = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const p = 2 * p2; // two-sided
  return { z, p, sig: p < 0.05 };
}

function pct(n) { return (n * 100).toFixed(2) + "%"; }

async function main() {
  loadEnv();
  const to = arg("--to", DEFAULT_TO);
  const dryRun = process.argv.includes("--dry-run");

  const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));
  const assignment = snap.assignment; // slug -> arm
  const arms = snap.arms;
  // Experiment window (NOT snap.window, which is the GSC-pull window used to
  // pick eligible pages). Data only exists from deploy/go-live onward anyway.
  const startDate = arg("--start", "2026-06-04");
  const endDate = arg("--end", "2026-10-04");

  if (!fs.existsSync(SA_PATH)) throw new Error("service-account.json not found");

  // Pull GSC directly for the full window — settled data, in one shot. This
  // avoids depending on 30 daily metric docs each capturing settled data (GSC
  // lags ~2-3 days, so per-day docs written for "yesterday" are unreliable).
  // dimensions [page, date] so each page-day's clicks/impressions can be
  // attributed to the position the page held THAT day (position-controlled CTR).
  const credentials = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const siteUrl = process.env.GSC_SITE_URL || `${SITE_ORIGIN_WITH_WWW}/`;

  const resp = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: { startDate, endDate, dimensions: ["page", "date"], rowLimit: 25000, type: "web" },
  });
  const rows = resp.data.rows || [];

  // Accumulators
  const overall = {};   // arm -> {impr, clicks, posWeighted, pages:Set, days}
  const byBin = {};     // bin -> arm -> {impr, clicks}
  for (const a of arms) {
    overall[a] = { impr: 0, clicks: 0, posWeighted: 0, pages: new Set(), days: 0 };
  }
  for (const b of POSITION_BINS) { byBin[b.key] = {}; for (const a of arms) byBin[b.key][a] = { impr: 0, clicks: 0 }; }

  const cityRe = /\/emergency-plumbers\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/;
  let docsRead = 0;
  for (const r of rows) {
    const m = (r.keys?.[0] || "").match(cityRe);
    if (!m) continue;
    const slug = `${m[1]}/${m[2]}`;
    const arm = assignment[slug];
    if (!arm) continue;
    const impr = r.impressions || 0, clicks = r.clicks || 0, pos = r.position || 0;
    docsRead++;
    if (impr <= 0) continue;
    overall[arm].impr += impr;
    overall[arm].clicks += clicks;
    overall[arm].posWeighted += pos * impr;
    overall[arm].pages.add(slug);
    overall[arm].days++;
    const bk = binFor(pos);
    byBin[bk][arm].impr += impr;
    byBin[bk][arm].clicks += clicks;
  }

  const report = buildReport({ snap, arms, startDate, endDate, overall, byBin, docsRead });

  if (dryRun || !process.env.BREVO_API_KEY) {
    console.log(report.text);
    console.log(`\n[analyze] ${dryRun ? "--dry-run" : "BREVO not configured"} — not emailing. (would send to ${to})`);
    return;
  }
  const res = await sendBrevoEmail({ to, subject: report.subject, htmlContent: report.html, textContent: report.text });
  console.log(res.ok ? `[analyze] emailed report to ${to}` : `[analyze] email failed: ${res.error}`);
}

function buildReport({ snap, arms, startDate, endDate, overall, byBin, docsRead }) {
  const ctrl = "control";
  const ctrlImpr = overall[ctrl].impr, ctrlClicks = overall[ctrl].clicks;
  const ctrlCtr = ctrlImpr ? ctrlClicks / ctrlImpr : 0;

  // Overall rows
  const rows = arms.map((a) => {
    const o = overall[a];
    const ctr = o.impr ? o.clicks / o.impr : 0;
    const avgPos = o.impr ? o.posWeighted / o.impr : 0;
    const lift = a === ctrl || ctrlCtr === 0 ? null : (ctr - ctrlCtr) / ctrlCtr;
    const t = a === ctrl ? null : zTest(o.clicks, o.impr, ctrlClicks, ctrlImpr);
    return { arm: a, pages: o.pages.size, impr: o.impr, clicks: o.clicks, ctr, avgPos, lift, t };
  });

  // Winner: highest CTR treatment that is significant vs control; else directional leader.
  const treatments = rows.filter((r) => r.arm !== ctrl);
  const sigWinners = treatments.filter((r) => r.t && r.t.sig && r.ctr > ctrlCtr).sort((x, y) => y.ctr - x.ctr);
  const leader = [...treatments].sort((x, y) => y.ctr - x.ctr)[0];
  let verdict;
  if (sigWinners.length) {
    verdict = `WINNER: ${ARM_LABELS[sigWinners[0].arm]} — CTR ${pct(sigWinners[0].ctr)} vs control ${pct(ctrlCtr)} ` +
      `(+${pct(sigWinners[0].lift)} relative, p=${sigWinners[0].t.p.toFixed(3)}). Adopt this title/description structure.`;
  } else if (leader) {
    verdict = `NO SIGNIFICANT WINNER YET — directional leader is ${ARM_LABELS[leader.arm]} ` +
      `(CTR ${pct(leader.ctr)} vs control ${pct(ctrlCtr)}). Underpowered at this traffic; extend or treat as directional.`;
  } else {
    verdict = "Insufficient data.";
  }

  const days = Math.max(...arms.map((a) => overall[a].days), 0);
  const totalImpr = arms.reduce((s, a) => s + overall[a].impr, 0);

  // ---- text ----
  const L = [];
  L.push(`exp-003 — SERP Title/Description CTR Test`);
  L.push(`Window: ${startDate} → ${endDate}   (${docsRead} slug-days, ${totalImpr} impressions)`);
  L.push(``);
  L.push(verdict);
  L.push(``);
  L.push(`OVERALL (controlling for position via the bins below):`);
  for (const r of rows) {
    L.push(`  ${ARM_LABELS[r.arm].padEnd(36)} pages=${String(r.pages).padStart(2)} impr=${String(r.impr).padStart(6)} ` +
      `clicks=${String(r.clicks).padStart(4)} CTR=${pct(r.ctr).padStart(7)} pos=${r.avgPos.toFixed(1)}` +
      (r.lift != null ? `  lift=${(r.lift * 100).toFixed(1)}% ${r.t.sig ? "(SIG p=" + r.t.p.toFixed(3) + ")" : "(ns)"}` : "  (baseline)"));
  }
  L.push(``);
  L.push(`BY POSITION BIN (CTR per arm; thin cells flagged *):`);
  for (const b of POSITION_BINS) {
    const cells = arms.map((a) => {
      const c = byBin[b.key][a];
      const ctr = c.impr ? c.clicks / c.impr : 0;
      const thin = c.impr < 100 ? "*" : "";
      return `${a}=${pct(ctr)}${thin}(${c.impr})`;
    });
    L.push(`  pos ${b.key.padEnd(5)}: ${cells.join("  ")}`);
  }
  L.push(``);
  L.push(`* cell has <100 impressions — underpowered, read with caution.`);
  const text = L.join("\n");

  // ---- html ----
  const overallTbl = rows.map((r) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(ARM_LABELS[r.arm])}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${r.pages}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${r.impr}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${r.clicks}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right"><b>${pct(r.ctr)}</b></td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${r.avgPos.toFixed(1)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${r.lift != null ? (r.lift * 100).toFixed(1) + "%" : "—"}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${r.t ? (r.t.sig ? "✅ " + r.t.p.toFixed(3) : "ns") : "—"}</td>
    </tr>`).join("");

  const binTbl = POSITION_BINS.map((b) => {
    const cells = arms.map((a) => {
      const c = byBin[b.key][a];
      const ctr = c.impr ? c.clicks / c.impr : 0;
      const thin = c.impr < 100;
      return `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right${thin ? ";color:#999" : ""}">${pct(ctr)}${thin ? "*" : ""}<br><span style="font-size:11px;color:#999">${c.impr} impr</span></td>`;
    }).join("");
    return `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee"><b>pos ${b.key}</b></td>${cells}</tr>`;
  }).join("");

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:760px;color:#1a202c">
    <h2 style="color:#1a365d">exp-003 — SERP Title/Description CTR Test</h2>
    <p style="color:#4a5568">Window <b>${startDate} → ${endDate}</b> · ${docsRead} slug-days · ${totalImpr} impressions · ${days} days of data</p>
    <div style="background:#ebf8ff;border-left:4px solid #1a365d;padding:12px 16px;margin:16px 0;font-size:15px"><b>${escapeHtml(verdict)}</b></div>
    <h3>Overall (controlling for position)</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <tr style="background:#f7fafc;text-align:left"><th style="padding:6px 10px">Arm</th><th style="padding:6px 10px;text-align:right">Pages</th><th style="padding:6px 10px;text-align:right">Impr</th><th style="padding:6px 10px;text-align:right">Clicks</th><th style="padding:6px 10px;text-align:right">CTR</th><th style="padding:6px 10px;text-align:right">Avg pos</th><th style="padding:6px 10px;text-align:right">Lift</th><th style="padding:6px 10px;text-align:center">Sig (p)</th></tr>
      ${overallTbl}
    </table>
    <h3>CTR by position bin</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <tr style="background:#f7fafc;text-align:left"><th style="padding:6px 10px">Position</th>${arms.map((a) => `<th style="padding:6px 10px;text-align:right">${escapeHtml(a)}</th>`).join("")}</tr>
      ${binTbl}
    </table>
    <p style="font-size:12px;color:#999">* cell has &lt;100 impressions — underpowered, read with caution. Comparison vs control via two-proportion z-test (p&lt;0.05 = significant).</p>
    <p style="font-size:12px;color:#999">Round 2 will test the remaining structures (pain/question, speed/response) against this round's winner.</p>
  </div>`;

  const subject = `exp-003 SERP CTR results — ${sigWinners.length ? "winner: " + ARM_LABELS[sigWinners[0].arm] : "directional (no sig winner)"}`;
  return { text, html, subject };
}

main().then(() => process.exit(0)).catch((e) => { console.error("[analyze] FATAL:", e?.stack || e); process.exit(1); });
