#!/usr/bin/env bash
# Register the skill-usage logger as a PreToolUse hook with matcher "Skill".
#   ./register-skill-audit.sh            dry run
#   ./register-skill-audit.sh --apply
set -uo pipefail
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; APPLY=0
while [ $# -gt 0 ]; do case "$1" in
  --apply) APPLY=1; shift ;; --dest) DEST="$2"; shift 2 ;;
  *) echo "unknown argument: $1" >&2; exit 1 ;; esac; done

HOOK="$DEST/hooks/log-skill-use.sh"
[ -f "$HOOK" ] || { echo "ERROR: $HOOK not found. Deploy it first." >&2; exit 1; }
chmod +x "$HOOK" 2>/dev/null
S="$DEST/settings.json"
[ -f "$S" ] || { echo "ERROR: no $S" >&2; exit 1; }

OUT=$(python3 - "$S" "$HOOK" "$APPLY" <<'PY'
import json, sys
path, hook, apply = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
d = json.load(open(path))
hooks = d.setdefault("hooks", {})
pre = hooks.setdefault("PreToolUse", [])
cmd = "bash " + hook
if any(h.get("command") == cmd for g in pre if isinstance(g, dict) for h in g.get("hooks", [])):
    print("ALREADY"); raise SystemExit
grp = next((g for g in pre if isinstance(g, dict) and g.get("matcher") == "Skill"), None)
entry = {"type": "command", "command": cmd, "timeout": 5}
if grp:
    grp.setdefault("hooks", []).append(entry)
else:
    pre.append({"matcher": "Skill", "hooks": [entry]})
if apply:
    json.dump(d, open(path, "w"), indent=2)
print("ADDED")
PY
)
case "$OUT" in
  ALREADY) echo "  [skip] already registered" ;;
  ADDED)   [ "$APPLY" -eq 1 ] && echo "  [done] registered PreToolUse matcher=Skill -> log-skill-use.sh" \
                              || echo "  [would] register PreToolUse matcher=Skill -> log-skill-use.sh" ;;
  *) echo "  ERROR: $OUT" >&2; exit 1 ;;
esac
[ "$APPLY" -eq 1 ] && echo "  Restart Claude Code, then: grep skill-invoked $DEST/hook-audit.log"
exit 0
