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
TEST_EXCLUDE='__tests__|\.test\.|\.spec\.'

count_any() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "ERROR: module path does not exist: $path" >&2
    echo "-1"
    return
  fi
  grep -rE "$ANY_PATTERN" "$path" --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -vE "$TEST_EXCLUDE" \
    | wc -l \
    | tr -d ' '
}

# Ceilings — reduce these as debt is paid down. Never raise them.
declare -A CEILINGS=(
  ["packages/backend/src"]=400
  ["apps/ValyntApp/src"]=260
  ["packages/sdui/src"]=180
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
