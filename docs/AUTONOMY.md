# Autonomous runs: guardrails and what enforces them

`ccs-run.mjs` works through approved specs unattended, then raises PRs. This page lists every
guardrail, **what enforces it**, and **where it is tested**. "Enforced by the runner" means a script
does it, so no model can talk its way past it. "Enforced by the harness" means Claude Code's
permission system or a hook does it. "Instruction only" means the model is asked to behave and
nothing stops it. Those are marked, because they are the weak ones.

## The shape of a run

```
approved spec (committed on base)
  └─ worktree .ccs/worktrees/NNN-slug, branch ccs/NNN-slug       <- main checkout never touched
       └─ for each runnable task (deps done, autonomy: auto):
            fresh `claude -p /ccs-core:ccs-run-task`  (plan -> red-first tests -> implement
                                                       -> change-reviewer -> change-verifier -> commit)
            runner reads: 04-verification.md VERDICT, git log, exit code. Not the model's summary.
            FAIL -> reset tree, fresh session with the failure evidence, max 3 attempts
       └─ final gate: runner executes the repo's test/typecheck/lint commands itself
       └─ independent review: fresh session (or Codex) sees spec + plan + contracts + diff only
       └─ CHANGES-REQUIRED with CRITICAL/HIGH -> fresh fix session -> gate -> new review (max 2 rounds)
       └─ push ccs/* branch, open PR (draft + `needs-human` if anything is unresolved)
  └─ always: ccs-reports/<run-id>.html written from the ledger
```

## Guardrails

| Guardrail | Enforced by | Notes |
|---|---|---|
| Only `APPROVED` specs run, read from the **base branch** | Runner | `ccs-approve` is the one human gate; specs must be committed on base. Tested: unapproved spec skipped and reported. |
| One worktree and branch per feature; the base branch never moves | Runner (`git worktree add -b ccs/...`) | Tested: `main` SHA unchanged, main checkout files untouched, `git status` clean. |
| Only `ccs/*` branches are pushed; never the base; never force | Runner refuses (`branch.startsWith('ccs/')`), plus the Bash guard hook for the model | Tested incl. a mutation that pushes to `main`. |
| The model never pushes, never calls `gh`, never merges | Harness: `permissions.deny` in `templates/run-settings.json` (`git push*`, `gh *`, `git merge*`, `git branch*` ...) plus the hook | `--permission-prompts none` means anything not allowed is **denied**, never queued for a human. |
| No installs, no `npx`/`dlx`, no `curl`/`wget`, no cloud/docker/eas | Harness deny list; the Bash guard also asks on `npx` | A new dependency is a human decision. The runner installs from the lockfile itself, once. |
| Hooks stay on | Runner never passes `--bare` (bare skips hooks) | Tested: no call carries `--bare`. Plugin hooks: Bash guard, sensitive-file guard, secret scan on commit and on Stop, verification gate. |
| Bash guard works on macOS | Fixed: it used bash-4 syntax and **failed open on bash 3.2** | `tests/hooks.sh` runs under `/bin/bash` and asserts exit 2 on dangerous commands. |
| Unattended permissions are not widened by your personal settings | Runner passes `--setting-sources project,local` | Add `--user-settings` to opt back in. Deny rules beat allow rules from any source regardless. |
| Fresh context per task, per fix, per review | Runner (new `claude -p`, no `--resume`/`--continue`) | Tested. Reviews also pass `--no-session-persistence`. |
| Reviewer never sees implementer notes | Runner: prompt excludes `specs/*/tasks/**`, review session denies `Read(**/specs/**/tasks/**)` | Deny rules on Read are best-effort for Grep/Glob. The prompt also forbids it. |
| Status comes from files, exit codes and git, not the model | Runner | DONE needs: `VERDICT: PASS` + a new commit + clean tree + exit ok. Tested: "no commit" and "FAIL verdict" are FAILED. |
| A suite with zero assertions is not PASS | `change-verifier` agent | **Instruction only** (agent prompt). The runner's gate checks exit codes, not assertion counts. |
| Budget | `--max-budget-usd` per session (harness) + total budget (runner) | Cost figures are client-side estimates. A session can overshoot slightly before it is stopped. Tested: budget stop. |
| Time box | Runner `--until`; per-task timeout with SIGINT, then SIGTERM, then SIGKILL of the process group | Tested: `SIGTERM` mid-task. Runs stop **starting** work at the deadline; a running task may finish up to its timeout. |
| Retry caps and stop on repeated failure | Runner: 3 attempts per task, 2 review rounds, stop after 3 failures in a row | A timeout is not retried. |
| A report always exists | Runner `finally` + signal handlers + `exit` handler | Tested: SIGTERM mid-task still produces the report. SIGKILL of the runner itself cannot be caught; the ledger is append-only, so `ccs-status-report` can rebuild the report afterwards. |
| The report cannot be written by the model | Report is rendered from the ledger by code; all values HTML-escaped; no scripts | Tested incl. script-injection text in task titles and errors. |
| Reports and scratch never land in a PR | `.ccs/` and `ccs-reports/` go in `.git/info/exclude` (shared by worktrees) | Tested: `git status` clean in the main checkout after a run. |
| Tasks that need judgment are never run | `autonomy: human` in `tasks.md`; `ccs-lint` rejects risky wording on an `auto` task unless a reason is written | Lint is keyword-based: it will miss a risky task that does not use the words. Review the `auto` list at `ccs-approve`. |

## Permission rules match simple commands

Allow rules such as `Bash(npm run *)` match a single command. A compound like `npm run test 2>&1; echo EXIT=$?` is not matched and is **denied**
(seen in the first real run; the model simply retried with the plain command). That is the safe direction, and `--permission-prompts none`
means it fails fast instead of waiting. If your repo needs a compound form, add an explicit rule in `.claude/ccs-run.json`.

## What a run will not do

Deploy, publish, run migrations against anything but a local database, change CI workflows
(`Edit(.github/workflows/**)` is denied), touch `.env` or keys, install packages, or open a PR for
a branch that has no commits. Mobile simulators and device E2E (Maestro/Detox) are not available
unattended; those checks are `MANUAL` and show up under "Not proven" in the report.

## What it cannot guarantee

- **A PASS means the plan's acceptance criteria had checks that passed.** It does not mean the
  spec was right. Weak acceptance criteria produce a confident, worthless PASS (see `PIPELINE.md`).
- **The independent review is a model.** Fresh context reduces shared blind spots; it does not
  remove them. Human review of the PR is still the last gate.
- **Codex review is untested** on the machine this was built on (Codex was not installed). It is
  attempted only when `codex` is on PATH and always falls back to a fresh Claude session; the
  report names the reviewer that actually produced the verdict.
- **`--setting-sources project,local`** also means stack packs installed from a marketplace are not
  loaded unless passed with `--plugin-dir`. In this repo layout the runner finds sibling `ccs-*`
  directories automatically.
