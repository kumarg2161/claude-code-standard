#!/usr/bin/env bash
# Hook: PreToolUse -> Bash
# Blocks dangerous bash commands before they execute.
#
# Design notes:
#   - Fails CLOSED. If jq is missing or input is unparseable, the call is denied.
#   - Never emits permissionDecision:"allow". Staying silent (exit 0, no output)
#     lets the command fall through to your normal permissions rules in
#     settings.json. Emitting "allow" would BYPASS those rules.
#   - Splits compound commands on && || ; | and newlines, then checks each
#     segment. The old ^-anchored rules were bypassed by "echo hi && sudo rm -rf /".
#   - Threat model: catches realistic accidents, not a determined adversary.
#     Any model that wants around this can base64-encode a payload. Tune for
#     low false positives, not for airtightness.

set -uo pipefail

LOG="${CLAUDE_HOOK_LOG:-$HOME/.claude/hook-audit.log}"
COMMAND=""

_log() {
  mkdir -p "$(dirname "$LOG")" 2>/dev/null || return 0
  printf '%s\t%s\t%s\t%s\n' "$(date -Is)" "$1" "$2" "${COMMAND//$'\n'/ }" >>"$LOG" 2>/dev/null || true
}

# Emit a decision and exit. Exit 2 blocks unconditionally on every CLI version;
# the JSON carries the human-readable reason on versions that parse it.
_decide() { # $1=deny|ask  $2=reason
  _log "${1^^}" "$2"
  jq -nc --arg r "$2" --arg d "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
  printf 'BLOCKED: %s\n' "$2" >&2
  [ "$1" = "deny" ] && exit 2
  exit 0
}
deny() { _decide deny "$1"; }
ask()  { _decide ask  "$1"; }

command -v jq >/dev/null 2>&1 || {
  printf 'BLOCKED: pre-bash-guard.sh requires jq and it is not installed (apt install jq).\n' >&2
  exit 2
}

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

low() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
has() { printf '%s' "$2" | grep -qEi -- "$1"; }

LC=$(low "$COMMAND")

# ---------------------------------------------------------------- whole-command
# Piping anything into a shell. Word-boundaried so "ls | shuf" and
# "npm test || shellcheck" are not false positives.
has '\|[[:space:]]*(sudo[[:space:]]+)?(ba|z|k|da|c)?sh([[:space:]]|$)' "$LC" &&
  deny "Piping into a shell is not allowed. Download, inspect, then run."

# Dumping the environment and filtering for secrets. Checked whole-command
# because "env | grep -i secret" splits into two innocent-looking segments.
has '^(env|printenv|set)([[:space:]]|$)' "$LC" && has '(secret|token|key|pass|cred)' "$LC" &&
  deny "Dumping environment secrets is not allowed."

# Reading credentials out of band. Your settings.json Read(...) denies do NOT
# cover this: `cat ~/.aws/credentials` is a Bash call, not a Read call.
SECRET_PATHS='(\.ssh/|\.aws/|\.gnupg/|\.kube/|\.docker/config|\.npmrc|\.netrc|\.pypirc|/secrets?/|\.env($|[^a-z])|\.pem($|[^a-z])|\.p12($|[^a-z])|\.pfx($|[^a-z])|credentials|terraform\.tfstate|id_rsa|id_ed25519|id_ecdsa|keystore|mnemonic|seed[-_.]?phrase)'
READERS='^(cat|bat|less|more|head|tail|strings|xxd|od|hexdump|base64|nl|awk|sed|cp|scp|rsync|tar|zip|openssl)([[:space:]]|$)'

# --------------------------------------------------------------- per segment
SEGMENTS=$(printf '%s' "$COMMAND" | sed -E 's/(\&\&|\|\||;|\|)/\n/g')

