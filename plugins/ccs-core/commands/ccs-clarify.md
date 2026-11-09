---
description: Resolve [NEEDS CLARIFICATION] markers and spec gaps with up to 5 targeted questions, written back into spec.md.
argument-hint: [feature dir or number; default = the only DRAFT feature]
---

Clarify the spec for: $ARGUMENTS

1. Pick the feature: the argument, else the single feature with Status `DRAFT` from
   `"${CLAUDE_PLUGIN_ROOT}/scripts/feature-status.sh"`. If several qualify, ask which.
2. Read `spec.md` and the constitution. Scan for gaps in: functional scope, data model, user interaction,
   non-functional limits, integrations, edge cases, constraints, terminology, completion signals.
   Existing `[NEEDS CLARIFICATION]` markers are mandatory questions.
3. Rank candidate questions by impact x uncertainty. Ask **at most 5 in total, one at a time**, using
   AskUserQuestion with 2-4 options and your recommended option first (label it "(Recommended)" and say why).
   Skip anything you can decide from the repo or the constitution.
4. After EACH answer, immediately edit `spec.md`: apply it to the affected section (requirements, stories,
   entities, edge cases), remove its marker, and append under `## Clarifications` / `### Session YYYY-MM-DD`:
   `- Q: <question> -> A: <answer>`. Replace contradicted text; do not leave both.
5. When done (or nothing worth asking): if no markers remain set `Status: CLARIFIED`. Print a table of
   category -> Resolved / Deferred / Clear / Outstanding, and say the next command is `/ccs-core:ccs-plan`.
   If nothing was ambiguous say "No critical ambiguities" rather than inventing questions.
