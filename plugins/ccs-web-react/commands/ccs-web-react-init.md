---
description: One-time wiring of the React web pack into this project: constitution articles, verify rows, unattended-run permissions. Idempotent.
---

Wire the `ccs-web-react` pack into this repository. Idempotent; append, never overwrite; show the diff.

1. Require `.specify/memory/constitution.md` (else tell the user to run `/ccs-core:ccs-init` first).
2. **Constitution.** If the file does not already contain `<!-- ccs-web-react -->`, insert the contents of
   `${CLAUDE_PLUGIN_ROOT}/templates/articles.md` between the `<!-- PACK:BEGIN -->` and `<!-- PACK:END -->` markers.
3. **Verification.** Read the component's own `package.json` (and `pnpm-workspace.yaml`). If it already defines a `test` script, `.claude/verify.json`
   is not needed for it: say so and change nothing. If `.claude/verify.json` already has a row for the component, leave it. Otherwise add the row from
   `${CLAUDE_PLUGIN_ROOT}/templates/verify.rows.json` to `.claude/verify.json`, adjusting `dir` and each command to scripts that **actually exist**.
   Never invent a script; if there is no `test` script, report that tasks in this component will be BLOCKED until one exists.
4. **Unattended permissions.** Merge `${CLAUDE_PLUGIN_ROOT}/templates/run-allow.json` into `.claude/ccs-run.json` (create it if absent;
   union the `allow` and `deny` arrays; fix the `--filter` package name to the real one).
5. Tell the user the `react-web` skill is now active for this stack, and list this stack's `autonomy: human` categories from that skill
   so they are applied when writing `tasks.md`.
6. Report what changed. Commit nothing.
