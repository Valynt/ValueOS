#!/usr/bin/env bash
# scripts/ci/infra-contract.sh
#
# Enforces Infra Agent Contract items 1–5 (automatable portions):
# 1) Runtime proof: dx reaches "All Services Ready" within timeout
# 2) Fail-fast over masking: forbid stub markers
# 3) Validation required: validate-imports=0, typecheck passes, node --check for large changed JS files
# 4) Verify files you depend on: hardcoded path existence checks for common infra refs
# 5) Spec is authoritative: (limited automation) require explicit spec acknowledgement when SPEC_REQUIRED=1

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

die() { echo "ERROR: $*" >&2; exit 1; }
note() { echo "INFO: $*" >&2; }

# -----------------------------
# Determine base range (for PRs)
# -----------------------------
BASE_REF=""
if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
  BASE_REF="origin/${GITHUB_BASE_REF}"
  note "Detected PR base ref: ${BASE_REF}"
  git fetch --no-tags --prune --depth=50 origin "${GITHUB_BASE_REF}" || true
else
  note "No GITHUB_BASE_REF set; using HEAD~1 as base (best-effort)."
  BASE_REF="HEAD~1"
fi

BASE_SHA="$(git rev-parse "${BASE_REF}" 2>/dev/null || true)"
HEAD_SHA="$(git rev-parse HEAD)"

if [[ -z "${BASE_SHA}" ]]; then
  note "Could not resolve BASE_REF=${BASE_REF}. Falling back to empty diff range."
  CHANGED_FILES=""
else
  CHANGED_FILES="$(git diff --name-only "${BASE_SHA}...${HEAD_SHA}" || true)"
fi

# --------------------------------
# (2) Forbid auto-generated stubs
# --------------------------------
note "Checking for forbidden stub markers…"
if command -v rg >/dev/null 2>&1; then
  if rg -n "Auto-generated stub for missing module" -S . >/dev/null; then
    rg -n "Auto-generated stub for missing module" -S . | head -n 50 >&2
    die "Forbidden stub marker found. Stubs are not allowed."
  fi
else
  if grep -RIn --exclude-dir=node_modules "Auto-generated stub for missing module" . >/dev/null; then
    grep -RIn --exclude-dir=node_modules "Auto-generated stub for missing module" . | head -n 50 >&2
    die "Forbidden stub marker found. Stubs are not allowed."
  fi
fi
note "Stub marker check: PASS"

# --------------------------------------------------------
# (3) validate-imports + typecheck + node --check (large JS)
# --------------------------------------------------------
note "Running dx:validate-imports…"
pnpm run dx:validate-imports

note "Running TypeScript typecheck…"
pnpm -w typecheck

# Node syntax check only applies to JS-family files (node --check doesn't parse TS).
# Enforce it for large (>200 lines) changed infra JS files.
note "Running node --check on large changed infra JS files…"
if [[ -n "${CHANGED_FILES}" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    # only infra-ish locations + JS-family
    case "$f" in
      scripts/*|scripts/**/*|packages/*/scripts/*|packages/*/scripts/**/*|infra/*|infra/**/*|deploy/*|deploy/**/*)
        ;;
      *)
        continue
        ;;
    esac

    case "$f" in
      *.js|*.mjs|*.cjs) ;;
      *) continue ;;
    esac

    [[ -f "$f" ]] || continue
    lines="$(wc -l < "$f" | tr -d ' ')"
    if [[ "${lines}" -gt 200 ]]; then
      note "node --check $f (${lines} lines)"
      node --check "$f"
    fi
  done <<< "$CHANGED_FILES"
fi
note "Validation gates: PASS"

# --------------------------------------------------------
# (4) Verify referenced infra files exist (common hard refs)
# --------------------------------------------------------
# This is a pragmatic (not perfect) detector for "new hardcoded paths":
# - It searches for common compose/config path patterns in changed files
# - Then verifies those paths exist in the repo
note "Verifying referenced infra file paths in changed files…"
TMP_REFS="$(mktemp)"
touch "$TMP_REFS"

