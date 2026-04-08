#!/usr/bin/env bash
# CI check: detect unauthorized SUPABASE_SERVICE_ROLE_KEY usage
# Fails if service-role client is created outside approved locations.
#
# Approved locations (service-role:justified):
#   - packages/shared/src/lib/adminSupabase.ts  (singleton factory)
#   - packages/shared/src/lib/supabase.ts       (createServerSupabaseClient)
#   - apps/ValyntApp/src/lib/supabase.ts        (createServerSupabaseClient)
#   - apps/ValyntApp/src/api/auth.ts            (admin auth ops)
#   - packages/backend/src/api/auth.ts          (admin auth ops)
#   - packages/backend/src/workers/             (background workers)
#   - scripts/jobs/                             (cron jobs)
#   - apps/ValyntApp/src/services/billing/WebhookService.ts
#   - apps/ValyntApp/src/services/billing/WebhookRetryService.ts
#   - apps/ValyntApp/src/services/security/APIKeyRotationService.ts
#   - packages/backend/src/services/billing/FinanceExportService.ts
#   - packages/backend/src/services/metering/UsageSink.ts

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

APPROVED_PATTERNS=(
  "packages/shared/src/lib/adminSupabase.ts"
  "packages/shared/src/lib/supabase.ts"
  "packages/shared/src/lib/env.ts"
  "packages/shared/src/lib/SemanticMemory.ts"
  "packages/shared/src/config/server-config.ts"
  "apps/ValyntApp/src/lib/supabase.ts"
  "apps/ValyntApp/src/lib/env.ts"
  "apps/ValyntApp/src/config/"
  "apps/ValyntApp/src/api/auth.ts"
  "packages/backend/src/api/auth.ts"
  "packages/backend/src/workers/"
  "packages/backend/src/services/security/"
  "packages/backend/src/config/secretsManager.ts"
  "packages/backend/src/config/secrets/"
  "packages/backend/src/middleware/rbac.ts"
  "packages/backend/src/middleware/planEnforcementMiddleware.ts"
  "packages/backend/src/services/UserProfileDirectoryService.ts"
  "packages/backend/src/services/SecurityAuditService.ts"
  "scripts/jobs/"
  "scripts/app/api/security/"
  "packages/backend/src/services/IntegrationControlService.ts"
  "packages/backend/src/services/AdminUserService.ts"
  "packages/backend/src/services/AdminRoleService.ts"
  "packages/backend/src/services/AuditLogService.ts"
  "packages/backend/src/services/AuthDirectoryService.ts"
  "packages/backend/src/services/consentRegistry.ts"
  "packages/backend/src/services/TenantProvisioning.ts"
  "packages/backend/src/services/crm/"
  "apps/ValyntApp/src/services/billing/WebhookService.ts"
  "apps/ValyntApp/src/services/billing/WebhookRetryService.ts"
  "apps/ValyntApp/src/services/security/APIKeyRotationService.ts"
  "packages/backend/src/services/billing/FinanceExportService.ts"
  "packages/backend/src/services/metering/UsageSink.ts"
  # repositories/ and lib/agent-fabric/agents/ are intentionally excluded from
  # APPROVED_PATTERNS. Every service_role usage in those directories must carry
  # an explicit "service-role:justified <reason>" comment at the call site.
  # This forces per-callsite review and prevents silent accumulation of bypasses.

  # Backend infrastructure (lib, config, env)
  # Note: repositories/ and lib/agent-fabric/agents/ are intentionally excluded.
  # Every service_role usage in those directories must carry an explicit
  # "service-role:justified <reason>" comment at the call site.
  "packages/backend/src/lib/supabase.ts"
  "packages/backend/src/lib/env.ts"
  "packages/backend/src/lib/supabase/privileged/"
  "packages/backend/src/config/schema.ts"
  "packages/backend/src/config/settings.ts"
  "packages/backend/src/config/validateEnv.ts"
  "packages/backend/src/config/env-validation.ts"
  "packages/backend/src/services/LLMCostTracker.ts"
  "packages/backend/src/services/llm/LLMCostTracker.ts"
  "packages/backend/src/services/metering/UsageAggregator.ts"
  "packages/backend/src/services/secrets/TenantSecretRepository.ts"
  "packages/backend/src/middleware/auth.ts"
  "packages/backend/src/api/health/"
  "packages/backend/src/runtime/approval-inbox/"
  "packages/backend/src/services/integrity/ValueIntegrityService.ts"
  "apps/ValyntApp/src/lib/supabase.server.ts"
  "packages/shared/src/lib/tenantVerification.ts"

  # Backend API routes
  # Note: repositories/ and agents/ are NOT in this list — those paths require
  # an explicit "service-role:justified" comment at every call site instead.
  "packages/backend/src/api/billing/webhooks.ts"
  "packages/backend/src/api/customer/"
  "packages/backend/src/api/conversations/"
  "packages/backend/src/api/valueCases/"
  "packages/backend/src/api/valueDrivers/"
  "packages/backend/src/api/artifacts/"
  "packages/backend/src/api/dataSubjectRequests.ts"
  "packages/backend/src/api/services/ReferralAnalyticsService.ts"
  "packages/backend/src/api/services/ReferralService.ts"

  # ValyntApp mirrors of approved backend services
  "apps/ValyntApp/src/services/AdminUserService.ts"
  "apps/ValyntApp/src/services/AuditLogService.ts"
  "apps/ValyntApp/src/services/IntegrationControlService.ts"
  "apps/ValyntApp/src/services/SecurityAuditService.ts"
  "apps/ValyntApp/src/services/TenantProvisioning.ts"
  "apps/ValyntApp/src/services/UsageTrackingService.ts"
  "apps/ValyntApp/src/services/billing/UsageMeteringService.ts"
  "apps/ValyntApp/src/services/metering/"
  "apps/ValyntApp/src/api/billing/webhooks.ts"
  "apps/ValyntApp/src/middleware/planEnforcementMiddleware.ts"

  # Domain services
  "packages/services/domain-validator/src/config.ts"
  "packages/services/domain-validator/src/database.ts"

  # Ops backend
  "ops/backend/"

  # Scripts (migrations, seeds, security tools)
  "scripts/beta-provision.ts"
  "scripts/migration/"
  "scripts/security-hammer"
  "scripts/seed-"
  "scripts/test-"
  "scripts/verify/"
)

