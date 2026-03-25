#!/usr/bin/env bash
# check-any-count.sh — enforce TypeScript `any` count ceilings per module.
#
# Counts production-only `any` usages (excludes test files) and fails if any
# module exceeds its ceiling. Ceilings are set to current counts; reduce them
# as debt is paid down. Never raise a ceiling — only lower it.
#
# Usage:
#   bash scripts/check-any-count.sh          # check all modules
#   bash scripts/check-any-count.sh --report # print counts without failing

set -euo pipefail

REPORT_ONLY=false
if [[ "${1:-}" == "--report" ]]; then
  REPORT_ONLY=true
fi

# Pattern matches `: any`, `as any`, `<any>` in TypeScript files.
ANY_PATTERN=':[[:space:]]*\bany\b|as[[:space:]]+\bany\b|<any>'
TEST_EXCLUDE='__tests__|/tests/|\.test\.|\.spec\.|\.bench\.'

count_any() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "ERROR: module path does not exist: $path" >&2
    echo "-1"
    return
  fi
  # Use Python for accurate counting — matches the ratchet script's logic exactly.
  # Skips comment lines (// * /*) to avoid false positives in template strings.
  python3 - "$path" <<'PYEOF'
import sys, pathlib, re
root = pathlib.Path(sys.argv[1])
pattern = re.compile(r':\s*any\b|as\s+any\b|<\s*any\s*>')
count = 0
for p in root.rglob('*'):
    if p.suffix not in {'.ts', '.tsx'}: continue
    parts = p.parts
    if any(x in parts for x in ('node_modules', 'dist', '__tests__', '__benchmarks__', 'examples')): continue
    n = p.name
    if n.endswith('.d.ts') or '.test.' in n or '.spec.' in n or '.bench.' in n: continue
    for line in p.read_text(errors='ignore').splitlines():
        s = line.strip()
        if s.startswith('//') or s.startswith('*') or s.startswith('/*'): continue
        if pattern.search(line): count += 1
print(count)
PYEOF
}

# Ceilings — all packages at 0 (full any elimination complete).
declare -A CEILINGS=(
  ["packages/shared"]=0
  ["packages/sdui"]=0
  ["packages/components"]=0
  ["packages/mcp"]=0
  ["apps/ValyntApp"]=0
  ["apps/agentic-ui-pro"]=0
  ["packages/backend"]=0
)

FAILED=false

printf "%-30s %8s %8s %8s\n" "Module" "Count" "Ceiling" "Status"
printf "%-30s %8s %8s %8s\n" "------" "-----" "-------" "------"

for module in "${!CEILINGS[@]}"; do
  ceiling="${CEILINGS[$module]}"
  count=$(count_any "$module")
  if [[ "$count" == "-1" ]]; then
    # count_any already printed an error to stderr
    status="FAIL"
    FAILED=true
  elif (( count > ceiling )); then
    status="FAIL"
    FAILED=true
  else
    status="OK"
  fi
  printf "%-30s %8s %8s %8s\n" "$module" "$count" "$ceiling" "$status"
done

echo ""

if [[ "$FAILED" == "true" ]] && [[ "$REPORT_ONLY" == "false" ]]; then
  echo "FAIL: One or more modules exceed their 'any' ceiling."
  echo "Fix: replace 'any' with 'unknown' + type guards in the files you touch."
  exit 1
fi

if [[ "$FAILED" == "true" ]] && [[ "$REPORT_ONLY" == "true" ]]; then
  echo "REPORT: One or more modules exceed their 'any' ceiling (no failure due to --report)."
elif [[ "$FAILED" == "false" ]]; then
  echo "OK: All modules within 'any' ceilings."
fi
