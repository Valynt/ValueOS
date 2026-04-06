#!/usr/bin/env bash
# ============================================================================
# tenant-isolation-lint.sh
#
# Static analysis checks for tenant isolation violations.
# Run in CI to catch regressions before merge.
#
# Exit codes:
#   0 — all checks pass
#   1 — one or more violations detected
# ============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$(cd "$(dirname "$0")/../.." && pwd)")"
BACKEND_SRC="$REPO_ROOT/packages/backend/src"
EXIT_CODE=0

red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
warn()  { printf '\033[0;33m%s\033[0m\n' "$1"; }

# ── 1. No production code should import the broken `supabase` proxy ──────────
# S1-01 target files — these must be clean unconditionally.
S1_01_FILES=(
  "$BACKEND_SRC/workers/AlertingRulesWorker.ts"
  "$BACKEND_SRC/runtime/execution-runtime/adapters/WorkflowFailureSupabaseAdapter.ts"
  "$BACKEND_SRC/observability/dataVolume.ts"
  "$BACKEND_SRC/observability/dataFreshness.ts"
)

echo "=== Check 1: No broken 'supabase' proxy imports (S1-01 target files) ==="

PROXY_HITS=$(grep -n "from.*['\"].*lib/supabase\.js['\"]" "${S1_01_FILES[@]}" \
  | grep "import.*{ *supabase *}" || true)

if [ -n "$PROXY_HITS" ]; then
  red "FAIL: S1-01 target files still import the broken 'supabase' proxy:"
  echo "$PROXY_HITS"
  EXIT_CODE=1
else
  green "PASS: S1-01 target files are clean."
fi

# ── 2. No service_role singletons in repository files ────────────────────────
echo ""
echo "=== Check 2: No service_role singletons in repositories ==="

SERVICE_ROLE_IN_REPOS=$(grep -rn "createServiceRoleSupabaseClient\(\)" "$BACKEND_SRC/repositories/" \
  --include="*.ts" \
  | grep -v "__tests__\|\.test\.\|\.spec\." || true)

if [ -n "$SERVICE_ROLE_IN_REPOS" ]; then
  warn "WARN: Repositories using createServiceRoleSupabaseClient() (should migrate to injected clients):"
  echo "$SERVICE_ROLE_IN_REPOS"
  # Not a blocking failure yet — some legacy repos have legitimate use
else
  green "PASS: No service_role singletons in repositories."
fi

# ── 3. DLQ keys must be tenant-scoped ────────────────────────────────────────
echo ""
echo "=== Check 3: DLQ keys are tenant-scoped ==="

GLOBAL_DLQ=$(grep -rn "DLQ_KEY\s*=\s*['\"]dlq:" "$BACKEND_SRC" \
  --include="*.ts" \
  | grep -v "__tests__\|\.test\.\|\.spec\." || true)

if [ -n "$GLOBAL_DLQ" ]; then
  red "FAIL: Global DLQ key found (should use tenant-scoped keys):"
  echo "$GLOBAL_DLQ"
  EXIT_CODE=1
else
  green "PASS: No global DLQ keys."
fi

# ── 4. Supabase queries in repos must include org/tenant filter ──────────────
echo ""
echo "=== Check 4: Repository queries include tenant filter ==="

# Look for .from('<table>').select() without a following .eq('organization_id' or 'tenant_id')
# This is a heuristic check — manual review recommended for flagged files.
REPO_FILES=$(find "$BACKEND_SRC/repositories" -name "*.ts" ! -name "*.test.*" ! -name "*.spec.*" ! -path "*__tests__*" 2>/dev/null || true)

UNFILTERED=0
for f in $REPO_FILES; do
  # Skip type-only or empty files
  if ! grep -q "\.from(" "$f" 2>/dev/null; then
    continue
  fi
  # Check if file has at least one org/tenant filter
  if ! grep -q "organization_id\|tenant_id" "$f" 2>/dev/null; then
    red "FAIL: $f has .from() queries but no organization_id/tenant_id filter"
    UNFILTERED=1
  fi
