#!/usr/bin/env bash
# Helper to run TypeScript on scripts/ only and treat non-script errors as
# external to the failure criteria.  This mirrors the intention of the
# technical debt plan: focus on scripts themselves, not the entire monorepo.
#
# Usage: bash scripts/typecheck-scripts.sh

set -euo pipefail

# Run tsc, capture output (including exit code 0/1)
output=$(tsc -p scripts/tsconfig.json --noEmit 2>&1 || true)

# Filter lines that reference scripts/ paths (they're root-relative because
# tsc prints the absolute file path).  We'll consider such lines as
# script-specific errors.
script_errors=$(echo "$output" | grep -E "(^|\/)scripts\/")

if [ -n "$script_errors" ]; then
  echo "Type errors in scripts/ (failing):"
  echo "$script_errors"
  exit 1
else
  echo "No script-specific type errors." >&2
  # echo the full tsc output for visibility (non-failures)
  if [ -n "$output" ]; then
    echo "(ignoring non-script errors)" >&2
    echo "$output" >&2
  fi
  exit 0
fi
