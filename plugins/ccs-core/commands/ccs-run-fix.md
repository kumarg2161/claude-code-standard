---
description: HEADLESS ONLY. Fix independent-review findings on a feature branch, in a fresh session that sees only the findings.
argument-hint: <feature> findings=<path to the review findings file>
---

Fix review findings: $ARGUMENTS   (format: `<feature-dir-name> findings=<path>`)

Unattended; you cannot ask questions. You never push or change branches. You see only: the findings file, the
feature's `spec.md`/`plan.md`/`contracts/`, and the code. You do not see how the code was written; do not guess why.

1. Read the findings file. For each CRITICAL/HIGH finding (and MEDIUM only if it is a one-line fix), locate the
   `file:line`, confirm the defect is real by reading the code, and fix the root cause.
2. If a finding is wrong, do not "fix" it: record `WONTFIX <id>: <evidence with file:line>` in the notes file.
3. Add or adjust a test that would have caught each real defect (red first), then run the component's test and
   typecheck commands (`"${CLAUDE_PLUGIN_ROOT}/scripts/detect-verify.sh"`). Everything must be green.
4. Do not widen scope, add dependencies, or edit specs. If a fix needs a spec change or a human decision, write
   `NEEDS-HUMAN <id>: <decision>` in the notes and leave that finding unfixed.
5. Write `<findings-dir>/fix-notes.md` (fixed / WONTFIX / NEEDS-HUMAN per finding) and make ONE commit
   `fix(review): <summary>` ending with the attribution trailer from your instructions.

Final message: `FIX: DONE` or `FIX: PARTIAL <n unresolved>`.
