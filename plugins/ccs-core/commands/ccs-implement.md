---
description: Execute the approved plan, one acceptance criterion at a time.
---

Implement the active work item.

## 1. Load

Read `.ccs/active` for `<task-dir>`, then `01-plan.md` and `02-test-plan.md` from `<task-dir>`.
Confirm the plan `Status:` is `APPROVED` and a test plan exists. If either is missing, stop.

## 2. Constraints

- Modify only the files listed under `## Files to modify`. If the work genuinely requires touching a
  file outside that list, append it to the plan with a one-line reason before editing it — never
  silently widen the blast radius.
- Read each file before editing it. Do not generate an edit from memory of what it contained.
- Modify existing files. No `*-v2`, `*-enhanced`, `*-new`, `*-fixed` variants.
- No side-effect commands as verification. Build, release, publish, migrate, and deploy commands
  mutate version files, tracked artifacts, tags, and counters. Use the test suite or a syntax check
  to verify; run a build only when the plan asks for it, once, at the end.
- Errors propagate. No empty catch, no returning `[]` or `{}` to make a failure look like a result.

## 3. Work AC by AC

For each `AC-n` in order:

1. Make the change
2. Run that AC's checks from the test plan
3. Record the result

For BUG and ENHANCEMENT, the red check from step 4 of the test plan must now pass, and you must
confirm it passes because the defect is gone rather than because the assertion moved.

If an AC turns out to be unachievable as written, stop and say so. Do not weaken the AC to make it
pass and do not quietly substitute a different one.

## 4. Report

Append an `## Implementation log` section to `01-plan.md`:

```markdown
## Implementation log

| AC | Files touched | Checks | Result |
|---|---|---|---|
| AC-1 | src/… | T-1.1 | PASS |
| AC-2 | src/… | T-2.1 | PASS |
```

Then set the plan `Status:` to `IMPLEMENTED`.

Do not declare the work done. You are not the judge of your own change — `/ccs-review` and `/ccs-verify`
decide that, in fresh context. Say what you changed and stop.
