---
description: Investigate and produce a gated work plan with numbered acceptance criteria.
---

Plan the work described in: $ARGUMENTS

You are in PLAN mode. Do not modify, create, or delete any source file in this command.
The only file you write is the plan artifact described in step 5.

## 1. Classify

Pick exactly one WORK TYPE. It changes what counts as evidence and what counts as done.

| Type | Done means |
|---|---|
| BUG | The failing behaviour is reproduced, then no longer reproduces |
| FEATURE | New observable behaviour exists and is exercised |
| ENHANCEMENT | Existing behaviour changed measurably, old behaviour not broken |
| REFACTOR | Behaviour provably identical, structure changed |
| REVIEW | Findings produced with file:line evidence; no code changed |
| DOCS | Every claim in the document is executable or checkable |

Derive a slug: `<type-lowercase>-<3-5-word-kebab-summary>`. Example: `bug-exam-session-cursor-timeout`.

## 2. Locate — this is a search question, not a reading question

Before forming any hypothesis:

- `grep` for the behaviour across EVERY surface that could own it, not only the one the request names. A request that points at one screen, endpoint, or module is a hint about symptoms, not about ownership.
- Check whether the work already exists, wholly or partly. Shipped code that nobody told you about is the most common cause of a wasted plan.
- For BUG: identify the UPSTREAM producer of the bad data or state before blaming the consumer that displays it. A component behaving correctly on corrupted input is not the bug.

## 3. Establish evidence

State, for each claim you are about to make, which of these you have:

- `EXECUTED` — you ran it and observed the result
- `CODE-READ` — you read the code and reasoned about it
- `ASSUMED` — neither

A code read reliably finds the cause you went looking for and reliably misses the one sitting next to it. For BUG and ENHANCEMENT, do not present a root cause as settled with only CODE-READ evidence. If a reproduction is cheap, run it now. If it is not cheap, say so and mark the cause PROVISIONAL in the plan.

If your reasoning depends on sample data, fixtures, or a corpus, verify the sample can answer the question being asked before using it. Masked, redacted, synthetic, or truncated records mechanically produce findings that look like signal. Check the comparison target, not just the value being measured.

## 4. Questions — at most three, once, in a single message

If something is genuinely ambiguous and the answer would change the design, ask. Hard limits:

- Maximum 3 questions
- All in one message
- Only once per task — you do not get a second round

Everything else you would have asked becomes a line under `## Assumptions` in the plan, phrased as a decision you made and the user can overturn at the gate. Do not ask about anything you can determine by reading the repo.

## 5. Write the plan

Write to `.claude/work/<slug>/01-plan.md`, creating directories as needed. Then write the slug (and nothing else) to `.claude/work/.active`.

Run `.claude/scripts/ensure-ignored.sh` once, from the repo root. It adds `.claude/work/` to
`.git/info/exclude` if it is not already ignored — local to this clone, never committed, nothing for
the user to configure. It is a no-op on repos that already ignore or deliberately track the path.

```markdown
# <Title>

- **Type:** BUG | FEATURE | ENHANCEMENT | REFACTOR | REVIEW | DOCS
- **Slug:** <slug>
- **Created:** <YYYY-MM-DD>
- **Status:** AWAITING-APPROVAL

## Problem / Requirement
<2-4 sentences. For BUG: the observed behaviour and the expected behaviour.
For FEATURE/ENHANCEMENT: the business need, in the language a stakeholder would use.>

## Root cause / Approach
<For BUG: the mechanism, with file:line. Mark PROVISIONAL if not reproduced.
For others: the chosen approach in 3-5 bullets.>

**Evidence:** EXECUTED | CODE-READ | ASSUMED — <one line on what was actually run or read>

## Acceptance criteria

| ID | Observable behaviour | How it is checked |
|---|---|---|
| AC-1 | <what is true after this work that is not true now> | <the command, endpoint call, or query that shows it> |
| AC-2 | ... | ... |

Rules for acceptance criteria:
- Observable from outside the code. "Handles the error correctly" is not an AC; "a request with a
  missing tenant id returns 400 with error.code=TENANT_REQUIRED" is.
- Each one independently checkable. If two always pass or fail together, merge them.
- Include at least one NEGATIVE criterion: what must still work that this change could break.
- For DOCS: each AC is a claim in the document plus the command that proves the claim.

## Files to modify
<Explicit paths. Modify existing files; do not create parallel *-v2 / *-new files.
If a new file is genuinely required, justify it in one line.>

## Blast radius
- **Callers / dependants:** <who consumes what is changing>
- **Data:** <migrations, backfills, schema changes — or None>
- **Config / infra:** <env vars, IAM, queues — or None>
- **Rollback:** <how this is undone>

## Out of scope
<Adjacent things you deliberately are not touching.>

## Assumptions
- <Decision made in place of a question, phrased so the user can overturn it in one line.>

## Open risks
- <What could make this plan wrong, and the one observation that would falsify it.>
```

## 6. Stop

Print the acceptance criteria table and the assumptions in chat, then stop and wait for approval.
This is the only approval gate in the pipeline — everything after it runs unattended.

Do not begin implementation. Do not run `/testplan` yourself. Wait.
