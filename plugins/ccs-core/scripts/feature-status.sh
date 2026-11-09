#!/usr/bin/env bash
# List features with their spec Status, one per line: <dir><TAB><Status><TAB><markers>
# usage: feature-status.sh [repo-root]
set -uo pipefail
ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
for d in "$ROOT"/specs/[0-9][0-9][0-9]*; do
  [ -d "$d" ] && [ -f "$d/spec.md" ] || continue
  st=$(grep -m1 -E '^- \*\*Status:\*\*' "$d/spec.md" | sed -E 's/^- \*\*Status:\*\* *([A-Z-]+).*/\1/')
  mk=$(grep -c 'NEEDS CLARIFICATION' "$d/spec.md" 2>/dev/null || true)
  printf '%s\t%s\t%s\n' "specs/$(basename "$d")" "${st:-UNKNOWN}" "${mk:-0}"
done
