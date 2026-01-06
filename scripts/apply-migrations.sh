#!/bin/bash
# Apply Database Migrations
# Purpose: Apply all enterprise test infrastructure migrations

set -e  # Exit on error

echo "🚀 Applying Database Migrations..."
echo "=================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo "Please set it with: export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
  exit 1
fi

# Array of migration files in order
migrations=(
  "20260103000001_fix_test_schema.sql"
  "20260103000002_legal_holds.sql"
  "20260103000003_user_deletions.sql"
  "20260103000004_cross_region_transfers.sql"
  "20260103000005_usage_tracking.sql"
  "20260103000006_audit_log_anonymization.sql"
  "20260103000007_retention_policies.sql"
  "20260103000008_tenant_isolation.sql"
  "20260103000009_data_regions.sql"
  "20260103000010_scheduled_jobs.sql"
)

# Migration directory
MIGRATION_DIR="supabase/migrations"

# Counter
total=${#migrations[@]}
current=0

# Apply each migration
for migration in "${migrations[@]}"; do
  current=$((current + 1))
  echo ""
  echo "[$current/$total] Applying: $migration"
  echo "-----------------------------------"
  
  migration_path="$MIGRATION_DIR/$migration"
  
  if [ ! -f "$migration_path" ]; then
    echo "❌ ERROR: Migration file not found: $migration_path"
    exit 1
  fi
  
  # Apply migration
  if psql "$DATABASE_URL" -f "$migration_path" > /dev/null 2>&1; then
    echo "✅ Success: $migration"
  else
    echo "❌ FAILED: $migration"
    echo "Attempting to show error..."
    psql "$DATABASE_URL" -f "$migration_path"
    exit 1
  fi
done

echo ""
echo "=================================="
echo "✅ All migrations applied successfully!"
echo ""

# Verify migrations
echo "🔍 Verifying database schema..."
echo "=================================="

# Check tables
echo ""
echo "📊 Tables created:"
psql "$DATABASE_URL" -c "\dt" | grep -E "(legal_holds|user_deletions|cross_region_transfers|usage_events|usage_quotas|user_consents|security_incidents|data_region_changes|sessions|temp_files|job_execution_history)" || echo "⚠️  Some tables may not be visible"

# Check triggers
echo ""
echo "⚡ Triggers created:"
psql "$DATABASE_URL" -c "SELECT tgname FROM pg_trigger WHERE tgname LIKE '%legal_hold%' OR tgname LIKE '%anonymize%' OR tgname LIKE '%retention%' OR tgname LIKE '%tenant%';" | head -20

# Check functions
echo ""
echo "🔧 Functions created:"
psql "$DATABASE_URL" -c "\df check_usage_quota" 2>/dev/null || echo "⚠️  check_usage_quota not found"
psql "$DATABASE_URL" -c "\df record_usage_event" 2>/dev/null || echo "⚠️  record_usage_event not found"
psql "$DATABASE_URL" -c "\df delete_expired_sessions" 2>/dev/null || echo "⚠️  delete_expired_sessions not found"

# Check scheduled jobs
echo ""
echo "⏰ Scheduled jobs:"
psql "$DATABASE_URL" -c "SELECT jobname, schedule FROM cron.job ORDER BY jobname;" 2>/dev/null || echo "⚠️  pg_cron not available or no jobs scheduled"

echo ""
echo "=================================="
echo "✅ Migration verification complete!"
echo ""
echo "Next steps:"
echo "1. Run tests: npm test -- tests/compliance --run"
echo "2. Check coverage: npm test -- --coverage"
echo "3. Review test results"
echo ""
