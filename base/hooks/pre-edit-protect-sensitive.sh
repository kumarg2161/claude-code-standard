#!/usr/bin/env bash
# Hook: PreToolUse -> Write|Edit|MultiEdit|NotebookEdit
# Blocks edits to credential and state files.
#
# Fixes vs v1:
#   - Fails closed; uses the current permissionDecision schema.
#   - Substring matching on the full path is gone. v1 blocked
#     src/services/walletService.ts, db/seeds/users.ts and docs/keystore-*.md.
#   - .env.example / .sample / .template are editable again; .env.local is not.
#   - Adds ~/.ssh, ~/.aws, ~/.kube, ~/.gnupg, id_rsa, *.tfvars, secrets/, .npmrc,
#     .netrc — none of which v1 caught.
#   - Lock files ask instead of deny (hand-resolving a conflict is legitimate).

set -uo pipefail

LOG="${CLAUDE_HOOK_LOG:-$HOME/.claude/hook-audit.log}"
FILE_PATH=""

_decide() { # $1=deny|ask $2=reason
  mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
  printf '%s\t%s\t%s\t%s\n' "$(date -Is)" "${1^^}" "$2" "$FILE_PATH" >>"$LOG" 2>/dev/null || true
  jq -nc --arg r "$2" --arg d "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
  printf 'BLOCKED: %s\n' "$2" >&2
  [ "$1" = "deny" ] && exit 2
  exit 0
}
deny() { _decide deny "$1"; }
ask()  { _decide ask  "$1"; }

command -v jq >/dev/null 2>&1 || {
  printf 'BLOCKED: pre-edit-protect-sensitive.sh requires jq (apt install jq).\n' >&2
  exit 2
}

INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" |
  jq -r '.tool_input.file_path // .tool_input.notebook_path // .tool_input.path // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

BASE=$(basename "$FILE_PATH")
LP=$(printf '%s' "$FILE_PATH" | tr '[:upper:]' '[:lower:]')
LB=$(printf '%s' "$BASE" | tr '[:upper:]' '[:lower:]')
m()  { printf '%s' "$2" | grep -qE -- "$1"; }

# ---- templates are fine, real dotenv files are not
if m '^\.env' "$LB"; then
  m '\.(example|sample|template|dist|defaults)$' "$LB" || \
    deny "Cannot edit $BASE. Update .env.example instead and tell me what to set."
fi

# ---- key / certificate material by extension
m '\.(pem|key|p12|pfx|jks|keystore|asc|gpg|ppk|crt|cer|der)$' "$LB" &&
  deny "Cannot edit key/certificate file $BASE."

# ---- SSH keys have no extension
m '^(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\.pub)?$' "$LB" &&
  deny "Cannot edit SSH key $BASE."

# ---- credential directories and dotfiles
m '(^|/)\.(ssh|aws|gnupg|kube|docker|azure|gcloud)(/|$)' "$LP" &&
  deny "Cannot edit files under a credential directory."
m '^(\.npmrc|\.netrc|\.pypirc|\.dockercfg|credentials|config)$' "$LB" &&
  m '(^|/)\.(aws|npm|docker|kube)(/|$)' "$LP" &&
  deny "Cannot edit $BASE."
m '^(\.npmrc|\.netrc|\.pypirc)$' "$LB" && deny "Cannot edit $BASE (may contain auth tokens)."

# ---- secrets directories
m '(^|/)(secrets?|private[-_]keys?|session-keys)/' "$LP" &&
  deny "Cannot edit files under a secrets/ directory."

# ---- wallet / mnemonic, word-bounded so walletService.ts is fine
m '(^|[^a-z])(wallet|keystore)\.(json|dat|db)$' "$LB" &&
  deny "Cannot edit wallet/keystore file $BASE."
m '(^|[-_.])(mnemonic|seed[-_.]?phrase|private[-_.]?key)([-_.]|\.[a-z]+$|$)' "$LB" &&
  deny "Cannot edit $BASE."

# ---- terraform state and variable files
m '^terraform\.tfstate' "$LB" && deny "Cannot edit terraform state."
m '\.tfvars(\.json)?$' "$LB" && ! m '\.(example|sample|template)\.' "$LB" &&
  ask "$BASE often holds secrets."

# ---- lock files: ask, do not hard-block
m '^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|cargo\.lock|poetry\.lock|composer\.lock|go\.sum|uv\.lock)$' "$LB" &&
  ask "Editing $BASE by hand. Usually the package manager should do this."

exit 0
