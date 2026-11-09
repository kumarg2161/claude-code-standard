#!/usr/bin/env bash
# Hook: Stop
# Safety net: scan the working tree for secrets when Claude finishes.
#
# Fixes vs v1:
#   - v1's pretty ASCII box went to stdout, which on Stop is not surfaced to you
#     inline. This exits 2 so the finding goes back to Claude as something it
#     must address, and sets systemMessage so you see it too.
#   - Honours stop_hook_active so it cannot loop forever.
#   - Scanning logic now lives in scan-secrets.sh, shared with the pre-commit
#     check in pre-bash-guard.sh. Stop fires AFTER Claude may already have run
#     `git commit`, so the guard is the primary control and this is the backstop.

set -uo pipefail

INPUT=$(cat 2>/dev/null || echo '{}')

# Prevent an infinite stop/continue loop.
if command -v jq >/dev/null 2>&1; then
  [ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ] && exit 0
fi

SCAN="$(dirname "${BASH_SOURCE[0]}")/scan-secrets.sh"
[ -x "$SCAN" ] || exit 0

if OUT=$("$SCAN" worktree 2>/dev/null); then
  exit 0
fi

MSG="Potential secrets detected in the working tree:
${OUT}
Redact these or move them to environment variables before committing."

if command -v jq >/dev/null 2>&1; then
  jq -nc --arg m "$MSG" '{systemMessage:$m}'
fi
printf '%s\n' "$MSG" >&2
exit 2
