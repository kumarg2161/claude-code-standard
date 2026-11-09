---
description: Run the full plan → test → implement → review → verify pipeline with a single approval gate.
---

Run the full delivery pipeline for: $ARGUMENTS

## Sequence

1. `/plan $ARGUMENTS` → writes `01-plan.md`, then **STOP and wait for approval**
2. On approval: set plan `Status:` to `APPROVED`, then `/testplan` → `02-test-plan.md`
3. `/implement` → code changes + implementation log
4. `/review` → `03-review.md` (fresh-context subagent)
5. `/verify` → `04-verification.md` (fresh-context subagent)
6. Report the verdict

## Gate rules

Step 1 is the only place you wait for a human. Steps 2 through 6 run unattended.

Stop the pipeline and hand back mid-run only if:

- The plan turns out to be wrong (root cause falsified, work already shipped, AC unachievable)
- `/review` returns UNMET criteria you cannot resolve without a product decision
- `/verify` returns BLOCKED for an environmental reason you cannot fix
- A destructive or outward-facing action is required that the plan did not authorise

In every other case, resolve it and continue. Do not stop to report progress, to confirm you
understood the plan, or to ask whether you should proceed to the next step.

## Retry rules

- `/review` UNMET or CRITICAL/HIGH → fix, re-run `/review` with a fresh subagent. Maximum 3 rounds,
  then hand back with what remains.
- `/verify` FAIL → fix, re-run `/verify`. Maximum 3 rounds.
- Never re-run a stage by editing its artifact.

## Finish

Report:

- The verdict line from `04-verification.md`
- The per-AC results table
- Anything listed as `MANUAL` or `Not covered` — this is what the pipeline did not prove
- Files changed

Then stop. Do not commit, push, tag, or open a PR unless the plan said to.
