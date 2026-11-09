---
description: Review the change against the plan in fresh context, via the change-reviewer subagent.
---

Review the active work item.

## 1. Load the pointers only

Read `.ccs/active` to get the task directory (`<task-dir>`, repo-relative, e.g. `specs/001-signup/tasks/T004`). Do not read the plan, the diff, or the changed files
yourself — you wrote them, and a reviewer that shares your context confirms your reasoning instead
of testing it.

## 2. Dispatch

Launch the `change-reviewer` subagent. Its prompt is exactly this and nothing more:

```
Review the change for task <task-dir>.

Read these two things and nothing else:
  1. <task-dir>/01-plan.md
  2. The diff: `git diff` plus `git diff --staged`, and `git status` for untracked files

Do not read the conversation that produced this change. Do not read 02-test-plan.md,
03-*, or 04-* artifacts. Write your findings to <task-dir>/03-review.md.
```

Do not add context, rationale, justification, or a summary of what you were trying to do. Do not
tell it which parts you are confident about. Anything you volunteer, it will anchor on.

## 3. On the result

Read `03-review.md` when the subagent finishes and report the verdict and any UNMET criteria in chat.

If the review finds unmet acceptance criteria or CRITICAL/HIGH findings:

- Fix them, then re-run `/ccs-review` — a fresh reviewer instance each time
- Or, if you believe the reviewer is wrong, say why in chat with file:line evidence and let the user
  decide. Do not edit `03-review.md` to remove a finding you disagree with.

Never mark your own change reviewed. The artifact is the record.
