# claude-code-standard

Shared Claude Code configuration for the team: engineering rules, commands,
subagents, safety hooks, domain skills, and a plan → test → review → verify
delivery pipeline.

Works on macOS, Linux, WSL, and native Windows from the same clone.

---

## Quick start

### macOS / Linux / WSL

```bash
git clone https://git.example.com/your-org/claude-code-standard.git
cd claude-code-standard
cp templates/CLAUDE.personal.example.md CLAUDE.personal.md   # edit: your role, stack, tone
./install.sh            # dry run — shows every action, changes nothing
./install.sh --apply
```

### Windows (PowerShell, not WSL)

```powershell
git clone https://git.example.com/your-org/claude-code-standard.git
cd claude-code-standard
Copy-Item templates\CLAUDE.personal.example.md CLAUDE.personal.md   # edit it
.\install.ps1           # dry run
.\install.ps1 -Apply
```

If PowerShell blocks the script:
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

**Install Git for Windows first.** Every hook here is a POSIX shell script, and
hook commands run under Git Bash when it is present. Without it they are
registered, listed, and never execute — silently. See
[`docs/WINDOWS.md`](docs/WINDOWS.md).

**Using WSL?** Use `install.sh` from inside the WSL terminal, not `install.ps1`.
Windows and WSL have separate config directories, and installing into the wrong
one is the most common setup failure. `claude doctor` and `/status` tell you which
is live.

### Then, on every platform

1. **Restart Claude Code completely** — commands and hooks load at startup.
2. `/hooks` → expect **PreToolUse: 3**, **Stop: 2**
3. Type `/` → expect `/work`, `/plan`, `/verify` alongside the team commands
4. Prove the hooks actually run (below)

---

## Prove the hooks run

`/hooks` shows what is **registered**, not what **executes**. A hook whose path
fails to resolve stays listed and silently never runs — no error, no warning.

```bash
# macOS / Linux / WSL
~/.claude/tools/add-hook-audit.sh --apply

# Windows (PowerShell)
bash "/c/Users/$env:USERNAME/.claude/tools/add-hook-audit.sh" --apply
```

Restart Claude Code, use it for anything, then check `~/.claude/hook-audit.log`
(`%USERPROFILE%\.claude\hook-audit.log` on Windows).

Entries mean the safety layer is live. An empty file means it is configured and
dead. Do this once per machine before trusting it. `--remove` reverses it.

---

## The delivery pipeline

```
/work fix the timeout on the exam sessions endpoint
```

Investigates, writes `.claude/work/<slug>/01-plan.md` with numbered acceptance
criteria, then **stops for your approval**. That is the only human gate. After
approval it runs test plan → implement → review → verify unattended and reports
`PASS` / `FAIL` / `BLOCKED`.

**Read [`docs/PIPELINE.md`](docs/PIPELINE.md) before your first run.** It covers
what runs unattended and what stops it, how to write acceptance criteria that
actually constrain the later stages, and when to use `/work` versus the
individual commands.

Four design rules worth knowing before changing anything:

- **The reviewer never sees the implementer's reasoning.** Plan and diff only. A
  reviewer sharing context confirms assumptions instead of testing them.
- **The verifier never reads the diff.** Its verdict comes from exit codes. A
  suite that exits 0 having run zero assertions is `BLOCKED`, not `PASS`.
- **Bugs are red-first.** The failing test must exist and fail before the fix
  does, with its output recorded.
- **Artifacts, not transcript.** Each stage reads the previous stage's file, so
  nothing is lost to compaction.

Runners are auto-detected per component, so a Python service and a TypeScript app
in one repo each get their own. If detection prints `UNKNOWN`, copy
`templates/verify.json.example` to `.claude/verify.json` and commit it — the only
per-repo config. `.claude/work/` is added to `.git/info/exclude` automatically on
first use.

---

## What is in here

| Path | What |
|---|---|
| `install.sh` / `install.ps1` | Installers — bash and PowerShell |
| `base/CLAUDE.team.md` | Shared rules: anti-hallucination, security, code style, git |
| `base/rules/` | Behaviour and code standards |
| `base/commands/` | `/start-task`, `/review-code`, `/design-api`, `/estimate-effort`, … |
| `base/agents/` | `explore-codebase`, `security-reviewer` |
| `base/hooks/` | Bash guard, sensitive-file guard, secret scanners, skill logger |
| `base/skills/` | `architect`, `api-design`, `db-design`, `devops`, `product-consult`, `proposal` |
| `pipeline/` | `/work` `/plan` `/testplan` `/implement` `/review` `/verify` + reviewer and verifier subagents |
| `templates/` | Personal CLAUDE.md stub, `verify.json` example |
| `tools/` | Audit and link-health scripts |
| `docs/PIPELINE.md` | How the autonomy works, and how to write a plan worth approving |
| `docs/WINDOWS.md` | Native Windows: Git Bash, path form, line endings |

Skills are model-invoked — Claude matches your request against each skill's
`description` line and loads what fits. Nothing to type, though `/architect`
forces one. If a skill never fires, widen its description rather than assuming it
is broken.

---

## What is deliberately NOT shared

- **`settings.json`** — hook paths are absolute and machine-specific, so each
  installer generates them locally. Gitignored.
- **`CLAUDE.personal.md`** — your profile and tone preferences. Gitignored.
- **`rules/lessons.md`** — ships empty. Lessons are specific to the projects and
  clients you work on. Anything genuinely general belongs in `core-behaviors.md`
  or `code-standards.md`, where it gets reviewed rather than accumulated.

---

## Uninstall / roll back

Both installers write a timestamped backup before touching anything.

```bash
# macOS / Linux / WSL
rm -rf ~/.claude && tar -xzf ~/.claude.backup-<timestamp>.tar.gz -C ~
```

```powershell
# Windows — expand the backup zip over %USERPROFILE%\.claude
Expand-Archive "$env:USERPROFILE\.claude-backup-<timestamp>.zip" -DestinationPath "$env:USERPROFILE\.claude" -Force
```

---

## Known rough edges

- `CLAUDE.md` tells Claude to delete the oldest lesson past 15 entries. That
  evicts by age, not value — graduate lessons worth keeping into the rules files.
- `.claudeignore` is not a mechanism Claude Code reads. File access is governed by
  `permissions.deny` in `settings.json`.
- `architect` and `api-design` overlap on API work. Whichever description matches
  better wins, which is arbitrary until they are differentiated.
- The VS Code extension on Windows has a known issue reporting "requires
  git-bash" despite Git Bash being installed. The CLI works in the same
  environment — see `docs/WINDOWS.md`.

---

## Contributing

Changes to `base/` and `pipeline/` affect everyone — open a PR.

Test against a scratch destination, never your live config:

```bash
./install.sh --apply --dest ~/.claude-test          # macOS / Linux / WSL
.\install.ps1 -Apply -Dest "$env:USERPROFILE\.claude-test"   # Windows
```

Shell scripts must stay POSIX-portable: no `readlink -f`, no `mapfile`, no
`sed -i` without a backup argument, no bash 4 syntax. macOS ships bash 3.2 and
BSD userland, and the usual failure is a script that appears to work while
silently doing nothing.
