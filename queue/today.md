# Queue — Fast Plumber Near Me

## Phase 2 — Contain score-plumbers bottleneck — CLOSED 2026-04-28

**Status:** Closed out. Superseded by the manual-first pivot on 2026-04-23.

**Original goal** (from when this was written):
make `score-plumbers.ts` fast enough to fit inside the 30-min cron step
inside `daily-scrape.yml` so it would stop cancelling and blocking the
daily site update.

**What actually happened:**

1. Most runtime work shipped early — commit `f7157da` (2026-04-21):
   ordered iteration (drain stale tail), REVIEW_CAP=75, REVIEWS_PER_BATCH
   15→30, RATE_LIMIT_MS 2000→500, `last_scored_at` stamped on fallback
   paths. Daily-scrape went from cancelling at 45min back to ~34min green.

2. `--limit N` was already implemented in `score-plumbers.ts:137` — the
   only remaining "Phase 2" task was to invoke it from the workflow.

3. Manual-first pivot (2026-04-23) removed `score-plumbers.ts` from
   `daily-scrape.yml` entirely. Cron scoring no longer exists. Scoring
   now runs by hand or via the Operator Console (step-2 paste-flow,
   plus the parallel Claude-subagent path documented in commits `ebabc16`
   / `99596cc` from 2026-04-27/28).

**Net:** the optimization target evaporated. There's no 30-min cron budget
to fit into anymore. The remaining levers documented in
`apps/plumbers-web/docs/phase2-checkin-2026-04-27.md` (raise review-delta
threshold, split scoring into its own workflow, skip pass 2/3 on
deep-review) are all "if scoring goes back into cron" futures — none
needed today.

**Reference:** `apps/plumbers-web/docs/phase2-checkin-2026-04-27.md` kept
as historical pipeline audit. CLAUDE.md "Automation pause" section is
the current source of truth for what's automated and what's manual.

## Open queue

(none)

When new work surfaces, add a section above this one with a Trigger,
Task, and Notes block — same shape as the closed Phase 2 entry above.
