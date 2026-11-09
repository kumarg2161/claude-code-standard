# Stack packs: adding a framework

`ccs-core` knows nothing about any framework. A **stack pack** is a thin plugin that teaches Claude one
stack. Packs never depend on each other or on core's code; they meet core only through **files in the
project**. That is what lets you add Flutter, Next.js, Python/FastAPI or Go later without touching core.

Shipped packs: `ccs-backend-ts` (TypeScript API), `ccs-web-react`, `ccs-mobile-rn` (React Native / Expo).

## What a pack contains

```
plugins/ccs-<name>/
├── .claude-plugin/plugin.json
├── skills/<skill>/SKILL.md          model-invoked knowledge: patterns, conventions, pitfalls
│   └── reference/*.md               longer material, loaded on demand
├── commands/ccs-<name>-init.md      one-time wiring into the project (below)
└── templates/                       articles.md (constitution text), verify.rows.json, run-allow.json
```

No hooks, no workflow commands, no runner changes. If you feel you need one, the change probably belongs in core.

## The contract with core (three project files)

| File | What the pack's `init` command adds | Read by |
|---|---|---|
| `.specify/memory/constitution.md` | Pack-prefixed articles (`B-1` backend, `W-1` web, `M-1` mobile; pick a unique letter) between the `<!-- PACK:BEGIN -->` / `<!-- PACK:END -->` markers (e.g. "all request bodies validated with zod at the boundary") | `ccs-plan` (constitution check), `pr-reviewer`, every task session |
| `.claude/verify.json` | Component rows: dir, stack, `test`, `lint`, `typecheck` commands. Skipped when `detect-verify.sh` already finds them | `detect-verify.sh` -> test plans, verifier, runner gate |
| `.claude/ccs-run.json` | Extra `allow`/`deny` permission rules for unattended runs (e.g. `Bash(pnpm --filter api test*)`) | `ccs-run.mjs` merges them into the run settings |

The init command must be **idempotent**, append rather than overwrite, and show the user the diff.

## Rules for pack content

1. **Skills describe when to load.** The `description` is the trigger: start with "Use when ...", name the
   concrete situations and tools (`Use when writing or reviewing React Native screens, navigation or Expo config`).
   A one-line summary will rarely fire.
2. **Test recipes must run unattended.** Anything needing a simulator, device, browser install or network
   is `MANUAL` (reported as unproven) or opt-in behind an env var. Never make the autonomous path depend on it.
3. **No installs.** A pack may tell the human which dependencies to add; unattended sessions are denied `pnpm add`.
4. **Autonomy defaults.** State which kinds of task in this stack should be `autonomy: human` (e.g. visual design,
   native module changes, store configuration).
5. **Keep it short.** A skill is a checklist and a few decisive examples, not a tutorial. Prefer rules that a reviewer can check by reading a diff.

## How the runner finds packs

`ccs-run.mjs` loads `ccs-core` plus every sibling `ccs-*` directory that has a `.claude-plugin/plugin.json`, passing each with
`--plugin-dir`. It runs sessions with `--setting-sources project,local`, so packs installed through a marketplace (which are
enabled in *user* settings) are **not** loaded unless you pass them: `ccs-run.mjs --plugin-dir /path/to/pack`.

## Adding one: checklist

1. Copy `plugins/ccs-backend-ts` as a starting point and rename it; register it in `.claude-plugin/marketplace.json`.
2. Write the skill(s); validate with `claude plugin validate plugins/ccs-<name>`.
3. Write `ccs-<name>-init` and its three templates.
4. Add the stack's component rows to the **fixture** used by `tests/` if you want the runner gate exercised for it.
5. Add one `autonomy` guidance paragraph to the skill, and one line to the root README table.
