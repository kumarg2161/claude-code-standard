#!/usr/bin/env bash
# Install the team Claude Code standard into your own config directory.
#
#   ./install.sh                 dry run
#   ./install.sh --apply
#   ./install.sh --apply --dest ~/.claude
#
# Safe by default: backs up first, never overwrites an existing file, and
# preserves every key already in your settings.json.
#
# Your CLAUDE.md is assembled as: base/CLAUDE.team.md + your personal section.
# Copy templates/CLAUDE.personal.example.md to CLAUDE.personal.md and edit it
# first — that file is gitignored, so your profile stays yours.

set -uo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
APPLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --dest)  DEST="$2"; shift 2 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

say()  { printf '%s\n' "$*"; }
act()  { if [ "$APPLY" -eq 1 ]; then printf '  [done] %s\n' "$*"; else printf '  [would] %s\n' "$*"; fi; }
skip() { printf '  [skip] %s\n' "$*"; }

# --- source validation: an empty payload must fail loudly, not report success
for d in base pipeline; do
  [ -d "$SRC/$d" ] || { say "ERROR: missing $d/. Run this from inside the cloned repo." >&2; exit 1; }
done
PAYLOAD=$(find "$SRC/base" "$SRC/pipeline" -type f | wc -l)
[ "$PAYLOAD" -ge 30 ] || { say "ERROR: only $PAYLOAD payload files found; clone looks incomplete." >&2; exit 1; }

[ "$APPLY" -eq 1 ] || say "DRY RUN — nothing will be changed. Re-run with --apply."
say ""
say "Repo:        $SRC ($PAYLOAD files)"
say "Destination: $DEST"
say ""

[ "$APPLY" -eq 1 ] && mkdir -p "$DEST"

# --- backup (-h so symlinked configs archive their contents, not the links)
if [ -d "$DEST" ] && [ "$APPLY" -eq 1 ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then
  BK="${DEST%/}.backup-$(date +%Y%m%d-%H%M%S).tar.gz"
  if tar -czhf "$BK" \
        --exclude='*/sessions' --exclude='*/cache' --exclude='*/projects' \
        --exclude='*/daemon*'  --exclude='*/plugins/cache' --exclude='*/file-history' \
        --exclude='*/shell-snapshots' \
        -C "$(dirname "$DEST")" "$(basename "$DEST")" 2>/dev/null; then
    say "Backup: $BK"
  else
    say "ERROR: backup failed. Aborting without changes." >&2
    exit 1
  fi
  say ""
fi

INSTALLED=0
COLLISIONS=0

install_tree() { # $1 = payload root, $2 = label
  local root="$1" label="$2" f rel target
  say "$label"
  while IFS= read -r f; do
    rel="${f#$root/}"
    case "$rel" in CLAUDE.team.md) continue ;; esac   # assembled separately
    target="$DEST/$rel"
    if [ -e "$target" ]; then
      if cmp -s "$f" "$target"; then skip "$rel (identical)"
      else skip "$rel — EXISTS AND DIFFERS, left untouched"; COLLISIONS=$((COLLISIONS+1)); fi
      continue
    fi
    act "install $rel"
    if [ "$APPLY" -eq 1 ]; then
      mkdir -p "$(dirname "$target")"; cp "$f" "$target"
      case "$rel" in *.sh) chmod +x "$target" ;; esac
    fi
    INSTALLED=$((INSTALLED+1))
  done <<< "$(find "$root" -type f | sort)"
  say ""
}

install_tree "$SRC/base"     "Team standard (rules, commands, agents, hooks, skills)"
install_tree "$SRC/pipeline" "Delivery pipeline"

