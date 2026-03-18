#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required to run this check." >&2
  exit 1
fi

BASE_REF=""
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE_REF="origin/main"
elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
  BASE_REF="HEAD~1"
else
  echo "Unable to determine git base for changed-file diff; skipping legacy path import guard."
  exit 0
fi

mapfile -t changed_files < <(git diff --name-only --diff-filter=ACMRT "${BASE_REF}...HEAD")

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "No changed files detected; legacy path import guard passed."
  exit 0
fi

fail=0
for file in "${changed_files[@]}"; do
  [[ -f "$file" ]] || continue

  # Docs and context notes are validated separately.
  if [[ "$file" == docs/* || "$file" == .windsurf/context/* ]]; then
    continue
  fi

  if rg -n --fixed-strings "src/agents/" "$file" >/dev/null; then
    echo "Legacy path detected (src/agents/): $file"
    rg -n --fixed-strings "src/agents/" "$file" || true
    fail=1
  fi

  if rg -n --fixed-strings "src/lib/agent-fabric/" "$file" >/dev/null; then
    echo "Legacy root path detected (src/lib/agent-fabric/*): $file"
    rg -n --fixed-strings "src/lib/agent-fabric/" "$file" || true
    fail=1
  fi

  if rg -n --fixed-strings "packages/agents/" "$file" >/dev/null; then
    echo "Deprecated path detected (packages/agents/*): $file"
    rg -n --fixed-strings "packages/agents/" "$file" || true
    fail=1
  fi
done

if [[ $fail -ne 0 ]]; then
  echo "Legacy path import guard failed. Replace legacy paths with canonical locations." >&2
  exit 1
fi

echo "Legacy path import guard passed."
