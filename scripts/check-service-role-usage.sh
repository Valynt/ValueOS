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
)

# Patterns that indicate direct service-role client creation
SEARCH_PATTERNS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "supabaseServiceRoleKey"
  "serviceRoleKey"
  "createServerSupabaseClient"
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

    # Skip non-source files
    case "$rel" in
      *.test.ts|*.spec.ts|*.test.js|*.spec.js|*.md|*.sql|*.sh|*.json|*.d.ts|*.js.map|*.d.ts.map) continue ;;
      node_modules/*|.windsurf/*) continue ;;
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
  echo "ERROR: Found $violations unauthorized service-role key usage(s)."
  echo "Either:"
  echo "  1. Refactor to use createRequestSupabaseClient() with user JWT"
  echo "  2. Add file to APPROVED_PATTERNS in this script"
  echo "  3. Add '// service-role:justified' comment with explanation"
  exit 1
fi

echo "OK: No unauthorized service-role key usage found."
exit 0
