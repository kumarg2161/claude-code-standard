#!/usr/bin/env bash
# Hook: Stop
# Gate: an ACTIVE work item may not be left unverified.
#
# Fires only when .ccs/active names a live task directory. Ordinary chats,
# one-off questions, and exploration are unaffected — no active marker, no gate.
#
# .ccs/active holds ONE line: a repo-relative task directory, e.g.
#   specs/001-signup/tasks/T004
# That directory holds 01-plan.md ... 04-verification.md. The marker lives in .ccs/
# (git-excluded, per checkout/worktree); the artifacts live under specs/ (committed).
#
# Exits:
#   0  nothing to gate, or verification passed
#   2  blocks the stop and hands the reason back to Claude to act on
#
# Escape hatches (both are deliberate, both leave a trace):
#   - /ccs-work-abandon    removes the active marker
#   - touch <task-dir>/.abandoned

set -uo pipefail

INPUT=$(cat 2>/dev/null || echo '{}')

# --- JSON helpers: jq if present, python3 otherwise, neither is fatal ---
json_field() { # $1 = top-level key
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg k "$1" '.[$k] // empty' 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get(sys.argv[1],"") or "")
except Exception: print("")' "$1" 2>/dev/null
  fi
}

json_block() { # $1 = message -> {"decision":"block","reason":...,"systemMessage":...}
  if command -v jq >/dev/null 2>&1; then
    jq -nc --arg m "$1" '{decision:"block", reason:$m, systemMessage:$m}'
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import sys,json
m=sys.argv[1]; print(json.dumps({"decision":"block","reason":m,"systemMessage":m}))' "$1"
  fi
}

# Never loop. Without a JSON parser this cannot be checked, so fail open.
if command -v jq >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1; then
  [ "$(json_field stop_hook_active)" = "true" ] && exit 0
else
  exit 0
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
ACTIVE_FILE="$ROOT/.ccs/active"

# No active work item — not our business.
[ -f "$ACTIVE_FILE" ] || exit 0

SLUG=$(tr -d '[:space:]' < "$ACTIVE_FILE" 2>/dev/null)
[ -n "$SLUG" ] || exit 0
# Refuse absolute paths and traversal: the marker is data, not a command.
case "$SLUG" in /*|*..*) exit 0 ;; esac

DIR="$ROOT/$SLUG"
[ -d "$DIR" ] || exit 0
[ -f "$DIR/.abandoned" ] && exit 0

PLAN="$DIR/01-plan.md"
VERIFY="$DIR/04-verification.md"

block() {
  local msg="$1"
  json_block "$msg"
  printf '%s\n' "$msg" >&2
  exit 2
}

# A plan awaiting approval is a legitimate stopping point — that IS the gate.
if [ -f "$PLAN" ] && grep -qE '^- \*\*Status:\*\* *AWAITING-APPROVAL' "$PLAN" 2>/dev/null; then
  exit 0
fi

if [ ! -f "$VERIFY" ]; then
  block "Work item '${SLUG}' is active but has no 04-verification.md.
Run /ccs-verify before finishing, or /ccs-work-abandon if this item is no longer being worked on."
fi

VERDICT=$(grep -m1 -oE '^VERDICT: *(PASS|FAIL|BLOCKED)' "$VERIFY" 2>/dev/null | awk '{print $2}')

case "$VERDICT" in
  PASS)
    exit 0
    ;;
  FAIL|BLOCKED)
    UNMET=$(grep -E '\| *(FAIL|BLOCKED|UNPROVEN) *\|' "$VERIFY" 2>/dev/null | head -5)
    block "Work item '${SLUG}' verification returned ${VERDICT}, not PASS.
${UNMET}
Fix the failing checks and re-run /ccs-verify. Do not edit 04-verification.md to change the verdict."
    ;;
  *)
    block "Work item '${SLUG}' has a 04-verification.md with no readable VERDICT line.
Line 2 must be exactly 'VERDICT: PASS', 'VERDICT: FAIL', or 'VERDICT: BLOCKED'. Re-run /ccs-verify."
    ;;
esac
