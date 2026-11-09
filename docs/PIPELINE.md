# The delivery pipeline — how the autonomy actually works

One human gate, four unattended stages, four artifacts. This document explains
what runs on its own, what stops it, and why almost everything depends on the
plan you approve at the start.

---

## 1. The shape

```
  /plan ─────────────► 01-plan.md          ◄── YOU APPROVE HERE. Only here.
    │
    ├─► /testplan ───► 02-test-plan.md     ─┐
    ├─► /implement ──► code + log           │  unattended
    ├─► /review ─────► 03-review.md         │
    └─► /verify ─────► 04-verification.md  ─┘
                             │
                             └─► VERDICT: PASS | FAIL | BLOCKED
```

`/work <description>` runs the whole chain and pauses once, at the gate.

Two properties make this different from asking Claude to "fix the bug and test it":

**Each stage reads the previous stage's file, not the conversation.** Transcript
gets compacted; files do not. Stage 4 can state exactly which acceptance criterion
each test covers because it reads the same `01-plan.md` that stage 1 wrote, hours
and many tokens later.

**Two stages run in fresh context deliberately.** The reviewer and the verifier
are subagents that never see the implementation reasoning. This is the point, not
an optimisation — see §5.

---

## 2. What "unattended" means, precisely

After you approve, Claude will not stop to ask permission, confirm it understood,
or report progress. It runs `/testplan`, `/implement`, `/review`, `/verify` in
order and reports at the end.

It **will** stop and hand back if:

| Condition | Why it stops rather than guessing |
|---|---|
| The plan's root cause turns out to be wrong | Everything downstream was derived from it |
| An acceptance criterion is unachievable as written | Weakening an AC to make it pass is the failure this exists to prevent |
| The work is already shipped | Nothing to do; the plan was based on a stale read |
| `/review` returns UNMET that needs a product decision | Not a technical call |
| `/verify` returns BLOCKED for an environmental reason it cannot fix | A missing database is not a code problem |
| A destructive or outward-facing action is needed that the plan did not authorise | Deploy, publish, migrate, force-push |
| 3 rounds of review or verify retries are exhausted | Prevents grinding |

It will **not** stop to tell you a test passed, that it is moving to the next
stage, or that it made a small decision inside the plan's boundaries. If you find
yourself being asked things mid-run, the plan was underspecified — fix the plan,
not the prompt.

**Guardrails still apply throughout.** The Bash guard and sensitive-file guard fire
on every tool call regardless of autonomy, and the Stop gate blocks the session
from ending while a work item is unverified. Autonomy means fewer questions, not
fewer controls.

---

## 3. Why the plan carries all the weight

Everything after the gate is mechanical. The plan is where judgement lives, and a
weak plan produces a confident, worthless `PASS`.

Concretely: `/testplan` writes a check per acceptance criterion. `/review` grades
the diff per acceptance criterion. `/verify` reports pass/fail per acceptance
criterion. **Every downstream stage is a function of the AC table.** Vague criteria
in, vague verdict out — and the verdict *looks* identical either way.

### Writing acceptance criteria that do work

An AC must be **observable from outside the code** and **independently checkable**.

| Weak | Why it fails | Strong |
|---|---|---|
| Export works correctly | Nothing to write a test against | `GET /admin/users/export` returns 200, `Content-Type: text/csv`, and a header row matching the column spec |
| Handles errors properly | "Properly" is unfalsifiable | A request with no `tenantId` returns 400 with `error.code=TENANT_REQUIRED` and writes no file |
| Fixes the timeout | Describes intent, not behaviour | The exam-sessions endpoint returns within 5s for a session with 10k+ documents, with no `MaxTimeMSExpired` in logs |
| Performance is improved | No baseline | p95 latency on `/sessions/:id` drops below 800ms, measured by the existing load script |

Three habits that pay for themselves:

- **Always include one negative criterion** — something that must still work and
  that this change plausibly breaks. Without it, the pipeline proves the new thing
  works and says nothing about the regression you just shipped.
- **Name the check in the AC itself.** If you cannot say how it would be observed,
  the AC is not finished, and `/testplan` will invent something to cover it.
- **Merge ACs that always pass or fail together.** They are one criterion wearing
  two hats, and they inflate the coverage table without adding evidence.

### Reading the Assumptions section

`/plan` asks at most three questions, once. Everything else it would have asked
becomes an assumption, written as a decision you can overturn in one line.

This is where scope quietly gets decided — export column set, row limits, whether
it streams or buffers, which tenant filter applies. **The assumptions matter more
than the file list.** A wrong assumption survives all four stages and passes
verification, because the tests were generated from the same assumption.

### Approving

Read `01-plan.md` itself, not the chat summary. Then either approve, or reply with
corrections in prose — "AC-2 should be 400 not 422, and export all tenants not just
the active one". Re-run `/plan` only if the root cause is wrong, not to adjust
details.

---

## 4. `/work` versus the individual commands

`/work` is the default. Use the stages directly when you want a different shape.

| Situation | Use |
|---|---|
| Normal bug, feature, or enhancement | `/work <description>` |
| You want to think about the approach before committing to it | `/plan <description>`, then stop |
| A plan already exists and was approved earlier | `/testplan`, then `/implement` |
| You wrote the code yourself and want it graded against a plan | `/review` |
| Something changed; you want a fresh verdict on the existing plan | `/verify` |
| Reviewing someone else's PR against a written spec | `/plan` the spec, then `/review` |
| Documentation work | `/work` with type DOCS — every claim gets a check |
| The work is parked or superseded | `/work-abandon` |