extract_paths_from_file() {
  local file="$1"
  # Extract common infra path patterns, tolerant to quotes.
  # Add patterns as your repo conventions evolve.
  if command -v rg >/dev/null 2>&1; then
    rg -oN \
      '(infra/[A-Za-z0-9._/\-]+(\.ya?ml|\.json|\.toml)|deploy/[A-Za-z0-9._/\-]+(\.ya?ml|\.json|\.toml)|config/[A-Za-z0-9._/\-]+(\.ya?ml|\.json|\.toml))' \
      "$file" 2>/dev/null || true
  else
    grep -oE \
      '(infra/[A-Za-z0-9._/\-]+(\.ya?ml|\.json|\.toml)|deploy/[A-Za-z0-9._/\-]+(\.ya?ml|\.json|\.toml)|config/[A-Za-z0-9._/\-]+(\.ya?ml|\.json|\.toml))' \
      "$file" 2>/dev/null || true
  fi
}

if [[ -n "${CHANGED_FILES}" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    [[ -f "$f" ]] || continue
    # Only scan code/config files (avoid binaries)
    case "$f" in
      *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.yml|*.yaml|*.toml|*.md)
        extract_paths_from_file "$f" >> "$TMP_REFS"
        ;;
      *)
        ;;
    esac
  done <<< "$CHANGED_FILES"
fi

sort -u "$TMP_REFS" -o "$TMP_REFS"

if [[ -s "$TMP_REFS" ]]; then
  while IFS= read -r p; do
    [[ -z "$p" ]] && continue
    if [[ ! -e "$p" ]]; then
      echo "Missing referenced path: $p" >&2
      die "Hardcoded path reference does not exist: $p"
    fi
  done < "$TMP_REFS"
fi
rm -f "$TMP_REFS"
note "Referenced path existence: PASS"

# --------------------------------------------------------
# (1) Runtime proof: dx reaches "All Services Ready"
# --------------------------------------------------------
DX_TIMEOUT_SECONDS="${DX_TIMEOUT_SECONDS:-300}" # default 5 min
DX_CMD="${DX_CMD:-pnpm run dx --mode local}"

note "Running runtime proof: '${DX_CMD}' (timeout=${DX_TIMEOUT_SECONDS}s)…"
DX_LOG="$(mktemp)"
set +e
timeout "${DX_TIMEOUT_SECONDS}" bash -lc "${DX_CMD}" 2>&1 | tee "$DX_LOG"
DX_EXIT="${PIPESTATUS[0]}"
set -e

# We accept timeout exit (124) IF the banner appears (dx keeps running).
if grep -q "All Services Ready" "$DX_LOG"; then
  note "Runtime proof: PASS (banner observed)"
else
  echo "---- dx log (tail) ----" >&2
  tail -n 200 "$DX_LOG" >&2 || true
  rm -f "$DX_LOG"
  die "Runtime proof failed: did not observe 'All Services Ready' within ${DX_TIMEOUT_SECONDS}s (exit=${DX_EXIT})."
fi
rm -f "$DX_LOG"

# --------------------------------------------------------
# (5) Spec authoritative (limited automation)
# --------------------------------------------------------
# Fully enforcing "spec is authoritative" is not purely automatable.
# This gate requires an explicit acknowledgement in CI when a spec was provided.
# Enable by setting SPEC_REQUIRED=1 and SPEC_ACK_TOKEN to a non-empty value.
if [[ "${SPEC_REQUIRED:-0}" == "1" ]]; then
  [[ -n "${SPEC_ACK_TOKEN:-}" ]] || die "SPEC_REQUIRED=1 but SPEC_ACK_TOKEN is empty. Provide an acknowledgement token in CI."
  note "Spec acknowledgement gate: PASS (SPEC_REQUIRED=1 and SPEC_ACK_TOKEN provided)"
else
  note "Spec acknowledgement gate: SKIP (SPEC_REQUIRED!=1)"
fi

note "Infra Agent Contract checks: ALL PASS"
