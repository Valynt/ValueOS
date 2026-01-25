#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required to run this check." >&2
  exit 1
fi

matches=0

if rg -n --fixed-strings "src/agents/" docs; then
  matches=1
fi

if rg -n --fixed-strings "legacy-restored" docs; then
  matches=1
fi

if rg -n "src/lib/agent-fabric/agents" docs | rg -v "apps/ValyntApp/src/lib/agent-fabric/agents"; then
  matches=1
fi

if [[ ${matches} -ne 0 ]]; then
  echo "Obsolete path references found in docs. Update docs to current paths." >&2
  exit 1
fi

echo "Doc path lint passed."
