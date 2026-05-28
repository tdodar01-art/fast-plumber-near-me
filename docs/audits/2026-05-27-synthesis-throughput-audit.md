# Synthesis Pipeline Throughput Audit — 2026-05-27

**Author:** Claude Code session (Tim's prompt)
**Scope:** Map the L1 / L2 / city-reorg synthesis paths as they exist on `main`
today, find resumability + idempotency risks, and decide what to harden before
a high-throughput burn tonight against Claude Code Max quota.

**Method:** read every script involved in the canonical synthesis path and the
score-plumbers Pass 2/3 deterministic steps; inspect the queue-state writer;
inspect the four historical runs in `data/synth-runs/`; cross-check
`daily-report.js` to confirm what each queue actually counts.

**Source of truth:**
- `apps/plumbers-web/scripts/synth/` (L1 synthesis pipeline — local Claude Code)
- `apps/plumbers-web/scripts/score-plumbers.ts` (`--pass 2` city reorg,
  `--pass 3` L2 decision; `--pass 1` is the Sonnet fallback and SHOULD NOT be
  used tonight — no Anthropic credits, see memory)
- `apps/plumbers-web/scripts/daily-report.js` (queue definitions)
- `CLAUDE.md` — "Canonical scoring path — local Claude Code"

---

## 1. The three queues, ground truth

All three are *computed* from Firestore state, not stored. `daily-report.js`
`measureQueues()` walks `plumbers/` once and counts:

| Queue | Counter (daily-report.js) | What it means | Drained by |
|---|---|---|---|
| C. L1 synth (875) | `l1Needed` | `!structurallyPinned && (pendingRescoreSince OR scores.method ∉ CANONICAL_METHODS OR no rs.summary)` | `scripts/synth/*` pipeline writeback (writes `scores.method = "claude-code-local-v3-cited"`) |
| D. City reorg (449) | `cityRankStale` | `rankable && scoredAt > 0 && !hasAnyRank` | `score-plumbers.ts --pass 2` (pure deterministic, writes `city_rank{}`) |
| E. L2 decision (476) | `decisionStale` | `rankable && scoredAt > 0 && (!decidedAt || scoredAt > decidedAt)` | `score-plumbers.ts --pass 3` (pure deterministic, writes `decision{}`) |

**Canonical methods** (anything else → L1 queue): `claude-code-local-v3-cited`,
`unified-sonnet-v4-cited`.

**Structurally pinned methods** (excluded from L1 queue forever or until they
get more reviews): `no_reviews`, `keyword_fallback`.

**Critical implication:** D and E unblock themselves automatically every time
L1 lands a fresh batch. They're not independent queues — they're consequences
of L1 writes. Order tonight: **L1 first, then D, then E.**

---

## 2. L1 synthesis pipeline — full map

### 2.1 Files

```
apps/plumbers-web/scripts/synth/
├── generate-batches.js       # entry point — Firestore → batches/*.json + queue.json
├── queue-state.js            # atomic JSON queue I/O + CLI
├── agent-prompt.js           # prompt template subagent reads
├── print-job-prompt.js       # CLI wrapper used by orchestrator to print one job's prompt
├── preprocess-reviews.js     # compresses raw reviews into signal block (algorithmic)
├── normalize-result-keys.js  # post-hoc camelCase → snake_case repair + hallucination drop
├── validate-synthesis.js     # per-job validation → marks validated|failed
├── writeback.js              # validated → Firestore + post-publish hook
└── lib/
    ├── synthesis-schema.js   # validateSynthesisResult() — schema + anti-hallucination
    ├── derive-fields.js      # badges, emergencyReadiness, pricingTier, bestFor
    ├── signal-extractors.js
    └── service-keywords.js
```

### 2.2 End-to-end flow

```text
[1] generate-batches.js
      ↓ reads Firestore plumbers, filters by plumberNeedsResynth()
      ↓ groups by primary city, sorts cities by GSC impressions desc
      ↓ writes data/synth-runs/<runId>/batches/<jobId>.json (one per batch)
      ↓ seeds queue.json with one entry per batch, status="pending"
      → stdout: runDir path

[2] ORCHESTRATOR (Claude Code session — this is YOU tonight)
      ↓ reads queue.json
      ↓ for each wave: mark N jobs "pending" → "running" via queue-state CLI
      ↓ fans out N Agent() calls in parallel, each with prompt from
        print-job-prompt.js (or agent-prompt.buildBatchPrompt directly)
      ↓ each subagent does: Read(batchPath) → Write(resultPath); only those tools
      ↓ subagent returns "done: N plumbers processed" or "error: ..."

[3] normalize-result-keys.js <runDir>            (optional, fixes drift)
      ↓ targets status="failed" by default
      ↓ camelCase → snake_case key rename
      ↓ drops hallucinated placeIds (not in batch input)
      ↓ coerces topQuote/avgRating null → "" / 0
      ↓ trims oversized summaries

[4] validate-synthesis.js <runDir>
      ↓ targets status="running" by default
      ↓ runs validateSynthesisResult() per result: schema + anti-hallucination
      ↓ flips status → "validated" (ok) or "failed" (with lastError)

[5] writeback.js <runDir>
      ↓ targets status="validated" only
      ↓ builds Pass-1-shape Firestore payload (scores.*, reviewSynthesis.*,
        evidence_quotes[], badges, emergencyReadiness, pricingTier, bestFor)
      ↓ per-plumber .update(payload), clears pendingRescoreSince
      ↓ status → "written"
      ↓ logs one pipelineRuns doc
      ↓ tail: publishAfterWriteback() — exports JSON, commits, requests indexing

[6] score-plumbers.ts --pass 2  (deterministic, no API)
      ↓ walks all scored plumbers, computes per-city percentiles
      ↓ writes city_rank{} on each plumber

[7] score-plumbers.ts --pass 3  (deterministic, no API)
      ↓ reads scores + city_rank + cross_platform_signals
      ↓ writes decision{} on each plumber
```

### 2.3 Selection logic (plumberNeedsResynth)

`generate-batches.js:85-101` — a plumber is selected if ANY of:
- `lastOutscraperPull` > `reviewSynthesis.synthesizedAt` (fresh data after last
  synth)
- No `reviewSynthesis.summary` AND `googleReviewCount > 0`
- `reviewSynthesis.synthesizedAt` older than `--max-age-days` (default 30)

Skipped: `isActive === false`, `googleReviewCount === 0`, missing primary city.

Override: `--method <name>` selects plumbers by current `scores.method` instead
— used for backfill of a method bucket (e.g. `--method claude-code-local-v2-cited`
to upgrade everything to v3).

### 2.4 Batching

`generate-batches.js`:
- Group by `serviceCities[0]` (or `city` slugified).
- Sort cities by `lastGSCImpressions` (cities collection) desc — big cities first.
- Chunk to `--batch-size` (default 10, min 4, max 12). Final remainder merged
  into prior chunk if below MIN_BATCH_SIZE.
- One job per chunk, jobId `<city-slug>-<3-digit-seq>`.

### 2.5 Queue state machine

`scripts/synth/queue-state.js` — single JSON file, atomic tmp+rename writes.

```
pending → running → validated → written
                ↘ failed (after MAX_ATTEMPTS retries or schema error)
```

VALID_STATUSES: `pending, running, validated, failed, scored, written`.
(`scored` is a historical status not currently used.)

CLI surface:
- `node queue-state.js init <runDir>`
- `node queue-state.js next <runDir> [N=8] [status=pending]` → JSON list
- `node queue-state.js mark <runDir> <jobId> <status> [errorMsg]`
- `node queue-state.js stats <runDir>`
- `node queue-state.js list <runDir> [status]`

### 2.6 Subagent prompt contract

`scripts/synth/agent-prompt.js` produces the per-batch prompt. Hard rules:
1. Read batch file (absolute path), write result file (absolute path).
2. Only `Read` + `Write` tools — no network, no other tools.
3. Schema is strict: dimensionScores (5 keys, 0..100|null), specialtyStrength
   (12 keys, 0..100 never null), strengths/weaknesses/redFlags as either
   string[] or `[{text, supporting_review_ids[]}]`, evidenceQuotes verbatim
   from input.evidenceQuotes.
4. supporting_review_ids MUST be a subset of input.evidenceQuotes[].review_id.
5. Banned phrases: "reliable and professional", "highly recommended",
   "satisfied customers", "trustworthy and reliable", "professional and
   courteous", "best in the business".

### 2.7 Validation — what it catches

`scripts/synth/lib/synthesis-schema.js validateSynthesisResult()`:
- placeId present and matches batch.
- summary present, ≤320 chars, no banned phrases.
- strengths/weaknesses/redFlags normalized — string[] or
  `[{text, supporting_review_ids[]}]`. supporting_review_ids filtered against
  `validReviewIds` (the set of review_ids in batch.evidenceQuotes); invalid
  ids dropped silently. **A claim with all-invalid ids becomes evidenced=[ids:[]]
  which is treated by writeback as "claim present but un-cited."**
- dimensionScores: all 5 keys must be `number 0..100` or `null`.
- specialtyStrength: all 12 keys must be `number 0..100` (never null).
- servicesMentioned: object keyed by slug, each `{count≥0, avgRating 0..5|null,
  topQuote string|null}`. Arrays of length 0 are coerced to `{}`.
- evidenceQuotes: **anti-hallucination check** — each `quote` must contain
  ≥40 normalized chars that appear as a substring in some
  batch.evidenceQuotes[].text. Curly/straight-quote drift and whitespace are
  absorbed. **This is the strongest grounding gate in the pipeline.**

Validator mutates the result in place (adds `*Evidence` arrays). On schema
fail → status=failed with `lastError` containing first 5 errors.

### 2.8 Writeback — what gets written

`scripts/synth/writeback.js buildUpdatePayload()`:

Per plumber update:
```js
{
  scores: {
    reliability, pricing_fairness, workmanship, responsiveness, communication,  // from agent (null → 50)
    specialty_strength: { 12 keys },
    variance: approximateVariance(reviewConsistency),
    review_text_only: rawScores,           // audit copy
    method: "claude-code-local-v3-cited",  // canonical
    last_scored_at: <ISO>,
    review_count_used: totalReviewsAnalyzed,
  },
  evidence_quotes: [...],                  // attribution stamped from batch input source
  "reviewSynthesis.summary": ...,
  "reviewSynthesis.strengths/weaknesses/redFlags": [string array, flattened],
  "reviewSynthesis.strengthsEvidence/...Evidence": [structured],
  "reviewSynthesis.badges": [...],         // derived deterministically
  "reviewSynthesis.emergencyReadiness/Notes/Signals": ...,
  "reviewSynthesis.pricingTier": ...,
  "reviewSynthesis.bestFor": ...,
  "reviewSynthesis.platformDiscrepancy": ...,
  "reviewSynthesis.reviewCount": ...,
  "reviewSynthesis.aiSynthesizedAt": <Timestamp>,
  "reviewSynthesis.synthesisVersion": "claude-code-local-v3-cited",
  pendingRescoreSince: FieldValue.delete(),
  pendingRescoreReason: FieldValue.delete(),
  updatedAt: <Timestamp>,
}
```

Notes:
- `.update()` is atomic at the document level. Field paths use dotted notation,
  so partial nested updates merge correctly.
- `cross-platform adjustment` is NOT applied in v1 of this writeback (TODO from
  the original commit) — agent's raw scores go through directly. Pass 2 reads
  the same fields regardless.
- `findSourceQuote()` matches agent quote → source quote and stamps
  `source/published_at/author_name/rating/review_id` onto each evidence quote.
  If no match → fields omitted (not fabricated).
- Tail: `publishAfterWriteback()` runs `export-firestore-to-json.js`, parses
  `__AFFECTED_CITIES__`, calls `request-indexing.js` for those city URLs.
  Indexing is bounded by the 200/day Firestore quota check inside
  `request-indexing.js`.

---

## 3. L2 + city-reorg path — full map

Both are inside `score-plumbers.ts` and are **pure deterministic functions of
Firestore state**. No Anthropic API calls. Idempotent.

### 3.1 Pass 2 — city reorg

`runPass2()` (score-plumbers.ts:1267):
1. Read entire `plumbers/` collection.
2. Filter to entries with numeric `scores.reliability` AND
   `scores.method !== "no_reviews"`.
3. Build set of all `serviceCities` slugs in scope (filterable by `--city`).
4. For each city slug:
   - Get members in that city, sort by overall score desc.
   - Compute per-plumber `{rank: "#N of M in City, ST", overall_percentile,
     best_dimension, worst_dimension, dim_percentiles{}}`.
5. Write `city_rank{}` map on each plumber (merge — one plumber can appear in
   multiple cities).

Per-plumber `.update({ city_rank, updatedAt })`. No batching — sequential
writes. With ~1500 plumbers and Firestore latency ~30-80ms, runtime is on
the order of **1-3 minutes**.

### 3.2 Pass 3 — L2 decision

`runPass3()` (score-plumbers.ts:1405):
1. Read entire `plumbers/` collection (or `--plumber`, `--city` filtered).
2. For each plumber: require `scores` AND `city_rank`.
3. `primarySlug = serviceCities.find(c => cityRank[c])`.
4. `computeDecision(scores, primaryEntry, cross_platform_signals)` →
   `{verdict, best_for[], avoid_if[], one_liner}` (from
   `src/lib/decision-engine.ts`).
5. Stamp `decision{...core, evidence_quotes, primary_city_slug, decided_at}`.

Per-plumber `.update({ decision, updatedAt })`. Sequential, **1-3 minutes**.

### 3.3 Resumability

Both passes always recompute from scratch. Running them twice writes the same
values twice. Idempotent. If interrupted, just re-run.

---

## 4. Risks discovered

### R1. No automatic "stuck running" reset
**Severity:** medium. **Likelihood tonight:** high if a Claude Code session
crashes mid-wave.

`validate-synthesis.js` only validates `status === "running"`. If a subagent
crashed without writing the result file, the job is permanently stuck —
validate fails it (missing result file → "failed"), or just hangs in "running"
waiting for the file. There is no script that scans for stuck jobs and resets
them to "pending" so the next wave can pick them up.

### R2. No queue-leasing / claim-and-set
**Severity:** low (tonight is single-orchestrator).

`queue-state.js markJob` is read-modify-write, atomic per single invocation
(tmp+rename), but has a lost-update window between two concurrent invocations.
If two orchestrators ever ran in parallel and both did `mark <jobX> running`,
the second silently wins. Tonight there is only one orchestrator (this Claude
Code session), so this is dormant. Documenting for the day a second operator
opens a second session.

### R3. publishAfterWriteback() runs once per writeback invocation
**Severity:** medium for tonight. **Cost:** indexing quota.

`writeback.js` calls `publishAfterWriteback()` unconditionally at end of run.
That triggers:
- `export-firestore-to-json.js` (idempotent, ~5-10s)
- `git commit/push` (only if changes — fine)
- `request-indexing.js` (counts against 200/day Firestore quota)

If we run writeback **per wave** (e.g. every 8 jobs), we burn ~10 publishes
tonight. Indexing quota is checked inside `request-indexing.js` (caps at 200
URLs/day), so we won't hard-bust the quota, but we'll waste it on
intermediate states.

**Mitigation:** run validate per wave, but `writeback` only ONCE at the very
end of the night. Validated jobs accumulate until the final writeback. OR add
a `--no-publish` flag to writeback and run publish once at the end.

### R4. Malformed agent output poisoning the wave
**Severity:** low. Validator is strong.

Agent may emit camelCase keys, hallucinated placeIds, or invented
`supporting_review_ids`. `normalize-result-keys.js` repairs the
camelCase + hallucination cases. The schema validator catches the rest
(banned phrases, ungrounded evidence quotes, count mismatches). Worst case:
job marked "failed" with a clear lastError. Other jobs in the same wave are
unaffected — each job's result file is independent.

### R5. generate-batches.js full-collection read
**Severity:** low. Cost: ~1500 doc reads per run-generation, ~3-5s.

`db.collection(COLLECTIONS.businesses).get()` reads all plumbers in one shot
to compute the candidate list, then issues one reviews query per selected
plumber. With 875 L1 candidates: 875 reviews queries sequential = several
minutes. The historical 2026-05-22 122543 run had 120 batches and finished
generation in ~1 minute, so 875 is plausibly 7-10 minutes of generation
time — not a problem, but worth knowing for monitoring.

### R6. Reading entire collection in score-plumbers Pass 2/3
**Severity:** low. Cost: ~1500 doc reads per pass, ~3-5s each.

Pass 2 and Pass 3 do unbounded `collection.get()`. Not a bottleneck at
current scale. Will need rethink at 10k+ plumbers.

### R7. agent-prompt.js doesn't print attribution echo enforcement
**Severity:** low. Validator handles it.

Prompt asks the agent to "ECHO the attribution fields verbatim", but the
validator does NOT check echo correctness — instead, `writeback.findSourceQuote()`
ignores the agent's echo and looks up source attribution from the batch input
directly. So agent echo errors are harmless. Documenting because the prompt
language is misleading.

### R8. Cross-platform adjustment is deferred in writeback v1
**Severity:** intentional (TODO from the original commit). Documenting only.

`writeback.js:170` — comment: "v1: cross-platform adjustment deferred — write
agent's raw scores directly." Pass 1 (`score-plumbers.ts:1156-1178`) applies
`applyAdjustment(rawScores, computeAdjustmentPenalty(cpSignals))`. The local
synth path skips this. Means: plumbers with a big Google/Yelp gap don't get
their composite penalized when synthesized by local Claude Code.
Acceptable for tonight — Pass 2 (rank) still produces a coherent ordering;
Pass 3 (decide) reads `cross_platform_signals` and gates strong_hire on it,
so the L2 verdict still reflects the discrepancy. Pre-existing behavior, not
a tonight concern.

### R9. Past indexing quota
**Severity:** low. 200/day. Each writeback publishes one set of affected
cities. 875 plumbers across ~80 cities means ≤80 URLs per writeback. Should
fit even at one big writeback.

### R10. Subagent prompt token budget
**Severity:** low. Each batch input is ~30-50KB (12 plumbers × ~3KB each).
Well within any Claude model's context. Agent output is similar size.

---

## 5. The 12 audit answers

1. **What scripts process each queue?**
   - L1 synth → `scripts/synth/generate-batches.js` → subagent fanout (Claude
     Code) → `scripts/synth/validate-synthesis.js` → `scripts/synth/writeback.js`.
     Synthesis version stamped is `claude-code-local-v3-cited`.
   - City reorg → `scripts/score-plumbers.ts --pass 2`.
   - L2 decision → `scripts/score-plumbers.ts --pass 3`.

2. **Exact commands.** See [§7].

3. **Batching.** `generate-batches.js` chunks by primary city, size 10
   (configurable `--batch-size`, range 4-12). Cities sorted by GSC impressions
   desc — high-impression cities run first.

4. **Concurrency.** `queue.json.concurrency` field is metadata only; the
   actual concurrency is controlled by the orchestrator (how many Agent calls
   it fans out per wave). Historical runs used 8-12. Recommended for tonight:
   **6-8 parallel Agent calls per wave** (per `CLAUDE.md`).

5. **Resumable?** YES. Queue state lives in `queue.json` on disk; status
   transitions are atomic per single CLI invocation. Crash recovery: anything
   still in `running` with no result file needs manual reset to `pending`
   before next wave. **Hardening adds this as a CLI command.**

6. **Duplicate synthesis?** Cannot occur within one run — `addJob` rejects
   duplicate jobIds. Cross-run: re-running generate-batches selects plumbers
   per `plumberNeedsResynth()`, so a plumber written back in run A won't be
   selected by run B (synthesizedAt is fresh). Safe.

7. **Partial failure poisoning?** No. Each result file is independent. One
   batch failing doesn't cascade. The `failed` status is terminal unless an
   operator explicitly resets the job.

8. **Atomic Firestore writes?** Yes per document — `.update(payload)` is
   atomic at the document level. The writeback loop is per-plumber, so cross-
   plumber consistency is eventually-consistent (no transaction). Acceptable
   because each plumber doc is independent.

9. **Malformed Claude output?** Caught at three layers:
   - `normalize-result-keys.js` repairs camelCase drift + drops hallucinated
     placeIds (run before validation).
   - `validateSynthesisResult()` schema-validates and grounds quotes against
     batch input (anti-hallucination needle: 40 normalized chars).
   - `findSourceQuote()` in writeback strips fabricated attribution.
   Worst case: a result file gets marked `failed`. Other jobs unaffected.

10. **Queue leasing/locking?** Not implemented. CLI `mark` is the only
    transition primitive. Single-orchestrator tonight = not needed.

11. **Retry backoff?** Soft. `requeueIfRetriable()` exists with
    `maxAttempts=3` default but is not auto-invoked anywhere. If a subagent
    fails, the orchestrator must explicitly `mark pending` again. Tonight:
    rely on per-wave manual retry of failed jobs (cheap, low volume).

12. **Estimated safest concurrency tonight.** **6 parallel subagents per
    wave.** Historical run at 12 succeeded, but Claude Code Max quota is a
    shared bucket — 6 leaves headroom and keeps wave latency predictable.

---

## 6. Throughput estimate

Assumptions:
- 875 L1 plumbers → ~88 batches at size 10.
- 6 parallel subagents per wave → ~15 waves.
- Per-wave subagent latency: 2-5 min wall time (each subagent reads ~30KB,
  emits ~30KB JSON, with thinking).
- Validation per wave: <10s.
- One final writeback: 875 sequential `.update()` calls × ~50ms = ~45s, plus
  publish hook ~30s.

**L1 burn time:** 15 waves × ~4 min = **~60 min**, plus writeback ~2 min,
plus validate-and-mark overhead ~5 min → **~70 min wall-clock total**.

**Pass 2 + Pass 3:** ~2-5 min combined.

**Total:** ~75-90 minutes if everything stays green. Could double if a
fraction of subagents need retries.

---

## 7. Commands (for tonight's runbook)

See [docs/runbooks/2026-05-27-synthesis-burn-plan.md] for the full operator
sequence. Brief form:

```bash
cd apps/plumbers-web

# (a) generate-batches — outputs the runDir on stdout
RUNDIR=$(node scripts/synth/generate-batches.js --batch-size 10 --max-age-days 30 2>/dev/null | tail -1)
echo "$RUNDIR"

# (b) inspect
node scripts/synth/queue-state.js stats "$RUNDIR"

# (c) wave loop — orchestrator (Claude Code) fans out subagents in parallel
#     [done inside the Claude Code session, not as bash]

# (d) validate each wave
node scripts/synth/validate-synthesis.js "$RUNDIR"

# (e) at the very end, writeback ONCE (single publish/index)
node scripts/synth/writeback.js "$RUNDIR"

# (f) pass 2 (city reorg) — deterministic, ~2 min
npx tsx scripts/score-plumbers.ts --pass 2

# (g) pass 3 (L2 decision) — deterministic, ~2 min
npx tsx scripts/score-plumbers.ts --pass 3
```

---

## 8. What hardening lands tonight

See `docs/runbooks/2026-05-27-synthesis-burn-plan.md` §3. Surgical only.

1. `queue-state.js reset-stuck <runDir>` — scans for `status=="running"` with
   missing/empty result file, flips back to `pending`. Crash-recovery primitive.
2. `queue-state.js summary <runDir>` — readable summary: jobs by status, total
   plumbers, top cities, oldest pending. Operator visibility.
3. `writeback.js --no-publish` — skip the export+commit+indexing tail so per-
   wave writebacks don't burn indexing quota. The operator does ONE publish at
   the end.

Out of scope tonight:
- Queue leasing (single-orchestrator; not needed)
- Auto-retry with backoff (manual retry is cheap at this volume)
- Cross-platform adjustment in local-synth writeback (pre-existing, deferred)
- Rewriting `score-plumbers.ts` (deterministic passes are fine as-is)
