/**
 * Live reader for today's 6 AM `daily-scrape.yml` run.
 *
 * Pulls four things from GitHub REST API (public, unauthenticated — repo
 * is public and Next.js `fetch` caches for 5 min so we stay well under the
 * 60 req/hr limit):
 *
 *   1. Latest scheduled `Daily Plumber Scrape` run on `main`
 *   2. That run's job steps (status + timing)
 *   3. The scrape commit the run produced
 *   4. The job's plain-text log, sliced per step and regex-extracted into
 *      structured facts (plumber counts, city names, API spend, etc.)
 *
 * Returns `null` on any failure; callers fall back to the static mock.
 */

import type {
  CronStep,
  CronStepStatus,
  DailyCronRun,
  StepDetailBlock,
} from "./types";
import { CRON_STEPS, getStepIdByGhName } from "./cronSteps";

const REPO = "tdodar01-art/fast-plumber-near-me";
const WORKFLOW_FILE = "daily-scrape.yml";
const REVALIDATE_SECONDS = 300;

// Public endpoints (workflow runs, jobs, commits) work unauthenticated but
// are rate-limited to 60 req/hr per IP. `/actions/jobs/{id}/logs` requires
// auth even for public repos. Seed apps/operator/.env.local with:
//   GITHUB_TOKEN=$(gh auth token)
// to enable log parsing. Without it, per-step summaries fall back to
// generic blurbs but everything else (status, timing, commit) still works.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function authHeaders(): HeadersInit {
  const base: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) base.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return base;
}

interface GhWorkflowRun {
  id: number;
  head_sha: string;
  run_started_at: string;
  updated_at: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}

interface GhJobStep {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "skipped" | "cancelled" | null;
  started_at: string | null;
  completed_at: string | null;
}

interface GhJob {
  id: number;
  name: string;
  steps: GhJobStep[];
}

interface GhCommitFile {
  filename: string;
}

interface GhCommit {
  sha: string;
  commit: { message: string };
  author?: { login: string } | null;
  files: GhCommitFile[];
}

async function gh<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: authHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function ghText(path: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: authHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function ghStepToStatus(step: GhJobStep): CronStepStatus {
  if (step.status === "completed") {
    switch (step.conclusion) {
      case "success":
        return "success";
      case "skipped":
        return "skip";
      case "cancelled":
        return "skip";
      case "failure":
        return "error";
      default:
        return "warn";
    }
  }
  return "warn";
}

function durationSeconds(startIso: string, endIso: string): number {
  return Math.max(
    0,
    Math.round(
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000,
    ),
  );
}

// ---------- Log parsing ----------

interface LogLine {
  time: number; // ms since epoch
  text: string;
}

interface ParsedStepData {
  summary?: string;
  detail?: string;
  extraBlocks?: StepDetailBlock[];
}

const ANSI = /\x1b\[[0-9;]*m/g;

function parseLogLines(raw: string): LogLine[] {
  const out: LogLine[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s(.*)$/);
    if (!m) continue;
    out.push({
      time: new Date(m[1]).getTime(),
      text: m[2].replace(ANSI, "").trimEnd(),
    });
  }
  return out;
}

// GitHub step timestamps are second-granular and slightly lie about where
// logs land (scripts run inside `bash -c` blocks that can finish a few
// hundred ms after the reported `completed_at`). The workflow emits
// `=== STAGE: X START ===` markers we can key off of for clean boundaries.
// Stage markers map to our stepIds; city-coverage has no echo and needs
// its own full-log scan in the parser.
const STAGE_MARKERS: Record<string, string> = {
  "gsc-expansion": "GSC EXPANSION",
  "gsc-prepend": "GSC PREPEND",
  "daily-scrape": "SCRAPE",
  "upload-firestore": "UPLOAD",
  "rebuild-json": "EXPORT",
  "commit-push": "COMMIT",
  "request-indexing": "INDEXING",
};

// US state abbreviation → lowercase slug used in fastplumbernearme.com URLs
// (`/emergency-plumbers/<state>/<city>`). Matches the reverse of
// STATE_SLUG_TO_ABBR in scripts/gsc-expansion.js.
const STATE_ABBR_TO_SLUG: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi",
  MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada",
  NH: "new-hampshire", NJ: "new-jersey", NM: "new-mexico", NY: "new-york",
  NC: "north-carolina", ND: "north-dakota", OH: "ohio", OK: "oklahoma",
  OR: "oregon", PA: "pennsylvania", RI: "rhode-island", SC: "south-carolina",
  SD: "south-dakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont",
  VA: "virginia", WA: "washington", WV: "west-virginia", WI: "wisconsin",
  WY: "wyoming", DC: "district-of-columbia",
};

function citySlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cityPageUrl(cityName: string, stateAbbr: string): string | null {
  const stateSlug = STATE_ABBR_TO_SLUG[stateAbbr.toUpperCase()];
  if (!stateSlug) return null;
  return `https://www.fastplumbernearme.com/emergency-plumbers/${stateSlug}/${citySlug(cityName)}`;
}

function linesByStage(lines: LogLine[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let current: string | null = null;
  let bucket: string[] = [];
  const markerRe = /===\s*STAGE:\s*(.+?)\s*START\s*===/;
  for (const l of lines) {
    const m = l.text.match(markerRe);
    if (m) {
      if (current) result.set(current, bucket);
      current = m[1].trim();
      bucket = [];
      continue;
    }
    if (current) bucket.push(l.text);
  }
  if (current) result.set(current, bucket);
  return result;
}

function linesBetween(
  lines: LogLine[],
  startIso: string | null,
  endIso: string | null,
): string[] {
  if (!startIso || !endIso) return [];
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime() + 1000;
  return lines
    .filter((l) => l.time >= start && l.time < end)
    .map((l) => l.text);
}

function parseGscExpansion(lines: string[]): ParsedStepData {
  const tierRe = /^\s*✓\s+([a-z0-9-]+):\s+gscTier="(\w+)"\s+\(wrote "\w+",\s*(\d+)\s+impr\)/;
  type Row = { slug: string; tier: string; impr: number };
  const rows: Row[] = [];
  let parsed: number | undefined;
  for (const t of lines) {
    const m = t.match(tierRe);
    if (m) rows.push({ slug: m[1], tier: m[2], impr: Number(m[3]) });
    const p = t.match(/Parsed (\d+) unique city pages from GSC data/);
    if (p) parsed = Number(p[1]);
  }

  if (rows.length === 0 && parsed === undefined) return {};

  const tierCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.tier] = (acc[r.tier] ?? 0) + 1;
    return acc;
  }, {});

  const summaryParts: string[] = [];
  if (rows.length > 0) {
    summaryParts.push(`${rows.length} city tier${rows.length === 1 ? "" : "s"} updated`);
    const tierBits = Object.entries(tierCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tier, n]) => `${n} ${tier}`);
    if (tierBits.length > 0) summaryParts.push(`(${tierBits.join(" · ")})`);
  }
  const summary = summaryParts.join(" ");

  const topRows = rows
    .slice()
    .sort((a, b) => b.impr - a.impr)
    .slice(0, 8);
  const extraBlocks: StepDetailBlock[] = [];
  if (parsed !== undefined) {
    extraBlocks.push({
      kind: "facts",
      rows: [
        { label: "Cities parsed from GSC", value: String(parsed) },
        { label: "City docs updated", value: String(rows.length) },
        ...Object.entries(tierCounts).map(([tier, n]) => ({
          label: `Tier "${tier}"`,
          value: String(n),
        })),
      ],
    });
  }
  if (topRows.length > 0) {
    extraBlocks.push({
      kind: "table",
      columns: ["City slug", "Tier", "Impressions"],
      rows: topRows.map((r) => [r.slug, r.tier, String(r.impr)]),
    });
  }

  const detail =
    topRows.length > 0
      ? `Top: ${topRows
          .slice(0, 3)
          .map((r) => `${r.slug} (${r.impr})`)
          .join(", ")}`
      : undefined;

  return { summary: summary || undefined, detail, extraBlocks };
}

function parseGscPrepend(lines: string[]): ParsedStepData {
  const queueMatch = lines
    .map((t) => t.match(/Prepended (\d+) cit(?:y|ies)/))
    .find((m): m is RegExpMatchArray => !!m);
  if (queueMatch) {
    return { summary: `${queueMatch[1]} cities prepended to scrape queue.` };
  }
  // Look for per-city geocode outputs. If none, treat as empty run.
  const geocodeLines = lines.filter((t) =>
    t.match(/^\s*(?:✓|•|→|\+)\s+.+?\s+(?:via|→|at)\s+/i),
  );
  if (geocodeLines.length > 0) {
    return {
      summary: `${geocodeLines.length} cit${geocodeLines.length === 1 ? "y" : "ies"} geocoded.`,
    };
  }
  return { summary: "No new cities to prepend." };
}

