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

missing=0
for file in "${TARGET_FILES[@]}"; do
  ops_owner=""
  ops_labels=""

  case "$file" in
    *.md)
      ops_owner="$(rg -n --max-count 1 '^Owner:\s+.+$' "$file" || true)"
      ops_labels="$(rg -n --max-count 1 '^Ops-Labels:\s+.+$' "$file" || true)"
      ;;
    *.yml|*.yaml)
      ops_owner="$(rg -n --max-count 1 '^\s*ops\.valueos\.io/owner:\s*.+$' "$file" || true)"
      ops_labels="$(rg -n --max-count 1 '^\s*ops\.valueos\.io/labels:\s*.+$' "$file" || true)"
      ;;
    *)
      ops_owner="$(rg -n --max-count 1 '(Owner:\s+.+|ops\.valueos\.io/owner:\s*.+)' "$file" || true)"
      ops_labels="$(rg -n --max-count 1 '(Ops-Labels:\s+.+|ops\.valueos\.io/labels:\s*.+)' "$file" || true)"
      ;;
  esac

  if [[ -z "$ops_owner" || -z "$ops_labels" ]]; then
    echo "[ops-metadata] Missing required metadata in $file" >&2
    [[ -z "$ops_owner" ]] && echo "  - missing owner metadata" >&2
    [[ -z "$ops_labels" ]] && echo "  - missing ops labels metadata" >&2
    missing=1
  else
    log "Validated metadata for $file"
  fi
done

if [[ "$missing" -ne 0 ]]; then
  fail "Ops metadata policy failed. Add owner + labels metadata to all changed infra manifests/runbooks."
fi

log "Ops metadata policy passed."
