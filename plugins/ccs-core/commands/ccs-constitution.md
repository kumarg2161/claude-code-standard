---
description: Amend the project constitution with a dated, reasoned entry. Never edits an article silently.
argument-hint: <the change and why>
---

Amend `.specify/memory/constitution.md` for: $ARGUMENTS

1. Read the whole constitution. Identify which article the change touches (or whether it needs a new one).
2. **Article II (Security) and Article III (Test-first) may be strengthened freely but never weakened**
   without the user typing an explicit confirmation in this conversation. Ask once if the change weakens them.
3. Make the smallest edit that expresses the change. Append one line under `## Amendments`:
   `- YYYY-MM-DD · Article N · <what changed> · <why> · approved by <user>`. Update `Last amended`.
4. Pack articles (VIII+) belong between the `PACK:BEGIN/END` markers.
5. Show the diff. Then check every existing `specs/*/plan.md` Constitution check against the new text
   and list any plan the amendment now puts in violation. Do not edit those plans.
