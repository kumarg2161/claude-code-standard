# claude-code-standard

A spec-driven, autonomous delivery toolkit for Claude Code, tuned for **TypeScript backend, React web and
React Native mobile** in a monorepo. You write and approve a spec; a time-boxed unattended run implements it
task by task, has a fresh session review it independently, raises a GitHub PR, and writes an HTML status report.

```
idea -> spec -> clarify -> plan -> tasks -> analyze -> APPROVE (the one human gate)
     -> ccs-run: worktree per feature -> fresh session per task (red-first, review, verify, commit)
     -> runner gate -> independent review (fresh Claude or Codex) -> fix loop -> PR (draft if anything is open)
     -> ccs-reports/latest.html
```

## Layout

| Plugin | Role |
|---|---|
| `plugins/ccs-core` | Stack-agnostic: spec commands, task pipeline, runner (`bin/ccs-run.mjs`), reviewer agents, report, safety hooks |
| `plugins/ccs-backend-ts` | TypeScript API skills (`ts-backend`, `api-design`, `db-design`), Vitest + supertest recipes |
| `plugins/ccs-web-react` | React skills, RTL + MSW recipes, opt-in Playwright |
| `plugins/ccs-mobile-rn` | React Native / Expo skills, jest-expo + RNTL recipes, opt-in Maestro |

Packs hold only stack knowledge and meet core through three project files, so adding Flutter or FastAPI later
touches nothing in core: see [`docs/STACK-PACKS.md`](docs/STACK-PACKS.md).

## Install

Requires: Claude Code >= 2.1.3xx (uses `--permission-prompts`), Node >= 20, git, jq, python3; `gh` (authenticated) for PRs.

```bash
# In Claude Code:
/plugin marketplace add /path/to/claude-code-standard
/plugin install ccs-core@claude-code-standard
/plugin install ccs-backend-ts@claude-code-standard    # whichever stacks you use
```

Commands appear namespaced: `/ccs-core:ccs-init`, `/ccs-core:ccs-specify`, ...
Try it without installing: `claude --plugin-dir plugins/ccs-core --plugin-dir plugins/ccs-backend-ts`.

> **Migrating from the old installer** (`install.sh`, `install.ps1`, `base/`, `pipeline/`, removed in this version): hooks now register
> through the plugin's `hooks.json`. If you ran the old installer, remove its hook entries from `~/.claude/settings.json`, or every hook fires twice.

## Build a product with it

```text
/ccs-core:ccs-init                         once per repo; then run each pack's /ccs-<pack>-init
/ccs-core:ccs-specify <what users need>    writes specs/001-slug/spec.md
/ccs-core:ccs-clarify                      resolves [NEEDS CLARIFICATION]
/ccs-core:ccs-plan                         plan, contracts (OpenAPI), data model, quickstart
/ccs-core:ccs-tasks                        tasks.md with observable ACs and autonomy flags
/ccs-core:ccs-analyze                      READY / NOT-READY
/ccs-core:ccs-approve                      the gate; commits the specs (never pushes)
/ccs-core:ccs-overnight                    preflight + dry run + the command to start a run
```

```bash
caffeinate -i node <plugin>/bin/ccs-run.mjs --until 07:00 --budget-usd 40
# options: --features 001,002  --base main  --no-pr  --dry-run  --max-attempts 3  --task-budget-usd 5
```

Read [`docs/PIPELINE.md`](docs/PIPELINE.md) before your first spec: **acceptance-criteria quality decides everything
downstream.** Read [`docs/AUTONOMY.md`](docs/AUTONOMY.md) before your first unattended run: it lists each guardrail,
what enforces it, and which ones are only instructions.

## The report

`ccs-reports/<run-id>.html` (and `latest.html`), written even if the run is killed. Generated from an append-only
ledger by code, so no model can alter it: outcome and stop reason, spend vs budget, per-feature PR links and review verdicts,
per-task status/attempts/verdict/time/cost/commit, error excerpts, what is unproven or human-only, and next actions.
`/ccs-core:ccs-status-report` regenerates it from any ledger. It is git-excluded so it never lands in a PR.

## Status: what is verified and what is not

**Verified (automated, in `tests/`):** 22 node tests and 21 hook cases (`node --test tests/*.test.mjs`,
`/bin/bash tests/hooks.sh`), covering the tasks parser and linter, report rendering (including injection and truncated ledgers),
and the runner against a fake `claude`/`gh` with real git: isolation, retries, BLOCKED, budget stop, SIGTERM, dry run,
unapproved specs, the fix loop, draft vs ready PRs, and that only `ccs/*` is pushed. Three guardrails were mutation-checked.

**Verified once by hand with the real model (cost about $0.7):** a dependency-free fixture, two tasks, both PASS with red-first
evidence, a fresh-session review that stayed out of the implementer's notes, `main` untouched, plugin hooks firing headless
(audit-log `DENY` entry from the Bash guard). All four plugins pass `claude plugin validate`.

**Not verified yet:**
- A run against a real **TypeScript monorepo** (pnpm, Vitest, React, Expo). The stack packs are written from convention, not exercised.
- A real **GitHub push and PR** (`gh` is faked in tests). Do the first one on a throwaway repo.
- The **Codex reviewer** path (Codex was not installed here; flags are unconfirmed and it falls back to Claude).
- Marketplace **install flow** and the **launchd** template (template syntax is lint-checked, never loaded).
- Multi-feature and long runs; parallel tasks (not implemented).

## Known limits

- `autonomy: auto` safety rests on `ccs-lint`'s keyword check plus your review at `ccs-approve`. It can miss a risky task.
- A task can exceed its budget slightly before the harness stops it; cost figures are client-side estimates.
- The runner stops *starting* work at `--until`; a running task may finish up to `--task-timeout-min`.
- Compound shell commands (`a; b`) do not match allow rules and are denied. See `docs/AUTONOMY.md`.

## Developing

```bash
node --test tests/*.test.mjs && /bin/bash tests/hooks.sh
for p in plugins/*; do (cd $p && claude plugin validate .); done
```
Shell scripts stay bash-3.2 safe (macOS): no `${var^^}`, `mapfile`, `readlink -f`. The Bash-guard bug that failed open on macOS
came from exactly that. Changes to `ccs-core` affect everyone: open a PR.