done

if [ "$UNFILTERED" -eq 0 ]; then
  green "PASS: All repository files with queries include tenant filters."
else
  EXIT_CODE=1
fi

# ── 5. Redis keys in services must include tenant prefix ─────────────────────
echo ""
echo "=== Check 5: Redis cache keys include tenant prefix ==="

# Check for hardcoded Redis keys without tenant scoping (exclude test files)
REDIS_GLOBAL=$(grep -rn '\.set(\s*['"'"'"][a-z]' "$BACKEND_SRC" \
  --include="*.ts" \
  | grep -v "__tests__\|\.test\.\|\.spec\.\|tenant:\|{" \
  | grep -v "node_modules\|dist" || true)

if [ -n "$REDIS_GLOBAL" ]; then
  warn "WARN: Possible global Redis keys (review manually):"
  echo "$REDIS_GLOBAL" | head -10
else
  green "PASS: No obvious global Redis keys."
fi

# ── 6. No deprecated createServerSupabaseClient in S1-02 target files ────────
# S1-02 target files — these must be clean unconditionally.
S1_02_FILES=(
  "$BACKEND_SRC/analytics/ValueLoopAnalytics.ts"
  "$BACKEND_SRC/config/progressiveRollout.ts"
  "$BACKEND_SRC/config/secretsManager.ts"
  "$BACKEND_SRC/workers/CertificateGenerationWorker.ts"
  "$BACKEND_SRC/workers/billingAggregatorWorker.ts"
  "$BACKEND_SRC/workers/ArtifactGenerationWorker.ts"
  "$BACKEND_SRC/lib/memory/SupabaseVectorStore.ts"
  "$BACKEND_SRC/lib/memory/SupabaseSemanticStore.ts"
  "$BACKEND_SRC/observability/dataVolume.ts"
  "$BACKEND_SRC/observability/dataFreshness.ts"
  "$BACKEND_SRC/runtime/approval-inbox/index.ts"
  "$BACKEND_SRC/runtime/execution-runtime/index.ts"
)

echo ""
echo "=== Check 6: Deprecated createServerSupabaseClient (S1-02 target files) ==="

DEPRECATED_HITS=$(grep -n "createServerSupabaseClient" "${S1_02_FILES[@]}" \
  | grep -v "__tests__\|\.test\.\|\.spec\.\|/privileged/" || true)

if [ -n "$DEPRECATED_HITS" ]; then
  red "FAIL: S1-02 target files still use deprecated createServerSupabaseClient:"
  echo "$DEPRECATED_HITS"
  echo "  Migrate to: createWorkerServiceSupabaseClient('justification') | createCronSupabaseClient() | getRequestSupabaseClient(req)"
  echo "  Each replacement must include a '// service-role:justified <reason>' comment."
  EXIT_CODE=1
else
  green "PASS: S1-02 target files are clean."
fi

# Broader repo-wide check — informational only (not a blocking failure until full migration is complete)
echo ""
echo "=== Check 6b: Deprecated createServerSupabaseClient (repo-wide, informational) ==="

REPO_WIDE_HITS=$(grep -rn "createServerSupabaseClient" "$BACKEND_SRC" \
  --include="*.ts" \
  | grep -v "__tests__\|\.test\.\|\.spec\.\|\.mock\.\|supabase\.ts\|supabase/index\.ts\|/privileged/" \
  | grep -v -F "$(printf '%s\n' "${S1_02_FILES[@]}")" \
  | wc -l | tr -d ' ')

if [ "$REPO_WIDE_HITS" -gt 0 ]; then
  warn "WARN: $REPO_WIDE_HITS additional createServerSupabaseClient usages remain in the repo (outside S1-02 scope — migrate in subsequent sprints)."
else
  green "PASS: No remaining createServerSupabaseClient usages outside S1-02 scope."
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
if [ "$EXIT_CODE" -eq 0 ]; then
  green "All tenant isolation checks passed."
else
  red "Tenant isolation violations detected. See above."
fi

exit $EXIT_CODE
