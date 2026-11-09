---
description: Clear the active work item so the verification gate stops firing.
---

Abandon or park the active work item.

1. Read `.ccs/active` for the task directory (`<task-dir>`).
2. Append to `<task-dir>/01-plan.md`:

   ```
   ## Abandoned
   - **Date:** <YYYY-MM-DD>
   - **Reason:** <one line — superseded, descoped, blocked externally, wrong root cause>
   ```

3. Set the plan `Status:` to `ABANDONED`.
4. `touch <task-dir>/.abandoned`
5. Remove `.ccs/active`.

Keep the directory. An abandoned plan with a stated reason is evidence for the next person who
picks the work up; a deleted one is a repeat of the same investigation.

Report what was abandoned and why.
