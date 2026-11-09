# Feature Spec: {{TITLE}}

- **Feature:** {{NNN-slug}}
- **Created:** {{DATE}}
- **Status:** DRAFT <!-- DRAFT -> CLARIFIED -> PLANNED -> APPROVED. Only /ccs-core:ccs-approve sets APPROVED. -->
- **Input:** {{USER DESCRIPTION, verbatim}}

## User Scenarios & Testing *(mandatory)*

<!-- Stories are prioritised and INDEPENDENTLY testable: shipping only P1 must still deliver value.
     Describe what a user can do and observe, never how it is built. -->

### User Story 1 — {{title}} (Priority: P1)

{{one or two sentences in plain language}}

**Why this priority:** {{value}}
**Independent test:** {{how this story alone is demonstrated}}

**Acceptance scenarios:**
1. **Given** {{state}}, **When** {{action}}, **Then** {{observable outcome}}

### User Story 2 — {{title}} (Priority: P2)

<!-- repeat -->

### Edge cases

- {{boundary condition / failure mode, and the expected behaviour}}

## Requirements *(mandatory)*

### Functional requirements

- **FR-001:** System MUST {{capability}}.
- **FR-002:** System MUST {{capability}} [NEEDS CLARIFICATION: {{what is unknown}}]

### Key entities

- **{{Entity}}:** {{what it represents, key attributes — no storage details}}

## Success criteria *(mandatory)*

- **SC-001:** {{measurable, technology-agnostic outcome}}

## Constraints & negative space

<!-- What the agent must NOT do, and what must keep working. These bind every task. -->
- Must not: {{e.g. change the auth middleware, add dependencies without a written reason}}
- Must keep working: {{existing behaviour this feature plausibly breaks}}

## Assumptions

- {{decision made in place of a question; phrased so it can be overturned in one line}}

## Clarifications

<!-- /ccs-core:ccs-clarify appends: ### Session YYYY-MM-DD, then "- Q: ... -> A: ..." -->
