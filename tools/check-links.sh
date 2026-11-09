#!/usr/bin/env bash
# Confirm the live config is still symlinked at the repo.
#
#   ./check-links.sh [--dest ~/.claude] [--repo ~/projects/Claude_setup_Srinidhi]
#
# Why this exists: a tool that saves a file by writing a temporary copy and
# renaming it over the target replaces the SYMLINK with a regular file. Nothing
# errors, both copies keep working, and the repo silently stops being the source
# of truth. That is exactly how a config splits in two without anyone noticing.
#
# Exit 0 = all good, 1 = something drifted.

set -uo pipefail

REPO="${HOME}/projects/Claude_setup_Srinidhi"
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --dest) DEST="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

MANAGED="CLAUDE.md .claudeignore-template rules commands agents hooks scripts skills"
BAD=0

# Portable path resolution. `readlink -f` is GNU-only; on BSD/macOS it fails and
# returns an empty string. Comparing two empty strings succeeds, so the naive
# version reports every link healthy on macOS -- a false pass, which is worse
# than no check at all.
resolve() {
  [ -e "$1" ] || return 1
  if command -v realpath >/dev/null 2>&1; then
    realpath "$1" 2>/dev/null && return 0
  fi
  if readlink -f / >/dev/null 2>&1; then
    readlink -f "$1" 2>/dev/null && return 0
  fi
  if [ -d "$1" ]; then
    ( cd "$1" 2>/dev/null && pwd -P )
  else
    ( cd "$(dirname "$1")" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$(basename "$1")" )
  fi
}

printf 'live: %s\nrepo: %s\n\n' "$DEST" "$REPO"

for item in $MANAGED; do
  L="$DEST/$item"
  R="$REPO/$item"

  if [ ! -e "$L" ] && [ ! -e "$R" ]; then
    printf '  --   %-24s absent from both\n' "$item"
    continue
  fi

  if [ -L "$L" ]; then
    RL="$(resolve "$L")"; RR="$(resolve "$R")"
    if [ -n "$RL" ] && [ "$RL" = "$RR" ]; then
      printf '  ok   %-24s -> repo\n' "$item"
    else
      printf '  BAD  %-24s links to %s\n' "$item" "$(readlink "$L")"
      BAD=$((BAD + 1))
    fi
  elif [ -e "$L" ]; then
    printf '  BAD  %-24s REAL FILE, not a link — repo is no longer authoritative\n' "$item"
    printf '       reconcile: diff -r "%s" "%s"\n' "$L" "$R"
    BAD=$((BAD + 1))
  else
    printf '  BAD  %-24s missing from live config\n' "$item"
    BAD=$((BAD + 1))
  fi
done

echo
if command -v git >/dev/null 2>&1 && [ -d "$REPO/.git" ]; then
  DIRTY=$(git -C "$REPO" status --porcelain 2>/dev/null | wc -l)
  [ "$DIRTY" -gt 0 ] && printf '  note: %s uncommitted change(s) in the repo\n\n' "$DIRTY"
fi

if [ "$BAD" -eq 0 ]; then
  echo "All managed items link to the repo."
  exit 0
fi

echo "$BAD item(s) drifted. Fix before editing config in either place."
exit 1
