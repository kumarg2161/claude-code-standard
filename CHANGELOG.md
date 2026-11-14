# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/). All four plugins share one version (lockstep).

## [Unreleased]

## [0.1.1] - 2026-11-14

### Fixed
- **`tasks.md` template sample parsed as a real task**: `parseTasks()` now ignores HTML comments, so the example `T004` in
  `templates/tasks.md` no longer shows up as a fake task (duplicate-id lint errors, phantom task in `ccs-run`). The sample line
  is also indented so older parsers skip it. Regression tests added.

## [0.1.0] - 2026-11-09

First release of the plugin layout. Replaces the installer-based `base/` + `pipeline/` bundle.

### Added
- **`ccs-core`**: spec-driven commands (`ccs-init`, `constitution`, `specify`, `clarify`, `plan`, `tasks`, `analyze`, `approve`),
  single-task pipeline (`task-plan`, `testplan`, `implement`, `review`, `verify`, `work`), headless `ccs-run-task` / `ccs-run-fix`,
  `ccs-overnight`, `ccs-status-report`, agents (`change-reviewer`, `change-verifier`, `pr-reviewer`, `explore-codebase`, `security-reviewer`),
  safety hooks via `hooks.json`.
- **Autonomous runner** `bin/ccs-run.mjs`: worktree + branch per feature, fresh session per task, capped retries, runner-side gate,
  independent review (fresh Claude session; Codex attempted if installed, untested), fix loop, push of `ccs/*` only, draft/ready PR via `gh`.
- **HTML status report** rendered from an append-only ledger (`bin/ccs-report.mjs`), written even on SIGTERM.
- `ccs-lint` (deterministic `spec.md`/`tasks.md` checks) and a shared `tasks.md` parser.
- **Stack packs**: `ccs-backend-ts`, `ccs-web-react`, `ccs-mobile-rn` (skills, test recipes, constitution articles, init commands).
- Tests: 22 node tests, 21 hook cases (`tests/`); docs `AUTONOMY.md`, `PIPELINE.md`, `STACK-PACKS.md`.

### Fixed (relative to the old bundle)
- **Bash guard and sensitive-file guard failed open on macOS bash 3.2** (`${var^^}` aborted the hook with exit 0, allowing denied commands).
- `scan-secrets.sh` path was hardcoded to `~/.claude`; typecheck fallback used `npx`, which unattended runs deny.
- Skills never triggered (one-line descriptions); descriptions rewritten.

### Removed
- `install.sh`, `install.ps1`, `tools/*.sh`, `base/`, `pipeline/` (superseded by the plugins and `hooks.json`).

### Known gaps
- Not yet run on a real TypeScript/React/Expo monorepo, a real GitHub PR, the Codex reviewer, the marketplace install flow,
  the launchd template, or native Windows. See README "Status".

[Unreleased]: https://github.com/kumarg2161/claude-code-standard/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/kumarg2161/claude-code-standard/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/kumarg2161/claude-code-standard/releases/tag/v0.1.0