function parseDailyScrape(lines: string[]): ParsedStepData {
  type CityRow = {
    city: string;
    state: string | null;
    newCount: number;
    deduped: number;
    apiCalls: number;
  };
  const cityRows: CityRow[] = [];
  let currentCity: string | null = null;
  let currentState: string | null = null;
  let apiCallsTotal: number | undefined;
  let queueRemaining: number | undefined;
  let totalPlumbers: number | undefined;
  let todayBudget: number | undefined;
  let todaysCities: string | undefined;

  for (const raw of lines) {
    const t = raw.replace(/^\[\d{4}-\d{2}-\d{2}T[^\]]+\]\s*/, "");
    const scrapingMatch = t.match(/^Scraping:\s+(.+?)\s*(?:\(|$)/);
    if (scrapingMatch) {
      // "Baltimore, MD" → city="Baltimore", state="MD"
      const withState = scrapingMatch[1].trim().match(/^(.+?),\s*([A-Z]{2})\b/);
      if (withState) {
        currentCity = withState[1].trim();
        currentState = withState[2];
      } else {
        currentCity = scrapingMatch[1].trim();
        currentState = null;
      }
      continue;
    }
    const resultMatch = t.match(/^\s*\+(\d+)\s+new,\s+(\d+)\s+deduped,\s+(\d+)\s+API calls/);
    if (resultMatch && currentCity) {
      cityRows.push({
        city: currentCity,
        state: currentState,
        newCount: Number(resultMatch[1]),
        deduped: Number(resultMatch[2]),
        apiCalls: Number(resultMatch[3]),
      });
      currentCity = null;
      currentState = null;
      continue;
    }
    const apiTotal = t.match(/^\s*API calls:\s+(\d+)\s*$/);
    if (apiTotal) apiCallsTotal = Number(apiTotal[1]);
    const queue = t.match(/^\s*Queue remaining:\s+(\d+)\s+cities/);
    if (queue) queueRemaining = Number(queue[1]);
    const rawSaved = t.match(/Raw data saved:\s+(\d+)\s+total plumbers/);
    if (rawSaved) totalPlumbers = Number(rawSaved[1]);
    const budget = t.match(/Today's budget:\s+(\d+)\s+API calls/);
    if (budget) todayBudget = Number(budget[1]);
    const cities = t.match(/Today's cities:\s+(.+?)\s+\(est/);
    if (cities) todaysCities = cities[1];
  }

  if (cityRows.length === 0 && apiCallsTotal === undefined) return {};

  const totalNew = cityRows.reduce((sum, r) => sum + r.newCount, 0);
  const cityList = cityRows.map((r) => r.city).join(", ");
  const summary =
    totalNew > 0
      ? `${totalNew} new plumber${totalNew === 1 ? "" : "s"} across ${cityRows.length} cit${cityRows.length === 1 ? "y" : "ies"}${cityList ? `: ${cityList}` : ""}.`
      : "Scrape ran; no new plumbers this cycle.";

  const extraBlocks: StepDetailBlock[] = [];
  if (cityRows.length > 0) {
    extraBlocks.push({
      kind: "table",
      columns: ["City", "New", "Deduped", "API calls"],
      rows: cityRows.map((r) => [
        r.state ? `${r.city}, ${r.state}` : r.city,
        String(r.newCount),
        String(r.deduped),
        String(r.apiCalls),
      ]),
    });

    // Clickable city pages so the operator can verify the plumbers we
    // just added are rendering live on fastplumbernearme.com. Only
    // cities that got at least one new plumber today — skip no-op scrapes.
    const linkRows = cityRows
      .filter((r) => r.newCount > 0 && r.state)
      .map((r) => {
        const href = cityPageUrl(r.city, r.state as string);
        return href
          ? {
              href,
              label: `${r.city}, ${r.state}`,
              hint: `+${r.newCount} new`,
            }
          : null;
      })
      .filter((x): x is { href: string; label: string; hint: string } => !!x);
    if (linkRows.length > 0) {
      extraBlocks.push({
        kind: "links",
        label: "Verify on fastplumbernearme.com",
        items: linkRows,
      });
    }
  }
  const facts: Array<{ label: string; value: string }> = [];
  if (apiCallsTotal !== undefined) {
    facts.push({ label: "API calls (total)", value: String(apiCallsTotal) });
  }
  if (todayBudget !== undefined) {
    facts.push({
      label: "Today's budget",
      value: `${todayBudget} API calls`,
    });
  }
  if (queueRemaining !== undefined) {
    facts.push({
      label: "Queue remaining",
      value: `${queueRemaining} cities`,
    });
  }
  if (totalPlumbers !== undefined) {
    facts.push({ label: "Raw plumbers saved", value: String(totalPlumbers) });
  }
  if (todaysCities) {
    facts.push({ label: "Today's cities", value: todaysCities });
  }
  if (facts.length > 0) extraBlocks.push({ kind: "facts", rows: facts });

  const detail =
    apiCallsTotal !== undefined
      ? `${apiCallsTotal} API call${apiCallsTotal === 1 ? "" : "s"}${queueRemaining !== undefined ? ` · ${queueRemaining} cities remaining in queue` : ""}`
      : undefined;

  return { summary, detail, extraBlocks };
}

function parseUpload(lines: string[]): ParsedStepData {
  let updated: number | undefined;
  let complete = false;
  for (const t of lines) {
    const m = t.match(/^\s*Updated:\s+(\d+)/);
    if (m) updated = Number(m[1]);
    if (t.includes("Firestore upload complete")) complete = true;
  }
  if (updated === undefined && !complete) return {};
  const summary =
    updated !== undefined
      ? `${updated} plumber doc${updated === 1 ? "" : "s"} upserted to Firestore.`
      : "Firestore upload complete.";
  const extraBlocks: StepDetailBlock[] =
    updated !== undefined
      ? [
          {
            kind: "facts",
            rows: [{ label: "Docs updated", value: String(updated) }],
          },
        ]
      : [];
  return { summary, extraBlocks };
}

function parseRebuildJson(lines: string[]): ParsedStepData {
  let firestorePlumbers: number | undefined;
  let firestoreReviews: number | undefined;
  let jsonPlumbers: number | undefined;
  const newPlumbers: string[] = [];
  let updated = 0;
  for (const t of lines) {
    const totals = t.match(
      /Firestore:\s+(\d+)\s+plumbers,\s+(\d+)\s+reviews\s+\|\s+JSON:\s+(\d+)\s+plumbers/,
    );
    if (totals) {
      firestorePlumbers = Number(totals[1]);
      firestoreReviews = Number(totals[2]);
      jsonPlumbers = Number(totals[3]);
      continue;
    }
    const neu = t.match(/^\s*\+\s+(.+?)\s+\(new — not in JSON\)/);
    if (neu) {
      newPlumbers.push(neu[1]);
      continue;
    }
    if (/^\s*↻\s+.+\(/.test(t)) updated += 1;
  }
  if (firestorePlumbers === undefined && newPlumbers.length === 0 && updated === 0) {
    return {};
  }
  const parts: string[] = [];
  if (firestorePlumbers !== undefined) {
    parts.push(
      `${firestorePlumbers} plumbers · ${firestoreReviews?.toLocaleString() ?? "?"} reviews in Firestore`,
    );
  }
  if (updated > 0) {
    parts.push(`${updated} updated`);
  }
  if (newPlumbers.length > 0) {
    parts.push(`${newPlumbers.length} new in JSON`);
  }
  const summary = parts.join(" · ") + ".";

  const extraBlocks: StepDetailBlock[] = [];
  const facts: Array<{ label: string; value: string }> = [];
  if (firestorePlumbers !== undefined) {
    facts.push({
      label: "Firestore plumbers",
      value: String(firestorePlumbers),
    });
  }
  if (firestoreReviews !== undefined) {
    facts.push({
      label: "Firestore reviews",
      value: firestoreReviews.toLocaleString(),
    });
  }
  if (jsonPlumbers !== undefined) {
    facts.push({ label: "JSON plumbers (before)", value: String(jsonPlumbers) });
  }
  facts.push({ label: "JSON rows updated", value: String(updated) });
  facts.push({ label: "New to JSON", value: String(newPlumbers.length) });
  if (facts.length > 0) extraBlocks.push({ kind: "facts", rows: facts });

  if (newPlumbers.length > 0) {
    extraBlocks.push({
      kind: "list",
      label: "New plumbers added to JSON",
      items: newPlumbers.slice(0, 25),
    });
  }
  return { summary, extraBlocks };
}

function parseRequestIndexing(lines: string[]): ParsedStepData {
  let sitemapSubmitted = false;
  let quotaUsed: number | undefined;
  let quotaTotal: number | undefined;
  let quotaRemaining: number | undefined;
  const submittedUrls: string[] = [];

  for (const t of lines) {
    if (t.match(/Sitemap submitted successfully/i)) sitemapSubmitted = true;
    const reqMatch = t.match(/Requesting indexing for:\s+(.+)$/);
    if (reqMatch) {
      submittedUrls.push(
        ...reqMatch[1]
          .split(/\s+/)
          .map((u) => u.trim())
          .filter(Boolean),
      );
    }
    const indexedMatch = t.match(/^\s*✓\s+(\/[^\s]+)\s+(?:submitted|indexed)/i);
    if (indexedMatch) submittedUrls.push(indexedMatch[1]);
    const quotaMatch = t.match(
      /Daily quota:\s+(\d+)\/(\d+)\s+used,\s+(\d+)\s+remaining/,
    );
    if (quotaMatch) {
      quotaUsed = Number(quotaMatch[1]);
      quotaTotal = Number(quotaMatch[2]);
      quotaRemaining = Number(quotaMatch[3]);
    }
  }

  // Dedupe URLs (the script may log them twice — once in the bash echo,
  // once when actually submitting).
  const uniqueUrls = Array.from(new Set(submittedUrls));

  if (!sitemapSubmitted && uniqueUrls.length === 0 && quotaUsed === undefined) {
    return {};
  }

  const summaryParts: string[] = [];
  if (sitemapSubmitted) summaryParts.push("sitemap submitted");
  if (uniqueUrls.length > 0) {
    summaryParts.push(
      `${uniqueUrls.length} URL${uniqueUrls.length === 1 ? "" : "s"} pinged for re-crawl`,
    );
  }
  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ") + "."
      : "Indexing step ran.";

  const extraBlocks: StepDetailBlock[] = [];
  const facts: Array<{ label: string; value: string }> = [];
  facts.push({
    label: "Sitemap",
    value: sitemapSubmitted ? "submitted" : "—",
  });
  facts.push({ label: "URLs pinged", value: String(uniqueUrls.length) });
  if (quotaUsed !== undefined && quotaTotal !== undefined) {
    facts.push({
      label: "Daily quota",
      value: `${quotaUsed} / ${quotaTotal} used (${quotaRemaining ?? quotaTotal - quotaUsed} left)`,
    });
  }
  extraBlocks.push({ kind: "facts", rows: facts });

  if (uniqueUrls.length > 0) {
    extraBlocks.push({
      kind: "links",
      label: "URLs submitted to Google for re-crawl",
      items: uniqueUrls.map((path) => ({
        href: `https://www.fastplumbernearme.com${path}`,
        label: path,
      })),
    });
  }

  const detail =
    quotaUsed !== undefined && quotaTotal !== undefined
      ? `Indexing API: ${quotaUsed}/${quotaTotal} used today`
      : undefined;

  return { summary, detail, extraBlocks };
}

function parseCityCoverage(lines: string[], allLines?: string[]): ParsedStepData {
  // City-coverage has no `=== STAGE: X START ===` echo in the workflow, so
  // if the time-window slice missed the output line (step ran in <1s), fall
  // back to scanning the whole log.
  const scope = lines.length > 0 ? lines : (allLines ?? []);
  for (const t of scope) {
    const m = t.match(/City coverage:\s+(\d+)\s+cities with data\s+\((\d+)\s+plumbers\)/);
    if (m) {
      const cities = Number(m[1]);
      const plumbers = Number(m[2]);
      return {
        summary: `${cities} cities × service combos now in sitemap coverage (${plumbers} plumbers total).`,
        extraBlocks: [
          {
            kind: "facts",
            rows: [
              { label: "Cities with data", value: String(cities) },
              { label: "Plumbers total", value: String(plumbers) },
            ],
          },
        ],
      };
    }
  }
  return {};
}

function parseStepFromLog(
  stepId: string,
  stepLines: string[],
  allLines?: string[],
): ParsedStepData {
  switch (stepId) {
    case "gsc-expansion":
      return parseGscExpansion(stepLines);
    case "gsc-prepend":
      return parseGscPrepend(stepLines);
    case "daily-scrape":
      return parseDailyScrape(stepLines);
    case "upload-firestore":
      return parseUpload(stepLines);
    case "rebuild-json":
      return parseRebuildJson(stepLines);
    case "city-coverage":
      return parseCityCoverage(stepLines, allLines);
    case "request-indexing":
      return parseRequestIndexing(stepLines);
    default:
      return {};
  }
}

// ---------- Block building ----------

function buildStepBlocks(
  stepId: string,
  description: string,
  ghStep: GhJobStep,
  runUrl: string,
  commit: GhCommit | null,
  parsed: ParsedStepData,
): StepDetailBlock[] {
  const blocks: StepDetailBlock[] = [
    { kind: "paragraph", text: description },
  ];

  if (parsed.extraBlocks && parsed.extraBlocks.length > 0) {
    blocks.push(...parsed.extraBlocks);
  }

  const facts: Array<{ label: string; value: string }> = [];
  if (ghStep.started_at && ghStep.completed_at) {
    facts.push({
      label: "Duration",
      value: `${durationSeconds(ghStep.started_at, ghStep.completed_at)}s`,
    });
  }
  facts.push({
    label: "Conclusion",
    value: ghStep.conclusion ?? ghStep.status,
  });
  facts.push({ label: "GitHub step", value: ghStep.name });
  blocks.push({ kind: "facts", rows: facts });

  if (stepId === "commit-push" && commit) {
    blocks.push({
      kind: "facts",
      rows: [
        { label: "Commit SHA", value: commit.sha.slice(0, 7) },
        { label: "Message", value: commit.commit.message.split("\n")[0] },
        { label: "Files changed", value: String(commit.files.length) },
      ],
    });
    if (commit.files.length > 0) {
      blocks.push({
        kind: "list",
        label: "Files in this commit",
        items: commit.files.map((f) => f.filename),
      });
    }
  }

  blocks.push({
    kind: "facts",
    rows: [{ label: "Workflow run", value: runUrl }],
  });

  return blocks;
}

function stepSummary(
  stepId: string,
  ghStep: GhJobStep,
  commit: GhCommit | null,
  parsed: ParsedStepData,
): string {
  if (ghStep.conclusion === "skipped") return "Skipped for today's run.";
  if (ghStep.conclusion === "failure") return "Step failed — see run logs.";
  if (ghStep.conclusion === "cancelled") return "Cancelled mid-run.";
  if (ghStep.status !== "completed") return "Still running.";
  if (parsed.summary) return parsed.summary;

  switch (stepId) {
    case "gsc-expansion":
      return "Pulled 90-day GSC data and queued any new cities with impressions.";
    case "gsc-prepend":
      return "Geocoded queued cities and prepended them to the scrape queue.";
    case "daily-scrape":
      return "Scraped queued cities via Google Places (New).";
    case "upload-firestore":
      return "Upserted scraped plumbers into Firestore.";
    case "rebuild-json":
      return "Regenerated plumbers-synthesized.json + leaderboard.json.";
    case "city-coverage":
      return "Rebuilt sitemap coverage map from fresh JSON.";
    case "request-indexing":
      return "Pinged Google Indexing API for updated city pages.";
    case "commit-push":
      return commit
        ? `Pushed ${commit.files.length} file${commit.files.length === 1 ? "" : "s"} to main — Vercel rebuild triggered.`
        : "Pushed to main — Vercel rebuild triggered.";
    default:
      return "Completed.";
  }
}

export async function loadTodayCronRun(): Promise<DailyCronRun | null> {
  // Scheduled runs are "the 6 AM cron" the page is named for. Manual
  // workflow_dispatch and cancelled-and-superseded runs are filtered out
  // by scoping to event=schedule.
  const runsResp = await gh<{ workflow_runs: GhWorkflowRun[] }>(
    `/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?branch=main&event=schedule&per_page=1`,
  );
  const run = runsResp?.workflow_runs?.[0];
  if (!run) return null;

  const jobsResp = await gh<{ jobs: GhJob[] }>(
    `/repos/${REPO}/actions/runs/${run.id}/jobs`,
  );
  const job = jobsResp?.jobs?.[0];
  if (!job) return null;

  // The run's `head_sha` is the commit that was HEAD when the schedule
  // fired (i.e. yesterday's rebuild-json). The commit the run *produced*
  // is the first github-actions[bot] commit on main after the run
  // started. GitHub's `author` query param doesn't match `[bot]` logins,
  // so filter the list ourselves.
  const producedList = await gh<GhCommit[]>(
    `/repos/${REPO}/commits?sha=main&since=${encodeURIComponent(run.run_started_at)}&per_page=10`,
  );
  const botCommitSha = producedList
    ?.reverse()
    .find((c) => c.author?.login === "github-actions[bot]")?.sha;
  const commit = botCommitSha
    ? await gh<GhCommit>(`/repos/${REPO}/commits/${botCommitSha}`)
    : await gh<GhCommit>(`/repos/${REPO}/commits/${run.head_sha}`);

  // Fetch plain-text job log once. Used to slice per-step lines and
  // regex out structured facts (plumber counts, city names, API spend,
  // etc). Runs older than ~90 days may return 410 — we degrade gracefully
  // to generic summaries.
  const rawLog = await ghText(
    `/repos/${REPO}/actions/jobs/${job.id}/logs`,
  );
  const logLines = rawLog ? parseLogLines(rawLog) : [];
  const stageBuckets = rawLog ? linesByStage(logLines) : new Map();
  const allLineTexts = logLines.map((l) => l.text);

  // Group GitHub steps by our stepId. Ignore any step that doesn't map.
  const byStepId = new Map<string, GhJobStep>();
  for (const ghStep of job.steps) {
    const id = getStepIdByGhName(ghStep.name);
    if (id && !byStepId.has(id)) {
      byStepId.set(id, ghStep);
    }
  }

  const steps: CronStep[] = CRON_STEPS.map((def) => {
    const ghStep = byStepId.get(def.id);
    if (!ghStep) {
      return {
        id: def.id,
        name: def.name,
        status: "skip" as CronStepStatus,
        summary: "Not present in this run's workflow definition.",
        blocks: [{ kind: "paragraph", text: def.description }],
      };
    }
    // Prefer stage-marker slicing (clean boundaries emitted by the
    // workflow). Fall back to the time window when this step has no
    // stage echo (city-coverage).
    const markerKey = STAGE_MARKERS[def.id];
    const stepLines = markerKey
      ? (stageBuckets.get(markerKey) ?? [])
      : linesBetween(logLines, ghStep.started_at, ghStep.completed_at);
    const parsed = parseStepFromLog(def.id, stepLines, allLineTexts);
    const base: CronStep = {
      id: def.id,
      name: def.name,
      status: ghStepToStatus(ghStep),
      summary: stepSummary(def.id, ghStep, commit, parsed),
      detail: parsed.detail,
      startedAt: ghStep.started_at ?? undefined,
      durationSeconds:
        ghStep.started_at && ghStep.completed_at
          ? durationSeconds(ghStep.started_at, ghStep.completed_at)
          : undefined,
      blocks: buildStepBlocks(
        def.id,
        def.description,
        ghStep,
        run.html_url,
        commit,
        parsed,
      ),
    };
    return base;
  });

  const startedAt = run.run_started_at;
  const lastStepEnd = steps
    .map((s) =>
      s.startedAt && s.durationSeconds !== undefined
        ? new Date(s.startedAt).getTime() + s.durationSeconds * 1000
        : 0,
    )
    .reduce((a, b) => Math.max(a, b), 0);
  const totalDuration =
    lastStepEnd > 0
      ? Math.round((lastStepEnd - new Date(startedAt).getTime()) / 1000)
      : durationSeconds(startedAt, run.updated_at);

  return {
    date: startedAt.slice(0, 10),
    startedAt,
    durationSeconds: totalDuration,
    commitSha: commit?.sha.slice(0, 7),
    commitMessage: commit?.commit.message.split("\n")[0],
    steps,
  };
}

export function getCronStepFromRun(
  run: DailyCronRun,
  id: string,
): CronStep | undefined {
  return run.steps.find((s) => s.id === id);
}