# Patterns that indicate direct service-role client creation.
# createServiceRoleSupabaseClient is included so direct calls (not just the
# deprecated shim) are caught in repositories/ and agents/ without justification.
SEARCH_PATTERNS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "supabaseServiceRoleKey"
  "serviceRoleKey"
  "createServerSupabaseClient"
  "createServiceRoleSupabaseClient"
  "getAdminSupabaseClient"
  "getServerSupabase"
)

violations=0

for pattern in "${SEARCH_PATTERNS[@]}"; do
  while IFS= read -r match; do
    [ -z "$match" ] && continue

    file="${match%%:*}"
    # Strip repo root prefix
    rel="${file#"$REPO_ROOT/"}"

    # Skip non-source files and test infrastructure
    case "$rel" in
      *.test.ts|*.spec.ts|*.test.js|*.spec.js|*.bench.ts|*.bench.js|*.md|*.sql|*.sh|*.json|*.d.ts|*.js.map|*.d.ts.map) continue ;;
      */__benchmarks__/*|*/__tests__/*|*/benchmarks/*|*/test/*) continue ;;
      */__mocks__/*|*/mocks/*|*vitest.config*|*jest.config*) continue ;;
      node_modules/*|.windsurf/*|*/node_modules/*) continue ;;
      tests/*|scripts/legacy/*|scripts/test-*|scripts/seed-*|scripts/verify/*) continue ;;
    esac

    # Skip compiled output directories
    case "$rel" in
      */dist/*|*/build/*|*.js) continue ;;
    esac

    approved=false
    for allowed in "${APPROVED_PATTERNS[@]}"; do
      if [[ "$rel" == *"$allowed"* ]]; then
        approved=true
        break
      fi
    done

    # Also allow files with "service-role:justified" comment
    if grep -q "service-role:justified" "$file" 2>/dev/null; then
      approved=true
    fi

    if [ "$approved" = false ]; then
      echo "VIOLATION: $rel uses '$pattern'"
      violations=$((violations + 1))
    fi
  done < <(grep -rn --include='*.ts' --include='*.js' "$pattern" "$REPO_ROOT" 2>/dev/null || true)
done

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "ERROR: Found $violations unauthorized service-role client usage(s)."
  echo ""
  echo "For files in repositories/ or lib/agent-fabric/agents/:"
  echo "  Add a '// service-role:justified <reason>' comment at the call site."
  echo "  The reason must explain why an RLS client cannot be used."
  echo ""
  echo "For all other files:"
  echo "  1. Refactor to use createRequestSupabaseClient() with the caller's JWT"
  echo "  2. Add the file to APPROVED_PATTERNS in scripts/check-service-role-usage.sh"
  echo "     (requires team review — do not add repositories/ or agents/ broadly)"
  echo "  3. Add '// service-role:justified <reason>' at the specific call site"
  exit 1
fi

echo "OK: No unauthorized service-role key usage found."
exit 0
