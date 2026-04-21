# Queue — Fast Plumber Near Me

## Phase 2 — Contain score-plumbers bottleneck

Trigger:
- After confirming Phase 1 is working (publishing runs successfully)

Task:
- Add --max N limit to score-plumbers.ts
- Reduce rescore trigger sensitivity (review delta threshold)

Notes:
- Do NOT touch workflows again
- Only modify scoring behavior
- Keep changes minimal and safe
