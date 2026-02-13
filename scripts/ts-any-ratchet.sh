#!/usr/bin/env bash
# ts-any-ratchet.sh — Enforce declining explicit-any count in CI.
#
# Counts `: any` occurrences in .ts/.tsx source files (excluding tests,
# node_modules, dist, and .d.ts). Fails if the count exceeds the baseline
# stored in ts-any-baseline.json. Run with --update to capture a new baseline.
#
# Usage:
#   bash scripts/ts-any-ratchet.sh          # check mode (CI)
#   bash scripts/ts-any-ratchet.sh --update # capture new baseline

set -euo pipefail

BASELINE_FILE="ts-any-baseline.json"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

count_any() {
  local count
  count=$(grep -rn ':\s*any\b' --include="*.ts" --include="*.tsx" \
    apps/ packages/ src/ 2>/dev/null \
    | grep -v node_modules \
    | grep -v dist \
    | grep -v __tests__ \
    | grep -v '.test\.' \
    | grep -v '.spec\.' \
    | grep -v '\.d\.ts' \
    | wc -l || true)
  echo "$count" | tr -d ' '
}

if [[ "${1:-}" == "--update" ]]; then
  CURRENT=$(count_any)
  cat > "$BASELINE_FILE" <<EOF
{
  "baseline": $CURRENT,
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "target": 100,
  "note": "Run 'bash scripts/ts-any-ratchet.sh --update' after reducing any count"
}
EOF
  echo "Baseline updated: $CURRENT (target: <100)"
  exit 0
fi

# Check mode
if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "ERROR: $BASELINE_FILE not found. Run with --update first."
  exit 1
fi

BASELINE=$(python3 -c "import json; print(json.load(open('$BASELINE_FILE'))['baseline'])")
CURRENT=$(count_any)

echo "TS any count: $CURRENT (baseline: $BASELINE, target: <100)"

if (( CURRENT > BASELINE )); then
  echo "FAIL: any count increased from $BASELINE to $CURRENT. Fix new any usages before merging."
  exit 1
fi

if (( CURRENT < BASELINE )); then
  echo "any count decreased from $BASELINE to $CURRENT. Update baseline: bash scripts/ts-any-ratchet.sh --update"
fi

echo "PASS"
