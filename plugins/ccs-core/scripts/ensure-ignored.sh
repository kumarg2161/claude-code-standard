#!/usr/bin/env bash
# Keep run-scratch and generated reports out of git, without touching a tracked file.
#
# Ignored (local only):
#   .ccs/          per-run scratch: active pointer, worktrees, run ledgers, logs
#   ccs-reports/   generated HTML status reports
#
# NOT ignored, on purpose: specs/ (spec.md, plan.md, tasks.md, per-task artifacts).
# Specs are the product's source of truth and travel with the PR.
#
# Writes to .git/info/exclude: per-clone, never committed, never in `git status`.
# In a linked worktree, .git is a file; --git-common-dir resolves to the shared
# directory, so the exclusion covers the main checkout and every worktree.
#
# Always exits 0. Ignoring is a convenience, never a blocker.

set -uo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -n "$ROOT" ] || exit 0
cd "$ROOT" || exit 0

GITDIR=$(git rev-parse --git-common-dir 2>/dev/null) || exit 0
case "$GITDIR" in /*) ;; *) GITDIR="$ROOT/$GITDIR" ;; esac
EXCLUDE="$GITDIR/info/exclude"
mkdir -p "$(dirname "$EXCLUDE")" 2>/dev/null || exit 0

for TARGET in ".ccs/" "ccs-reports/"; do
  # Already ignored by .gitignore, a global excludesFile, or info/exclude?
  git check-ignore -q "${TARGET}probe" 2>/dev/null && continue
  # Deliberately tracked? Leave it alone.
  git ls-files --error-unmatch "${TARGET%/}" >/dev/null 2>&1 && continue
  grep -qxF "$TARGET" "$EXCLUDE" 2>/dev/null && continue
  {
    grep -q 'ccs-core ensure-ignored' "$EXCLUDE" 2>/dev/null ||
      printf '\n# ccs-core run artifacts (local only; added by ensure-ignored.sh)\n'
    printf '%s\n' "$TARGET"
  } >> "$EXCLUDE" 2>/dev/null || continue
  echo "ignored: $TARGET via $EXCLUDE"
done
exit 0
