# Tasks: {{TITLE}}

- **Feature:** {{NNN-slug}}
- **Inputs:** spec.md, plan.md, data-model.md, contracts/, research.md
- **Generated:** {{DATE}}

<!--
LINE FORMAT (one task = one line + indented fields; machine-read by ccs-run, keep it exact):

- [ ] T004 [US1] [api] [P] <imperative description with the exact file path(s)>
      AC: AC-4.1 <observable behaviour> | check: <command or test name>
      AC: AC-4.2 (negative) <what must still work> | check: <command or test name>
      deps: T002, T003        autonomy: auto

Tags     [US1]  user story it serves ([setup]/[found]/[polish] outside stories)
         [api]|[web]|[mobile]|[shared]  component, maps to a verify.json component
         [P]    may run in parallel with other [P] tasks (different files, no dependency)
Fields   deps:      task ids that must be DONE first, or "none"
         autonomy:  auto | human. A human task carries "(reason: ...)" and is skipped overnight.
Status   - [ ] pending   - [x] done (set by the runner/verify, never by hand mid-run)
Every task has >=1 AC, and at least one negative AC per user story.
Tests are NOT separate tasks. Each task writes its own failing test FIRST, then the code (red-first,
evidence recorded in 02-test-plan.md), because a task that only adds red tests can never verify PASS.
Each task must leave the whole suite green and be independently committable.
-->

## Phase 1: Setup (shared infrastructure)

- [ ] T001 [setup] [shared] Scaffold workspace packages and scripts
      AC: AC-1.1 `pnpm -r typecheck` exits 0 | check: pnpm -r typecheck
      deps: none        autonomy: auto

## Phase 2: Foundational (blocks every user story)

<!-- Contracts, shared types, base schema, test harness. Nothing in Phase 3+ starts until this is DONE. -->

## Phase 3: User Story 1 — {{title}} (P1)

**Goal:** {{story goal}} · **Independent test:** {{how to demonstrate it}}

### Tasks

<!-- each task is red-first internally: failing test, then implementation -->

**Checkpoint:** User Story 1 works on its own.

## Phase N: Polish & cross-cutting

## Dependencies & execution order

- Setup -> Foundational -> User Stories in priority order (stories may run in parallel only when independent) -> Polish.
- Within a story: contract/types -> models -> services -> endpoints -> UI -> integration. Each step is red-first.

## Not automatable (human)

<!-- Every `autonomy: human` task and why. /ccs-core:ccs-analyze checks this list matches the tasks above. -->