while IFS= read -r RAW; do
  seg=$(printf '%s' "$RAW" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
  [ -z "$seg" ] && continue
  s=$(low "$seg")

  # ---- privilege escalation
  has '^(sudo|doas|su)([[:space:]]|$)' "$s" &&
    deny "sudo/su is not allowed. Run privileged commands yourself."

  # ---- recursive delete (any form: -rf, -r -f, --recursive, -R)
  if has '^rm([[:space:]]|$)' "$s"; then
    has '(^|[[:space:]])-[a-z]*[rR][a-z]*([[:space:]]|$)|--recursive' "$seg" &&
      deny "Recursive rm is not allowed. Delete directory trees yourself."
  fi
  has '^shred([[:space:]]|$)' "$s" && deny "shred is not allowed."
  has '^(find|fd)[[:space:]].*(-delete|-exec[[:space:]]+rm)' "$s" &&
    deny "find with -delete/-exec rm is not allowed."
  has '^dd[[:space:]].*of=/dev/' "$s" && deny "dd writing to a device is not allowed."
  has '^mkfs' "$s" && deny "mkfs is not allowed."
  has '^chmod[[:space:]].*(777|a\+rwx)' "$s" && deny "chmod 777 is not allowed."
  has '^truncate[[:space:]].*-s[[:space:]]*0' "$s" && deny "truncate -s 0 is not allowed."

  # ---- reading secrets
  if has "$READERS" "$s" && has "$SECRET_PATHS" "$s"; then
    deny "Reading credential/key material is not allowed. Report the path, not the contents."
  fi
  # Executing a script out of a temp dir: the second half of the
  # "curl -o /tmp/x && bash /tmp/x" pattern that pipe detection misses.
  has '^(ba|z|k|da)?sh([[:space:]]+-[a-z]+)*[[:space:]]+(/tmp/|/var/tmp/|/dev/shm/)' "$s" &&
    deny "Executing a script from a temp directory is not allowed."

  # ---- git, destructive
  has '^git[[:space:]]+push' "$s" && {
    has '(-f([[:space:]]|$)|--force|[[:space:]]\+[a-z0-9_./-]*:?)' "$seg" &&
      deny "Force push is not allowed (including --force-with-lease and + refspecs)."
    has '(^|[/[:space:]:+])(main|master|production|prod|release)([[:space:]]|$|:)' "$s" &&
      deny "Direct push to a protected branch is not allowed."
    has '--delete|:[[:space:]]*$' "$s" && deny "Deleting a remote branch is not allowed."
    # bare `git push` while sitting on a protected branch
    if [ "$s" = "git push" ] || has '^git[[:space:]]+push[[:space:]]+[a-z0-9_-]+([[:space:]]+head)?$' "$s"; then
      br=$(git symbolic-ref --short HEAD 2>/dev/null || true)
      case "$br" in
        main|master|production|prod|release)
          deny "Bare 'git push' while on '$br' would push to a protected branch." ;;
      esac
    fi
  }
  has '^git[[:space:]]+reset[[:space:]].*--hard' "$s" &&
    deny "git reset --hard discards uncommitted work. Do it yourself."
  has '^git[[:space:]]+clean[[:space:]].*-[a-z]*f' "$s" &&
    deny "git clean -f discards untracked work. Do it yourself."
  has '^git[[:space:]]+(filter-branch|filter-repo)' "$s" && deny "History rewriting is not allowed."
  has '^git[[:space:]]+branch[[:space:]]+-D' "$s" && ask "Force-deleting a branch."
  has '^git[[:space:]]+checkout[[:space:]]+--[[:space:]]*\.' "$s" &&
    deny "git checkout -- . discards all local changes."

  # ---- database, only in an execution context (not grep/cat/echo)
  if has '^(psql|mysql|mariadb|mongosh?|sqlite3|sqlcmd|clickhouse-client|redis-cli)([[:space:]]|$)' "$s" ||
     has '(^|[[:space:]])(prisma|sequelize|knex|alembic|typeorm)[[:space:]]+.*(migrate|db)' "$s"; then
    has '(drop[[:space:]]+(table|database|schema|collection)|truncate[[:space:]]+table|flushall|flushdb)' "$s" &&
      deny "Destructive database statement. Run it yourself after review."
    has 'delete[[:space:]]+from' "$s" && ! has 'where' "$s" &&
      deny "DELETE without a WHERE clause."
  fi

  # ---- cloud / infra
  has '^terraform[[:space:]]+destroy' "$s" && deny "terraform destroy is not allowed."
  has '^terraform[[:space:]]+apply' "$s" && ask "terraform apply mutates real infrastructure."
  has '^aws[[:space:]]' "$s" && {
    has '(delete-|terminate-|deregister-|remove-|revoke-|detach-|disable-)' "$s" &&
      ask "Mutating AWS call."
    has '^aws[[:space:]]+s3[[:space:]]+(rm|rb)([[:space:]]|$)' "$s" &&
      deny "aws s3 rm/rb is not allowed."
  }
  has '^kubectl[[:space:]]+(delete|drain|cordon)' "$s" && ask "Mutating cluster call."
  has '^(docker|podman)[[:space:]]+(system[[:space:]]+prune|volume[[:space:]]+rm)' "$s" &&
    deny "Docker prune/volume rm destroys state."

  # ---- arbitrary package execution
  has '^(npx|bunx|uvx)([[:space:]]|$)|^(pnpm|yarn)[[:space:]]+dlx|^pipx[[:space:]]+run' "$s" &&
    ask "Executing a package that is not in your lockfile."

  # ---- outbound data transfer
  if has '^(curl|wget|http|httpie)([[:space:]]|$)' "$s"; then
    has '(-X[[:space:]]*(POST|PUT|PATCH|DELETE)|--request[[:space:]]*(POST|PUT|PATCH|DELETE)|--data|--post-data|--post-file|(^|[[:space:]])-d([[:space:]]|=|'"'"'|")|(^|[[:space:]])-F([[:space:]]|=)|--form|(^|[[:space:]])-T([[:space:]]|=)|--upload-file)' "$seg" &&
      deny "Outbound data transfer is not allowed."
  fi

  # ---- secret scan before a commit is created (the actual moment of risk)
  if has '^git[[:space:]]+commit' "$s"; then
    scan="$HOME/.claude/hooks/scan-secrets.sh"
    if [ -x "$scan" ]; then
      if out=$("$scan" staged 2>&1); then :; else
        deny "Potential secret in staged changes:${out:+ $out}"
      fi
    fi
  fi
done <<<"$SEGMENTS"

# No decision: fall through to your settings.json permissions rules.
exit 0
