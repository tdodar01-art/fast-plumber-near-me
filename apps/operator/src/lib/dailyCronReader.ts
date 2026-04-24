/**
 * Live reader for today's 6 AM `daily-scrape.yml` run.
 *
 * Pulls three things from GitHub REST API (public, unauthenticated — repo
 * is public and Next.js `fetch` caches for 5 min so we stay well under the
 * 60 req/hr limit):
 *
 *   1. Latest `Daily Plumber Scrape` workflow run on `main`
 *   2. That run's job steps (status + timing)
 *   3. The head commit (message, sha, files changed)
 *
 * Maps GitHub step names onto our 7-step catalog in `cronSteps.ts`. Any
 * steps outside the catalog (setup, scoring, cleanup) are ignored — the
 * operator console only surfaces the intake chain.
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
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
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

function buildStepBlocks(
  stepId: string,
  description: string,
  ghStep: GhJobStep,
  runUrl: string,
  commit: GhCommit | null,
): StepDetailBlock[] {
  const blocks: StepDetailBlock[] = [
    { kind: "paragraph", text: description },
  ];

  const facts: Array<{ label: string; value: string }> = [];
  if (ghStep.started_at) {
    facts.push({
      label: "Started",
      value: new Date(ghStep.started_at).toISOString(),
    });
  }
  if (ghStep.started_at && ghStep.completed_at) {
    facts.push({
      label: "Duration",
      value: `${durationSeconds(ghStep.started_at, ghStep.completed_at)}s`,
    });
  }
  facts.push({ label: "GitHub step", value: ghStep.name });
  facts.push({
    label: "Conclusion",
    value: ghStep.conclusion ?? ghStep.status,
  });
  facts.push({ label: "Workflow run", value: runUrl });
  blocks.push({ kind: "facts", rows: facts });

  // Only the commit-push step gets the file list and commit message.
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

  return blocks;
}

function stepSummary(
  stepId: string,
  ghStep: GhJobStep,
  commit: GhCommit | null,
): string {
  if (ghStep.conclusion === "skipped") return "Skipped for today's run.";
  if (ghStep.conclusion === "failure") return "Step failed — see run logs.";
  if (ghStep.conclusion === "cancelled") return "Cancelled mid-run.";
  if (ghStep.status !== "completed") return "Still running.";

  // Minimal per-step success blurbs. Real numbers live in logs; we stay
  // honest by describing what the step does rather than fabricating counts.
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
    const base: CronStep = {
      id: def.id,
      name: def.name,
      status: ghStepToStatus(ghStep),
      summary: stepSummary(def.id, ghStep, commit),
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