The stages are separable because they read files, not conversation. `/verify` run
tomorrow on a plan approved today works exactly the same.

**When not to use the pipeline at all:** a typo, a one-line config change, a
question. `/work` on trivial work costs four artifacts and a review cycle to prove
something you could see by eye. Rough line: if you cannot write two acceptance
criteria for it, it does not need a plan.

---

## 5. Why review and verify are isolated

**The reviewer receives `01-plan.md` and `git diff`. Nothing else.** No transcript,
no test plan, no rationale, no "here's what I was going for". A reviewer that
shares the implementer's context confirms the implementer's assumptions — it
re-derives the same reasoning and finds it sound, because it is the same reasoning.

It returns one of four states per AC:

- `MET` — with the file:line producing the behaviour
- `UNMET` — with what is missing
- `PARTIAL` — with the gap named
- `UNVERIFIABLE-BY-READ` — needs execution to judge

That fourth state is a feature. A reviewer that says "this needs to be run" is more
useful than one that guesses `MET` and is contradicted by stage 4.

**The verifier never reads the diff.** Its verdict comes from exit codes and test
output. It cannot be persuaded by code that looks correct. Specifically:

- A suite that exits 0 having executed zero assertions is `BLOCKED`, not `PASS`
- A check that passes for the wrong reason is a failure, even when green
- `MANUAL` checks are `UNPROVEN` and appear in the summary — never `PASS`
- It will not modify a test to make it pass; a broken check is a finding

**Red-first, for bugs.** The failing test must exist and fail *before* the fix
does, and its output is pasted into `02-test-plan.md`. Without this, stage 4 is
circular: the test was written to match whatever the code now does. If the check
passes before any change is made, the plan's root cause is wrong and the pipeline
stops.

---

## 6. Reading the output

| File | Read it when |
|---|---|
| `01-plan.md` | Before approving. Always. |
| `02-test-plan.md` | To see what will and will not be proven — check `## Not covered` |
| `03-review.md` | On `CHANGES-REQUIRED`, or to see what needed execution to judge |
| `04-verification.md` | Always, especially the `## Unproven` section |

A `PASS` means *every acceptance criterion had an automated check that passed for
the right reason*. It does not mean the change is correct — it means the change
does what the plan said, and the plan was your judgement. Read `## Unproven` before
treating a green verdict as complete coverage.

### The three verdicts

- **`PASS`** — proceed. Check `## Unproven` first.
- **`FAIL`** — a check failed. Fix and re-run `/verify`; do not edit the artifact.
- **`BLOCKED`** — checks could not run: missing database, unresolved runner, an AC
  with no check, or a suite with zero assertions. This is the honest verdict for
  "we do not know", and it is not a softer `FAIL`.

The Stop hook enforces this. While `.claude/work/.active` names a work item whose
verification is not `PASS`, Claude cannot end the turn. `/work-abandon` clears it
deliberately and records why.

---

## 7. A worked example

```
/work fix the MaxTimeMSExpired timeout on the exam sessions endpoint
```

**`/plan`** greps every surface that touches exam sessions rather than only the
endpoint named, reproduces the timeout, and writes:

- Root cause with `file:line`, evidence marked `EXECUTED`
- `AC-1`: the endpoint returns within 5s for a session with 10k+ documents
- `AC-2`: no `MaxTimeMSExpired` appears in logs for that request
- `AC-3` (negative): pagination on the same endpoint still returns correct totals
- Assumptions: which index is assumed present, what "large session" means
- Blast radius: other consumers of the same query path

It stops. You read it, fix `AC-3`'s threshold, approve.

**`/testplan`** detects the runner, writes a test reproducing the timeout, runs it,
confirms it fails with `MaxTimeMSExpired` and not a connection error, and pastes
the red output.

**`/implement`** changes only the files the plan listed, running each AC's checks
as it goes.

**`/review`** — a fresh subagent, plan and diff only — returns `MET` for AC-1 and
AC-3, `UNVERIFIABLE-BY-READ` for AC-2 (log assertions need a run), plus a `HIGH`
finding on an unrelated swallowed error it noticed in the diff.

**`/verify`** runs everything, reports per-AC results with exit codes, and emits
`VERDICT: PASS` with AC-2 now proven by execution.

Total human involvement: one description, one plan read, one correction, one
approval.

---

## 8. First run in a new repo

Two things happen automatically: `.claude/work/` is added to `.git/info/exclude`
(local, never committed), and the runner is auto-detected per component — a Python
service and a TypeScript app in one tree each get their own.

If detection prints `UNKNOWN`, copy `templates/verify.json.example` to
`.claude/verify.json`, fill it in once, and commit it. That is the only per-repo
configuration the pipeline needs.

---

## 9. Common mistakes

- **Approving the chat summary instead of the plan file.** The summary lists files;
  the file has the criteria that everything downstream is graded against.
- **Vague ACs.** The most expensive mistake, because the failure is invisible —
  you get a confident `PASS` that proves nothing.
- **Skipping the negative criterion.** The pipeline proves the new behaviour works
  and stays silent about what broke.
- **Treating `BLOCKED` as nearly `PASS`.** It means the checks did not run.
- **Editing an artifact to change a verdict.** Every stage refuses to do this;
  doing it by hand removes the only reason the artifacts are trustworthy.
- **Using `/work` for trivial changes.** Four artifacts to prove a typo fix.
- **Leaving a work item active.** The Stop gate will keep asking. `/work-abandon`.
