#!/usr/bin/env bash
# Shared secret scanner. Used by two hooks:
#   PreToolUse Bash(git commit*) -> scan-secrets.sh staged    (before the commit)
#   Stop                         -> scan-secrets.sh worktree  (safety net)
#
# Usage: scan-secrets.sh [staged|worktree]
# Exit 0 = clean. Exit 1 = findings printed to stdout as "path:line: rule".
#
# Suppress a known-false positive by putting this on the line:
#   pragma: allowlist secret

set -uo pipefail
MODE="${1:-worktree}"
MAX_BYTES=${SCAN_MAX_BYTES:-1000000}

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0

# v1 used `git diff --name-only HEAD`, which sees zero untracked files — the
# single most likely place a new secret lands. Include them here.
if [ "$MODE" = "staged" ]; then
  FILES=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)
else
  FILES=$( { git diff --name-only --diff-filter=ACMR HEAD 2>/dev/null
             git ls-files --others --exclude-standard 2>/dev/null; } | sort -u)
fi
[ -z "$FILES" ] && exit 0

# name : case-flag (i = case-insensitive) : soft-flag (1 = apply the placeholder
# filter) : pattern.  High-confidence token shapes are NOT placeholder-filtered:
# a line reading AKIAIOSFODNN7EXAMPLE should still be flagged, because "example"
# appearing somewhere on the line is not evidence the key is fake.
RULES=(
  'AWS access key id::0:(^|[^A-Z0-9])(AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}([^A-Z0-9]|$)'
  'GitHub token::0:(gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{20,})'
  'Anthropic API key::0:sk-ant-[A-Za-z0-9_-]{20,}'
  'OpenAI API key::0:sk-(proj-)?[A-Za-z0-9_-]{20,}'
  'Slack token::0:xox[baprse]-[A-Za-z0-9-]{10,}'
  'Stripe live key::0:(sk|rk)_live_[A-Za-z0-9]{16,}'
  'Google API key::0:AIza[A-Za-z0-9_-]{35}'
  'Private key block::0:-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'JSON Web Token::0:eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  'Hex private key::0:(^|[^0-9a-fA-Fx])0x[0-9a-fA-F]{64}([^0-9a-fA-F]|$)'
  'Bearer token:i:1:bearer[[:space:]]+[A-Za-z0-9_.=-]{25,}'
  'Hardcoded credential:i:1:[a-z_]*(passwd|password|pass|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)[a-z_]*[[:space:]]*[:=][[:space:]]*["'"'"']?[^"'"'"'[:space:]$<{,;)]{10,}'
)

# Values that look like a credential but are not one. Applied only to the two
# soft rules above.
PLACEHOLDER='(process\.env|os\.environ|ENV\[|\$\{|\$\(|<[a-z_]+>|xxx+|\*\*\*|changeme|placeholder|your[-_]|dummy|redacted|deadbeef|0000000000|password123|hunter2)'

FOUND=0
OUT=""
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in
    *.lock|*.min.js|*.min.css|*.map|*.snap) continue ;;
    node_modules/*|dist/*|build/*|vendor/*|.next/*|target/*|coverage/*) continue ;;
    *.example|*.sample|*.template) continue ;;
  esac
  # skip binaries and anything oversized
  grep -Iq . "$f" 2>/dev/null || continue
  sz=$(wc -c <"$f" 2>/dev/null || echo 0)
  [ "$sz" -gt "$MAX_BYTES" ] && continue

  for rule in "${RULES[@]}"; do
    name="${rule%%:*}"; rest="${rule#*:}"
    icase="${rest%%:*}"; rest="${rest#*:}"
    soft="${rest%%:*}"; pat="${rest#*:}"
    # -e is required: several patterns begin with "-" and grep would
    # otherwise parse them as options.
    if [ "$icase" = "i" ]; then gflags="-nEi"; else gflags="-nE"; fi
    while IFS= read -r hit; do
      [ -z "$hit" ] && continue
      ln="${hit%%:*}"; text="${hit#*:}"
      printf '%s' "$text" | grep -qE -e 'pragma: allowlist secret' && continue
      if [ "$soft" = "1" ]; then
        printf '%s' "$text" | grep -qEi -e "$PLACEHOLDER" && continue
      fi
      OUT="${OUT}  $f:$ln  [$name]"$'\n'
      FOUND=1
    done < <(grep $gflags -e "$pat" "$f" 2>/dev/null | head -5)
  done
done <<<"$FILES"

if [ "$FOUND" -eq 1 ]; then
  printf '%s' "$OUT"
  exit 1
fi
exit 0
