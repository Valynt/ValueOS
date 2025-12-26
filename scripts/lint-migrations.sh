#!/bin/bash

# ============================================================================
# Database Migration Linter
# ============================================================================
# Validates SQL migrations for common issues and best practices
# ============================================================================

set -e

MIGRATIONS_DIR="supabase/migrations"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║           Database Migration Linter                                  ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((CHECKS_WARNING++))
}

check_info() {
    echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

# Check 1: Migrations directory exists
echo "📁 Checking migrations directory..."
if [ -d "$MIGRATIONS_DIR" ]; then
    MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
    check_pass "Found $MIGRATION_COUNT migration files"
else
    check_fail "Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Check 2: Migration naming convention
echo ""
echo "📝 Checking migration naming conventions..."
NAMING_ISSUES=0
for file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        # Should be: YYYYMMDDHHmmss_description.sql
        if [[ ! "$filename" =~ ^[0-9]{14}_.+\.sql$ ]]; then
            check_warn "Migration doesn't follow naming convention: $filename"
            echo "  Expected: YYYYMMDDHHmmss_description.sql"
            NAMING_ISSUES=$((NAMING_ISSUES + 1))
        fi
    fi
done

if [ $NAMING_ISSUES -eq 0 ]; then
    check_pass "All migrations follow naming convention"
fi

# Check 3: No DROP TABLE without IF EXISTS
echo ""
echo "🔍 Checking for unsafe DROP TABLE..."
UNSAFE_DROPS=0
while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    content=$(echo "$line" | cut -d: -f2-)
    if [[ ! "$content" =~ "IF EXISTS" ]]; then
        check_warn "DROP TABLE without IF EXISTS in $(basename $file)"
        echo "  Line: $content"
        UNSAFE_DROPS=$((UNSAFE_DROPS + 1))
    fi
done < <(grep -n "DROP TABLE" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v "rollbacks" || true)

if [ $UNSAFE_DROPS -eq 0 ]; then
    check_pass "No unsafe DROP TABLE statements"
fi

# Check 4: ALTER TABLE ADD COLUMN without IF NOT EXISTS
echo ""
echo "🔍 Checking for unsafe ALTER TABLE ADD COLUMN..."
UNSAFE_ALTERS=0
while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    content=$(echo "$line" | cut -d: -f2-)
    if [[ ! "$content" =~ "IF NOT EXISTS" ]]; then
        check_warn "ALTER TABLE ADD COLUMN without IF NOT EXISTS in $(basename $file)"
        echo "  Line: $content"
        UNSAFE_ALTERS=$((UNSAFE_ALTERS + 1))
    fi
done < <(grep -n "ALTER TABLE.*ADD COLUMN" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v "rollbacks" || true)

if [ $UNSAFE_ALTERS -eq 0 ]; then
    check_pass "No unsafe ALTER TABLE ADD COLUMN statements"
fi

# Check 5: Transaction blocks for large migrations
echo ""
echo "🔍 Checking for transaction blocks in large migrations..."
MISSING_TRANSACTIONS=0
for file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$file" ]; then
        LINE_COUNT=$(wc -l < "$file")
        if [ $LINE_COUNT -gt 100 ]; then
            if ! grep -q "BEGIN;" "$file" || ! grep -q "COMMIT;" "$file"; then
                check_warn "Large migration (${LINE_COUNT} lines) missing transaction block: $(basename $file)"
                MISSING_TRANSACTIONS=$((MISSING_TRANSACTIONS + 1))
            fi
        fi
    fi
done

if [ $MISSING_TRANSACTIONS -eq 0 ]; then
    check_pass "All large migrations have transaction blocks"
fi

# Check 6: Dangerous operations
echo ""
echo "🚨 Checking for dangerous operations..."
DANGEROUS_OPS=0

# DROP DATABASE
if grep -r "DROP DATABASE" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v "rollbacks"; then
    check_fail "Found DROP DATABASE command"
    DANGEROUS_OPS=$((DANGEROUS_OPS + 1))
fi

# TRUNCATE
TRUNCATE_COUNT=$(grep -r "TRUNCATE" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v "rollbacks" | wc -l || echo "0")
if [ $TRUNCATE_COUNT -gt 0 ]; then
    check_warn "Found $TRUNCATE_COUNT TRUNCATE command(s)"
fi

# DROP SCHEMA without IF EXISTS
if grep -r "DROP SCHEMA" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v "IF EXISTS" | grep -v "rollbacks"; then
    check_warn "Found DROP SCHEMA without IF EXISTS"
fi

# ALTER TABLE DROP COLUMN
DROP_COLUMN_COUNT=$(grep -r "ALTER TABLE.*DROP COLUMN" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v "rollbacks" | wc -l || echo "0")
if [ $DROP_COLUMN_COUNT -gt 0 ]; then
    check_warn "Found $DROP_COLUMN_COUNT ALTER TABLE DROP COLUMN command(s)"
fi

if [ $DANGEROUS_OPS -eq 0 ]; then
    check_pass "No critical dangerous operations found"
fi

# Check 7: SQL syntax (basic)
echo ""
echo "🔍 Checking basic SQL syntax..."
SYNTAX_ISSUES=0
for file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$file" ]; then
        # Check for unmatched parentheses
        OPEN_PARENS=$(grep -o "(" "$file" | wc -l)
        CLOSE_PARENS=$(grep -o ")" "$file" | wc -l)
        if [ $OPEN_PARENS -ne $CLOSE_PARENS ]; then
            check_warn "Unmatched parentheses in $(basename $file): $OPEN_PARENS open, $CLOSE_PARENS close"
            SYNTAX_ISSUES=$((SYNTAX_ISSUES + 1))
        fi
        
        # Check for missing semicolons at end of statements
        if ! tail -1 "$file" | grep -q ";"; then
            check_warn "Missing semicolon at end of $(basename $file)"
            SYNTAX_ISSUES=$((SYNTAX_ISSUES + 1))
        fi
    fi
done

if [ $SYNTAX_ISSUES -eq 0 ]; then
    check_pass "No basic syntax issues found"
fi

# Check 8: RLS policies
echo ""
echo "🔒 Checking RLS policies..."
RLS_TABLES=$(grep -r "CREATE TABLE" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l || echo "0")
RLS_POLICIES=$(grep -r "CREATE POLICY\|ALTER TABLE.*ENABLE ROW LEVEL SECURITY" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l || echo "0")

check_info "Found $RLS_TABLES table creations and $RLS_POLICIES RLS policies"

if [ $RLS_TABLES -gt 0 ] && [ $RLS_POLICIES -eq 0 ]; then
    check_warn "Tables created but no RLS policies found - consider adding RLS for security"
fi

# Check 9: Indexes
echo ""
echo "📊 Checking indexes..."
INDEX_COUNT=$(grep -r "CREATE INDEX" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l || echo "0")
check_info "Found $INDEX_COUNT index creations"

if [ $INDEX_COUNT -eq 0 ]; then
    check_warn "No indexes found - consider adding indexes for performance"
fi

# Check 10: Foreign keys
echo ""
echo "🔗 Checking foreign keys..."
FK_COUNT=$(grep -r "FOREIGN KEY\|REFERENCES" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l || echo "0")
check_info "Found $FK_COUNT foreign key references"

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                      Linting Summary                                 ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${YELLOW}Warnings: $CHECKS_WARNING${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
echo ""

# Statistics
echo "📊 Migration Statistics:"
echo "  Total migrations: $MIGRATION_COUNT"
echo "  RLS policies: $RLS_POLICIES"
echo "  Indexes: $INDEX_COUNT"
echo "  Foreign keys: $FK_COUNT"
echo ""

if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Linting failed with $CHECKS_FAILED critical errors${NC}"
    echo ""
    echo "Please fix the critical errors above before committing."
    exit 1
elif [ $CHECKS_WARNING -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Linting passed with $CHECKS_WARNING warnings${NC}"
    echo ""
    echo "Consider addressing the warnings above for better migration quality."
    exit 0
else
    echo -e "${GREEN}✅ All linting checks passed!${NC}"
    echo ""
    echo "Your migrations are ready to commit."
    exit 0
fi
