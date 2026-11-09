# The spec-driven workflow

One human gate, then machines. You write and approve a spec. Everything after the gate is mechanical,
which is why the spec carries all the weight.

```
 /ccs-core:ccs-init              once per repo: constitution, verify config, git excludes
 /ccs-core:ccs-specify <idea>    specs/NNN-slug/spec.md      what and why, never how
 /ccs-core:ccs-clarify           <= 5 questions, answers written back into the spec
 /ccs-core:ccs-plan              plan.md, research.md, data-model.md, contracts/, quickstart.md
 /ccs-core:ccs-tasks             tasks.md  (ordered, each with observable ACs + autonomy flag)
 /ccs-core:ccs-analyze           read-only consistency check -> analysis.md  VERDICT: READY | NOT-READY
 /ccs-core:ccs-approve           THE gate: marks APPROVED, commits the specs locally (never pushes)
        │
        ▼
 /ccs-core:ccs-overnight         preflight + dry run + prints the command (does not start it)
 node .../bin/ccs-run.mjs ...    unattended: tasks -> review -> fix -> PR, always writes the report
        │
        ▼
 ccs-reports/latest.html         what was done, what failed, what a human must decide
```

Commands are namespaced by Claude Code as `/ccs-core:<name>`. The stack packs add `ccs-backend-ts`,
`ccs-web-react` and `ccs-mobile-rn` skills and an init command each.

## Where things live

| Path | Tracked? | What |
|---|---|---|
| `.specify/memory/constitution.md` | yes | The rules every plan is checked against. Amend with `/ccs-core:ccs-constitution`. |
| `specs/NNN-slug/spec.md, plan.md, tasks.md, contracts/` | **yes** | The product's source of truth. Travels with the PR. |
| `specs/NNN-slug/tasks/Txxx/01-plan.md ... 04-verification.md` | yes | Per-task evidence: plan, red-first test plan, review, verdict. |
| `specs/NNN-slug/review/pr-review-roundN.md` | yes | The independent pre-PR review. |
| `.ccs/` | no (git-excluded) | Scratch: active pointer, worktrees, run ledgers, logs. |
| `ccs-reports/` | no (git-excluded) | Generated HTML reports. Never in a PR. |
| `.claude/verify.json` | yes | Only needed when `detect-verify.sh` cannot find your test commands. |
| `.claude/ccs-run.json` | yes | Optional: `{"allow":[...],"deny":[...]}` extra permission rules for runs. |

## `tasks.md`: the contract the runner reads

```
- [ ] T004 [US1] [api] [P] Add POST /users in apps/api/src/users.ts (zod body, 201/400)
      AC: AC-4.1 valid body returns 201 and the user | check: pnpm --filter api test users
      AC: AC-4.2 (negative) GET /health still returns 200 | check: pnpm --filter api test health
      deps: T002, T003        autonomy: auto
```

- **Tags**: `[US1]` story, `[api]|[web]|[mobile]|[shared]` component, `[P]` parallel-safe, `[setup]|[found]|[polish]` outside stories.
- **Tests are not separate tasks.** Each task writes its failing test first, then the code, and leaves the suite green.
  A task that only adds red tests could never verify PASS.
- **`autonomy: human (reason: ...)`** keeps a task out of unattended runs: ambiguous requirements,
  visual/design work, auth/crypto/access control, new architecture decisions, migrations against anything but a
  local database, anything needing a device or credentials. `ccs-lint` rejects risky wording on an `auto` task unless you
  write a reason.
- `node plugins/ccs-core/bin/ccs-lint.mjs specs/NNN-slug` checks all of this deterministically.

## Writing acceptance criteria that do work

An AC must be **observable from outside the code** and **independently checkable**. Every stage downstream is a function
of the AC table: tests are written per AC, the review grades per AC, the verdict reports per AC. Vague criteria in, vague
verdict out, and the verdict looks identical either way.

