---
description: Turn an approved plan's acceptance criteria into executable checks, red-first for bugs.
---

Produce the test plan for the active work item.

## 1. Load

Read `.claude/work/.active` for the slug, then read `.claude/work/<slug>/01-plan.md`.

If `Status:` is not `APPROVED`, stop and say the plan has not been approved yet.
Read nothing else from the conversation history — the plan file is the contract.

## 2. Determine the runner

Run `.claude/scripts/detect-verify.sh` from the repo root. It prints one TSV row per check:

```
dir<TAB>stack<TAB>kind<TAB>command
backend    python  test   pytest -q
frontend   node    test   npm run test
```

Each command runs **from its `dir`**, not from the repo root — a polyglot repo (FastAPI service plus
a Next.js app, say) yields separate rows per component, and a check for one component must not be run
from the other's directory.

Only include components the change actually touches. If the plan modifies backend files only, do not
add frontend checks to pad coverage; note in `## Not covered` that the frontend was untouched and
unverified.

If it reports `UNKNOWN`, inspect the repo and write a `.claude/verify.json` once (schema in the
script's header) rather than guessing at each invocation. Commit that file — it is the one piece of
per-repo config worth keeping.

## 3. Map every AC to at least one check

Every `AC-n` in the plan gets one or more `T-n.x` checks. An AC with no check is a planning defect —
go back and say so rather than inventing a vague check to cover it.

Prefer, in this order:

1. An automated test in the repo's existing suite and existing style
2. A scripted command with a deterministic assertion (`curl … | jq -e`, a DB query with an expected count)
3. A manual step — only when the first two are genuinely impossible, and marked `MANUAL`

Write real tests, in the project's framework, in the directory the project already uses. Do not
invent a parallel test harness. Do not write a test that asserts what the code currently does — the
test asserts what the plan says should be true.

## 4. Red-first, for BUG and ENHANCEMENT

Before any implementation exists:

- Write the check that proves the defect
- Run it
- Confirm it FAILS, and that it fails for the stated reason rather than a setup error
- Paste the actual failure output into the artifact

A test written after the fix proves only that the code does what the code does. If the check passes
before any change is made, the plan's root cause is wrong — stop and report that, do not adjust the
test until it fails.

A skipped check is not a passing check. If a check can no-op (missing fixture, guarded by an
existence test, empty dataset), it must report SKIP as a distinct status. Zero assertions executed
is a failure signal, never a green.

## 5. Write the artifact

Write `.claude/work/<slug>/02-test-plan.md`:

```markdown
# Test plan — <slug>

- **Runner:** <command(s) detect-verify.sh resolved, or from .claude/verify.json>
- **Suite command:** <the single command that runs everything>

## Coverage

| Check | Covers | Kind | Command | Pre-fix state |
|---|---|---|---|---|
| T-1.1 | AC-1 | automated | `<exact command>` | RED — see below |
| T-2.1 | AC-2 | scripted | `<exact command>` | N/A (new behaviour) |
| T-3.1 | AC-3 | MANUAL | <steps> | — |

## Red-first evidence
<!-- BUG and ENHANCEMENT only. Paste the actual failing output, unedited. -->

```
<real output>
```

## Files added or modified by this test plan
<paths>

## Not covered
<Any AC whose check is MANUAL or partial, and why. Be explicit — this list is what the
verification stage cannot prove automatically.>
```

## 6. Report

State in chat: how many ACs, how many checks, which are automated vs manual, and the red-first
result. Then stop. Do not implement.
