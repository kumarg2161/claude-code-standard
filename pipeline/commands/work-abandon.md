---
description: Clear the active work item so the verification gate stops firing.
---

Abandon or park the active work item.

1. Read `.claude/work/.active` for the slug.
2. Append to `.claude/work/<slug>/01-plan.md`:

   ```
   ## Abandoned
   - **Date:** <YYYY-MM-DD>
   - **Reason:** <one line — superseded, descoped, blocked externally, wrong root cause>
   ```

3. Set the plan `Status:` to `ABANDONED`.
4. `touch .claude/work/<slug>/.abandoned`
5. Remove `.claude/work/.active`.

Keep the directory. An abandoned plan with a stated reason is evidence for the next person who
picks the work up; a deleted one is a repeat of the same investigation.

Report what was abandoned and why.