| Weak | Why it fails | Strong |
|---|---|---|
| Export works correctly | Nothing to write a test against | `GET /admin/users/export` returns 200, `Content-Type: text/csv`, header row matches the column spec |
| Handles errors properly | "Properly" is unfalsifiable | A request with no `tenantId` returns 400 with `error.code=TENANT_REQUIRED` and writes no file |
| Fixes the timeout | Describes intent, not behaviour | The sessions endpoint returns within 5s for a session with 10k+ documents, no `MaxTimeMSExpired` in logs |
| Performance is improved | No baseline | p95 on `/sessions/:id` below 800ms, measured by the existing load script |

- **Every user story needs a negative AC**: something that must still work and that this change plausibly breaks.
- **Name the check in the AC.** If you cannot say how it is observed, the AC is not finished.
- **Merge ACs that always pass or fail together.** They are one criterion wearing two hats.

Read the **Assumptions** in `spec.md` and `plan.md` before approving. A wrong assumption survives every later stage
and passes verification, because the tests were generated from the same assumption.

## One task, interactively (and ad-hoc work)

The single-task pipeline from earlier versions still exists for work that is not part of a feature spec:

| Situation | Use |
|---|---|
| Ad-hoc bug fix or small enhancement | `/ccs-core:ccs-work <description>` (plan -> gate -> testplan -> implement -> review -> verify) |
| Think about the approach first | `/ccs-core:ccs-task-plan <description>`, then stop |
| Plan already approved | `/ccs-core:ccs-testplan`, then `/ccs-core:ccs-implement` |
| You wrote the code, grade it against a plan | `/ccs-core:ccs-review` |
| Fresh verdict on the existing plan | `/ccs-core:ccs-verify` |
| Parked or superseded | `/ccs-core:ccs-work-abandon` |

Ad-hoc work is stored in `specs/adhoc/<slug>/`. If you cannot write two acceptance criteria for a change, it does not need a plan.

## Why review and verify are isolated

**The reviewer receives the plan and the diff, nothing else.** A reviewer that shares the implementer's context re-derives the
same reasoning and finds it sound, because it is the same reasoning. It returns `MET`, `UNMET`, `PARTIAL` or
`UNVERIFIABLE-BY-READ` per AC. The fourth state is a feature: "needs to be run" beats a guessed MET that execution contradicts.

**The verifier never reads the diff.** Its verdict comes from exit codes and test output. A suite that exits 0 having run zero
assertions is `BLOCKED`, not `PASS`; `MANUAL` checks are `UNPROVEN`, never `PASS`; it never edits a test to make it pass.

**Red-first for bugs.** The failing test must exist and fail before the fix, with its output pasted into `02-test-plan.md`.
If the check passes before any change, the plan's root cause is wrong and the work stops.

In a feature run there is a **second, feature-level review** before the PR, by a fresh session (or Codex), that sees only the
spec, plan, contracts, constitution and the diff.

## Verdicts

- **PASS**: every AC had an automated check that passed for the right reason. Read `## Unproven` before treating it as complete.
- **FAIL**: a check failed. The runner retries with a fresh session (max 3), then marks the task FAILED.
- **BLOCKED**: checks could not run, a suite had zero assertions, an AC had no check, or the task needs a human decision
  (`BLOCKED.md`). It is the honest verdict for "we do not know" and is not a softer FAIL.

## Common mistakes

- Approving the chat summary instead of `spec.md` and `tasks.md`.
- Vague ACs: the most expensive mistake, because the failure is invisible.
- Skipping the negative AC: the run proves the new thing works and is silent about what broke.
- Marking a risky task `auto` to "save time". Auth, crypto and migrations are human tasks.
- Forgetting to commit the approved specs: the runner reads them from the base branch and will skip the feature.
- Treating BLOCKED as nearly PASS. It means the checks did not run.
- Editing an artifact to change a verdict. Every stage refuses to do this; doing it by hand removes the only reason the artifacts are trustworthy.
