#!/usr/bin/env bash
# Add an audit line to every hook so you can prove they actually ran.
#
#   ./add-hook-audit.sh                 dry run
#   ./add-hook-audit.sh --apply
#   ./add-hook-audit.sh --apply --dir ~/.claude/hooks --log ~/.claude/hook-audit.log
#
# Inserts one append-to-log line immediately after the shebang of each hook.
# Idempotent, harmless, and removable with --remove. It does not read or consume
# stdin, so the hook's own JSON input is untouched.
#
# Why: /hooks proves REGISTRATION, not EXECUTION. A hook whose path does not
# resolve fails non-blockingly — registered, listed, and never running. The log
# is the only surface-independent proof, and it works identically in the VS Code
# extension, the terminal, and the desktop app.

set -uo pipefail

DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks"
LOG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hook-audit.log"
APPLY=0
REMOVE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --apply)  APPLY=1; shift ;;
    --remove) REMOVE=1; shift ;;
    --dir)    DIR="$2"; shift 2 ;;
    --log)    LOG="$2"; shift 2 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

MARK='# --- hook audit (added by add-hook-audit.sh) ---'
[ -d "$DIR" ] || { echo "ERROR: no hooks directory at $DIR" >&2; exit 1; }

[ "$APPLY" -eq 1 ] || echo "DRY RUN — nothing will be changed. Re-run with --apply."
echo
echo "Hooks: $DIR"
echo "Log:   $LOG"
echo

CHANGED=0
for f in "$DIR"/*.sh; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"

  if grep -qF "$MARK" "$f"; then
    if [ "$REMOVE" -eq 1 ]; then
      echo "  [${APPLY:+done}${APPLY:-would}] remove audit from $base"
      if [ "$APPLY" -eq 1 ]; then
        python3 - "$f" "$MARK" <<'PY'
import sys
path, mark = sys.argv[1], sys.argv[2]
lines = open(path).readlines()
out, skip = [], 0
for ln in lines:
    if ln.rstrip("\n") == mark:
        skip = 1          # the marker is already dropped; skip only the echo line
        continue
    if skip:
        skip -= 1
        continue
    out.append(ln)
open(path, "w").writelines(out)
PY
      fi
      CHANGED=$((CHANGED + 1))
    else
      echo "  [skip] $base (already audited)"
    fi
    continue
  fi

  [ "$REMOVE" -eq 1 ] && { echo "  [skip] $base (no audit line)"; continue; }

  if ! head -1 "$f" | grep -q '^#!'; then
    echo "  [skip] $base — no shebang on line 1, left alone"
    continue
  fi

  if [ "$APPLY" -eq 1 ]; then
    python3 - "$f" "$MARK" "$LOG" <<'PY'
import sys
path, mark, log = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).readlines()
audit = (
    mark + "\n"
    'printf "%s %s %s\\n" "$(date +%FT%T)" "$(basename "$0")" "${CLAUDE_PROJECT_DIR:-no-project}" >> '
    + log + ' 2>/dev/null || true\n'
)
lines.insert(1, audit)
open(path, "w").writelines(lines)
PY
    echo "  [done] audited $base"
  else
    echo "  [would] audit $base"
  fi
  CHANGED=$((CHANGED + 1))
done

echo
echo "Hooks touched: $CHANGED"
if [ "$APPLY" -eq 1 ] && [ "$REMOVE" -eq 0 ]; then
  echo
  echo "Now: restart Claude Code, ask it to run any command, then:"
  echo "  tail -20 '$LOG'"
  echo
  echo "Nothing in the log = the hooks are registered but never executing."
fi