# --- tools
say "Tools"
for t in "$SRC"/tools/*.sh; do
  [ -f "$t" ] || continue
  b="$(basename "$t")"
  if [ -e "$DEST/tools/$b" ] && cmp -s "$t" "$DEST/tools/$b"; then skip "$b (identical)"; continue; fi
  act "install tools/$b"
  if [ "$APPLY" -eq 1 ]; then mkdir -p "$DEST/tools"; cp "$t" "$DEST/tools/$b"; chmod +x "$DEST/tools/$b"; fi
  INSTALLED=$((INSTALLED+1))
done
say ""

# --- CLAUDE.md = team standard + your personal section
say "CLAUDE.md"
PERSONAL="$SRC/CLAUDE.personal.md"
if [ ! -f "$PERSONAL" ]; then
  say "  No CLAUDE.personal.md found. Create it first:"
  say "    cp templates/CLAUDE.personal.example.md CLAUDE.personal.md"
  say "  Installing the team standard alone for now."
  PERSONAL=""
fi
if [ -e "$DEST/CLAUDE.md" ]; then
  skip "CLAUDE.md already exists — left untouched"
  say "        compare: diff '$DEST/CLAUDE.md' <(cat '$SRC/base/CLAUDE.team.md' ${PERSONAL:+\"$PERSONAL\"})"
  COLLISIONS=$((COLLISIONS+1))
else
  act "assemble CLAUDE.md (team standard${PERSONAL:+ + personal section})"
  if [ "$APPLY" -eq 1 ]; then
    { cat "$SRC/base/CLAUDE.team.md"; [ -n "$PERSONAL" ] && { echo; cat "$PERSONAL"; }; } > "$DEST/CLAUDE.md"
  fi
  INSTALLED=$((INSTALLED+1))
fi
say ""

# --- hooks into settings.json, with absolute paths for THIS machine
say "settings.json — hooks"
if ! command -v python3 >/dev/null 2>&1; then
  say "  [skip] python3 not found; register hooks by hand (see README)"
else
  OUT=$(python3 - "$DEST/settings.json" "$DEST" <<'PY'
import json, os, sys
path, dest = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(path):
    try: data = json.load(open(path))
    except Exception: print("PARSE_ERROR"); raise SystemExit(0)

# Absolute paths, generated per machine. `~` is not reliably expanded inside hook
# shells, and a hook whose path fails to resolve fails NON-BLOCKINGLY -- it stays
# listed in /hooks while never running. That is the worst possible failure for a
# safety control, so the path is resolved here instead.
def c(n): return "bash " + os.path.join(dest, "hooks", n)

WANT = {
  "PreToolUse": [("Bash", c("pre-bash-guard.sh"), 5),
                 ("Write|Edit", c("pre-edit-protect-sensitive.sh"), 5),
                 ("Skill", c("log-skill-use.sh"), 5)],
  "Stop":       [(None, c("stop-secret-scan.sh"), 10),
                 (None, c("stop-require-verification.sh"), 10)],
}
hooks, notes = data.get("hooks") or {}, []
def present(ev, cmd):
    return any(h.get("command") == cmd
               for e in hooks.get(ev, []) or [] if isinstance(e, dict)
               for h in e.get("hooks", []) or [] if isinstance(h, dict))

for ev, specs in WANT.items():
    bucket = hooks.setdefault(ev, [])
    for matcher, cmd, timeout in specs:
        if not os.path.exists(cmd.split(" ", 1)[1]):
            notes.append(f"{ev}: SKIPPED {os.path.basename(cmd)} (script not installed)"); continue
        if present(ev, cmd):
            notes.append(f"{ev}: already registered {os.path.basename(cmd)}"); continue
        hook = {"type": "command", "command": cmd, "timeout": timeout}
        grp = next((e for e in bucket if isinstance(e, dict)
                    and e.get("matcher") == matcher and isinstance(e.get("hooks"), list)), None)
        if grp: grp["hooks"].append(hook)
        else:
            new = {"hooks": [hook]}
            if matcher: new["matcher"] = matcher
            bucket.append(new)
        notes.append(f"{ev}: added {os.path.basename(cmd)}")
data["hooks"] = hooks
print("---JSON---"); print(json.dumps(data, indent=2))
print("---NOTES---"); print("\n".join(notes))
PY
)
  if [ "$OUT" = "PARSE_ERROR" ]; then
    say "  [skip] $DEST/settings.json is not valid JSON. Fix it, then re-run."
  else
    printf '%s' "$OUT" | sed -n '/^---NOTES---$/,$p' | sed '1d' | sed 's/^/    - /'
    act "write settings.json (your existing keys preserved)"
    if [ "$APPLY" -eq 1 ]; then
      [ -f "$DEST/settings.json" ] && cp "$DEST/settings.json" "$DEST/settings.json.bak-$(date +%H%M%S)"
      printf '%s' "$OUT" | sed -n '/^---JSON---$/,/^---NOTES---$/p' | sed '1d;$d' > "$DEST/settings.json"
    fi
  fi
fi

say ""
say "---------------------------------------------"
say "Installed: $INSTALLED    Collisions left untouched: $COLLISIONS"
say ""
if [ "$APPLY" -eq 1 ]; then
  say "Next:"
  say "  1. Restart Claude Code completely."
  say "  2. /hooks    — expect PreToolUse: 3, Stop: 2"
  say "  3. Type /    — expect /work, /plan, /verify alongside the team commands"
  say "  4. Prove they run:  $DEST/tools/add-hook-audit.sh --apply   (then restart)"
else
  say "Re-run with --apply."
fi
