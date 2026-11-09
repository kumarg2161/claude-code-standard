---
description: One-time project setup: constitution, lessons file, verify config, CLAUDE.md import, git excludes. Run once per repo.
---

Initialise this repository for the ccs workflow. Idempotent: never overwrite an existing file.

1. **Preconditions.** Must be inside a git repo (`git rev-parse --show-toplevel`). If not, stop and say so.
2. **Git excludes.** Run `"${CLAUDE_PLUGIN_ROOT}/scripts/ensure-ignored.sh"` (adds `.ccs/` and `ccs-reports/` to
   `.git/info/exclude`; `specs/` stays tracked on purpose).
3. **Constitution.** If `.specify/memory/constitution.md` does not exist, copy
   `${CLAUDE_PLUGIN_ROOT}/templates/constitution.md` there and replace `{{DATE}}` with today's date.
   Create `.specify/memory/lessons.md` with a one-line header if absent.
4. **Verification config.** Run `"${CLAUDE_PLUGIN_ROOT}/scripts/detect-verify.sh"` and show the table.
   - Rows printed: detection works; do not write `.claude/verify.json`.
   - `UNKNOWN`: ask the user once which commands run tests/lint/typecheck per component, then write
     `.claude/verify.json` (schema: `${CLAUDE_PLUGIN_ROOT}/templates/verify.json.example`).
   - Warn if a component has no `test` row: tasks in that component cannot be verified, so the runner will mark them BLOCKED.
5. **CLAUDE.md.** If the project `CLAUDE.md` has no `<!-- ccs:begin -->` block, append:
   ```
   <!-- ccs:begin -->
   @.specify/memory/constitution.md
   Workflow: /ccs-core:ccs-specify -> ccs-clarify -> ccs-plan -> ccs-tasks -> ccs-analyze -> ccs-approve,
   then run the autonomous cycle (see /ccs-core:ccs-overnight). Specs live in specs/NNN-slug/.
   <!-- ccs:end -->
   ```
6. **Stack packs.** Check which of `ccs-backend-ts`, `ccs-web-react`, `ccs-mobile-rn` are installed
   (their commands `ccs-backend-ts-init` etc. appear in your command list) and tell the user to run
   each installed pack's init command next. Do not guess.
7. **Report** what was created, what already existed, and the detected components. Commit nothing.
