---
description: Read-only consistency check across spec, plan and tasks. Writes analysis.md with a READY / NOT-READY verdict.
argument-hint: [feature dir or number]
---

Analyze the feature: $ARGUMENTS

Read-only on every file except `specs/NNN-slug/analysis.md`.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/ccs-lint.mjs" specs/NNN-slug --json` and include its errors and warnings verbatim.
2. Then review what a linter cannot:
   - **Coverage:** every FR maps to >=1 task; every success criterion is reachable; every user story's
     independent test is actually achievable by its tasks.
   - **Contracts:** every endpoint/event the tasks touch exists in `contracts/`; types are not duplicated by hand.
   - **Constitution:** plan gates are honest (spot-check one claim per article); no unrecorded violation.
   - **Check quality:** each `check:` would fail if the behaviour were absent (not `true`, not a bare typecheck
     for a behavioural AC). Flag checks that can pass with zero assertions.
   - **Autonomy:** any `auto` task that really needs a human decision, or a `human` task that is trivially safe.
   - **Scope:** tasks that touch files the plan does not list, or exceed the spec's negative space.
3. Write `analysis.md`: findings table (`SEVERITY | where | issue | fix`, CRITICAL/HIGH/MEDIUM/LOW), coverage
   table, and a final line exactly `VERDICT: READY` or `VERDICT: NOT-READY`.
   READY requires: lint OK and no CRITICAL/HIGH findings.
4. Print the verdict and the findings. Do not fix anything here; say which command fixes each class.
