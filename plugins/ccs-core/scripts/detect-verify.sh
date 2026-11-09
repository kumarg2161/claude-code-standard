#!/usr/bin/env bash
# Resolve verification commands for this repo, per component.
#
# Handles polyglot repos: a Python/FastAPI service and a TypeScript/Next.js app
# in the same tree are two components, each with its own runner, each reported
# separately. A component is a directory holding a manifest (package.json,
# pyproject.toml, Cargo.toml, go.mod) at the root or up to two levels down.
#
# Precedence:
#   1. $CLAUDE_VERIFY_CMD    single command, wins over everything
#   2. .claude/verify.json   per-repo override (schema below)
#   3. auto-detection
#
# .claude/verify.json — flat (single component):
#   { "test": "...", "lint": "...", "typecheck": "...", "suite": "..." }
# or per-component:
#   { "components": [
#       { "dir": "backend",  "stack": "python", "test": "pytest -q", "lint": "ruff check ." },
#       { "dir": "frontend", "stack": "node",   "test": "npm run test", "typecheck": "npm run typecheck" }
#   ]}
#
# Output: TSV rows `dir<TAB>stack<TAB>kind<TAB>command`, then SOURCE=<origin>.
# Commands are written to run FROM `dir`, not from the repo root.
# Prints UNKNOWN if nothing is detectable. Always exits 0.

set -uo pipefail

row() { printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4"; }

has_script() { # $1=package.json path  $2=script name
  command -v python3 >/dev/null 2>&1 || return 1
  python3 -c '
import sys, json
try:
    d = json.load(open(sys.argv[1]))
    sys.exit(0 if isinstance(d.get("scripts", {}).get(sys.argv[2]), str) else 1)
except Exception:
    sys.exit(1)' "$1" "$2" 2>/dev/null
}

grep_any() { # $1=needle, rest=files -> 0 if found in any existing file
  local needle="$1"; shift
  local f
  for f in "$@"; do
    [ -f "$f" ] && grep -qs -- "$needle" "$f" && return 0
  done
  return 1
}

# ---------------------------------------------------------------- 1. env override
if [ -n "${CLAUDE_VERIFY_CMD:-}" ]; then
  row "." "custom" "suite" "$CLAUDE_VERIFY_CMD"
  echo "SOURCE=env:CLAUDE_VERIFY_CMD"
  exit 0
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT" 2>/dev/null || exit 0

# ---------------------------------------------------------------- 2. repo override
CFG="$ROOT/.claude/verify.json"
if [ -f "$CFG" ] && command -v python3 >/dev/null 2>&1; then
  OUT=$(python3 -c '
import sys, json
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
rows = []
comps = d.get("components")
if isinstance(comps, list) and comps:
    for c in comps:
        if not isinstance(c, dict):
            continue
        dr = c.get("dir", ".") or "."
        st = c.get("stack", "custom") or "custom"
        for kind in ("suite", "typecheck", "lint", "test"):
            v = c.get(kind)
            if isinstance(v, str) and v.strip():
                rows.append(dr + "\t" + st + "\t" + kind + "\t" + v)
else:
    for kind in ("suite", "typecheck", "lint", "test"):
        v = d.get(kind)
        if isinstance(v, str) and v.strip():
            rows.append(".\tcustom\t" + kind + "\t" + v)
if not rows:
    sys.exit(1)
print("\n".join(rows))' "$CFG" 2>/dev/null)
  if [ -n "$OUT" ]; then
    printf '%s\n' "$OUT"
    echo "SOURCE=.claude/verify.json"
    exit 0
  fi
fi

# ---------------------------------------------------------------- 3. auto-detect
find_manifests() { # $1 = manifest filename -> dirs, "." first if present
  [ -f "./$1" ] && echo "."
  find . -mindepth 2 -maxdepth 3 \
    \( -name node_modules -o -name .venv -o -name venv -o -name .git -o -name dist \
       -o -name build -o -name target -o -name .next -o -name __pycache__ \
       -o -name .tox -o -name site-packages \) -prune \
    -o -name "$1" -type f -print 2>/dev/null \
    | sed "s|^\./||; s|/$1\$||" | sort -u
}

FOUND=0
NODE_DIRS=$(find_manifests package.json)
NESTED_NODE=$(printf '%s\n' "$NODE_DIRS" | grep -cv '^\.$' || true)

# --- Node / TypeScript ---
while IFS= read -r d; do
  [ -n "$d" ] || continue
  PJ="$d/package.json"
  [ -f "$PJ" ] || continue

  # Skip a workspace root that only aggregates and has no test script of its own.
  if [ "$d" = "." ] && ! has_script "$PJ" test && [ "$NESTED_NODE" -gt 0 ]; then
    continue
  fi

  # PM runs scripts; PMX runs a locally installed binary. Never `npx`: the bash
  # guard turns npx into an "ask", which an unattended run denies, so the check
  # would silently never execute.
  PM="npm run";  PMX="npm exec --no -- "
  { [ -f "$d/pnpm-lock.yaml" ] || [ -f "./pnpm-lock.yaml" ]; } && { PM="pnpm run"; PMX="pnpm exec "; }
  { [ -f "$d/yarn.lock" ]      || [ -f "./yarn.lock" ]; }      && { PM="yarn";     PMX="yarn "; }
  { [ -f "$d/bun.lockb" ]      || [ -f "./bun.lockb" ]; }      && { PM="bun run";  PMX="bun run "; }

  if has_script "$PJ" test; then
    row "$d" "node" "test" "$PM test"
    FOUND=1
  fi
  has_script "$PJ" lint && row "$d" "node" "lint" "$PM lint"

  if has_script "$PJ" typecheck; then
    row "$d" "node" "typecheck" "$PM typecheck"
  elif has_script "$PJ" type-check; then
    row "$d" "node" "typecheck" "$PM type-check"
  elif [ -f "$d/tsconfig.json" ]; then
    row "$d" "node" "typecheck" "${PMX}tsc --noEmit"
  fi
done <<< "$NODE_DIRS"

# --- Python ---
PY_DIRS=$( { find_manifests pyproject.toml; find_manifests setup.cfg; find_manifests pytest.ini; } | sort -u )
while IFS= read -r d; do
  [ -n "$d" ] || continue
  CFGS="$d/pyproject.toml $d/setup.cfg $d/pytest.ini $d/tox.ini"

  if grep_any pytest $CFGS || [ -d "$d/tests" ] || [ -d "$d/test" ]; then
    if grep_any poetry "$d/pyproject.toml"; then
      row "$d" "python" "test" "poetry run pytest -q"
    else
      row "$d" "python" "test" "pytest -q"
    fi
    FOUND=1
  fi

  if   grep_any ruff   $CFGS; then row "$d" "python" "lint" "ruff check ."
  elif grep_any flake8 $CFGS; then row "$d" "python" "lint" "flake8"
  elif grep_any pylint $CFGS; then row "$d" "python" "lint" "pylint ."
  fi

  if   grep_any mypy    $CFGS; then row "$d" "python" "typecheck" "mypy ."
  elif grep_any pyright $CFGS; then row "$d" "python" "typecheck" "pyright"
  fi
done <<< "$PY_DIRS"

# --- Rust ---
while IFS= read -r d; do
  [ -n "$d" ] || continue
  row "$d" "rust" "test"      "cargo test"
  row "$d" "rust" "lint"      "cargo clippy -- -D warnings"
  row "$d" "rust" "typecheck" "cargo check"
  FOUND=1
done <<< "$(find_manifests Cargo.toml)"

# --- Go ---
while IFS= read -r d; do
  [ -n "$d" ] || continue
  row "$d" "go" "test" "go test ./..."
  row "$d" "go" "lint" "go vet ./..."
  FOUND=1
done <<< "$(find_manifests go.mod)"

# --- Makefile fallback ---
if [ "$FOUND" -eq 0 ] && [ -f Makefile ] && grep -qE '^test:' Makefile; then
  row "." "make" "test" "make test"
  FOUND=1
fi

if [ "$FOUND" -eq 0 ]; then
  echo "UNKNOWN"
  exit 0
fi

echo "SOURCE=auto-detected"
exit 0
