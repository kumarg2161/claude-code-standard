# Project Constitution

<!-- Written by /ccs-core:ccs-init. Articles I-VII are the core standard. Stack packs append
     VIII+ between the PACK markers. Amend with /ccs-core:ccs-constitution (dated, with a reason);
     never edit an article silently. Every plan is checked against this file. -->

**Ratified:** {{DATE}} · **Last amended:** {{DATE}}

## Article I — Evidence over assertion

- Modify existing files first. Never create a new file when an existing one can be changed.
  No `*-v2`, `*-new`, `*-enhanced` variants.
- Read a file before editing it. Never generate an edit from memory of what the file contained.
- Status is binary: DONE or NOT DONE. Report only what you verified by reading code or running a command.
- If unsure, say "I'm not sure". When challenged, re-examine the code before agreeing or disagreeing.
- Mark ambiguity as `[NEEDS CLARIFICATION: question]`. Do not guess a requirement.

## Article II — Security (non-negotiable)

- Never read, print or write secrets: `.env`, private keys, keystores, cloud credentials, tfstate.
- Never run destructive database commands (DROP, TRUNCATE, DELETE without WHERE) or commands
  against a shared or production database.
- Never push to `main`/`master`/`production`/`release`, never force-push, never rewrite history.
- Never POST/PUT data to external services, or run `curl | sh`, or execute packages that are not in the lockfile.
- A hardcoded secret is reported as `FILE:LINE` with the value redacted.
- Validate input at every boundary. Never log secrets, tokens or PII.

## Article III — Test-first

- Every acceptance criterion has an automated check that passes for the right reason.
- Bugs are red-first: the failing test exists and fails, with output recorded, before the fix.
- A suite that executes zero assertions is BLOCKED, not PASS. Skipped is not passing.
- MANUAL checks are UNPROVEN and are listed in the report; they are never PASS.

## Article IV — Contracts first

- Behaviour that crosses a boundary (HTTP API, shared types, mobile↔API) is specified as a contract
  under `specs/<feature>/contracts/` before it is implemented, and contract tests precede implementation.
- Shared types come from the contract, not from copy-pasting between apps.

## Article V — Simplicity

- Use framework features directly; do not wrap them without a written reason.
- No speculative abstraction ("future-proofing"). Extract only when a pattern appears 3+ times.
- Dead code is deleted, not commented out.
- A violation is allowed only if recorded in the plan's Complexity Tracking table with the simpler
  alternative and why it was rejected.

## Article VI — Errors propagate

- Every function that can fail has explicit error handling. Catch blocks log with context AND re-throw
  or return a meaningful error. Never swallow an error, and never return `[]`/`{}`/`null` to hide one.
- Every query handles "not found". Log at the right level (error / warn / info for business events).

## Article VII — Delivery

- Conventional commits: `feat|fix|refactor|docs|chore|perf|test(scope): message`.
- Check `git status` before committing. Never commit secrets, `.ccs/` (run scratch) or `ccs-reports/` (generated reports).
- Per-task evidence (`specs/<feature>/tasks/Txxx/`) and independent reviews (`specs/<feature>/review/`) ARE committed on purpose:
  they are the audit trail and travel with the PR. Do not flag or remove them.
- Unattended work runs only on tasks marked `autonomy: auto`. These are never auto: ambiguous
  requirements, design-heavy or visual work, auth/crypto/access-control changes, new architecture
  decisions, and migrations against anything but a local database.
- Unattended work never pushes, opens PRs, deploys or publishes by itself; the runner does that,
  after an independent review.

<!-- PACK:BEGIN -->
<!-- Stack packs append pack-prefixed articles (B-1, W-1, M-1) here via their ccs-<pack>-init command. -->
<!-- PACK:END -->

## Amendments

<!-- Format: - YYYY-MM-DD · Article N · what changed · why · approved by -->

## Lessons

When the user corrects a mistake, append one line to `.specify/memory/lessons.md`:
`- **[Category]**: <what went wrong> → <correct approach>`.
Graduate lessons that apply to every project into an article here (via an amendment) before they
are trimmed; do not evict by age.
