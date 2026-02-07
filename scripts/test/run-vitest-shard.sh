#!/usr/bin/env bash
set -euo pipefail

SHARD_INDEX=${1:-0}
SHARD_COUNT=${2:-1}

if [ -z "$SHARD_COUNT" ] || [ "$SHARD_COUNT" -le 0 ]; then
  echo "Invalid SHARD_COUNT: $SHARD_COUNT"
  exit 1
fi

echo "Running shard $SHARD_INDEX/$SHARD_COUNT"

# Find test files tracked by git (fallback to find if none)
mapfile -t files < <(git ls-files '*.test.ts' '*.spec.ts' 2>/dev/null || true)
if [ ${#files[@]} -eq 0 ]; then
  # fallback to find
  while IFS= read -r -d $'' f; do
    files+=("$f")
  done < <(find . -type f \( -name "*.test.ts" -o -name "*.spec.ts" \) -print0)
fi

if [ ${#files[@]} -eq 0 ]; then
  echo "No test files found to shard. Exiting 0."
  exit 0
fi

selected=()
for i in "${!files[@]}"; do
  idx=$((i % SHARD_COUNT))
  if [ "$idx" -eq "$SHARD_INDEX" ]; then
    selected+=("${files[$i]}")
  fi
done

if [ ${#selected[@]} -eq 0 ]; then
  echo "No tests assigned to this shard (index $SHARD_INDEX of $SHARD_COUNT). Exiting 0."
  exit 0
fi

echo "Shard will run ${#selected[@]} files"
# Run vitest with the selected list
pnpm exec vitest run -- ${selected[@]}
