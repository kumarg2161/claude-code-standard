---
description: The single human gate before autonomy. Marks the spec APPROVED and commits the specs locally. Never pushes.
argument-hint: [feature dir or number]
---

Approve the feature: $ARGUMENTS

This is the only approval gate before unattended work. Be strict.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/ccs-lint.mjs" specs/NNN-slug`; stop on any ERROR.
2. Read `specs/NNN-slug/analysis.md`. It must exist, be newer than `tasks.md`/`plan.md`/`spec.md`, and end
   with `VERDICT: READY`. Otherwise stop and tell the user to run `/ccs-core:ccs-analyze`.
3. Show the user, in chat: the user stories, every `autonomy: auto` task (id, component, title), every
   `human` task with its reason, and the Assumptions from `spec.md` and `plan.md`. Ask for explicit approval
   with AskUserQuestion ("Approve for autonomous runs" / "Not yet").
4. On approval only: set `Status: APPROVED` in `spec.md`, add `- **Approved:** <date>`.
5. Commit locally: `git add specs/NNN-slug .specify` and
   `git commit -m "docs(spec): approve NNN-slug"` (conventional commit; end with the attribution line your
   session instructions give). **Do not push.** The runner branches from this commit, so the specs must be committed.
6. Print the exact command to start a run: `/ccs-core:ccs-overnight`.
