#!/usr/bin/env bash
set -euo pipefail

BASE_SHA="${GITHUB_BASE_SHA:-}"
HEAD_SHA="${GITHUB_HEAD_SHA:-${GITHUB_SHA:-HEAD}}"
BEFORE_SHA="${GITHUB_BEFORE_SHA:-}"

if [[ -z "$BASE_SHA" ]]; then
  if [[ -n "$BEFORE_SHA" && "$BEFORE_SHA" != "0000000000000000000000000000000000000000" ]]; then
    BASE_SHA="$BEFORE_SHA"
  else
    BASE_SHA="$(git rev-parse HEAD~1)"
  fi
fi

RANGE="$BASE_SHA...$HEAD_SHA"
echo "Validating ops metadata for changed files in range: $RANGE"

mapfile -t CHANGED_FILES < <(git diff --name-only "$RANGE" -- infra/k8s docs/runbooks)

if [[ ${#CHANGED_FILES[@]} -eq 0 ]]; then
  mapfile -t CHANGED_FILES < <(git diff --name-only -- infra/k8s docs/runbooks)
fi

if [[ ${#CHANGED_FILES[@]} -eq 0 ]]; then
  echo "No changed files under infra/k8s or docs/runbooks; skipping ops metadata check."
  exit 0
fi

FAILURES=0

for file in "${CHANGED_FILES[@]}"; do
  [[ -f "$file" ]] || continue

  case "$file" in
    infra/k8s/*.yml|infra/k8s/*.yaml|infra/k8s/**/*.yml|infra/k8s/**/*.yaml)
      if ! rg -q 'app\.kubernetes\.io/part-of\s*:' "$file"; then
        echo "[FAIL] $file: missing required label app.kubernetes.io/part-of"
        FAILURES=1
      fi
      if ! rg -q '(app\.kubernetes\.io/owner|valynt\.io/ops-owner)\s*:' "$file"; then
        echo "[FAIL] $file: missing required owner label/annotation (app.kubernetes.io/owner or valynt.io/ops-owner)"
        FAILURES=1
      fi
      ;;
    docs/runbooks/*.md|docs/runbooks/**/*.md)
      if ! rg -q '^\*\*Ops Owner\*\*:' "$file"; then
        echo "[FAIL] $file: missing required metadata line '**Ops Owner**:'"
        FAILURES=1
      fi
      if ! rg -q '^\*\*Ops Labels\*\*:' "$file"; then
        echo "[FAIL] $file: missing required metadata line '**Ops Labels**:'"
        FAILURES=1
      fi
      ;;
  esac
done

if [[ "$FAILURES" -ne 0 ]]; then
  echo "Ops metadata policy check failed."
  exit 1
fi

echo "Ops metadata policy check passed."
