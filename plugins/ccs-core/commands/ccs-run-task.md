---
description: HEADLESS ONLY. Execute one approved task end to end (plan, red-first tests, implement, review, verify, commit). Never asks a question.
argument-hint: <feature> <Txxx> [retry=<path to notes from the previous failed attempt>]
---

Execute task: $ARGUMENTS   (format: `<feature-dir-name> <Txxx> [retry=<path>]`)

You are running unattended. **You cannot ask questions and nobody will answer one.** If you need a human
decision, write `BLOCKED.md` (below) and stop. You never push, open PRs, install dependencies, create
branches, or touch anything outside this repo. The runner does all outward actions after an independent review.

## 0. Load and refuse early

Read `.specify/memory/constitution.md`, `specs/<feature>/spec.md`, `plan.md`, the relevant `contracts/`,
`data-model.md`, and the task's block in `specs/<feature>/tasks.md` (do NOT change its `[ ]` marker; the runner does).
Refuse (write `BLOCKED.md`, stop) if: spec `Status` is not `APPROVED`; the task is not `autonomy: auto`; a
dependency is not `[x]`; or the task's ACs contradict the spec, the contracts or the constitution.
If `retry=<path>` was given, read it first: it is the failure evidence from a previous attempt. Treat the
working tree as fresh and fix the cause, not the symptom. Do not weaken an AC to make it pass.

Task directory `<task-dir>` = `specs/<feature>/tasks/<Txxx>/`. Create it and write `<task-dir>` (nothing else) to `.ccs/active`.

## 1. Plan (auto-approved: the spec is the approval)

Write `<task-dir>/01-plan.md` in the format of `/ccs-core:ccs-task-plan` with `Status: APPROVED`, copying the task's
ACs **verbatim with their ids**. Include `## Files to modify` (explicit paths, from the task and plan.md; the only
files you may edit), `## Blast radius`, `## Out of scope` and `## Assumptions`. Search the repo first; do not duplicate
what exists. If an AC is unachievable as written, or needs a product/design/security decision, go to **BLOCKED**.

## 2. Test plan, red-first

Run `"${CLAUDE_PLUGIN_ROOT}/scripts/detect-verify.sh"` for the real commands. Write `<task-dir>/02-test-plan.md`
(format of `/ccs-core:ccs-testplan`): one or more checks per AC in the project's existing test framework and directory.
Write the failing tests FIRST, run them, and confirm they fail **for the stated reason** (not a setup error); paste
the real output under `## Red-first evidence`. If a check passes before any change, the plan's premise is wrong: BLOCKED.
Include the negative AC's check. Anything you cannot automate is `MANUAL` and listed under `## Not covered`.

## 3. Implement

Edit only files in `## Files to modify` (append any extra file with a one-line reason before touching it). Read each
file before editing. Modify existing files; no `*-v2`/`*-new`. Errors propagate; no empty catch. Work AC by AC and run its
check. Do not add dependencies (that is a human decision). Do not run builds/migrations/deploys; use tests and typecheck.

## 4. Independent review (fresh context)

Launch the `change-reviewer` subagent exactly as `/ccs-core:ccs-review` specifies, with `<task-dir>`, adding no rationale.
Fix every UNMET AC and CRITICAL/HIGH finding, then launch a **new** reviewer instance. Maximum 2 fix rounds.

## 5. Verify (fresh context)

Launch the `change-verifier` subagent exactly as `/ccs-core:ccs-verify` specifies. On FAIL fix and re-run (max 2 rounds).
Never edit `03-review.md` or `04-verification.md`. Never modify a test to make it pass.

## 6. Finish

- Verdict `PASS` and review not CHANGES-REQUIRED: `git add -A` (the ignored `.ccs/` is excluded automatically) and make ONE
  commit: `feat(<component>): <task title> (<Txxx>)` (or `fix`/`refactor`/`test` as the work type dictates), ending with the
  attribution trailer from your instructions. Then `rm .ccs/active`.
- Verdict `FAIL` or `BLOCKED`: do **not** commit. Leave the artifacts. Keep `.ccs/active` (the runner handles it).
- **BLOCKED.md** (`<task-dir>/BLOCKED.md`): one short paragraph: the decision needed, the options, your recommendation.
  Then `rm .ccs/active` and stop.

Your final message is exactly one line: `TASK <Txxx>: PASS` | `TASK <Txxx>: FAIL <reason>` | `TASK <Txxx>: BLOCKED <reason>`.
The runner does not trust it: it reads `04-verification.md`, the git history and the exit code.
