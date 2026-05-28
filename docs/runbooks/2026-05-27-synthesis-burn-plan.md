# Synthesis Burn Plan — 2026-05-27 night

**Goal:** drain the L1 (875), L2 (476), and ideally city-reorg (449) queues
using local Claude Code Max quota.

**Pre-reads:** [docs/audits/2026-05-27-synthesis-throughput-audit.md](../audits/2026-05-27-synthesis-throughput-audit.md)

**The orchestrator is *this Claude Code session*.** There is no separate
orchestrator script — the session reads the queue, fans out Agent calls per
batch, validates results, and runs writeback at the end. Tonight's plan only
requires you to invoke the session and approve the prompts.

---

## 0. Pre-flight

Run these in order from `apps/plumbers-web/`:

```bash
cd ~/code/directory-sites/fast-plumber-near-me/apps/plumbers-web

# Sanity: service-account.json present
ls -la service-account.json

# Sanity: no half-finished synth runs hanging around
ls data/synth-runs/

# Confirm queues sized roughly as expected
# (this prints status against the Firestore source of truth — no writes)
node scripts/daily-report.js --dry-run --window-hours 24 | grep -A20 "QUEUES"
```

Expected: L1 ≈ 875, city reorg ≈ 449, L2 decision ≈ 476.

---

## 1. Generate batches for L1

`generate-batches.js` reads Firestore, filters by `plumberNeedsResynth()`,
and emits a runDir with per-batch JSON inputs + a fresh `queue.json`.

```bash
# Generate L1 batches.  Size 10 → ~88 batches for 875 plumbers.
# --concurrency is metadata only; actual concurrency is set in the orchestrator.
node scripts/synth/generate-batches.js \
  --batch-size 10 \
  --max-age-days 30 \
  --concurrency 6 \
  2>generate.log
# Path to runDir is the LAST line of stdout.
RUNDIR=$(tail -1 generate.log.runDir.txt 2>/dev/null || \
         node scripts/synth/generate-batches.js --batch-size 10 --max-age-days 30 | tail -1)

# The recommended way:
RUNDIR=$(node scripts/synth/generate-batches.js --batch-size 10 --max-age-days 30 2>/dev/null | tail -1)
echo "RUNDIR=$RUNDIR"
node scripts/synth/queue-state.js summary "$RUNDIR"
```

You should see:
```
run 2026MMDD-HHMMSS  total=~88  progress=0%
  status counts: {"pending":~88, ...}
  plumber counts: total=~875 written=0 ...
```

If `total` is wildly off (e.g. <50 or >150), STOP — check
`generate.log` for selection issues before proceeding.

---

## 2. Wave 1 — validation batch (10–25 plumbers, ~1-3 batches)

Goal: confirm the pipeline still works end-to-end before scaling up.

In **this Claude Code session**, run:

> "Process the first 2 jobs from `$RUNDIR` using the synth pipeline. For each
> job, mark it `running`, fan out one Agent (general-purpose) call per job
> with the prompt from `node scripts/synth/print-job-prompt.js $RUNDIR <jobId>`,
> wait for both to finish, then run `node scripts/synth/normalize-result-keys.js
> $RUNDIR` and `node scripts/synth/validate-synthesis.js $RUNDIR`. Report
> validation results."

**Manual verification after wave 1:**

```bash
# How many jobs validated?
node scripts/synth/queue-state.js summary "$RUNDIR"

# Spot-check one result file
ls "$RUNDIR/results/"
cat "$RUNDIR/results/$(ls $RUNDIR/results/ | head -1)" | head -60
```

Look for:
- ≥80% of plumbers in that result file validated.
- `summary` reads as specific + punchy, not generic ("3 of 12 reviews mention…").
- `evidenceQuotes[].quote` text appears in the corresponding `batches/*.json`.

If anything looks wrong: STOP. Investigate. Fix prompts or validator before
firing more waves.

---

## 3. Wave 2 — medium wave (50-100 plumbers, 5-10 batches)

Same shape as wave 1, but ask the orchestrator for 6 jobs in parallel.

> "Process the next 6 pending jobs from `$RUNDIR` with concurrency 6. After
> all subagents return, run normalize + validate. Do NOT run writeback yet."

After wave 2: re-check summary, spot-check 2-3 more result files. Confirm
no systemic failure modes (e.g. half the jobs hallucinating placeIds, or
banned phrases slipping through).

---

## 4. Sustained processing — drain L1

Once waves 1+2 look clean, ask for sustained processing:

