#!/usr/bin/env bash
# Ensure .claude/work/ is git-ignored in this repo, without touching a tracked file.
#
# Writes to .git/info/exclude, which is per-clone, never committed, and never
# shown in `git status`. Nothing to configure per project and nothing your
# teammates inherit or have to review.
#
# No-ops when:
#   - not in a git repo
#   - the path is already ignored by any means (.gitignore, global excludes, info/exclude)
#   - artifacts are deliberately tracked (CLAUDE_WORK_TRACKED=1)
#
# Always exits 0. Ignoring is a convenience, never a blocker.

set -uo pipefail

[ "${CLAUDE_WORK_TRACKED:-0}" = "1" ] && exit 0

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -n "$ROOT" ] || exit 0
cd "$ROOT" || exit 0

TARGET=".claude/work/"

# Already ignored by .gitignore, a global excludesFile, or info/exclude? Nothing to do.
if git check-ignore -q "${TARGET}probe" 2>/dev/null; then
  exit 0
fi

# Already tracked? Leave it alone — someone chose to commit these.
if git ls-files --error-unmatch .claude/work >/dev/null 2>&1; then
  exit 0
fi

GITDIR=$(git rev-parse --git-dir 2>/dev/null) || exit 0
EXCLUDE="$GITDIR/info/exclude"
mkdir -p "$(dirname "$EXCLUDE")" 2>/dev/null || exit 0

grep -qxF "$TARGET" "$EXCLUDE" 2>/dev/null && exit 0

{
  printf '\n# Claude Code pipeline artifacts (local only — added by ensure-ignored.sh)\n'
  printf '%s\n' "$TARGET"
} >> "$EXCLUDE" 2>/dev/null || exit 0

echo "ignored: $TARGET via ${EXCLUDE#$ROOT/}"
exit 0
