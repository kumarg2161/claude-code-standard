---
description: Turn a feature idea into specs/NNN-slug/spec.md (what and why, never how). Does not plan or code.
argument-hint: <feature idea in plain language>
---

Create a feature spec for: $ARGUMENTS

You are writing WHAT users need and WHY. Do not name frameworks, libraries, endpoints, tables or file paths.

1. Read `.specify/memory/constitution.md` (stop and ask the user to run `/ccs-core:ccs-init` if it is missing).
2. Run `"${CLAUDE_PLUGIN_ROOT}/scripts/next-feature.sh"` for `NNN`. Slug = 2-4 kebab-case words from the idea.
   Create `specs/NNN-slug/` (no git branch: the autonomous runner makes one per feature).
3. Search the repo for existing behaviour that overlaps. If this already exists, say so and stop.
4. Write `specs/NNN-slug/spec.md` from `${CLAUDE_PLUGIN_ROOT}/templates/spec.md`:
   - User stories prioritised P1..Pn, each **independently testable** (P1 alone must deliver value),
     each with Given/When/Then scenarios and an "Independent test".
   - Functional requirements `FR-###` that are testable and unambiguous; entities without storage detail.
   - Success criteria `SC-###` that are measurable and technology-agnostic.
   - Edge cases, **Constraints & negative space** (what must not change), and Assumptions.
5. Ambiguity policy: make an informed default and record it under Assumptions. Use
   `[NEEDS CLARIFICATION: question]` ONLY where the choice materially changes scope, UX, security or data
   and no reasonable default exists. At most 5 markers; prefer fewer.
6. Self-check: no implementation detail leaked; every FR is testable; every story has an independent test;
   at least one edge case and one negative-space line. Fix what fails.
7. Status stays `DRAFT`. Print the story titles, the FR count, the markers, and the next command
   (`/ccs-core:ccs-clarify` if markers exist, else `/ccs-core:ccs-plan`). Do not plan. Do not write code.