> "Process all remaining pending jobs in `$RUNDIR` in waves of 6 parallel
> Agent calls. Between each wave: run normalize + validate. If a wave has any
> failed jobs, retry them ONCE by marking them back to `pending` and
> reincluding in the next wave. Do NOT run writeback until I tell you. Report
> progress after every wave."

**During execution — operator monitoring:**

```bash
# In a second terminal, every few minutes:
watch -n 30 'node scripts/synth/queue-state.js summary "$RUNDIR"'

# If a wave seems stuck (no progress for >15min):
node scripts/synth/queue-state.js summary "$RUNDIR"  # check oldest running
# If "oldest running" is > 15min old, the subagent likely died — reset:
node scripts/synth/queue-state.js reset-stuck "$RUNDIR"
# Then ask the orchestrator to pick those jobs up in the next wave.
```

**Acceptance gate for moving to step 5:** at least 70% of jobs in status
`validated` and ≤10% in status `failed`. The rest (`pending` or `running`)
can wait for a retry pass.

---

## 5. Writeback — single publish

ONLY run this once L1 is mostly drained. Each `writeback.js` invocation
without `--no-publish` triggers a full export + commit + indexing run, which
costs from the 200/day GSC indexing quota.

```bash
# Push all validated jobs to Firestore. Includes the post-publish hook
# (export-firestore-to-json + git commit + request-indexing).
node scripts/synth/writeback.js "$RUNDIR" 2>&1 | tee writeback.log
```

If you need to do multiple writebacks for any reason (e.g. retry a failed
batch later in the session), use `--no-publish` on intermediate writebacks
and do ONE clean publish at the end:

```bash
# Per-wave writebacks during retry passes — no quota burn
node scripts/synth/writeback.js "$RUNDIR" --no-publish

# Final flush at the very end (only writes anything still in "validated";
# does export + commit + indexing)
node scripts/synth/writeback.js "$RUNDIR"
```

---

## 6. Pass 2 (city reorg) — deterministic, ~2 min

Drains queue D (city_rank stale, ~449).

```bash
npx tsx scripts/score-plumbers.ts --pass 2 2>&1 | tee pass2.log
```

Watch for:
- `Pass 2 done: wrote city_rank for N plumber(s)` where N ≈ 449 + any new
  plumbers from the L1 burn.
- No `Error:` lines in stderr.

Idempotent — re-running rewrites the same values.

---

## 7. Pass 3 (L2 decision) — deterministic, ~2 min

Drains queue E (decision stale, ~476).

```bash
npx tsx scripts/score-plumbers.ts --pass 3 2>&1 | tee pass3.log
```

Watch for:
- `Pass 3 done: N decided, M skipped` where N ≈ 476.
- "skipped" entries fall into two valid categories: missing scores, or
  missing city_rank entry for their primary city. The former is expected
  for `no_reviews`/`keyword_fallback` plumbers. The latter should be near
  zero after Pass 2.

---

## 8. Final publish (only if writeback ran with --no-publish)

If you used `--no-publish` on every writeback to save indexing quota, do
the publish now:

```bash
# Export Firestore → static JSON, commit, push
node scripts/export-firestore-to-json.js

# Optional: request indexing for top affected cities (max 200 URLs/day)
# Skip this if you've already used most of today's quota
```

---

## 9. Smoke test the result

```bash
# Pick 3 random plumbers that were just synthesized — check Firestore shape
node -e '
const admin = require("firebase-admin");
const sa = require("./service-account.json");
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
db.collection("plumbers")
  .where("reviewSynthesis.synthesisVersion", "==", "claude-code-local-v3-cited")
  .limit(3)
  .get()
  .then(snap => {
    snap.docs.forEach(d => {
      const data = d.data();
      console.log("\n---", data.businessName, "(" + d.id + ")");
      console.log("  method:", data.scores?.method);
      console.log("  summary:", data.reviewSynthesis?.summary);
      console.log("  strengths:", JSON.stringify(data.reviewSynthesis?.strengths));
      console.log("  redFlags:", JSON.stringify(data.reviewSynthesis?.redFlags));
      console.log("  city_rank keys:", Object.keys(data.city_rank || {}));
      console.log("  decision.verdict:", data.decision?.verdict);
    });
    process.exit(0);
  });
'
```

All three should show:
- `method: claude-code-local-v3-cited`
- non-empty `summary` reading as specific, not generic
- `city_rank` with at least one entry
- `decision.verdict` populated

---

