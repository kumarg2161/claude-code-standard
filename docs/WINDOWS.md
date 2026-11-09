# Running this setup on native Windows

For teammates running Claude Code directly on Windows rather than through WSL.
If you use WSL, follow the main README — you are on the Linux path and none of
this applies.

## Install

From PowerShell:

```powershell
git clone <this-repo> claude-standard
cd claude-standard
Copy-Item templates\CLAUDE.personal.example.md CLAUDE.personal.md   # edit it
.\install.ps1            # dry run
.\install.ps1 -Apply
```

Config goes to `%USERPROFILE%\.claude`. If PowerShell blocks the script, run it
for this session only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

## Install Git for Windows first

Every hook in this repo is a POSIX shell script. Hook commands execute under Git
Bash when it is on PATH, and fall back to `cmd.exe` otherwise — where a `.sh`
file will not run.

That failure is **non-blocking**. The hooks stay listed in `/hooks`, report
nothing, and never execute. Your entire safety layer is off and looks fine.

`install.ps1` checks for Git Bash and warns before letting you continue. If it is
installed but not detected, set the path in your `settings.json`:

```json
{ "env": { "CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe" } }
```

Claude Code without Git for Windows still works — it uses PowerShell for shell
commands. It is only the hooks that need bash.

## Two Windows-specific traps the installer handles

**Backslash paths break under Git Bash.** A hook registered as
`C:\Users\me\.claude\hooks\x.sh` is read as escape sequences, not a path:

```
bash: line 1: C:Usersme.claudehooksx.sh: command not found
```

Hook commands are therefore written in POSIX form —
`/c/Users/me/.claude/hooks/x.sh` — which `install.ps1` generates for you. If you
add a hook by hand, convert the path the same way.

**CRLF line endings break shell scripts.** A `.sh` checked out with CRLF fails
under bash with `\r: command not found`. The repo's `.gitattributes` forces LF on
`*.sh` regardless of your `core.autocrlf`, and the installer normalises endings
as it writes. If you edit a hook in Notepad, check the endings before committing.

## Verify it actually works

`/hooks` proves registration, not execution. Restart Claude Code, then:

```powershell
bash "/c/Users/$env:USERNAME/.claude/tools/add-hook-audit.sh" --apply
```

Restart again, use Claude for anything, then check
`%USERPROFILE%\.claude\hook-audit.log`. Entries mean the hooks are firing. An
empty file means they are registered and dead — almost always Git Bash missing,
a backslash path, or CRLF endings.

## VS Code extension

The extension has a known issue where it reports "Claude Code on Windows requires
git-bash" despite Git Bash being installed and `CLAUDE_CODE_GIT_BASH_PATH` set at
both user and machine level. The CLI works from a terminal in the same
environment. If you hit it, run Claude Code from the terminal until it is fixed.

## Which config directory is live

Windows and WSL keep separate configs. `C:\Users\you\.claude` and
`\\wsl$\Ubuntu\home\you\.claude` are different directories, and installing into
one while running the other is the most common way to spend an hour debugging a
setup that was never loaded.

Run `claude doctor` and `/status` to confirm which one is in use before
installing. If VS Code shows `WSL: Ubuntu` in the status bar, you are on the
Linux side — use `install.sh`, not this file.

## The pipeline itself

Unchanged. `/work`, `/plan`, `/testplan`, `/implement`, `/review`, `/verify` all
behave identically; `detect-verify.sh` and `ensure-ignored.sh` run through the
Bash tool. See `docs/PIPELINE.md`.

One caveat: if your repo lives on a network drive or a mapped share, `git
rev-parse --show-toplevel` can return a UNC path that Git Bash handles poorly.
Keep repos on a local drive.
