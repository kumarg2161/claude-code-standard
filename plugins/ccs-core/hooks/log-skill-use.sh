#!/usr/bin/env bash
# Hook: PreToolUse -> Skill
# Records which skill was invoked, into the same audit log the other hooks use.
#
# Read-only and never blocks: it always exits 0, whatever it finds. A logging
# hook that can fail a tool call is worse than no logging hook.
#
# Register with matcher "Skill" in ~/.claude/settings.json.

set -uo pipefail

LOG="${CLAUDE_HOOK_AUDIT_LOG:-$HOME/.claude/hook-audit.log}"
INPUT=$(cat 2>/dev/null || echo '{}')

NAME=""
if command -v jq >/dev/null 2>&1; then
  # The exact field name for the skill is not documented, so try the plausible
  # keys in order. The last branch dumps the whole tool_input, which makes the
  # first real invocation self-documenting: read the log, then narrow this.
  NAME=$(printf '%s' "$INPUT" | jq -r '
      .tool_input.name
      // .tool_input.skill
      // .tool_input.skill_name
      // .tool_input.command
      // (.tool_input | tostring)
      // empty' 2>/dev/null | head -c 200)
elif command -v python3 >/dev/null 2>&1; then
  NAME=$(printf '%s' "$INPUT" | python3 -c '
import sys, json
try:
    ti = json.load(sys.stdin).get("tool_input", {})
except Exception:
    print(""); raise SystemExit
for k in ("name", "skill", "skill_name", "command"):
    v = ti.get(k)
    if isinstance(v, str) and v:
        print(v[:200]); raise SystemExit
print(json.dumps(ti)[:200])' 2>/dev/null)
fi

[ -n "$NAME" ] || NAME="(unparsed)"

printf '%s %s %s %s\n' \
  "$(date +%FT%T)" "skill-invoked" "$NAME" "${CLAUDE_PROJECT_DIR:-no-project}" \
  >> "$LOG" 2>/dev/null || true

exit 0