## 10. Rollback (if anything looks systemically wrong)

The pipeline writes to Firestore but never deletes prior state. Rollback
options:

1. **Don't run writeback.** If you discover an issue after validate but
   before writeback, just don't writeback. Validated result files sit on
   disk; Firestore is unchanged.

2. **Mark fields stale.** If writeback already ran and the synthesis is
   bad, run:
   ```bash
   # Force re-synthesis on all plumbers from this run by setting
   # pendingRescoreSince. The next generate-batches will pick them up.
   node -e '
   const admin = require("firebase-admin");
   const sa = require("./service-account.json");
   admin.initializeApp({ credential: admin.credential.cert(sa) });
   const db = admin.firestore();
   const now = admin.firestore.Timestamp.now();
   db.collection("plumbers")
     .where("scores.method", "==", "claude-code-local-v3-cited")
     // narrow further by city or a known-bad job set as needed
     .get()
     .then(async snap => {
       const writer = db.bulkWriter();
       snap.docs.forEach(d => {
         writer.update(d.ref, {
           pendingRescoreSince: now,
           pendingRescoreReason: "manual-rollback-2026-05-27",
         });
       });
       await writer.close();
       console.log("flagged", snap.size, "plumbers for re-synth");
       process.exit(0);
     });
   '
   ```

3. **Revert the JSON commit.** If publish ran:
   ```bash
   cd ~/code/directory-sites/fast-plumber-near-me
   git log --oneline -5  # find the synth commit
   git revert <sha>      # creates a new commit reverting it
   git push origin main  # triggers Vercel rebuild from prior state
   ```

There is no "undo Firestore writes" — Firestore is the source of truth.
Re-synthesis is the only path back.

---

## 11. Resume from a partial burn

If the Claude Code session dies mid-burn:

```bash
# 1. Find the most recent run
RUNDIR=$(ls -td data/synth-runs/2026* | head -1)
echo "$RUNDIR"

# 2. Snapshot state
node scripts/synth/queue-state.js summary "$RUNDIR"

# 3. Reset any "running" jobs whose subagent died (no result file)
node scripts/synth/queue-state.js reset-stuck "$RUNDIR"

# 4. Tell the next Claude Code session: "Resume processing $RUNDIR.
#    Continue from pending jobs."
```

The pipeline is fully resumable — the queue file on disk is the durable state.

---

## 12. Decision gates

**Should L2 begin immediately?** Yes. Pass 2 and Pass 3 are deterministic and
take 2-5 min each. Run them as soon as L1 writeback completes. They will
process every plumber that has fresh scores, which after the L1 burn is the
whole canonical-method cohort.

**Should city-reorg run tonight?** Yes — Pass 2 IS the city-reorg path. It
runs in the same script as L2 (Pass 3) and is consumed by both queues D
and E. Same 5 minutes.

**Order:** L1 first, then Pass 2, then Pass 3, then final publish. **Do not
reorder.** Pass 3 reads `city_rank` (Pass 2's output); Pass 2 reads `scores`
(L1's output).

---

## 13. Estimated throughput

From the audit:
- 875 L1 plumbers → ~88 batches at size 10
- 6 parallel subagents/wave → ~15 waves
- Per-wave: ~4-5 min subagent latency + ~10s validate
- L1 total: **~70 min wall-clock**
- Pass 2 + Pass 3 + publish: ~10 min
- **Total: ~80-90 min if everything is green.** Could double if 30%+ of
  jobs need retry.

---

## 14. Blockers / failure modes to watch for

| Symptom | Likely cause | Action |
|---|---|---|
| All subagents return "error: ..." | Prompt template broken or batch file unreadable | Stop. Inspect prompt + one batch file. |
| Validate marks everything failed with "quote not grounded" | Agent paraphrasing instead of copying verbatim | Re-run wave; if persistent, tighten prompt language around verbatim copying. |
| `writeback.js` "no matching batch plumber" warnings | Agent hallucinated placeIds | normalize-result-keys.js already drops these; check that you ran normalize before writeback. |
| Indexing API errors after writeback | Hit 200/day quota | Expected past ~200 URLs; not a real error. Re-publish tomorrow. |
| `score-plumbers.ts --pass 2/3` errors | Likely Firestore credential issue, not pipeline | Check `service-account.json`; re-run. |
| Stale `pendingRescoreSince` after writeback | Writeback failed to clear | Run writeback again on the same runDir — `pendingRescoreSince` is set to `FieldValue.delete()` on every update. |
