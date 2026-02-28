#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

log() { echo "[ops-metadata] $*"; }
fail() { echo "[ops-metadata] ERROR: $*" >&2; exit 1; }

resolve_range() {
  local base="${OPS_METADATA_BASE:-}"
  local head="${OPS_METADATA_HEAD:-HEAD}"

  if [[ -n "$base" ]]; then
    echo "$base...$head"
    return
  fi

  if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    git fetch --no-tags --depth=100 origin "${GITHUB_BASE_REF}" >/dev/null 2>&1 || true
    echo "origin/${GITHUB_BASE_REF}...$head"
    return
  fi

  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    echo "HEAD~1...$head"
    return
  fi

  echo ""
}

is_placeholder() {
  local value="${1,,}"
  [[ -z "$value" || "$value" =~ ^(tbd|todo|unknown|none|n/a|-)$ ]]
}

DIFF_RANGE="$(resolve_range)"
if [[ -n "$DIFF_RANGE" ]]; then
  CHANGED_FILES="$(git diff --name-only "$DIFF_RANGE" || true)"
else
  CHANGED_FILES="$(git ls-files || true)"
fi

TARGET_FILES=()
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  [[ -f "$file" ]] || continue
  case "$file" in
    infra/k8s/*|docs/runbooks/*)
      TARGET_FILES+=("$file")
      ;;
  esac
done <<< "$CHANGED_FILES"

if [[ ${#TARGET_FILES[@]} -eq 0 ]]; then
  log "No changed infra/k8s or docs/runbooks files detected. Skipping."
  exit 0
fi

mkdir -p artifacts/ops-metadata
REPORT_FILE="artifacts/ops-metadata/ops-metadata-report.jsonl"
: > "$REPORT_FILE"

missing=0
for file in "${TARGET_FILES[@]}"; do
  owner=""
  labels=""

  case "$file" in
    *.md)
      owner="$(sed -nE 's/^Owner:[[:space:]]+(.+)$/\1/p' "$file" | head -n1 || true)"
      labels="$(sed -nE 's/^Ops-Labels:[[:space:]]+(.+)$/\1/p' "$file" | head -n1 || true)"
      ;;
    *.yml|*.yaml)
      owner="$(sed -nE 's/^[[:space:]]*ops\.valueos\.io\/owner:[[:space:]]*"?([^"#]+)"?.*/\1/p' "$file" | head -n1 || true)"
      labels="$(sed -nE 's/^[[:space:]]*ops\.valueos\.io\/labels:[[:space:]]*"?([^"#]+)"?.*/\1/p' "$file" | head -n1 || true)"
      ;;
    *)
      owner="$(rg -n --max-count 1 '(Owner:\s+.+|ops\.valueos\.io/owner:\s*.+)' "$file" | cut -d: -f3- || true)"
      labels="$(rg -n --max-count 1 '(Ops-Labels:\s+.+|ops\.valueos\.io/labels:\s*.+)' "$file" | cut -d: -f3- || true)"
      ;;
  esac

  owner_trimmed="$(echo "$owner" | xargs || true)"
  labels_trimmed="$(echo "$labels" | xargs || true)"

  file_ok=1
  owner_error=""
  labels_error=""

  if is_placeholder "$owner_trimmed"; then
    owner_error="missing_or_placeholder"
    file_ok=0
  fi

  if is_placeholder "$labels_trimmed"; then
    labels_error="missing_or_placeholder"
    file_ok=0
  fi

  if [[ "$labels_trimmed" != "" && "$labels_trimmed" != *","* ]]; then
    labels_error="expected_comma_separated_labels"
    file_ok=0
  fi

  if [[ "$file_ok" -eq 0 ]]; then
    echo "[ops-metadata] Missing/invalid required metadata in $file" >&2
    [[ -n "$owner_error" ]] && echo "  - owner: $owner_error" >&2
    [[ -n "$labels_error" ]] && echo "  - labels: $labels_error" >&2
    missing=1
  else
    log "Validated metadata for $file"
  fi

  python3 - <<PY >> "$REPORT_FILE"
import json
print(json.dumps({
  "file": ${file@Q},
  "owner": ${owner_trimmed@Q},
  "labels": ${labels_trimmed@Q},
  "valid": ${file_ok}
}))
PY

done

if [[ "$missing" -ne 0 ]]; then
  fail "Ops metadata policy failed. Add valid owner + labels metadata to all changed infra manifests/runbooks."
fi

log "Ops metadata policy passed."
