---
description: Preflight and print the exact command (and optional launchd schedule) to start a time-boxed autonomous run. Does not start it.
argument-hint: [until HH:MM] [budget USD]
---

Prepare an autonomous run: $ARGUMENTS

This command never starts the run itself (it can take hours and must outlive this session). It checks, asks, and prints.

1. **Preflight** (run each, report PASS/FAIL, stop on any FAIL with the fix):
   - `claude --version`; `node --version` (>= 20); `git rev-parse --show-toplevel`; `jq --version`; `python3 --version`
   - `gh auth status` and `git remote get-url origin` (PRs need both; without them tell the user to add `--no-pr`)
   - Current branch is the integration branch and `git status --porcelain` is empty: the runner branches from the
     **committed** base, so approved specs must be committed there.
   - `"${CLAUDE_PLUGIN_ROOT}/scripts/feature-status.sh"`: list features. Only `APPROVED` ones will run; say which are not and why.
   - `.claude/verify.json` or `detect-verify.sh` yields a `test` row for every component the approved tasks use.
2. **Dry run.** Run `node "${CLAUDE_PLUGIN_ROOT}/bin/ccs-run.mjs" --dry-run` and show what would run, what is human-only, and what
   is blocked by dependencies. It spends nothing and writes `ccs-reports/latest.html`.
3. **Ask** (AskUserQuestion) for the end time (`07:00`, `+8h`), the total budget in USD (suggest `(tasks x 2) + 5`), and whether
   to open PRs. Defaults come from `$ARGUMENTS`.
4. **Print** one copy-paste command, e.g.
   `caffeinate -i node "<abs path>/bin/ccs-run.mjs" --until 07:00 --budget-usd 40`
   (`caffeinate -i` keeps a Mac awake on macOS). Explain the guarantees in 5 lines: hooks stay on, nothing is pushed except
   `ccs/*` branches, no merge, per-task fresh sessions, review by a fresh session or Codex, and an HTML report is written even if
   the run is killed.
5. **Schedule (optional).** If asked, fill `${CLAUDE_PLUGIN_ROOT}/templates/ccs-overnight.plist` (replace `__NODE__`, `__RUNNER__`, `__REPO__`,
   `__HOUR__`, `__MINUTE__`, `__ARGS__`) into `~/Library/LaunchAgents/com.ccs.overnight.plist` and print the
   `launchctl bootstrap gui/$(id -u) <plist>` command for the user to run. Do not load it yourself. Warn that the runner path contains the plugin
   version, so the schedule must be regenerated after a plugin update.
6. **Morning:** the report is `ccs-reports/latest.html`; logs are in `.ccs/runs/<run-id>/logs/`.
