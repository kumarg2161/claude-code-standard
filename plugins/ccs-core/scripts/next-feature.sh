#!/usr/bin/env bash
# Print the next feature number (zero-padded, 3+ digits) by scanning specs/NNN-*.
# Considers specs/ on disk AND branches named ccs/NNN-* so numbers never collide.
# POSIX/bash 3.2 safe.   usage: next-feature.sh [repo-root]
set -uo pipefail
ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
max=0
for d in "$ROOT"/specs/[0-9][0-9][0-9]*; do
  [ -d "$d" ] || continue
  n=$(basename "$d" | sed -E 's/^([0-9]+).*/\1/'); n=$((10#$n))
  [ "$n" -gt "$max" ] && max=$n
done
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  for b in $(git -C "$ROOT" for-each-ref --format='%(refname:short)' 'refs/heads/ccs/*' 2>/dev/null); do
    n=$(printf '%s' "$b" | sed -E 's#^ccs/([0-9]+).*#\1#'); case "$n" in ''|*[!0-9]*) continue ;; esac
    n=$((10#$n)); [ "$n" -gt "$max" ] && max=$n
  done
fi
printf '%03d\n' $((max + 1))
