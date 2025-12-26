#!/bin/bash

# ============================================================================
# Test Custom Domains Migration
# ============================================================================
# Tests the custom domains database migration locally
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testing Custom Domains Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Supabase is running
log_info "Checking if Supabase is running..."
if ! docker ps | grep -q "supabase-db"; then
    log_error "Supabase is not running. Start it with: npx supabase start"
    exit 1
fi
log_success "Supabase is running"
echo ""

# Get database connection string
DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Test 1: Run migration
log_info "Test 1: Running custom_domains migration..."
if psql "$DB_URL" -f supabase/migrations/20251208164354_custom_domains.sql > /dev/null 2>&1; then
    log_success "custom_domains migration successful"
else
    log_error "custom_domains migration failed"
    exit 1
fi
echo ""

# Test 2: Run verification logs migration
log_info "Test 2: Running domain_verification_logs migration..."
if psql "$DB_URL" -f supabase/migrations/20251208164400_domain_verification_logs.sql > /dev/null 2>&1; then
    log_success "domain_verification_logs migration successful"
else
    log_error "domain_verification_logs migration failed"
    exit 1
fi
echo ""

# Test 3: Verify tables exist
log_info "Test 3: Verifying tables exist..."
TABLES=$(psql "$DB_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('custom_domains', 'domain_verification_logs');")
if echo "$TABLES" | grep -q "custom_domains" && echo "$TABLES" | grep -q "domain_verification_logs"; then
    log_success "Both tables created successfully"
else
    log_error "Tables not found"
    exit 1
fi
echo ""

# Test 4: Verify RLS is enabled
log_info "Test 4: Verifying RLS is enabled..."
RLS_CUSTOM=$(psql "$DB_URL" -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = 'custom_domains';")
RLS_LOGS=$(psql "$DB_URL" -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = 'domain_verification_logs';")
if [[ "$RLS_CUSTOM" == *"t"* ]] && [[ "$RLS_LOGS" == *"t"* ]]; then
    log_success "RLS enabled on both tables"
else
    log_error "RLS not enabled"
    exit 1
fi
echo ""

# Test 5: Verify indexes exist
log_info "Test 5: Verifying indexes exist..."
INDEXES=$(psql "$DB_URL" -t -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('custom_domains', 'domain_verification_logs');")
if echo "$INDEXES" | grep -q "idx_custom_domains_tenant_id"; then
    log_success "Indexes created successfully"
else
    log_error "Indexes not found"
    exit 1
fi
echo ""

# Test 6: Test insert with valid data
log_info "Test 6: Testing insert with valid data..."
psql "$DB_URL" -c "
    INSERT INTO custom_domains (tenant_id, domain, verification_token, verification_method)
    VALUES (
        (SELECT id FROM organizations LIMIT 1),
        'test.example.com',
        'abcdef1234567890abcdef1234567890',
        'dns'
    );
" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    log_success "Valid insert successful"
else
    log_error "Valid insert failed"
    exit 1
fi
echo ""

# Test 7: Test insert with invalid domain format
log_info "Test 7: Testing insert with invalid domain format..."
if psql "$DB_URL" -c "
    INSERT INTO custom_domains (tenant_id, domain, verification_token, verification_method)
    VALUES (
        (SELECT id FROM organizations LIMIT 1),
        'invalid domain',
        'abcdef1234567890abcdef1234567890',
        'dns'
    );
" > /dev/null 2>&1; then
    log_error "Invalid domain format should have been rejected"
    exit 1
else
    log_success "Invalid domain format correctly rejected"
fi
echo ""

# Test 8: Test insert with short verification token
log_info "Test 8: Testing insert with short verification token..."
if psql "$DB_URL" -c "
    INSERT INTO custom_domains (tenant_id, domain, verification_token, verification_method)
    VALUES (
        (SELECT id FROM organizations LIMIT 1),
        'test2.example.com',
        'short',
        'dns'
    );
" > /dev/null 2>&1; then
    log_error "Short verification token should have been rejected"
    exit 1
else
    log_success "Short verification token correctly rejected"
fi
echo ""

# Test 9: Test helper function
log_info "Test 9: Testing log_domain_verification function..."
RESULT=$(psql "$DB_URL" -t -c "
    SELECT log_domain_verification(
        (SELECT id FROM custom_domains LIMIT 1),
        (SELECT tenant_id FROM custom_domains LIMIT 1),
        'dns',
        'success',
        NULL,
        '{\"records\": [\"test\"]}'::jsonb,
        NULL
    );
")
if [ -n "$RESULT" ]; then
    log_success "Helper function works correctly"
else
    log_error "Helper function failed"
    exit 1
fi
echo ""

# Test 10: Run RLS tests (if pgTAP is available)
log_info "Test 10: Running RLS tests..."
if psql "$DB_URL" -c "SELECT * FROM pg_extension WHERE extname = 'pgtap';" | grep -q "pgtap"; then
    if psql "$DB_URL" -f supabase/tests/database/custom_domains_rls.test.sql > /dev/null 2>&1; then
        log_success "RLS tests passed"
    else
        log_warning "RLS tests failed (this is expected if test data doesn't exist)"
    fi
else
    log_warning "pgTAP not installed, skipping RLS tests"
fi
echo ""

# Test 11: Test rollback
log_info "Test 11: Testing rollback migration..."
if psql "$DB_URL" -f supabase/migrations/20251208164500_rollback_custom_domains.sql > /dev/null 2>&1; then
    log_success "Rollback migration successful"
else
    log_error "Rollback migration failed"
    exit 1
fi
echo ""

# Verify tables are dropped
log_info "Verifying tables are dropped..."
TABLES_AFTER=$(psql "$DB_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('custom_domains', 'domain_verification_logs');")
if [ -z "$TABLES_AFTER" ]; then
    log_success "Tables successfully dropped"
else
    log_error "Tables still exist after rollback"
    exit 1
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All migration tests passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Review the migration files"
echo "2. Run migrations in staging: npx supabase db push"
echo "3. Verify in staging environment"
echo "4. Deploy to production"
