#!/usr/bin/env bash
# audit-mock-data.sh
# Scans a React/TypeScript src directory for mock data patterns.
# Usage: bash audit-mock-data.sh [src_dir]
# Output: grouped list of files with mock data signals, sorted by signal count.

set -euo pipefail

SRC="${1:-src}"

if [[ ! -d "$SRC" ]]; then
  echo "Error: directory '$SRC' not found" >&2
  exit 1
fi

echo "=== Mock data audit: $SRC ==="
echo ""

# Patterns that indicate hardcoded mock data in React views/hooks
PATTERNS=(
  # Inline arrays of objects (the most common mock pattern)
  'const [a-zA-Z]* = \['
  # Named mock constants
  'MOCK_\|mock_\|mockData\|mockCases\|mockDeals\|mockAgents'
  # Hardcoded UUIDs or IDs
  '"id": "[a-z0-9-]\{8,\}"'
  # Simulated delays (setTimeout in data-fetching context)
  'setTimeout.*resolve'
  # Stub fetch functions
  'async function fetch.*{[^}]*return MOCK\|return mock\|return \[\|return {}'
  # Placeholder data comments
  'TODO.*mock\|FIXME.*mock\|mock data\|placeholder data\|hardcoded'
  # Static arrays assigned to state
  'useState(\[{[^}]*}\])'
)

declare -A FILE_COUNTS

for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r match; do
    file="${match%%:*}"
    FILE_COUNTS["$file"]=$(( ${FILE_COUNTS["$file"]:-0} + 1 ))
  done < <(grep -rn --include="*.tsx" --include="*.ts" -l "$pattern" "$SRC" 2>/dev/null || true)
done

if [[ ${#FILE_COUNTS[@]} -eq 0 ]]; then
  echo "No mock data signals found."
  exit 0
fi

echo "Files with mock data signals (sorted by signal count):"
echo ""

# Sort by count descending
for file in $(for k in "${!FILE_COUNTS[@]}"; do echo "${FILE_COUNTS[$k]} $k"; done | sort -rn | awk '{print $2}'); do
  count="${FILE_COUNTS[$file]}"
  echo "  [$count signals] $file"

  # Show the specific lines for context
  for pattern in "${PATTERNS[@]}"; do
    grep -n "$pattern" "$file" 2>/dev/null | head -3 | while IFS= read -r line; do
      echo "    line ${line%%:*}: $(echo "${line#*:}" | sed 's/^[[:space:]]*//' | cut -c1-80)"
    done
  done
  echo ""
done

echo "Total files flagged: ${#FILE_COUNTS[@]}"
