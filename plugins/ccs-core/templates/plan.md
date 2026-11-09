# Implementation Plan: {{TITLE}}

- **Feature:** {{NNN-slug}} · **Date:** {{DATE}} · **Spec:** specs/{{NNN-slug}}/spec.md

## Summary

{{primary requirement + chosen technical approach, 3-5 sentences}}

## Technical context

- **Language / runtime:** {{e.g. TypeScript 5, Node 20}}
- **Components touched:** {{apps/api, apps/web, apps/mobile, packages/shared-types}}
- **Primary dependencies:** {{existing ones; any new one needs a written reason}}
- **Storage:** {{database, or none}}
- **Testing:** {{per component, from verify.json}}
- **Performance / constraints:** {{numbers, or "none stated"}}
- **Unknowns:** {{each one is a research item below, never a guess}}

## Constitution check

*GATE: must pass before Phase 0. Re-check after Phase 1 design.*

<!-- One line per article that applies, PASS or VIOLATION. A VIOLATION must appear in Complexity Tracking. -->
- [ ] Article III Test-first: every FR maps to an automated check
- [ ] Article IV Contracts first: boundary behaviour has a contract under contracts/
- [ ] Article V Simplicity: no speculative abstraction, no unjustified new dependency
- [ ] {{stack-pack articles}}

## Phase 0 — Research (`research.md`)

{{one entry per unknown: decision · rationale · alternatives rejected}}

## Phase 1 — Design

- `data-model.md`: entities, fields, relations, validation rules, state transitions.
- `contracts/`: `openapi.yaml` (and event/schema files) for every boundary this feature adds or changes.
- `quickstart.md`: the shortest executable path that demonstrates each user story end to end.

## Project structure

```text
{{the real paths that will change, per component}}
```

**Structure decision:** {{what and why}}

## Blast radius

- **Callers / dependants:** {{who consumes what is changing}}
- **Data:** {{migrations, backfills — or None}}
- **Config / infra:** {{env vars, queues — or None}}
- **Rollback:** {{how this is undone}}

## Complexity tracking

<!-- Fill ONLY if the Constitution check has violations. -->
| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|

## Open risks

- {{what could make this plan wrong, and the one observation that would falsify it}}
