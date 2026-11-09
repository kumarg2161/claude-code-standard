# Native Windows notes

**Status: untested.** The plugin was built and verified on macOS. This page keeps what is known to matter on native
Windows from earlier versions of this repo, plus the new risks the plugin layout introduces. If you use WSL, follow the
README: you are on the Linux path and none of this applies.

## Git for Windows is required for the hooks

Every hook is a POSIX shell script. Hook commands run under Git Bash when it is on PATH and fall back to `cmd.exe`
otherwise, where a `.sh` file will not run. That failure is **non-blocking**: the hooks stay listed in `/hooks`, report
nothing, and never execute. Your entire safety layer is off and looks fine.

If Git Bash is installed but not detected, set it in `settings.json`:

```json
{ "env": { "CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe" } }
```

## Known traps

- **Backslash paths break under Git Bash.** `C:\Users\me\x.sh` is read as escape sequences
  (`C:Usersmex.sh: command not found`). The plugin registers hooks as `bash "${CLAUDE_PLUGIN_ROOT}/hooks/x.sh"`.
  **Whether `CLAUDE_PLUGIN_ROOT` expands to a backslash path on Windows is unverified.** If hooks never fire, this is the first suspect.
- **CRLF breaks shell scripts** (`\r: command not found`). `.gitattributes` forces LF on `*.sh`; check line endings if you edit a hook in Notepad.
- **The runner** (`bin/ccs-run.mjs`) is Node and avoids shell-specific code, but it runs `git`, `gh`, `pnpm` and `bash` (for
  `detect-verify.sh`) by name. It has not been run on Windows.
- Keep repos on a local drive. On a mapped share, `git rev-parse --show-toplevel` can return a UNC path that Git Bash handles poorly.
- The VS Code extension has a known issue reporting "requires git-bash" despite Git Bash being installed. The CLI works in the same environment.
- Windows and WSL keep **separate** Claude configs (`C:\Users\you\.claude` vs `\\wsl$\...\.claude`). Check `claude doctor` and `/status`
  to see which is live before installing plugins.

## Prove the hooks run

`/hooks` shows registration, not execution. Ask Claude to run `cat .env` in a scratch repo that contains a fake `.env`.
The Bash guard should block it and append a `DENY` line to `%USERPROFILE%\.claude\hook-audit.log`. No entry means the hooks are
registered and dead. Set `CLAUDE_HOOK_LOG` to use a different log path.
