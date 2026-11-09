---
description: Run the checks and emit a machine-readable go/no-go verdict.
---

Verify the active work item.

## 1. Load the pointer only

Read `.claude/work/.active` for the slug. Do not run the checks yourself and do not form a view on
whether the change is correct — that is the subagent's job, and it must reach the verdict from
process exit codes rather than from having watched the work happen.

## 2. Dispatch

Launch the `change-verifier` subagent with exactly this prompt:

```
Verify work item <slug>.

Read .claude/work/<slug>/01-plan.md and .claude/work/<slug>/02-test-plan.md.
Run every check. Write .claude/work/<slug>/04-verification.md.

Your verdict comes from exit codes and test output only. Do not read the diff and do not
reason about whether the code looks correct.
```

## 3. On the result

Read `04-verification.md` and report the verdict line and the per-AC table in chat.

- `VERDICT: PASS` — every AC covered by a check that passed, no MANUAL gaps left unstated
- `VERDICT: FAIL` — one or more checks failed
- `VERDICT: BLOCKED` — checks could not run (environment, missing fixture, unresolved runner)

A `BLOCKED` is not a `PASS`. A suite that exits 0 having executed zero assertions is `BLOCKED`.

If the verdict is not PASS, fix and re-run `/verify`. Do not edit the artifact to change the verdict,
and do not report the work complete on the strength of a partial run.
