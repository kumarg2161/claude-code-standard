---
description: Generate specs/NNN/tasks.md: ordered, dependency-aware tasks, each with observable acceptance criteria and an autonomy flag.
argument-hint: [feature dir or number]
---

Generate tasks for: $ARGUMENTS

1. Pick the feature (status `PLANNED`). Read `spec.md`, `plan.md`, `data-model.md`, `contracts/`, `research.md`.
2. Run `"${CLAUDE_PLUGIN_ROOT}/scripts/detect-verify.sh"` to learn the components and their real
   test commands. Task tags `[api]`, `[web]`, `[mobile]`, `[shared]` must match those components.
3. Write `specs/NNN-slug/tasks.md` from `${CLAUDE_PLUGIN_ROOT}/templates/tasks.md`. **The line format in that
   template's comment is machine-read; keep it exact.** Structure:
   Phase 1 Setup -> Phase 2 Foundational (contracts, shared types, base schema, test harness; blocks all
   stories) -> one phase per user story in priority order -> Polish.
4. Task rules:
   - One task = one component, one coherent change, small enough for a single fresh session (a few files).
   - **Tests are not separate tasks.** Each task is red-first internally (failing test, then code) and must leave
     the whole suite green; a red-only task could never verify PASS. Contract tests belong to the contract task.
   - Every task has >=1 AC that is observable from outside the code and a `check:` that is a real command
     from step 2 (e.g. `pnpm --filter api test users`). Every user story has >=1 `(negative)` AC.
   - Include exact file paths. Mark `[P]` only for tasks touching different files with no dependency.
   - `deps:` must reference earlier task ids; no cycles.
5. **Autonomy.** Default `autonomy: auto`. Use `autonomy: human (reason: ...)` for: ambiguous requirements,
   visual/design-heavy work, auth/crypto/access-control, new architecture decisions, migrations against
   anything but a local database, anything needing a device/simulator, credentials or external accounts.
   List each human task and its reason under `## Not automatable (human)`.
6. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/ccs-lint.mjs" specs/NNN-slug` and fix every ERROR before finishing.
7. Print task counts (auto / human), the phase list and the next command `/ccs-core:ccs-analyze`.
