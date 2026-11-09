---
description: Produce plan.md, research.md, data-model.md, contracts/ and quickstart.md for a CLARIFIED spec, gated by the constitution.
argument-hint: [feature dir or number; extra technical direction]
---

Plan the feature: $ARGUMENTS

1. Pick the feature (argument, else the single `CLARIFIED` one from `"${CLAUDE_PLUGIN_ROOT}/scripts/feature-status.sh"`).
   Refuse if `spec.md` still has `[NEEDS CLARIFICATION]` markers or Status is `DRAFT`: send the user to
   `/ccs-core:ccs-clarify`.
2. Read `spec.md`, `.specify/memory/constitution.md` (including any pack articles), and the existing code
   the feature touches. Search before deciding: reuse existing modules, schemas and patterns.
3. **Evidence rule:** every claim in `research.md` is tagged `EXECUTED`, `CODE-READ` or `ASSUMED`.
   Anything `ASSUMED` that changes the design is a risk in plan.md, not a fact.
4. Write, from `${CLAUDE_PLUGIN_ROOT}/templates/plan.md`:
   - `research.md`: one entry per unknown (decision / rationale / alternatives rejected).
   - `data-model.md`: entities, fields, relations, validation, state transitions.
   - `contracts/openapi.yaml` (plus event/schema files) for **every boundary** the feature adds or changes,
     including error responses using the project's error envelope. Contracts come before tasks (Article IV).
   - `quickstart.md`: the shortest executable path that demonstrates each user story.
   - `plan.md` with Technical context, Project structure (real paths), Blast radius and Open risks.
5. **Constitution gate**, twice: before research and after design. Tick each article that applies. A
   violation must be justified in `## Complexity tracking`; unjustified violations block the plan.
6. Use the installed stack-pack skills when they match (api-design, db-design, architect, and any
   `ccs-backend-ts` / `ccs-web-react` / `ccs-mobile-rn` skills). Ask the user at most 3 questions, once,
   only for decisions the repo cannot answer; everything else becomes a labelled Assumption.
7. Set spec `Status: PLANNED`. Print the Constitution check result, the contracts written, the risks, and
   the next command `/ccs-core:ccs-tasks`. Write no application code.
